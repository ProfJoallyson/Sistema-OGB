import { h, tabela } from '../dom.js';
import { formatar } from '../../regras/boletim.js';

const mostrar = v => {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'number') return formatar(v);
  if (typeof v === 'object') return Object.entries(v).map(([k, x]) => `${k}: ${typeof x === 'number' ? formatar(x) : x ?? '—'}`).join(' · ');
  return String(v);
};

export async function tela({ sistema }) {
  const hs = await sistema.historico();
  const filtro = h('input', { type: 'search', placeholder: 'Filtrar por pessoa, coleção ou campo', 'aria-label': 'Filtrar' });
  const corpo = h('tbody');
  const desenhar = () => {
    const q = filtro.value.trim().toLowerCase();
    corpo.replaceChildren(...hs.filter(x => !q || `${x.usuarioNome} ${x.colecao} ${x.campo} ${x.docId} ${x.acao}`.toLowerCase().includes(q)).slice(0, 500).map(x =>
      h('tr', {}, h('td', {}, new Date(x.em).toLocaleString('pt-BR')), h('td', {}, x.usuarioNome), h('td', {}, x.acao),
        h('td', {}, `${x.colecao} / ${x.docId}`), h('td', {}, x.campo), h('td', { class: 'nome' }, mostrar(x.antes)), h('td', { class: 'nome' }, mostrar(x.depois)))));
  };
  filtro.addEventListener('input', desenhar);
  desenhar();
  return [h('h1', {}, 'Histórico de alterações'), h('p', { class: 'suave' }, 'Toda mudança fica aqui: quem fez, quando, o valor anterior e o novo.'),
    h('div', { class: 'linha' }, h('div', { style: 'flex:1' }, filtro)),
    h('div', { class: 'tabela-rolagem' }, h('table', { class: 'dados-tabela' }, h('thead', {}, h('tr', {}, ['Quando', 'Quem', 'Ação', 'Registro', 'Campo', 'Antes', 'Depois'].map(c => h('th', {}, c)))), corpo))];
}
