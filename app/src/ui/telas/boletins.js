import { h, tabela, imprimir } from '../dom.js';
import { formatar } from '../../regras/boletim.js';
import { disciplina } from '../../regras/curriculo.js';
import { modelo } from '../../documentos/modelos.js';
import { gerarFolha } from '../../documentos/pagina.js';
import { emitir, contextoDocumento } from '../../documentos/emitir.js';

const etiqueta = s => h('span', { class: 'etiqueta ' + (s || '') }, { aprovado: 'Aprovado', reprovado: 'Reprovado', cursando: 'Cursando' }[s] || '-');

export async function tela(ctx, [turmaId, alunoId]) {
  const { sistema } = ctx;
  if (!turmaId) {
    const turmas = await sistema.turmas();
    return [h('h1', {}, 'Turmas e boletins'),
      h('div', { class: 'grade-cartoes' }, turmas.map(t => h('a', { class: 'cartao', href: `#/boletins/${t.id}` },
        h('b', {}, t.nome), h('br'), h('span', { class: 'suave' }, `${t.disciplinas.length} disciplinas · turno da ${t.turno === 'tarde' ? 'tarde' : 'manhã'}`))))];
  }
  const turma = await sistema.turma(turmaId);
  const boletins = await sistema.boletinsDaTurma(turmaId);
  const podeEmitir = await sistema.pode('documentos.emitir');

  if (alunoId) {
    const b = boletins.find(x => x.aluno.id === alunoId);
    const m = modelo('boletim');
    const c = await contextoDocumento(sistema, m, alunoId, { logo: ctx.logo, boletim: b });
    return [h('div', { class: 'linha' }, h('a', { href: `#/boletins/${turmaId}` }, `← ${turma.nome}`), h('span', { class: 'espaco' }),
      podeEmitir ? h('button', { class: 'primario', onclick: async () => imprimir((await emitir(sistema, 'boletim', alunoId, {}, { logo: ctx.logo, boletim: b })).html) }, 'Imprimir / PDF') : null),
      h('h1', {}, b.aluno.nome), h('div', { class: 'previa' }, h('div', { html: gerarFolha(m, c) }))];
  }

  const fgb = boletins[0] ? boletins[0].linhas.map(l => l.disciplina) : [];
  const linhas = boletins.map(b => h('tr', {},
    h('td', { class: 'num' }, b.matricula.numero), h('td', { class: 'nome' }, h('a', { href: `#/boletins/${turmaId}/${b.aluno.id}` }, b.aluno.nome)),
    ['t1', 't2', 't3'].map(t => h('td', { class: 'num' }, formatar(b.MA[t]))),
    h('td', { class: 'num' }, formatar(b.MG.geral)), h('td', { class: 'num' }, b.faltas.total), h('td', {}, etiqueta(b.situacao))));
  const MT = boletins[0] ? boletins[0].MT : {};
  const pendencias = [];
  for (const d of fgb) {
    const sem = boletins.filter(b => b.linhas.find(l => l.disciplina === d).trimestres.t1.MPT === null).length;
    if (sem) pendencias.push(`${disciplina(d).curto || disciplina(d).nome}: ${sem} sem nota no 1º tri`);
  }
  return [
    h('div', { class: 'linha' }, h('a', { href: '#/boletins' }, '← Turmas'), h('span', { class: 'espaco' }),
      podeEmitir ? h('button', { class: 'primario', onclick: async () => {
        const htmls = [];
        for (const b of boletins) htmls.push((await emitir(sistema, 'boletim', b.aluno.id, {}, { logo: ctx.logo, boletim: b })).html);
        imprimir(htmls.join(''));
      } }, 'Imprimir boletins da turma') : null),
    h('h1', {}, turma.nome),
    h('p', { class: 'suave' }, `Média da turma: 1º tri ${formatar(MT.t1)} · 2º tri ${formatar(MT.t2)} · 3º tri ${formatar(MT.t3)}`),
    tabela(['Nº', 'Aluno', 'MA 1', 'MA 2', 'MA 3', 'MG', 'Faltas', 'Situação'].map(c => h('th', { class: c === 'Aluno' || c === 'Situação' ? '' : 'num' }, c)), linhas),
    pendencias.length ? h('details', { class: 'cartao' }, h('summary', {}, 'Notas que faltam'), h('ul', {}, pendencias.map(p => h('li', {}, p)))) : null,
  ];
}
