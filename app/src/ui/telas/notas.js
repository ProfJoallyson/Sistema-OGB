// Grade de notas do professor: alunos nas linhas, avaliações nas colunas.
// A média do trimestre e a MDT se atualizam ao digitar.

import { h, avisar, abas } from '../dom.js';
import { disciplina, colunasDoProfessor, avaliacoes, SIGLAS } from '../../regras/curriculo.js';
import { calcularDisciplina, formatar, LIMITES } from '../../regras/boletim.js';

export async function tela(ctx, [turmaId, discId, aba = 't1']) {
  const { sistema, usuario } = ctx;
  if (!turmaId) return escolher(ctx);
  const turma = await sistema.turma(turmaId);
  const d = disciplina(discId);
  if (!turma || !d) throw new Error('Turma ou disciplina não encontrada.');
  const podeLancar = await sistema.pode('notas.lancar', { turmaId, disciplinaId: discId });
  const alunos = await sistema.alunosDaTurma(turmaId);
  const docs = Object.fromEntries((await sistema.notasDaTurma(turmaId, discId)).map(n => [n.alunoId, n]));
  const sims = await sistema.simuladosDaTurma(turmaId);
  const modelo = turma.modelo;

  const cols = aba === 'anual' ? [] : colunasDoProfessor(modelo, discId);
  const simCols = avaliacoes(modelo, discId).filter(c => !cols.includes(c));
  if (modelo === 'EM3' && !d.itinerario && aba !== 'anual') simCols.push('SE');

  const calc = a => calcularDisciplina(modelo, discId, docs[a.id] || {}, sims[a.id] || {});
  const celulasCalc = (a, tr) => {
    const r = calc(a);
    if (aba === 'anual') {
      return [...['t1', 't2', 't3'].map(t => h('td', { class: 'num' }, formatar(r.trimestres[t].MDT))),
        h('td', { class: 'num calc' + (r.MPA !== null && r.MPA < LIMITES.provaFinal ? ' baixa' : '') }, formatar(r.MPA)),
        null, // PF (input)
        h('td', { class: 'num calc' + (r.MDA !== null && r.MDA < LIMITES.aprovacao ? ' baixa' : '') }, formatar(r.MDA))];
    }
    const t = r.trimestres[aba];
    return [...simCols.map(c => h('td', { class: 'num suave' }, c === 'SE' ? (t.bonusSE ? '+' + formatar(t.bonusSE) : '-') : formatar(t.notas[c]))),
      h('td', { class: 'num calc' + (t.faltando.length ? ' provisoria' : '') + (t.MPT !== null && t.MPT < LIMITES.recuperacao ? ' baixa' : ''), title: t.faltando.length ? `Provisória: falta ${t.faltando.join(', ')}` : '' }, formatar(t.MPT)),
      h('td', { class: 'num calc' }, formatar(t.MDT))];
  };

  const entrada = (a, campo, valor) => {
    const inp = h('input', { class: 'nota', value: valor === null || valor === undefined ? '' : String(valor).replace('.', ','), inputmode: 'decimal', 'aria-label': `${campo} de ${a.nome}`, disabled: !podeLancar });
    inp.addEventListener('change', async () => {
      try {
        const v = await sistema.lancarNota({ turmaId, disciplinaId: discId, alunoId: a.id, trimestre: aba === 'anual' ? null : aba, campo, valor: inp.value });
        const doc = docs[a.id] || (docs[a.id] = {});
        if (campo === 'PF') doc.PF = v; else doc[aba] = { ...(doc[aba] || {}), [campo]: v };
        inp.value = v === null ? '' : String(v).replace('.', ',');
        inp.classList.remove('invalida'); inp.classList.add('salvo');
        atualizarLinha(a);
      } catch (e) { inp.classList.add('invalida'); avisar(e.message, 'erro'); }
    });
    return h('td', { class: 'num' }, inp);
  };

  const linhas = new Map();
  const montarLinha = a => {
    const doc = docs[a.id] || {};
    const calcs = celulasCalc(a);
    let tds;
    if (aba === 'anual') { calcs[4] = entrada(a, 'PF', doc.PF); tds = calcs; }
    else tds = [...cols.map(c => entrada(a, c, (doc[aba] || {})[c])), ...calcs];
    const tr = h('tr', {}, h('td', { class: 'num' }, a.matricula.numero), h('td', { class: 'nome' }, a.nome), tds);
    linhas.set(a.id, tr);
    return tr;
  };
  const atualizarLinha = a => {
    const tr = linhas.get(a.id);
    const novos = celulasCalc(a).filter(Boolean);
    const calcTds = [...tr.querySelectorAll('td')].filter(td => !td.querySelector('input')).slice(2);
    calcTds.forEach((td, i) => novos[i] && td.replaceWith(novos[i]));
  };

  const cab = aba === 'anual'
    ? ['Nº', 'Aluno', 'MDT 1', 'MDT 2', 'MDT 3', 'MPA', 'PF', 'MDA']
    : ['Nº', 'Aluno', ...cols, ...simCols.map(c => `${c} (simulado)`), 'MPT', 'MDT'];

  return [
    h('div', { class: 'linha' }, h('a', { href: '#/notas' }, '← Minhas turmas')),
    h('h1', {}, `${d.nome} · ${turma.nome}`),
    !podeLancar ? h('p', { class: 'aviso-exemplo' }, 'Somente leitura: você pode ver estas notas, mas não alterar.') : null,
    abas({ t1: '1º trimestre', t2: '2º trimestre', t3: '3º trimestre', anual: 'Resultado anual e PF' }, aba, k => ctx.ir(`notas/${turmaId}/${discId}/${k}`)),
    h('p', { class: 'suave' }, aba === 'anual'
      ? `A prova final (PF) só conta para quem ficou com MPA abaixo de 7,0. Digite "NC" se o aluno não compareceu.`
      : `Digite as notas de 0 a 10 (vírgula ou ponto). A recuperação (RO) só conta quando a MPT fica abaixo de 7,0; "NC" = não compareceu. ` +
        (simCols.length ? 'As notas de simulado vêm da secretaria. ' : '') + 'Cada mudança fica no histórico.'),
    h('div', { class: 'tabela-rolagem' }, h('table', { class: 'dados-tabela' },
      h('thead', {}, h('tr', {}, cab.map(c => h('th', { class: c === 'Aluno' ? '' : 'num', title: SIGLAS[c] || '' }, c)))),
      h('tbody', {}, alunos.map(montarLinha)))),
  ];
}

async function escolher({ sistema, usuario }) {
  const turmas = await sistema.turmas();
  let lista;
  if (usuario.perfis.includes('admin') || (usuario.perfis.includes('secretaria') && usuario.corrigeNotas)) {
    lista = turmas.flatMap(t => t.disciplinas.map(d => ({ turma: t, d })));
  } else {
    const minhas = await sistema.minhasAtribuicoes();
    lista = minhas.map(a => ({ turma: turmas.find(t => t.id === a.turmaId), d: a.disciplinaId })).filter(x => x.turma);
  }
  const porTurma = {};
  for (const x of lista) (porTurma[x.turma.nome] ||= []).push(x);
  return [h('h1', {}, 'Lançar notas'),
    lista.length ? null : h('p', { class: 'suave' }, 'Nenhuma turma atribuída a você.'),
    Object.entries(porTurma).map(([nome, xs]) => h('div', { class: 'cartao' }, h('h3', {}, nome),
      h('div', { class: 'linha' }, xs.map(x => h('a', { class: 'botao', href: `#/notas/${x.turma.id}/${x.d}` }, disciplina(x.d).nome)))))];
}
