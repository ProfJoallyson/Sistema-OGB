// Regras de negócio do sistema: quem pode fazer o quê, validação e histórico.
// As telas chamam só estas funções; o banco fica atrás do repositório.

import { pode, exigir, temPerfil } from '../modelo/perfis.js';
import { VALIDAR, chaves, normalizarEmail, nomeTurma } from '../modelo/esquema.js';
import { serie, ordenarDisciplinas, CAMPOS_PROFESSOR } from '../regras/curriculo.js';
import { calcularBoletim, mediaDaTurma, validarNota, TRIMESTRES } from '../regras/boletim.js';

export const AULAS_POR_DIA = 6; // dia sem passar na catraca = 6 faltas (decisão de 04/11)

const agora = () => new Date().toISOString();
let contador = 0;
export const novoId = (prefixo = '') =>
  prefixo + Date.now().toString(36) + (contador++ % 1296).toString(36).padStart(2, '0') + Math.random().toString(36).slice(2, 6);

const igual = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

export class Sistema {
  constructor(repo, usuario) {
    this.repo = repo;
    this.usuario = usuario;
    this._atrib = null;
    if (repo.observar) repo.observar('atribuicoes', () => { this._atrib = null; });
  }

  // ---------- básico ----------
  async escola() { return (await this.repo.obter('escola', 'config')) || {}; }
  async anoLetivo() { return (await this.escola()).anoLetivo || new Date().getFullYear(); }

  // Professor só vê as turmas em que dá aula; os demais perfis veem todas.
  veTodasAsTurmas() {
    return ['secretaria', 'tesouraria', 'coordenacao', 'direcao', 'admin'].some(p => temPerfil(this.usuario, p));
  }

  async atribuicoes() { return (this._atrib ||= await this.repo.listar('atribuicoes')); }
  async dadosPermissao() { return { atribuicoes: await this.atribuicoes() }; }
  async pode(acao, ctx) { return pode(this.usuario, acao, ctx, await this.dadosPermissao()); }
  async exigir(acao, ctx) { exigir(this.usuario, acao, ctx, await this.dadosPermissao()); }

  // Grava e registra no histórico cada campo que mudou (quem, quando, antes, depois).
  async _gravar(operacoes, acao) {
    const hist = [];
    for (const o of operacoes) {
      const antes = await this.repo.obter(o.colecao, o.id);
      const depois = o.op === 'remover' ? null : o.op === 'atualizar' ? { ...(antes || {}), ...o.dados } : o.dados;
      const campos = new Set([...Object.keys(antes || {}), ...Object.keys(depois || {})]);
      campos.delete('id'); campos.delete('atualizadoEm'); campos.delete('atualizadoPor');
      for (const campo of campos) {
        const a = antes ? antes[campo] : undefined;
        const d = depois ? depois[campo] : undefined;
        if (igual(a, d)) continue;
        hist.push({ op: 'salvar', colecao: 'historico', id: novoId('h'), dados: {
          em: agora(), usuarioId: this.usuario.id, usuarioNome: this.usuario.nome, acao,
          colecao: o.colecao, docId: o.id, campo, antes: a ?? null, depois: d ?? null,
        } });
      }
      if (o.dados) o.dados = { ...o.dados, atualizadoEm: agora(), atualizadoPor: this.usuario.id };
    }
    await this.repo.lote([...operacoes, ...hist]);
    return hist.length;
  }

  async historico(filtro) {
    await this.exigir('historico.ver');
    const h = await this.repo.listar('historico', filtro);
    return h.sort((a, b) => (a.em < b.em ? 1 : -1));
  }

  // ---------- usuários ----------
  async usuarioPorEmail(email) {
    const u = await this.repo.obter('usuarios', chaves.usuario(email));
    return u && u.ativo !== false ? u : null;
  }

  async usuarios() { await this.exigir('usuarios.ver'); return this.repo.listar('usuarios'); }

  async salvarUsuario(u) {
    await this.exigir('usuarios.gerenciar');
    VALIDAR.usuarios(u);
    const email = normalizarEmail(u.email);
    const doc = { nome: u.nome.trim(), email, perfis: [...new Set(u.perfis)], corrigeNotas: !!u.corrigeNotas, ativo: u.ativo !== false };
    if (doc.corrigeNotas && !doc.perfis.includes('secretaria')) doc.corrigeNotas = false;
    await this._gravar([{ op: 'salvar', colecao: 'usuarios', id: chaves.usuario(email), dados: doc }], 'usuario.salvar');
    return { ...doc, id: chaves.usuario(email) };
  }

  // plano = resultado de prepararImportacao() (servicos/importar-usuarios.js)
  async aplicarImportacaoUsuarios(plano) {
    await this.exigir('usuarios.gerenciar');
    if (plano.erros.length) throw new Error('Corrija os erros da planilha antes de importar.');
    const ops = [];
    for (const u of plano.usuarios) {
      VALIDAR.usuarios(u);
      ops.push({ op: 'salvar', colecao: 'usuarios', id: chaves.usuario(u.email), dados: { ...u, email: normalizarEmail(u.email), ativo: true } });
    }
    for (const a of plano.atribuicoes) {
      ops.push({ op: 'salvar', colecao: 'atribuicoes', id: chaves.atribuicao(a.turmaId, a.disciplinaId),
        dados: { turmaId: a.turmaId, disciplinaId: a.disciplinaId, professorId: chaves.usuario(a.email) } });
    }
    await this._gravar(ops, 'usuarios.importar');
    this._atrib = null;
    return { usuarios: plano.usuarios.length, atribuicoes: plano.atribuicoes.length };
  }

  // ---------- turmas, disciplinas, professores ----------
  async turmas(ano) {
    ano ??= await this.anoLetivo();
    let ts = await this.repo.listar('turmas', { ano });
    if (!this.veTodasAsTurmas()) {
      const minhas = new Set((await this.minhasAtribuicoes()).map(a => a.turmaId));
      ts = ts.filter(t => minhas.has(t.id));
    }
    return ts.sort((a, b) => ordemSerie(a) - ordemSerie(b) || a.letra.localeCompare(b.letra))
      .map(t => ({ ...t, nome: nomeTurma(t), modelo: serie(t.serie).modelo }));
  }

  async turma(id) {
    const t = await this.repo.obter('turmas', id);
    return t && { ...t, nome: nomeTurma(t), modelo: serie(t.serie).modelo };
  }

  async salvarTurma(t) {
    await this.exigir('cadastros.editar');
    VALIDAR.turmas(t);
    const id = t.id || `${t.ano}_${t.serie}_${t.letra}`.toLowerCase();
    await this._gravar([{ op: 'salvar', colecao: 'turmas', id, dados: { ...t, disciplinas: ordenarDisciplinas(t.disciplinas) } }], 'turma.salvar');
    return id;
  }

  // Professores para a tela de cadastro (quem tem o perfil Professor).
  async professores() {
    if (!(await this.pode('cadastros.editar')) && !(await this.pode('notas.ver'))) throw new Error('Você não tem permissão para esta ação.');
    return (await this.repo.listar('usuarios')).filter(u => (u.perfis || []).includes('professor') && u.ativo !== false)
      .map(u => ({ id: u.id, nome: u.nome })).sort((a, b) => a.nome.localeCompare(b.nome));
  }

  async minhasAtribuicoes() {
    return (await this.atribuicoes()).filter(a => a.professorId === this.usuario.id);
  }

  async salvarAtribuicao({ turmaId, disciplinaId, professorId }) {
    await this.exigir('cadastros.editar');
    VALIDAR.atribuicoes({ turmaId, disciplinaId, professorId });
    await this._gravar([{ op: 'salvar', colecao: 'atribuicoes', id: chaves.atribuicao(turmaId, disciplinaId), dados: { turmaId, disciplinaId, professorId } }], 'atribuicao.salvar');
    this._atrib = null;
  }

  // ---------- alunos e matrícula ----------
  async alunosDaTurma(turmaId) {
    await this.exigir('alunos.ver', { turmaId });
    const t = await this.repo.obter('turmas', turmaId);
    const ms = (await this.repo.listar('matriculas', { turmaId, ano: t.ano })).filter(m => m.situacao !== 'cancelada');
    const alunos = await Promise.all(ms.map(m => this.repo.obter('alunos', m.alunoId)));
    return ms.map((m, i) => ({ ...alunos[i], matricula: m }))
      .sort((a, b) => (a.matricula.numero || 999) - (b.matricula.numero || 999) || a.nome.localeCompare(b.nome));
  }

  async alunos() {
    await this.exigir('alunos.ver');
    if (!this.veTodasAsTurmas()) {
      throw new Error('Abra pela turma para ver os alunos.');
    }
    return (await this.repo.listar('alunos')).sort((a, b) => a.nome.localeCompare(b.nome));
  }

  async matriculas(ano) {
    await this.exigir('alunos.ver');
    if (!this.veTodasAsTurmas()) throw new Error('Abra pela turma para ver os alunos.');
    return this.repo.listar('matriculas', { ano });
  }

  async aluno(id) {
    const a = await this.repo.obter('alunos', id);
    if (!a) return null;
    const ms = (await this.repo.listar('matriculas', { alunoId: id })).sort((x, y) => y.ano - x.ano);
    const turmaId = ms[0] && ms[0].turmaId;
    await this.exigir('alunos.ver', { turmaId });
    return { ...a, matriculas: ms };
  }

  // A tesouraria faz a matrícula e os dados vão direto para a ficha do aluno.
  async matricular(aluno, { turmaId, numero, bolsa = 'nenhuma', turno }) {
    await this.exigir('matricula.fazer');
    VALIDAR.alunos(aluno);
    const t = await this.repo.obter('turmas', turmaId);
    if (!t) throw new Error('Turma não encontrada.');
    const alunoId = aluno.id || novoId('a');
    const m = { alunoId, turmaId, ano: t.ano, numero: numero ? Number(numero) : await this._proximoNumero(turmaId, t.ano),
      bolsa, turno: turno || t.turno, situacao: 'ativa', matriculadoEm: agora() };
    VALIDAR.matriculas(m);
    const { matriculas, ...dadosAluno } = aluno;
    await this._gravar([
      { op: 'salvar', colecao: 'alunos', id: alunoId, dados: dadosAluno },
      { op: 'salvar', colecao: 'matriculas', id: chaves.matricula(t.ano, alunoId), dados: m },
    ], 'matricula.fazer');
    return alunoId;
  }

  async _proximoNumero(turmaId, ano) {
    const ms = await this.repo.listar('matriculas', { turmaId, ano });
    return ms.reduce((max, m) => Math.max(max, m.numero || 0), 0) + 1;
  }

  async salvarAluno(aluno) {
    await this.exigir('matricula.fazer');
    VALIDAR.alunos(aluno);
    const { matriculas, matricula, ...dados } = aluno;
    await this._gravar([{ op: 'salvar', colecao: 'alunos', id: aluno.id, dados }], 'aluno.salvar');
  }

  async atualizarMatricula(id, parte) {
    await this.exigir('matricula.fazer');
    await this._gravar([{ op: 'atualizar', colecao: 'matriculas', id, dados: parte }], 'matricula.atualizar');
  }

  // ---------- notas ----------
  // trimestre: 't1' | 't2' | 't3'; para a PF use trimestre = null e campo = 'PF'.
  async lancarNota({ turmaId, disciplinaId, alunoId, trimestre, campo, valor }) {
    const turma = await this.repo.obter('turmas', turmaId);
    if (!turma) throw new Error('Turma não encontrada.');
    if (!turma.disciplinas.includes(disciplinaId)) throw new Error('Disciplina não pertence à turma.');
    if (campo === 'PF') trimestre = null;
    else if (!TRIMESTRES.includes(trimestre)) throw new Error('Trimestre inválido.');
    if (campo !== 'PF' && !CAMPOS_PROFESSOR.includes(campo)) throw new Error(`O campo ${campo} não é digitado pelo professor.`);
    await this.exigir('notas.lancar', { turmaId, disciplinaId, campo });
    const v = validarNota(valor, campo);
    const id = chaves.nota(turma.ano, turmaId, disciplinaId, alunoId);
    const doc = (await this.repo.obter('notas', id)) || { ano: turma.ano, turmaId, disciplinaId, alunoId };
    if (trimestre) doc[trimestre] = { ...(doc[trimestre] || {}), [campo]: v };
    else doc.PF = v;
    await this._gravar([{ op: 'salvar', colecao: 'notas', id, dados: doc }], 'nota.lancar');
    return v;
  }

  async notasDaTurma(turmaId, disciplinaId) {
    await this.exigir('notas.ver', { turmaId });
    const filtro = disciplinaId ? { turmaId, disciplinaId } : { turmaId };
    return this.repo.listar('notas', filtro);
  }

  // ---------- simulados ----------
  // tipo: SO | SP | SE (acertos = número) ou SG (acertos = { matematica, natureza, linguagens, humanas })
  async lancarSimulado({ ano, alunoId, trimestre, tipo, acertos }) {
    await this.exigir('simulados.lancar');
    if (!TRIMESTRES.includes(trimestre)) throw new Error('Trimestre inválido.');
    if (!['SO', 'SP', 'SE', 'SG'].includes(tipo)) throw new Error('Tipo de simulado inválido.');
    ano ??= await this.anoLetivo();
    const checar = (n, max) => {
      if (n === null || n === '' || n === undefined) return null;
      const x = Number(n);
      if (!Number.isInteger(x) || x < 0 || x > max) throw new Error(`Acertos inválidos: ${n} (de 0 a ${max}).`);
      return x;
    };
    const valor = tipo === 'SG'
      ? Object.fromEntries(Object.entries(acertos || {}).map(([k, n]) => [k, checar(n, 40)]))
      : checar(acertos, 80);
    const id = chaves.simulado(ano, alunoId, trimestre);
    const doc = (await this.repo.obter('simulados', id)) || { ano, alunoId, trimestre };
    doc[tipo] = tipo === 'SG' ? { ...(doc.SG || {}), ...valor } : valor;
    await this._gravar([{ op: 'salvar', colecao: 'simulados', id, dados: doc }], 'simulado.lancar');
  }

  async simuladosDoAluno(ano, alunoId) {
    const docs = await this.repo.listar('simulados', { ano, alunoId });
    return Object.fromEntries(docs.map(d => [d.trimestre, d]));
  }

  async simuladosDaTurma(turmaId) {
    await this.exigir('notas.ver', { turmaId });
    const t = await this.repo.obter('turmas', turmaId);
    const ids = new Set((await this.repo.listar('matriculas', { turmaId, ano: t.ano })).map(m => m.alunoId));
    const r = {};
    for (const d of await this.repo.listar('simulados', { ano: t.ano })) {
      if (ids.has(d.alunoId)) (r[d.alunoId] ||= {})[d.trimestre] = d;
    }
    return r;
  }

  // ---------- frequência (catraca) ----------
  // Grava o dia: quem estava na lista entrou; quem não estava leva 6 faltas.
  async registrarDia({ data, turmaIds, presentes }) {
    await this.exigir('frequencia.lancar');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) throw new Error('Data inválida.');
    const pres = new Set(presentes);
    const ops = [];
    let ausentes = 0;
    for (const turmaId of turmaIds) {
      const t = await this.repo.obter('turmas', turmaId);
      for (const m of await this.repo.listar('matriculas', { turmaId, ano: t.ano })) {
        if (m.situacao && m.situacao !== 'ativa') continue;
        const id = chaves.falta(m.alunoId, data);
        if (pres.has(m.alunoId)) {
          if (await this.repo.obter('faltas', id)) ops.push({ op: 'remover', colecao: 'faltas', id });
        } else {
          ausentes++;
          ops.push({ op: 'salvar', colecao: 'faltas', id, dados: { alunoId: m.alunoId, turmaId, ano: t.ano, data, aulas: AULAS_POR_DIA, origem: 'catraca' } });
        }
      }
    }
    await this._gravar(ops, 'frequencia.catraca');
    return { ausentes };
  }

  async faltasDoDia(data) {
    await this.exigir('frequencia.ver');
    return this.repo.listar('faltas', { data });
  }

  async desfazerFalta(alunoId, data, motivo) {
    await this.exigir('frequencia.lancar');
    await this._gravar([{ op: 'remover', colecao: 'faltas', id: chaves.falta(alunoId, data) }], 'frequencia.desfazer' + (motivo ? `: ${motivo}` : ''));
  }

  async faltasDoAluno(ano, alunoId) {
    const escola = await this.escola();
    const tri = (escola.trimestres && escola.trimestres[ano]) || {};
    const r = { t1: 0, t2: 0, t3: 0, dias: [] };
    for (const f of await this.repo.listar('faltas', { alunoId, ano })) {
      r.dias.push(f);
      const t = TRIMESTRES.find(k => tri[k] && f.data >= tri[k].inicio && f.data <= tri[k].fim);
      if (t) r[t] += f.aulas || AULAS_POR_DIA;
    }
    r.dias.sort((a, b) => (a.data < b.data ? -1 : 1));
    return r;
  }

  // ---------- boletim ----------
  async boletim(alunoId, ano) {
    ano ??= await this.anoLetivo();
    const m = await this.repo.obter('matriculas', chaves.matricula(ano, alunoId));
    if (!m) throw new Error('Aluno sem matrícula neste ano.');
    await this.exigir('boletim.ver', { turmaId: m.turmaId });
    const [aluno, turma, notas, simulados, faltas] = await Promise.all([
      this.repo.obter('alunos', alunoId), this.turma(m.turmaId),
      this.repo.listar('notas', { alunoId, ano }), this.simuladosDoAluno(ano, alunoId), this.faltasDoAluno(ano, alunoId),
    ]);
    const lancamentos = Object.fromEntries(notas.filter(n => n.turmaId === m.turmaId).map(n => [n.disciplinaId, n]));
    const calc = calcularBoletim({ modelo: turma.modelo, disciplinas: turma.disciplinas, lancamentos, simulados, faltas });
    return { aluno, matricula: m, turma, ano, ...calc };
  }

  async boletinsDaTurma(turmaId) {
    await this.exigir('boletim.ver', { turmaId });
    const turma = await this.turma(turmaId);
    const alunos = await this.alunosDaTurma(turmaId);
    const boletins = [];
    for (const a of alunos) boletins.push(await this.boletim(a.id, turma.ano));
    const MT = mediaDaTurma(boletins);
    return boletins.map(b => ({ ...b, MT }));
  }

  // ---------- documentos ----------
  async registrarEmissao({ tipo, alvoId, alvoNome, extras }) {
    await this.exigir('documentos.emitir');
    const codigo = codigoAutenticidade();
    const dados = { tipo, alvoId, alvoNome, extras: extras || {}, codigo, em: agora(), usuarioId: this.usuario.id, usuarioNome: this.usuario.nome };
    await this.repo.salvar('emissoes', codigo, dados);
    return { ...dados, id: codigo };
  }

  async emissoes(filtro) {
    await this.exigir('documentos.ver');
    return (await this.repo.listar('emissoes', filtro)).sort((a, b) => (a.em < b.em ? 1 : -1));
  }

  async salvarEscola(parte) {
    await this.exigir('escola.editar');
    await this._gravar([{ op: 'atualizar', colecao: 'escola', id: 'config', dados: parte }], 'escola.salvar');
  }

  async funcionarios() { return this.repo.listar('funcionarios'); }

  async salvarFuncionario(f) {
    await this.exigir('cadastros.editar');
    VALIDAR.funcionarios(f);
    const id = f.id || novoId('f');
    await this._gravar([{ op: 'salvar', colecao: 'funcionarios', id, dados: f }], 'funcionario.salvar');
    return id;
  }
}

const ordemSerie = t => ['6EF', '7EF', '8EF', '9EF', '1EM', '2EM', '3EM'].indexOf(t.serie);

// Código curto para conferir se um documento foi mesmo emitido pela escola.
export function codigoAutenticidade() {
  const alfabeto = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  const rnd = (globalThis.crypto && crypto.getRandomValues) ? crypto.getRandomValues(new Uint8Array(10)) : Array.from({ length: 10 }, () => Math.random() * 256);
  for (let i = 0; i < 10; i++) s += alfabeto[rnd[i] % alfabeto.length];
  return `${s.slice(0, 5)}-${s.slice(5)}`;
}
