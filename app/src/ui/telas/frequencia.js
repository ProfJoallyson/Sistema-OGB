// Frequência pela catraca: a lista de quem entrou no dia vira faltas para quem não entrou.

import { h, avisar, lerPlanilha, tabela, trocar } from '../dom.js';
import { nomesDaLista, conferirCatraca } from '../../servicos/catraca.js';
import { AULAS_POR_DIA } from '../../servicos/sistema.js';
import { dataCurta } from '../../documentos/texto.js';

export async function tela(ctx) {
  const { sistema } = ctx;
  const turmas = await sistema.turmas();
  const d = new Date();
  const hoje = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const data = h('input', { type: 'date', value: hoje, 'aria-label': 'Dia' });
  const marcas = turmas.map(t => h('label', {}, h('input', { type: 'checkbox', value: t.id, checked: true }), t.nome));
  const texto = h('textarea', { rows: 8, placeholder: 'Cole aqui os nomes (um por linha) ou escolha o arquivo da catraca abaixo.' });
  const arquivo = h('input', { type: 'file', accept: '.csv,.txt,.xlsx,.xls' });
  const resultado = h('div');

  arquivo.addEventListener('change', async () => {
    try {
      const abasPlanilha = await lerPlanilha(arquivo.files[0]);
      const primeira = Object.values(abasPlanilha)[0];
      texto.value = nomesDaLista(primeira).join('\n');
      avisar(`${texto.value.split('\n').filter(Boolean).length} nomes lidos do arquivo.`);
    } catch (e) { avisar(e.message, 'erro'); }
  });

  const conferir = async () => {
    const turmaIds = marcas.map(l => l.querySelector('input')).filter(i => i.checked).map(i => i.value);
    const alunos = (await Promise.all(turmaIds.map(id => sistema.alunosDaTurma(id)))).flat().filter(a => a.matricula.situacao === 'ativa' || !a.matricula.situacao);
    const nomes = nomesDaLista(texto.value.split(/\r?\n/));
    if (!nomes.length) { avisar('A lista está vazia.', 'erro'); return; }
    const r = conferirCatraca(nomes, alunos);
    const escolhas = r.duvidas.map(d => h('select', {}, h('option', { value: '' }, 'Nenhum destes (ignorar)'),
      d.sugestoes.map((s, i) => h('option', { value: s.alunoId, selected: i === 0 }, `${s.nome} (${Math.round(s.semelhanca * 100)}%)`))));
    const nomeDe = id => (alunos.find(a => a.id === id) || {}).nome;
    trocar(resultado, h('div', { class: 'cartao' },
      h('h2', {}, `Conferência do dia ${dataCurta(data.value)}`),
      h('p', {}, `${r.presentes.length} alunos encontrados na lista · ${r.ausentes.length} sem registro na catraca (levam ${AULAS_POR_DIA} faltas cada)`),
      r.duvidas.length ? [h('h3', {}, 'Confirme os nomes parecidos'), tabela(['Na catraca', 'É o aluno'], r.duvidas.map((d, i) => h('tr', {}, h('td', {}, d.nomeCatraca), h('td', {}, escolhas[i]))))] : null,
      r.naoEncontrados.length ? h('details', {}, h('summary', {}, `Nomes da catraca que não são de alunos destas turmas: ${r.naoEncontrados.length}`), h('ul', {}, r.naoEncontrados.map(n => h('li', {}, n)))) : null,
      r.ausentes.length ? h('details', {}, h('summary', {}, 'Quem vai levar falta'), h('ul', {}, r.ausentes.map(id => h('li', {}, nomeDe(id))))) : null,
      h('div', { class: 'linha fim' }, h('button', { class: 'primario', onclick: async () => {
        const presentes = [...r.presentes, ...escolhas.map(s => s.value).filter(Boolean)];
        try {
          const { ausentes } = await sistema.registrarDia({ data: data.value, turmaIds, presentes });
          avisar(`Dia gravado: ${ausentes} alunos com falta.`);
          resultado.replaceChildren();
        } catch (e) { avisar(e.message, 'erro'); }
      } }, 'Gravar o dia'))));
  };

  return [h('h1', {}, 'Frequência pela catraca'),
    h('p', { class: 'suave' }, `Cada dia em que o aluno não passa na catraca conta ${AULAS_POR_DIA} faltas. Reenviar a lista do mesmo dia corrige o que foi gravado. Faltas podem ser desfeitas na ficha do aluno, e tudo fica no histórico.`),
    h('div', { class: 'cartao' },
      h('div', { class: 'campos' }, h('div', { class: 'campo' }, h('label', {}, 'Dia'), data), h('div', { class: 'campo' }, h('label', {}, 'Arquivo da catraca (CSV ou Excel)'), arquivo)),
      h('label', {}, 'Turmas'), h('div', { class: 'opcoes-check', style: 'margin-bottom:12px' }, marcas),
      h('label', {}, 'Lista de quem entrou'), texto,
      h('div', { class: 'linha fim', style: 'margin-top:12px' }, h('button', { class: 'primario', onclick: conferir }, 'Conferir lista'))),
    resultado];
}
