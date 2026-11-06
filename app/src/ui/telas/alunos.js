import { h, tabela, abas, avisar, lerFormulario } from '../dom.js';
import { nomeTurma, BOLSAS } from '../../modelo/esquema.js';
import { dataCurta } from '../../documentos/texto.js';
import { formularioAluno } from './matricula.js';

export async function tela(ctx, [alunoId, aba = 'dados']) {
  const { sistema } = ctx;
  if (alunoId) return ficha(ctx, alunoId, aba);
  const alunos = await sistema.alunos();
  const turmas = Object.fromEntries((await sistema.turmas()).map(t => [t.id, t]));
  const ano = await sistema.anoLetivo();
  const busca = h('input', { type: 'search', placeholder: 'Buscar aluno pelo nome', 'aria-label': 'Buscar aluno' });
  const filtroTurma = h('select', { 'aria-label': 'Turma' }, h('option', { value: '' }, 'Todas as turmas'), Object.values(turmas).map(t => h('option', { value: t.id }, t.nome)));
  const corpo = h('tbody');
  const matriculas = Object.fromEntries((await sistema.matriculas(ano)).map(m => [m.alunoId, m]));
  const desenhar = () => {
    const q = busca.value.trim().toLowerCase();
    corpo.replaceChildren(...alunos.filter(a => (!q || a.nome.toLowerCase().includes(q)) && (!filtroTurma.value || (matriculas[a.id] || {}).turmaId === filtroTurma.value))
      .slice(0, 300).map(a => {
        const m = matriculas[a.id];
        return h('tr', {}, h('td', { class: 'nome' }, h('a', { href: `#/alunos/${a.id}` }, a.nome)),
          h('td', {}, m && turmas[m.turmaId] ? turmas[m.turmaId].nome : '-'), h('td', { class: 'num' }, m ? m.numero : ''), h('td', {}, dataCurta(a.nascimento)));
      }));
  };
  busca.addEventListener('input', desenhar);
  filtroTurma.addEventListener('change', desenhar);
  desenhar();
  return [
    h('div', { class: 'linha' }, h('h1', { style: 'margin:0' }, 'Alunos'), h('span', { class: 'espaco' }),
      (await sistema.pode('matricula.fazer')) ? h('a', { class: 'botao primario', href: '#/matricula' }, 'Nova matrícula') : null),
    h('div', { class: 'linha' }, h('div', { style: 'flex:2;min-width:200px' }, busca), h('div', { style: 'flex:1;min-width:160px' }, filtroTurma)),
    h('div', { class: 'tabela-rolagem' }, h('table', { class: 'dados-tabela' }, h('thead', {}, h('tr', {}, ['Nome', 'Turma', 'Nº', 'Nascimento'].map(c => h('th', {}, c)))), corpo)),
  ];
}

async function ficha(ctx, alunoId, aba) {
  const { sistema } = ctx;
  const a = await sistema.aluno(alunoId);
  if (!a) throw new Error('Aluno não encontrado.');
  const ano = await sistema.anoLetivo();
  const m = a.matriculas.find(x => x.ano === ano) || a.matriculas[0];
  const turma = m && await sistema.turma(m.turmaId);
  const veBoletim = m && await sistema.pode('boletim.ver', { turmaId: m.turmaId });
  const opcoes = { dados: 'Dados', ...(veBoletim ? { boletim: 'Boletim', frequencia: 'Frequência' } : {}), historico: 'Histórico escolar' };
  const topo = [h('div', { class: 'linha' }, h('a', { href: '#/alunos' }, '← Alunos'), h('span', { class: 'espaco' }),
    (await sistema.pode('documentos.emitir')) ? h('a', { class: 'botao', href: `#/documentos/aluno/${alunoId}` }, 'Emitir documento') : null),
  h('h1', {}, a.nome),
  h('p', { class: 'suave' }, turma ? `${turma.nome} · Nº ${m.numero} · ${BOLSAS[m.bolsa || 'nenhuma']}` : 'Sem matrícula'),
  abas(opcoes, aba, k => ctx.ir(`alunos/${alunoId}/${k}`))];

  if (aba === 'boletim' && veBoletim) {
    ctx.ir(`boletins/${m.turmaId}/${alunoId}`);
    return topo;
  }
  if (aba === 'frequencia' && veBoletim) {
    const f = await sistema.faltasDoAluno(m.ano, alunoId);
    const podeDesfazer = await sistema.pode('frequencia.lancar');
    return [...topo, h('p', {}, `Faltas: 1º tri ${f.t1} · 2º tri ${f.t2} · 3º tri ${f.t3} · total ${f.t1 + f.t2 + f.t3}`),
      f.dias.length ? tabela(['Dia', 'Aulas', 'Origem', ''], f.dias.map(d => h('tr', {}, h('td', {}, dataCurta(d.data)), h('td', { class: 'num' }, d.aulas), h('td', {}, d.origem),
        h('td', {}, podeDesfazer ? h('button', { onclick: async () => { await sistema.desfazerFalta(alunoId, d.data, 'pela ficha do aluno'); avisar('Falta desfeita.'); ctx.recarregar(); } }, 'Desfazer') : null))))
        : h('p', { class: 'suave' }, 'Nenhuma falta registrada.')];
  }
  if (aba === 'historico') {
    return [...topo, h('div', { class: 'cartao' }, h('p', {}, 'O histórico escolar junta os anos feitos no OGB (automático) e os anos de outras escolas (digitados uma vez).'),
      h('p', { class: 'suave' }, 'Em preparação: falta a escola definir a carga horária do Médio e as assinaturas do histórico.'),
      a.matriculas.length ? tabela(['Ano', 'Turma', 'Situação'], await Promise.all(a.matriculas.map(async x => {
        const t = await sistema.turma(x.turmaId);
        return h('tr', {}, h('td', {}, x.ano), h('td', {}, t ? nomeTurma(t) : '-'), h('td', {}, x.situacao || ''));
      }))) : null)];
  }
  // Dados
  const podeEditar = await sistema.pode('matricula.fazer');
  const form = formularioAluno(a, { desabilitado: !podeEditar });
  if (podeEditar) {
    form.append(h('div', { class: 'linha fim' }, h('button', { class: 'primario', type: 'submit' }, 'Salvar dados')));
    form.addEventListener('submit', async e => {
      e.preventDefault();
      try { await sistema.salvarAluno({ ...a, ...lerFormulario(form), id: alunoId }); avisar('Dados salvos.'); } catch (err) { avisar(err.message, 'erro'); }
    });
  }
  return [...topo, form];
}
