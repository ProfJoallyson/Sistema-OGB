// Ajudantes mínimos de interface (sem biblioteca).

export function h(tag, attrs = {}, ...filhos) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === false || v === null || v === undefined) continue;
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'value') el.value = v;
    else if (k === 'checked' || k === 'disabled' || k === 'selected') el[k] = !!v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const f of filhos.flat(Infinity)) {
    if (f === null || f === undefined || f === false) continue;
    el.append(f instanceof Node ? f : document.createTextNode(String(f)));
  }
  return el;
}

// Troca o conteúdo de um elemento, ignorando vazios (null, false).
export function trocar(el, ...filhos) {
  el.replaceChildren(...filhos.flat(Infinity).filter(f => f !== null && f !== undefined && f !== false));
  return el;
}

export const $ = (sel, raiz = document) => raiz.querySelector(sel);

let timer;
export function avisar(msg, tipo = '') {
  document.querySelectorAll('.aviso').forEach(e => e.remove());
  const el = h('div', { class: `aviso ${tipo}`, role: 'status' }, msg);
  document.body.append(el);
  clearTimeout(timer);
  timer = setTimeout(() => el.remove(), tipo === 'erro' ? 6000 : 3000);
}

// Campo com rótulo. tipo: text | date | number | email | select | textarea | checkbox
export function campo(rotulo, nome, valor = '', { tipo = 'text', opcoes, largo, obrigatorio, ajuda, ...resto } = {}) {
  let input;
  if (tipo === 'select') {
    input = h('select', { name: nome, ...resto },
      Object.entries(opcoes).map(([v, t]) => h('option', { value: v, selected: String(v) === String(valor) }, t)));
  } else if (tipo === 'textarea') {
    input = h('textarea', { name: nome, rows: 4, ...resto });
    input.value = valor ?? '';
  } else {
    input = h('input', { name: nome, type: tipo, value: valor ?? '', required: obrigatorio, ...resto });
  }
  return h('div', { class: 'campo' + (largo ? ' largo' : '') }, h('label', {}, rotulo + (obrigatorio ? ' *' : '')), input,
    ajuda ? h('small', { class: 'suave' }, ajuda) : null);
}

// Lê um formulário em objeto; nomes com ponto viram objetos ("pai.nome").
export function lerFormulario(form) {
  const r = {};
  for (const el of form.elements) {
    if (!el.name) continue;
    const v = el.type === 'checkbox' ? el.checked : el.value.trim();
    const partes = el.name.split('.');
    let o = r;
    partes.slice(0, -1).forEach(p => { o = (o[p] ||= {}); });
    o[partes[partes.length - 1]] = v;
  }
  return r;
}

export function tabela(cabecalhos, linhas, { classe = '' } = {}) {
  return h('div', { class: 'tabela-rolagem' }, h('table', { class: 'dados-tabela ' + classe },
    h('thead', {}, h('tr', {}, cabecalhos.map(c => (c instanceof Node ? c : h('th', {}, c))))),
    h('tbody', {}, linhas)));
}

export function abas(opcoes, atual, aoEscolher) {
  return h('div', { class: 'abas', role: 'tablist' }, Object.entries(opcoes).map(([k, t]) =>
    h('button', { class: k === atual ? 'ativa' : '', role: 'tab', 'aria-selected': k === atual ? 'true' : 'false', onclick: () => aoEscolher(k) }, t)));
}

// Imprime HTML de documentos (o navegador oferece "Salvar como PDF").
export function imprimir(html) {
  const area = document.getElementById('impressao');
  area.innerHTML = html;
  setTimeout(() => window.print(), 50);
}

// Lê planilha (.xlsx/.xls/.csv) ou texto em matriz de linhas. Usa a SheetJS embutida em vendor/.
export async function lerPlanilha(arquivo) {
  const nome = arquivo.name.toLowerCase();
  if (nome.endsWith('.csv') || nome.endsWith('.txt')) {
    const texto = await arquivo.text();
    const sep = (texto.split('\n')[0].match(/;/g) || []).length > (texto.split('\n')[0].match(/,/g) || []).length ? ';' : ',';
    return { [arquivo.name]: texto.split(/\r?\n/).map(l => l.split(sep).map(c => c.replace(/^"|"$/g, '').trim())) };
  }
  if (!window.XLSX) await carregarScript('vendor/xlsx.full.min.js');
  const wb = window.XLSX.read(await arquivo.arrayBuffer(), { type: 'array', cellDates: true });
  return Object.fromEntries(wb.SheetNames.map(n => [n, window.XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: false, defval: '' })]));
}

function carregarScript(src) {
  return new Promise((ok, erro) => { const s = h('script', { src }); s.onload = ok; s.onerror = () => erro(new Error('Não consegui abrir o leitor de planilhas.')); document.head.append(s); });
}

export const ICONES = {
  doc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M8 13h8M8 17h5"/></svg>',
  aluno: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/></svg>',
  turma: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="8" cy="9" r="3"/><circle cx="16" cy="9" r="3"/><path d="M2 20c0-3 3-5 6-5s6 2 6 5M14 15c3 0 8 1 8 5"/></svg>',
};
