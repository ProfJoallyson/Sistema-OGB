import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RepositorioMemoria } from '../src/dados/memoria.js';
import { confere } from '../src/dados/repositorio.js';
import { dadosDeExemplo, ANO } from '../src/dados/exemplo.js';
import { Sistema } from '../src/servicos/sistema.js';
import { pode } from '../src/modelo/perfis.js';
import { conferirCatraca, nomesDaLista } from '../src/servicos/catraca.js';
import { prepararImportacao, acharTurma, acharDisciplina } from '../src/servicos/importar-usuarios.js';

const D = '@colegioecursoogb.com.br';
const T6A = `${ANO}_6ef_a`;

async function como(email) {
  const repo = confere(new RepositorioMemoria(dadosDeExemplo()));
  const u = await repo.obter('usuarios', email + D);
  return { repo, s: new Sistema(repo, u), u };
}

const semPermissao = { codigo: 'sem-permissao' };

test('professor lança nota só na própria disciplina e turma, e fica no histórico', async () => {
  const { s, repo } = await como('ana.prof');
  await s.lancarNota({ turmaId: T6A, disciplinaId: 'port', alunoId: 'a0001', trimestre: 't2', campo: 'PE', valor: '8,5' });
  const n = await repo.obter('notas', `${ANO}_${T6A}_port_a0001`);
  assert.equal(n.t2.PE, 8.5);
  assert.ok(n.t1.PP !== undefined, 'não apaga o 1º trimestre');
  const h = await repo.listar('historico', { docId: `${ANO}_${T6A}_port_a0001` });
  assert.equal(h.length, 1);
  assert.equal(h[0].campo, 't2');
  assert.equal(h[0].usuarioId, 'ana.prof' + D);
  await assert.rejects(s.lancarNota({ turmaId: T6A, disciplinaId: 'mat', alunoId: 'a0001', trimestre: 't2', campo: 'PE', valor: 8 }), semPermissao);
  await assert.rejects(s.lancarNota({ turmaId: T6A, disciplinaId: 'port', alunoId: 'a0001', trimestre: 't2', campo: 'SO', valor: 8 }), /não é digitado/);
  await assert.rejects(s.lancarNota({ turmaId: T6A, disciplinaId: 'port', alunoId: 'a0001', trimestre: 't2', campo: 'PE', valor: 12 }), /Nota inválida/);
});

test('secretaria só corrige nota com a permissão; direção e coordenação só veem', async () => {
  const nota = { turmaId: T6A, disciplinaId: 'mat', alunoId: 'a0002', trimestre: 't1', campo: 'RO', valor: 'NC' };
  await assert.rejects((await como('bia.secretaria')).s.lancarNota(nota), semPermissao);
  assert.equal(await (await como('clara.secretaria')).s.lancarNota(nota), 'NC');
  for (const p of ['direcao', 'coordenacao']) {
    const { s } = await como(p);
    await assert.rejects(s.lancarNota(nota), semPermissao);
    assert.ok((await s.boletinsDaTurma(T6A)).length > 0);
    assert.ok((await s.historico()).length >= 0);
  }
});

test('tesouraria matricula mas não vê notas nem boletim', async () => {
  const { s, repo } = await como('tesouraria');
  const id = await s.matricular({ nome: 'Aluna Nova Exemplo', sexo: 'F', nascimento: '2014-03-02' }, { turmaId: T6A, bolsa: 'integral' });
  const m = await repo.obter('matriculas', `${ANO}_${id}`);
  assert.equal(m.numero, 9);
  assert.equal(m.bolsa, 'integral');
  await assert.rejects(s.boletim(id), semPermissao);
  await assert.rejects(s.notasDaTurma(T6A), semPermissao);
});

test('professor vê só as suas turmas; não vê boletim de outra turma', async () => {
  const { s } = await como('coordenacao'); // coordenação vê tudo
  assert.equal((await s.turmas()).length, 10);
  const u = { id: 'x' + D, nome: 'Prof', perfis: ['professor'] };
  const dados = { atribuicoes: [{ professorId: u.id, turmaId: T6A, disciplinaId: 'hist' }] };
  assert.equal(pode(u, 'boletim.ver', { turmaId: T6A }, dados), true);
  assert.equal(pode(u, 'boletim.ver', { turmaId: 'outra' }, dados), false);
  assert.equal(pode(u, 'notas.lancar', { turmaId: T6A, disciplinaId: 'hist', campo: 'PP' }, dados), true);
  assert.equal(pode(u, 'notas.lancar', { turmaId: T6A, disciplinaId: 'port', campo: 'PP' }, dados), false);
  assert.equal(pode({ ...u, ativo: false }, 'boletim.ver', { turmaId: T6A }, dados), false);
});

test('boletim do aluno usa notas, simulados e faltas', async () => {
  const { s } = await como('bia.secretaria');
  await s.registrarDia({ data: `${ANO}-03-10`, turmaIds: [T6A], presentes: ['a0002', 'a0003', 'a0004', 'a0005', 'a0006', 'a0007', 'a0008'] });
  const b = await s.boletim('a0001');
  assert.equal(b.faltas.t1, 6);
  assert.equal(b.linhas.length, 9);
  assert.ok(b.linhas[0].trimestres.t1.MPT > 0);
  assert.equal(b.situacao, 'cursando');
  // reimportar o dia com o aluno presente desfaz a falta
  await s.registrarDia({ data: `${ANO}-03-10`, turmaIds: [T6A], presentes: ['a0001', 'a0002', 'a0003', 'a0004', 'a0005', 'a0006', 'a0007', 'a0008'] });
  assert.equal((await s.boletim('a0001')).faltas.t1, 0);
});

test('simulados: secretaria lança acertos; valida limites', async () => {
  const { s, repo } = await como('bia.secretaria');
  await s.lancarSimulado({ alunoId: 'a0001', trimestre: 't3', tipo: 'SO', acertos: 72 });
  assert.equal((await repo.obter('simulados', `${ANO}_a0001_t3`)).SO, 72);
  await assert.rejects(s.lancarSimulado({ alunoId: 'a0001', trimestre: 't3', tipo: 'SO', acertos: 81 }), /Acertos inválidos/);
  await assert.rejects(s.lancarSimulado({ alunoId: 'a0001', trimestre: 't3', tipo: 'SG', acertos: { matematica: 41 } }), /Acertos inválidos/);
  await assert.rejects((await como('ana.prof')).s.lancarSimulado({ alunoId: 'a0001', trimestre: 't3', tipo: 'SO', acertos: 1 }), semPermissao);
});

test('catraca: nomes iguais, parecidos e não encontrados', () => {
  const alunos = [{ id: '1', nome: 'Ana Lima Santos' }, { id: '2', nome: 'João Pedro Rocha' }, { id: '3', nome: 'Davi Gomes' }];
  const lista = nomesDaLista([['Data', 'Nome'], ['10/03', 'ANA LIMA SANTOS'], ['10/03', 'Joao P Rocha'], ['10/03', 'Fulano de Tal']]);
  assert.deepEqual(lista, ['ANA LIMA SANTOS', 'Joao P Rocha', 'Fulano de Tal']);
  const r = conferirCatraca(lista, alunos);
  assert.deepEqual(r.presentes, ['1']);
  assert.equal(r.duvidas[0].sugestoes[0].alunoId, '2');
  assert.deepEqual(r.naoEncontrados, ['Fulano de Tal']);
  assert.deepEqual(r.ausentes, ['3']);
});

test('importação de usuários por planilha', async () => {
  const { s, repo } = await como('admin');
  const turmas = await s.turmas();
  assert.equal(acharTurma('6º Ano A', turmas).id, T6A);
  assert.equal(acharTurma('6A', turmas).id, T6A);
  assert.equal(acharTurma('1ª Série', turmas).id, `${ANO}_1em_u`);
  assert.equal(acharTurma('6º Ano', turmas), null, 'ambíguo: 6º A e 6º B');
  assert.equal(acharDisciplina('Português'), 'port');
  assert.equal(acharDisciplina('Ed. Física'), 'edf');
  const plano = prepararImportacao({
    pessoas: [
      ['Nome', 'E-mail', 'Perfis', 'Pode corrigir notas'],
      ['Maria Prof', 'maria@colegioecursoogb.com.br', 'Professor', ''],
      ['Rita', 'RITA@colegioecursoogb.com.br', 'Secretaria', 'Sim'],
      ['Diretor', 'dir@colegioecursoogb.com.br', 'Direção, Professor', ''],
      ['Fora', 'fora@gmail.com', 'Professor', ''],
      ['Sem perfil', 'sp@colegioecursoogb.com.br', 'Zelador', ''],
    ],
    aulas: [
      ['E-mail do professor', 'Turma', 'Disciplina'],
      ['maria@colegioecursoogb.com.br', '6º Ano A, 6B', 'História'],
      ['dir@colegioecursoogb.com.br', '3ª Série U', 'Filosofia'],
      ['dir@colegioecursoogb.com.br', '6A', 'Filosofia'],
      ['rita@colegioecursoogb.com.br', '6A', 'Arte'],
    ],
  }, turmas);
  assert.equal(plano.usuarios.length, 3);
  assert.equal(plano.usuarios.find(u => u.email === 'rita@colegioecursoogb.com.br').corrigeNotas, true);
  assert.deepEqual(plano.usuarios.find(u => u.nome === 'Diretor').perfis, ['direcao', 'professor']);
  assert.equal(plano.atribuicoes.length, 3);
  assert.deepEqual(plano.erros.map(e => [e.aba, e.linha]), [['Pessoas', 5], ['Pessoas', 6], ['Pessoas', 6], ['Aulas', 4], ['Aulas', 5]]);
  await assert.rejects(s.aplicarImportacaoUsuarios(plano), /Corrija/);
  const ok = { ...plano, erros: [] };
  await s.aplicarImportacaoUsuarios(ok);
  assert.ok(await repo.obter('usuarios', 'maria@colegioecursoogb.com.br'));
  assert.equal((await repo.obter('atribuicoes', `${T6A}_hist`)).professorId, 'maria@colegioecursoogb.com.br');
  await assert.rejects((await como('direcao')).s.aplicarImportacaoUsuarios(ok), semPermissao);
});

test('usuário precisa de e-mail da escola', async () => {
  const { s } = await como('admin');
  await assert.rejects(s.salvarUsuario({ nome: 'X', email: 'x@gmail.com', perfis: ['professor'] }), /da escola/);
  const u = await s.salvarUsuario({ nome: 'X', email: 'X@colegioecursoogb.com.br', perfis: ['tesouraria'], corrigeNotas: true });
  assert.equal(u.corrigeNotas, false);
  assert.equal(u.id, 'x@colegioecursoogb.com.br');
});

test('planilha modelo: lê com a SheetJS e ignora as linhas de exemplo', async () => {
  const { readFileSync } = await import('node:fs');
  const vm = await import('node:vm');
  const caixa = {};
  vm.runInNewContext(readFileSync(new URL('../vendor/xlsx.full.min.js', import.meta.url), 'utf8'), caixa);
  const XLSX = caixa.XLSX;
  const wb = XLSX.read(readFileSync(new URL('../modelos/modelo-usuarios.xlsx', import.meta.url)), { type: 'buffer' });
  const aba = n => XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: false, defval: '' });
  const { s } = await como('admin');
  const turmas = await s.turmas();
  const vazio = prepararImportacao({ pessoas: aba('Pessoas'), aulas: aba('Aulas') }, turmas);
  assert.equal(vazio.usuarios.length, 0);
  assert.equal(vazio.erros.length, 0);
  // a mesma planilha sem a palavra EXEMPLO vira usuários e aulas de verdade
  const tira = m => m.map(l => l.map(c => String(c).replace(/^EXEMPLO /, '')));
  const cheio = prepararImportacao({ pessoas: tira(aba('Pessoas')), aulas: aba('Aulas') }, turmas);
  assert.deepEqual(cheio.erros, []);
  assert.equal(cheio.usuarios.length, 5);
  assert.equal(cheio.atribuicoes.length, 4);
  assert.deepEqual(cheio.usuarios.find(u => u.nome === 'João Souza').perfis, ['professor', 'coordenacao']);
});
