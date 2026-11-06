// Junta os dados que cada documento precisa e registra a emissão.

import { modelo as acharModelo } from './modelos.js';
import { gerarFolha } from './pagina.js';

export async function contextoDocumento(sistema, modelo, alvoId, extras = {}) {
  const escola = await sistema.escola();
  const funcionarios = await sistema.funcionarios();
  const porId = id => funcionarios.find(f => f.id === id) || null;
  const base = { escola, secretaria: porId(escola.secretariaId), diretor: porId(escola.diretorId), logo: extras.logo };
  if (modelo.alvo === 'funcionario') return { ...base, funcionario: porId(alvoId) };
  if (modelo.alvo === 'turma') {
    const turma = await sistema.turma(alvoId);
    const alunos = await sistema.alunosDaTurma(alvoId);
    const boletins = modelo.id === 'relacaoNotas' ? await sistema.boletinsDaTurma(alvoId) : [];
    return { ...base, turma, alunos, boletins };
  }
  const ano = extras.ano ?? escola.anoLetivo;
  const aluno = await sistema.aluno(alvoId);
  const matricula = aluno.matriculas.find(m => m.ano === ano) || aluno.matriculas[0];
  const turma = await sistema.turma(matricula.turmaId);
  let boletim = null;
  if (await sistema.pode('boletim.ver', { turmaId: turma.id })) {
    boletim = extras.boletim || await sistema.boletim(alvoId, matricula.ano);
  }
  return { ...base, aluno, matricula, matriculas: aluno.matriculas, turma, boletim };
}

// Emite um documento: monta a folha e grava o registro (tipo, para quem, quem emitiu, código).
export async function emitir(sistema, tipo, alvoId, respostas = {}, extras = {}) {
  const modelo = acharModelo(tipo);
  if (!modelo) throw new Error('Documento desconhecido: ' + tipo);
  const ctx = await contextoDocumento(sistema, modelo, alvoId, extras);
  const motivo = modelo.disponivel && modelo.disponivel(ctx);
  if (motivo) throw new Error(motivo);
  const alvoNome = (ctx.aluno || ctx.funcionario || ctx.turma || {}).nome;
  const emissao = extras.previa ? null : await sistema.registrarEmissao({ tipo, alvoId, alvoNome, extras: respostas });
  return { html: gerarFolha(modelo, ctx, respostas, emissao), emissao, ctx };
}
