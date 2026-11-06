// Lançamento dos acertos dos simulados (até a integração com o leitor de gabarito).

import { h, avisar, abas } from '../dom.js';
import { notaSimulado80, notaAreaSG, bonusSE, AREAS_SG } from '../../regras/simulados.js';
import { formatar } from '../../regras/boletim.js';

export async function tela(ctx, [turmaId, trimestre = 't1', tipoEscolhido]) {
  const { sistema } = ctx;
  const turmas = await sistema.turmas();
  if (!turmaId) {
    return [h('h1', {}, 'Simulados'),
      h('p', { class: 'suave' }, 'Lance o número de acertos de cada aluno. A nota sai pelas tabelas do boletim e vale para as disciplinas do aluno. Depois, o leitor de gabarito vai mandar os acertos direto para cá.'),
      h('div', { class: 'grade-cartoes' }, turmas.map(t => h('a', { class: 'cartao', href: `#/simulados/${t.id}` }, h('b', {}, t.nome))))];
  }
  const turma = turmas.find(t => t.id === turmaId);
  const tipos = turma.modelo === 'EM3' ? { SP: 'SP (parcial)', SG: 'SG (global, por área)', SE: 'SE (extra, bônus)' } : { SO: 'SO (obrigatório)' };
  const tipo = tipoEscolhido && tipos[tipoEscolhido] ? tipoEscolhido : Object.keys(tipos)[0];
  const alunos = await sistema.alunosDaTurma(turmaId);
  const sims = await sistema.simuladosDaTurma(turmaId);

  const nota = (valor, area) => {
    try {
      if (valor === '' || valor === null || valor === undefined) return '-';
      if (tipo === 'SG') return formatar(notaAreaSG(valor));
      if (tipo === 'SE') return '+' + formatar(bonusSE(valor));
      return formatar(notaSimulado80(valor));
    } catch { return '?'; }
  };

  const entrada = (a, area) => {
    const doc = (sims[a.id] || {})[trimestre] || {};
    const valor = area ? (doc.SG || {})[area] : doc[tipo];
    const saida = h('span', { class: 'suave' }, nota(valor, area));
    const inp = h('input', { class: 'nota', inputmode: 'numeric', value: valor ?? '', 'aria-label': `Acertos de ${a.nome}${area ? ' em ' + AREAS_SG[area] : ''}` });
    inp.addEventListener('change', async () => {
      try {
        const v = inp.value.trim() === '' ? null : inp.value.trim();
        await sistema.lancarSimulado({ ano: turma.ano, alunoId: a.id, trimestre, tipo, acertos: area ? { [area]: v } : v });
        inp.classList.remove('invalida'); inp.classList.add('salvo');
        saida.textContent = nota(v, area);
      } catch (e) { inp.classList.add('invalida'); avisar(e.message, 'erro'); }
    });
    return [h('td', { class: 'num' }, inp), h('td', { class: 'num' }, saida)];
  };

  const colunas = tipo === 'SG' ? Object.keys(AREAS_SG) : [null];
  const cab = ['Nº', 'Aluno', ...colunas.flatMap(a => (a ? [`${AREAS_SG[a]} (de 40)`, 'Nota'] : [`Acertos (de 80)`, tipo === 'SE' ? 'Bônus' : 'Nota']))];
  return [
    h('div', { class: 'linha' }, h('a', { href: '#/simulados' }, '← Turmas')),
    h('h1', {}, `Simulados · ${turma.nome}`),
    abas({ t1: '1º trimestre', t2: '2º trimestre', t3: '3º trimestre' }, trimestre, k => ctx.ir(`simulados/${turmaId}/${k}/${tipo}`)),
    Object.keys(tipos).length > 1 ? abas(tipos, tipo, k => ctx.ir(`simulados/${turmaId}/${trimestre}/${k}`)) : null,
    tipo === 'SG' ? h('p', { class: 'suave' }, 'SG: 2 provas de 80 questões, 40 por área. Matemática → Matemática; Natureza → Física, Química e Biologia; Linguagens → Português, línguas, Arte e Ed. Física; Humanas → História, Geografia, Sociologia e Filosofia.') : null,
    h('div', { class: 'tabela-rolagem' }, h('table', { class: 'dados-tabela' },
      h('thead', {}, h('tr', {}, cab.map(c => h('th', { class: c === 'Aluno' ? '' : 'num' }, c)))),
      h('tbody', {}, alunos.map(a => h('tr', {}, h('td', { class: 'num' }, a.matricula.numero), h('td', { class: 'nome' }, a.nome), colunas.map(ar => entrada(a, ar))))))),
  ];
}
