// Cadastro de turmas e de qual professor dá qual disciplina em cada turma.

import { h, avisar, campo, lerFormulario, tabela } from '../dom.js';
import { SERIES, GRADE_PADRAO, DISCIPLINAS, disciplina } from '../../regras/curriculo.js';
import { TURNOS } from '../../modelo/esquema.js';

export async function tela(ctx, [turmaId]) {
  const { sistema } = ctx;
  if (turmaId === 'nova') return novaTurma(ctx);
  const turmas = await sistema.turmas();
  if (!turmaId) {
    return [h('div', { class: 'linha' }, h('h1', { style: 'margin:0' }, 'Turmas e professores'), h('span', { class: 'espaco' }), h('a', { class: 'botao primario', href: '#/turmas/nova' }, 'Nova turma')),
      h('p', { class: 'suave' }, 'Escolha a turma para dizer qual professor dá cada disciplina. Também dá para subir tudo de uma vez pela planilha em "Usuários e perfis".'),
      h('div', { class: 'grade-cartoes' }, turmas.map(t => h('a', { class: 'cartao', href: `#/turmas/${t.id}` }, h('b', {}, t.nome), h('br'), h('span', { class: 'suave' }, `${t.disciplinas.length} disciplinas`))))];
  }
  const t = turmas.find(x => x.id === turmaId);
  const profs = await sistema.professores();
  const atrib = Object.fromEntries((await sistema.atribuicoes()).filter(a => a.turmaId === turmaId).map(a => [a.disciplinaId, a.professorId]));
  const linhas = t.disciplinas.map(d => {
    const sel = h('select', { 'aria-label': `Professor de ${disciplina(d).nome}` }, h('option', { value: '' }, '— sem professor —'),
      profs.map(p => h('option', { value: p.id, selected: atrib[d] === p.id }, p.nome)));
    sel.addEventListener('change', async () => {
      if (!sel.value) return;
      try { await sistema.salvarAtribuicao({ turmaId, disciplinaId: d, professorId: sel.value }); avisar('Professor salvo.'); } catch (e) { avisar(e.message, 'erro'); }
    });
    return h('tr', {}, h('td', {}, disciplina(d).nome), h('td', {}, sel));
  });
  return [h('div', { class: 'linha' }, h('a', { href: '#/turmas' }, '← Turmas')), h('h1', {}, t.nome),
    h('p', { class: 'suave' }, `Turno: ${TURNOS[t.turno] || '-'} · Ano letivo ${t.ano}`),
    tabela(['Disciplina', 'Professor'], linhas)];
}

async function novaTurma(ctx) {
  const { sistema } = ctx;
  const ano = await sistema.anoLetivo();
  const discs = h('div', { class: 'opcoes-check' });
  const serieSel = campo('Série', 'serie', '6EF', { tipo: 'select', opcoes: Object.fromEntries(SERIES.map(s => [s.id, s.nome])) });
  const marcar = () => {
    const s = serieSel.querySelector('select').value;
    const grade = GRADE_PADRAO[s];
    discs.replaceChildren(...DISCIPLINAS.filter(d => s.endsWith('EM') || !d.itinerario)
      .map(d => h('label', {}, h('input', { type: 'checkbox', name: 'd_' + d.id, checked: grade.includes(d.id) }), d.nome)));
  };
  serieSel.querySelector('select').addEventListener('change', marcar);
  marcar();
  const form = h('form', {}, h('div', { class: 'campos' }, serieSel, campo('Letra', 'letra', 'A', { maxlength: 2, ajuda: 'U para turma única' }),
    campo('Turno', 'turno', 'manha', { tipo: 'select', opcoes: TURNOS }), campo('Ano letivo', 'ano', ano, { tipo: 'number' })),
  h('fieldset', {}, h('legend', {}, 'Disciplinas'), discs), h('div', { class: 'linha fim' }, h('button', { class: 'primario', type: 'submit' }, 'Criar turma')));
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const f = lerFormulario(form);
    const disciplinas = Object.keys(f).filter(k => k.startsWith('d_') && f[k]).map(k => k.slice(2));
    try {
      const id = await sistema.salvarTurma({ ano: Number(f.ano), serie: f.serie, letra: f.letra.toUpperCase(), turno: f.turno, disciplinas });
      avisar('Turma criada.'); ctx.ir(`turmas/${id}`);
    } catch (err) { avisar(err.message, 'erro'); }
  });
  return [h('div', { class: 'linha' }, h('a', { href: '#/turmas' }, '← Turmas')), h('h1', {}, 'Nova turma'), form];
}
