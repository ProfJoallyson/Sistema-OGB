// Emissão de documentos: escolher o tipo, o aluno/funcionário/turma, responder o que falta,
// ver a prévia e emitir (fica registrado com código de autenticidade).

import { h, avisar, imprimir, tabela, ICONES } from '../dom.js';
import { MODELOS, GRUPOS, EM_BREVE, modelo as acharModelo } from '../../documentos/modelos.js';
import { contextoDocumento, emitir } from '../../documentos/emitir.js';
import { gerarFolha, padroes } from '../../documentos/pagina.js';

const icone = m => ICONES[m.alvo === 'turma' ? 'turma' : m.grupo === 'aluno' ? 'aluno' : 'doc'];

export async function tela(ctx, [tipo, alvoId]) {
  const { sistema } = ctx;
  const podeEmitir = await sistema.pode('documentos.emitir');
  if (tipo === 'emitidos' || !podeEmitir) return emitidos(ctx, podeEmitir);
  if (tipo === 'aluno' && alvoId) return escolherTipo(ctx, alvoId);
  if (!tipo) return escolherTipo(ctx);
  const m = acharModelo(tipo);
  if (!alvoId) return escolherAlvo(ctx, m);
  return preparar(ctx, m, alvoId);
}

function item(m, href, extra) {
  return h('a', { class: `cartao doc-item grupo-${GRUPOS[m.grupo].cor}`, href }, h('span', { class: 'doc-icone', html: icone(m) }),
    h('span', {}, h('b', {}, m.nome), extra ? [h('br'), h('small', { class: 'suave' }, extra)] : null));
}

async function escolherTipo(ctx, alunoId) {
  const lista = alunoId ? MODELOS.filter(m => m.alvo === 'aluno') : MODELOS;
  const partes = [h('div', { class: 'linha' }, h('h1', { style: 'margin:0' }, 'Documentos'), h('span', { class: 'espaco' }), h('a', { class: 'botao', href: '#/documentos/emitidos' }, 'Documentos emitidos'))];
  if (alunoId) partes.push(h('p', {}, 'Para: ', h('b', {}, (await ctx.sistema.aluno(alunoId)).nome)));
  for (const [g, info] of Object.entries(GRUPOS)) {
    const ms = lista.filter(m => m.grupo === g);
    if (!ms.length) continue;
    partes.push(h('h2', {}, info.nome), h('div', { class: 'grade-cartoes' },
      ms.map(m => item(m, alunoId ? `#/documentos/${m.id}/${alunoId}` : `#/documentos/${m.id}`)),
      alunoId ? null : EM_BREVE.filter(e => e.grupo === g).map(e => h('div', { class: `cartao doc-item grupo-${info.cor}`, style: 'opacity:.6' },
        h('span', { class: 'doc-icone', html: ICONES.doc }), h('span', {}, h('b', {}, e.nome), h('br'), h('small', { class: 'suave' }, 'Em breve: ' + e.motivo))))));
  }
  return partes;
}

async function escolherAlvo(ctx, m) {
  const { sistema } = ctx;
  const voltar = h('div', { class: 'linha' }, h('a', { href: '#/documentos' }, '← Documentos'));
  if (m.alvo === 'turma') {
    const turmas = await sistema.turmas();
    return [voltar, h('h1', {}, m.nome), h('div', { class: 'grade-cartoes' }, turmas.map(t => h('a', { class: 'cartao', href: `#/documentos/${m.id}/${t.id}` }, h('b', {}, t.nome))))];
  }
  if (m.alvo === 'funcionario') {
    const fs = await sistema.funcionarios();
    return [voltar, h('h1', {}, m.nome), tabela(['Funcionário', 'Função'], fs.map(f => h('tr', {}, h('td', {}, h('a', { href: `#/documentos/${m.id}/${f.id}` }, f.nome)), h('td', {}, f.funcao))))];
  }
  const alunos = await sistema.alunos();
  const busca = h('input', { type: 'search', placeholder: 'Digite o nome do aluno', 'aria-label': 'Buscar aluno', autofocus: true });
  const lista = h('div', { class: 'grade-cartoes' });
  const desenhar = () => {
    const q = busca.value.trim().toLowerCase();
    lista.replaceChildren(...alunos.filter(a => !q || a.nome.toLowerCase().includes(q)).slice(0, 30)
      .map(a => h('a', { class: 'cartao', href: `#/documentos/${m.id}/${a.id}` }, a.nome)));
  };
  busca.addEventListener('input', desenhar);
  desenhar();
  const lote = m.loteTurma ? h('p', {}, 'Ou emita para a turma inteira em ', h('a', { href: '#/boletins' }, 'Turmas e boletins'), '.') : null;
  return [voltar, h('h1', {}, m.nome), h('div', { class: 'linha' }, h('div', { style: 'flex:1' }, busca)), lote, lista];
}

async function preparar(ctx, m, alvoId) {
  const { sistema } = ctx;
  const c = await contextoDocumento(sistema, m, alvoId, { logo: ctx.logo });
  const motivo = m.disponivel && m.disponivel(c);
  const voltar = h('div', { class: 'linha' }, h('a', { href: `#/documentos/${m.id}` }, '← Escolher outro'));
  if (motivo) return [voltar, h('h1', {}, m.nome), h('p', { class: 'erro' }, motivo)];
  const respostas = padroes(m, c);
  const previa = h('div', { class: 'previa' });
  const desenhar = () => { previa.innerHTML = gerarFolha(m, c, respostas); };
  const perguntas = (m.perguntas ? m.perguntas(c) : []).map(q => {
    let el;
    if (q.tipo === 'opcoes') el = h('select', {}, Object.entries(q.opcoes).map(([k, v]) => h('option', { value: k, selected: String(k) === String(q.padrao) }, v)));
    else el = h('input', { type: q.tipo === 'numero' ? 'number' : q.tipo === 'data' ? 'date' : 'text', value: q.padrao ?? '' });
    el.addEventListener('input', () => { respostas[q.id] = el.value; desenhar(); });
    el.addEventListener('change', () => { respostas[q.id] = el.value; desenhar(); });
    return h('div', { class: 'campo' }, h('label', {}, q.rotulo), el);
  });
  desenhar();
  return [voltar, h('h1', {}, m.nome),
    perguntas.length ? h('div', { class: 'cartao' }, h('p', { class: 'suave' }, 'O sistema já preencheu os dados. Só falta isto:'), h('div', { class: 'campos' }, perguntas)) : null,
    h('div', { class: 'linha fim' }, h('button', { class: 'primario', onclick: async () => {
      try {
        const { html, emissao } = await emitir(sistema, m.id, alvoId, respostas, { logo: ctx.logo });
        avisar(`Documento emitido. Código ${emissao.codigo}.`);
        imprimir(html);
      } catch (e) { avisar(e.message, 'erro'); }
    } }, 'Emitir e imprimir / PDF')),
    previa];
}

async function emitidos(ctx, podeEmitir) {
  const es = await ctx.sistema.emissoes();
  return [h('div', { class: 'linha' }, podeEmitir ? h('a', { href: '#/documentos' }, '← Documentos') : null),
    h('h1', {}, 'Documentos emitidos'),
    es.length ? tabela(['Quando', 'Documento', 'Para', 'Emitido por', 'Código'], es.slice(0, 300).map(e => h('tr', {},
      h('td', {}, new Date(e.em).toLocaleString('pt-BR')), h('td', {}, (acharModelo(e.tipo) || {}).nome || e.tipo), h('td', {}, e.alvoNome), h('td', {}, e.usuarioNome), h('td', {}, h('code', {}, e.codigo)))))
      : h('p', { class: 'suave' }, 'Nenhum documento emitido ainda.')];
}
