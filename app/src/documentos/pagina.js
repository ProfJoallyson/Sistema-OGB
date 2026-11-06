// Monta a folha A4 de um documento: cabeçalho da escola, título, corpo,
// local e data, assinatura e o código de autenticidade.

import { esc, dataPorExtenso } from './texto.js';

export function cabecalho(escola, logo) {
  const end = [escola.endereco, `${escola.cidade}-${escola.uf}`, escola.cep && `CEP ${escola.cep}`].filter(Boolean).join(' · ');
  return `<header class="cab-escola">${logo ? `<img src="${esc(logo)}" alt="Logo do ${esc(escola.nome)}">` : ''}
    <div><p class="nome-escola">${esc(escola.nome)}</p>
    <p>${esc(escola.razaoSocial)} · CNPJ ${esc(escola.cnpj)}</p>
    <p>${esc(end)}${escola.telefone ? ` · Fone ${esc(escola.telefone)}` : ''}</p></div></header>`;
}

function assinatura(func) {
  if (!func) return '<div class="assinatura"><span class="linha"></span><p>Assinatura</p></div>';
  const reg = func.registro ? ` · Reg. ${esc(func.registro)}` : '';
  return `<div class="assinatura"><span class="linha"></span><p><b>${esc(func.nome)}</b></p><p>${esc(func.funcao)}${reg}</p></div>`;
}

const espacado = t => esc(t).split('').join(' ').replace(/ {3}/g, ' &nbsp; ');

// doc = { modelo, corpo, assinante: 'secretaria'|'diretor'|null, emissao, data }
export function folha({ modelo, corpo, assinante, emissao, data, ctx }) {
  const escola = ctx.escola;
  const func = assinante === 'diretor' ? ctx.diretor : assinante === 'secretaria' ? ctx.secretaria : null;
  const titulo = modelo.titulo.length <= 12 ? espacado(modelo.titulo) : esc(modelo.titulo);
  const fecho = assinante === null ? '' :
    `<p class="local-data">${esc(escola.cidade || 'Guarabira')}, ${dataPorExtenso(data || new Date())}.</p>${assinatura(func)}`;
  const codigo = emissao ? `<footer class="autenticidade">Documento emitido pelo sistema do ${esc(escola.nome)} em ${new Date(emissao.em).toLocaleString('pt-BR')} · Código de autenticidade <b>${esc(emissao.codigo)}</b></footer>` : '';
  return `<section class="folha ${modelo.orientacao === 'paisagem' ? 'paisagem' : 'retrato'} doc-${modelo.id}">
    ${cabecalho(escola, ctx.logo)}
    <h1 class="titulo-doc">${titulo}</h1>
    <div class="corpo">${corpo}</div>
    ${fecho}${codigo}</section>`;
}

// Gera o HTML final de um documento (uma folha) com o modelo e as respostas.
export function gerarFolha(modelo, ctx, respostas = {}, emissao = null) {
  const r = { ...padroes(modelo, ctx), ...respostas };
  const corpo = modelo.montar(ctx, r);
  const assinante = modelo.assinatura ? modelo.assinatura(r, ctx) : 'secretaria';
  return folha({ modelo, corpo, assinante, emissao, ctx });
}

export function padroes(modelo, ctx) {
  const qs = modelo.perguntas ? modelo.perguntas(ctx) : [];
  return Object.fromEntries(qs.map(q => [q.id, q.padrao]));
}
