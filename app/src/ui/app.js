// Início do app: escolhe o banco, faz o login, monta o menu do perfil e as rotas.

import { CONFIG } from '../config.js';
import { RepositorioMemoria, armazenamentoNavegador } from '../dados/memoria.js';
import { dadosDeExemplo } from '../dados/exemplo.js';
import { confere } from '../dados/repositorio.js';
import { Sistema } from '../servicos/sistema.js';
import { PERFIS, DOMINIO_ESCOLA, pode } from '../modelo/perfis.js';
import { h, avisar } from './dom.js';

import * as inicio from './telas/inicio.js';
import * as notas from './telas/notas.js';
import * as turmas from './telas/turmas.js';
import * as alunos from './telas/alunos.js';
import * as matricula from './telas/matricula.js';
import * as simulados from './telas/simulados.js';
import * as frequencia from './telas/frequencia.js';
import * as boletins from './telas/boletins.js';
import * as documentos from './telas/documentos.js';
import * as usuarios from './telas/usuarios.js';
import * as historico from './telas/historico.js';
import * as escola from './telas/escola.js';

const LOGO = 'icons/logo-ogb.png';

// [rota, rótulo do menu, ação exigida (ou função), módulo]
const ROTAS = [
  ['inicio', 'Início', null, inicio],
  ['notas', 'Lançar notas', u => u.perfis.includes('professor') || (u.perfis.includes('secretaria') && u.corrigeNotas) || u.perfis.includes('admin'), notas],
  ['boletins', 'Turmas e boletins', 'boletim.ver', boletins],
  ['alunos', 'Alunos', u => ['secretaria', 'tesouraria', 'coordenacao', 'direcao', 'admin'].some(p => u.perfis.includes(p)), alunos],
  ['matricula', 'Nova matrícula', 'matricula.fazer', matricula],
  ['simulados', 'Simulados', 'simulados.lancar', simulados],
  ['frequencia', 'Frequência (catraca)', 'frequencia.lancar', frequencia],
  ['documentos', 'Documentos', 'documentos.ver', documentos],
  ['turmas', 'Turmas e professores', 'cadastros.editar', turmas],
  ['usuarios', 'Usuários e perfis', 'usuarios.ver', usuarios],
  ['historico', 'Histórico de alterações', 'historico.ver', historico],
  ['escola', 'Dados da escola', 'escola.editar', escola],
];

const estado = { repo: null, sistema: null, usuario: null, login: null };

function rotasDoUsuario(u) {
  // Professor vê "Turmas e boletins" só das suas turmas, então a ação genérica basta.
  return ROTAS.filter(([, , req]) => !req || (typeof req === 'function' ? req(u) : pode(u, req, {}, {})));
}

async function iniciar() {
  if (CONFIG.modo === 'firebase' && CONFIG.firebase) {
    const { iniciarFirebase } = await import('../dados/firebase.js');
    const fb = await iniciarFirebase(CONFIG.firebase);
    estado.repo = confere(fb.repo);
    estado.login = fb.login;
    fb.login.aoMudar(email => (email ? entrarComEmail(email) : telaEntrada()));
  } else {
    estado.armazenamento = armazenamentoNavegador();
    estado.repo = confere(new RepositorioMemoria(dadosDeExemplo(), estado.armazenamento));
    let salvo = null;
    try { salvo = sessionStorage.getItem('ogb-usuario'); } catch { /* ignora */ }
    if (salvo) await entrarComEmail(salvo); else telaEntrada();
  }
  window.addEventListener('hashchange', mostrarRota);
}

async function entrarComEmail(email) {
  const s = new Sistema(estado.repo, { id: 'login', perfis: [] });
  const u = await s.usuarioPorEmail(email);
  if (!u) {
    telaEntrada(`O e-mail ${email} não está cadastrado no sistema. Peça ao administrador para incluir você.`);
    if (estado.login) await estado.login.sair();
    return;
  }
  estado.usuario = u;
  estado.sistema = new Sistema(estado.repo, u);
  try { sessionStorage.setItem('ogb-usuario', email); } catch { /* ignora */ }
  montarApp();
}

function sair() {
  try { sessionStorage.removeItem('ogb-usuario'); } catch { /* ignora */ }
  estado.usuario = null;
  if (estado.login) estado.login.sair();
  location.hash = '';
  telaEntrada();
}

async function telaEntrada(erro) {
  const raiz = document.getElementById('raiz');
  const cartao = h('div', { class: 'cartao' },
    h('img', { src: LOGO, alt: 'Colégio e Curso OGB' }),
    h('h1', {}, 'Colégio e Curso OGB'),
    h('p', { class: 'slogan' }, 'Para grandes conquistas, a melhor escola!'),
    erro ? h('p', { class: 'erro' }, erro) : null);
  if (estado.login) {
    cartao.append(h('button', { class: 'primario', onclick: async () => {
      try { await estado.login.entrar(DOMINIO_ESCOLA); } catch (e) { avisar(e.message, 'erro'); }
    } }, 'Entrar com a conta Google da escola'), h('p', { class: 'suave' }, `Use o seu e-mail @${DOMINIO_ESCOLA}.`));
  } else {
    const us = await estado.repo.listar('usuarios');
    cartao.append(
      h('p', { class: 'aviso-exemplo' }, 'Versão de teste com dados de exemplo (fictícios). Escolha um perfil para entrar. Depois do Firebase, o login será com a conta Google da escola.'),
      h('div', { class: 'usuarios-exemplo' }, us.map(u => h('button', { onclick: () => entrarComEmail(u.email) },
        h('span', {}, u.nome), h('small', { class: 'suave' }, u.perfis.map(p => PERFIS[p].nome).join(' + '))))),
      h('p', {}), h('button', { class: 'perigo', onclick: () => { estado.armazenamento.limpar(); location.reload(); } }, 'Voltar aos dados de exemplo'));
  }
  raiz.replaceChildren(h('main', { class: 'entrada' }, cartao));
}

function montarApp() {
  const u = estado.usuario;
  const menu = h('aside', { class: 'menu', id: 'menu' },
    h('div', { class: 'marca' }, h('img', { src: LOGO, alt: '' }), h('div', {}, h('b', {}, 'Colégio e Curso OGB'), h('small', {}, 'Sistema escolar'))),
    h('nav', { 'aria-label': 'Menu' }, rotasDoUsuario(u).map(([r, rot]) => h('a', { href: `#/${r}`, 'data-rota': r, onclick: () => menu.classList.remove('aberto') }, rot))),
    h('div', { class: 'quem' }, h('b', {}, u.nome), h('br'), h('span', { class: 'suave' }, u.perfis.map(p => PERFIS[p].nome).join(' + ')), h('br'),
      h('button', { onclick: sair, style: 'margin-top:8px' }, 'Sair')));
  const topo = h('div', { class: 'topo-celular' }, h('button', { class: 'icone', 'aria-label': 'Abrir menu', onclick: () => menu.classList.toggle('aberto') }, '☰'), h('b', {}, 'Colégio e Curso OGB'));
  const conteudo = h('main', { class: 'conteudo', id: 'conteudo' });
  document.getElementById('raiz').replaceChildren(h('div', { class: 'app' }, menu, h('div', {}, topo, conteudo)));
  mostrarRota();
}

async function mostrarRota() {
  if (!estado.usuario) return;
  const [nome = 'inicio', ...params] = location.hash.replace(/^#\/?/, '').split('/').map(decodeURIComponent);
  const rota = rotasDoUsuario(estado.usuario).find(([r]) => r === nome) || ROTAS[0];
  document.querySelectorAll('.menu nav a').forEach(a => a.classList.toggle('ativo', a.dataset.rota === rota[0]));
  const conteudo = document.getElementById('conteudo');
  conteudo.replaceChildren(h('p', { class: 'suave' }, 'Carregando…'));
  const ctx = {
    sistema: estado.sistema, usuario: estado.usuario, logo: LOGO,
    ir: caminho => { location.hash = '#/' + caminho; },
    recarregar: mostrarRota,
    exemplo: !estado.login,
  };
  try {
    const tela = await rota[3].tela(ctx, params);
    conteudo.replaceChildren(...[tela].flat(Infinity).filter(x => x !== null && x !== undefined && x !== false));
  } catch (e) {
    console.error(e);
    conteudo.replaceChildren(h('div', { class: 'cartao' }, h('h2', {}, 'Não foi possível abrir esta tela'), h('p', { class: 'erro' }, e.message)));
  }
  window.scrollTo(0, 0);
}

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch(() => { /* sem cache offline */ });
}

iniciar().catch(e => {
  console.error(e);
  document.getElementById('raiz').replaceChildren(h('p', { class: 'erro', style: 'padding:16px' }, 'Erro ao iniciar: ' + e.message));
});
