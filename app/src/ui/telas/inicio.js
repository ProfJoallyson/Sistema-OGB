import { h } from '../dom.js';
import { disciplina } from '../../regras/curriculo.js';
import { PERFIS } from '../../modelo/perfis.js';

export async function tela({ sistema, usuario, exemplo }) {
  const partes = [h('h1', {}, `Olá, ${usuario.nome.split(' ')[0]}`)];
  if (exemplo) partes.push(h('p', { class: 'aviso-exemplo' }, 'Versão de teste: os dados são fictícios e ficam só neste navegador. Nada aqui vai para o boletim real.'));
  partes.push(h('p', { class: 'suave' }, usuario.perfis.map(p => PERFIS[p].descricao).join(' ')));

  if (usuario.perfis.includes('professor')) {
    const minhas = await sistema.minhasAtribuicoes();
    const turmas = Object.fromEntries((await sistema.turmas()).map(t => [t.id, t]));
    partes.push(h('h2', {}, 'Minhas turmas'));
    partes.push(minhas.length
      ? h('div', { class: 'grade-cartoes' }, minhas.filter(a => turmas[a.turmaId]).map(a =>
        h('a', { class: 'cartao', href: `#/notas/${a.turmaId}/${a.disciplinaId}` },
          h('b', {}, turmas[a.turmaId].nome), h('br'), h('span', { class: 'suave' }, disciplina(a.disciplinaId).nome))))
      : h('p', { class: 'suave' }, 'Nenhuma turma atribuída a você ainda. A secretaria faz essa ligação em "Turmas e professores".'));
  }

  if (sistema.veTodasAsTurmas()) {
    const ts = await sistema.turmas();
    const atalhos = [
      ['boletim.ver', '#/boletins', 'Turmas e boletins', `${ts.length} turmas no ano letivo`],
      ['matricula.fazer', '#/matricula', 'Nova matrícula', 'Cadastrar aluno e matricular'],
      ['simulados.lancar', '#/simulados', 'Simulados', 'Lançar acertos de SO, SP, SG e SE'],
      ['frequencia.lancar', '#/frequencia', 'Frequência', 'Importar a lista da catraca'],
      ['documentos.emitir', '#/documentos', 'Documentos', 'Declarações, boletins, fichas e listas'],
      ['usuarios.gerenciar', '#/usuarios', 'Usuários e perfis', 'Quem acessa e o que pode fazer'],
    ];
    const cards = [];
    for (const [acao, href, titulo, sub] of atalhos) {
      if (await sistema.pode(acao)) cards.push(h('a', { class: 'cartao', href }, h('b', {}, titulo), h('br'), h('span', { class: 'suave' }, sub)));
    }
    partes.push(h('h2', {}, 'Atalhos'), h('div', { class: 'grade-cartoes' }, cards));
  }
  return partes;
}
