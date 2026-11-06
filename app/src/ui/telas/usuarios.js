// Usuários e perfis: o administrador define quem entra e o que cada um pode fazer.
// Pode ser um por um ou pela planilha modelo (modelo-usuarios.xlsx).

import { h, avisar, lerPlanilha, tabela, trocar } from '../dom.js';
import { PERFIS, DOMINIO_ESCOLA } from '../../modelo/perfis.js';
import { prepararImportacao } from '../../servicos/importar-usuarios.js';
import { disciplina } from '../../regras/curriculo.js';

export async function tela(ctx) {
  const { sistema } = ctx;
  const gerencia = await sistema.pode('usuarios.gerenciar');
  const usuarios = (await sistema.usuarios()).sort((a, b) => a.nome.localeCompare(b.nome));

  const linha = u => {
    const marcas = Object.entries(PERFIS).map(([k, p]) => h('label', {}, h('input', { type: 'checkbox', value: k, checked: u.perfis.includes(k), disabled: !gerencia }), p.nome));
    const corrige = h('input', { type: 'checkbox', checked: u.corrigeNotas, disabled: !gerencia, 'aria-label': 'Pode corrigir notas' });
    const ativo = h('input', { type: 'checkbox', checked: u.ativo !== false, disabled: !gerencia, 'aria-label': 'Ativo' });
    const salvar = async () => {
      try {
        const perfis = marcas.map(l => l.querySelector('input')).filter(i => i.checked).map(i => i.value);
        const r = await sistema.salvarUsuario({ ...u, perfis, corrigeNotas: corrige.checked, ativo: ativo.checked });
        corrige.checked = r.corrigeNotas;
        avisar('Salvo.');
      } catch (e) { avisar(e.message, 'erro'); }
    };
    [...marcas.map(l => l.querySelector('input')), corrige, ativo].forEach(i => i.addEventListener('change', salvar));
    return h('tr', {}, h('td', { class: 'nome' }, h('b', {}, u.nome), h('br'), h('small', { class: 'suave' }, u.email)),
      h('td', {}, h('div', { class: 'opcoes-check' }, marcas)), h('td', { class: 'num' }, corrige), h('td', { class: 'num' }, ativo));
  };

  const partes = [h('h1', {}, 'Usuários e perfis'),
    h('p', { class: 'suave' }, `Cada pessoa entra com a conta Google da escola (@${DOMINIO_ESCOLA}). Só entra quem está nesta lista. "Corrige notas" vale só para a secretaria.`)];

  if (gerencia) {
    const nome = h('input', { placeholder: 'Nome', 'aria-label': 'Nome' });
    const email = h('input', { placeholder: `email@${DOMINIO_ESCOLA}`, type: 'email', 'aria-label': 'E-mail' });
    const perfil = h('select', { 'aria-label': 'Perfil' }, Object.entries(PERFIS).map(([k, p]) => h('option', { value: k }, p.nome)));
    partes.push(h('div', { class: 'cartao' }, h('h2', {}, 'Incluir pessoa'),
      h('div', { class: 'campos' }, h('div', { class: 'campo' }, nome), h('div', { class: 'campo' }, email), h('div', { class: 'campo' }, perfil)),
      h('div', { class: 'linha fim' }, h('button', { class: 'primario', onclick: async () => {
        try { await sistema.salvarUsuario({ nome: nome.value, email: email.value, perfis: [perfil.value] }); avisar('Pessoa incluída.'); ctx.recarregar(); } catch (e) { avisar(e.message, 'erro'); }
      } }, 'Incluir'))), importacao(ctx));
  }
  partes.push(h('h2', {}, `${usuarios.length} pessoas`), tabela(['Pessoa', 'Perfis', 'Corrige notas', 'Ativo'], usuarios.map(linha)));
  return partes;
}

function importacao(ctx) {
  const { sistema } = ctx;
  const arquivo = h('input', { type: 'file', accept: '.xlsx,.xls,.csv', 'aria-label': 'Planilha de usuários' });
  const saida = h('div');
  arquivo.addEventListener('change', async () => {
    try {
      const abas = await lerPlanilha(arquivo.files[0]);
      const pega = nome => Object.entries(abas).find(([k]) => k.toLowerCase().startsWith(nome))?.[1] || [];
      const pessoas = pega('pessoas').length ? pega('pessoas') : Object.values(abas)[0];
      const turmas = await sistema.turmas();
      const plano = prepararImportacao({ pessoas, aulas: pega('aulas') }, turmas);
      const nomeTurma = id => (turmas.find(t => t.id === id) || {}).nome;
      trocar(saida, 
        h('p', {}, `${plano.usuarios.length} pessoas e ${plano.atribuicoes.length} aulas encontradas.`),
        plano.erros.length ? [h('p', { class: 'erro' }, `${plano.erros.length} problemas para corrigir na planilha:`),
          h('ul', { class: 'lista-erros' }, plano.erros.map(e => h('li', {}, `Aba ${e.aba}, linha ${e.linha}: ${e.msg}`)))] : null,
        plano.avisos.length ? h('ul', {}, plano.avisos.map(e => h('li', { class: 'suave' }, e.linha === '-' ? e.msg : `Aba ${e.aba}, linha ${e.linha}: ${e.msg}`))) : null,
        h('details', {}, h('summary', {}, 'Ver o que será gravado'),
          tabela(['Nome', 'E-mail', 'Perfis'], plano.usuarios.map(u => h('tr', {}, h('td', {}, u.nome), h('td', {}, u.email), h('td', {}, u.perfis.map(p => PERFIS[p].nome).join(', ') + (u.corrigeNotas ? ' (corrige notas)' : ''))))),
          tabela(['Professor', 'Turma', 'Disciplina'], plano.atribuicoes.map(a => h('tr', {}, h('td', {}, a.email), h('td', {}, nomeTurma(a.turmaId)), h('td', {}, disciplina(a.disciplinaId).nome))))),
        h('div', { class: 'linha fim' }, h('button', { class: 'primario', disabled: plano.erros.length > 0 || (!plano.usuarios.length && !plano.atribuicoes.length), onclick: async () => {
          try { const r = await sistema.aplicarImportacaoUsuarios(plano); avisar(`Importado: ${r.usuarios} pessoas e ${r.atribuicoes} aulas.`); ctx.recarregar(); } catch (e) { avisar(e.message, 'erro'); }
        } }, 'Gravar no sistema')));
    } catch (e) { avisar(e.message, 'erro'); }
  });
  return h('div', { class: 'cartao' }, h('h2', {}, 'Subir pela planilha'),
    h('p', {}, 'Preencha a ', h('a', { href: 'modelos/modelo-usuarios.xlsx', download: true }, 'planilha modelo'), ' (aba Pessoas com os perfis e aba Aulas com turma e disciplina de cada professor) e escolha o arquivo. O sistema mostra os erros antes de gravar.'),
    arquivo, saida);
}
