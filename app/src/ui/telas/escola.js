// Dados da escola usados nos documentos e o calendário dos trimestres.

import { h, campo, avisar, lerFormulario } from '../dom.js';

export async function tela(ctx) {
  const { sistema } = ctx;
  const e = await sistema.escola();
  const ano = e.anoLetivo;
  const tri = (e.trimestres && e.trimestres[ano]) || {};
  const fs = await sistema.funcionarios();
  const opcoesFunc = Object.fromEntries(fs.map(f => [f.id, `${f.nome} (${f.funcao})`]));
  const form = h('form', {},
    h('fieldset', {}, h('legend', {}, 'Cabeçalho dos documentos'), h('div', { class: 'campos' },
      campo('Nome', 'nome', e.nome), campo('Razão social', 'razaoSocial', e.razaoSocial), campo('CNPJ', 'cnpj', e.cnpj),
      campo('Endereço', 'endereco', e.endereco), campo('Cidade', 'cidade', e.cidade), campo('UF', 'uf', e.uf), campo('CEP', 'cep', e.cep),
      campo('Telefone', 'telefone', e.telefone, { ajuda: 'Ainda a definir: 3271-3135 ou 98788-0997 e 98831-2237.' }))),
    h('fieldset', {}, h('legend', {}, 'Assinaturas'), h('div', { class: 'campos' },
      campo('Secretária', 'secretariaId', e.secretariaId, { tipo: 'select', opcoes: opcoesFunc }),
      campo('Diretor(a)', 'diretorId', e.diretorId, { tipo: 'select', opcoes: opcoesFunc }))),
    h('fieldset', {}, h('legend', {}, `Ano letivo ${ano}`), h('div', { class: 'campos' },
      campo('Ano letivo atual', 'anoLetivo', ano, { tipo: 'number' }),
      ...['t1', 't2', 't3'].flatMap((t, i) => [campo(`${i + 1}º trimestre: início`, `tri.${t}.inicio`, (tri[t] || {}).inicio, { tipo: 'date' }),
        campo(`${i + 1}º trimestre: fim`, `tri.${t}.fim`, (tri[t] || {}).fim, { tipo: 'date' })]),
      campo('Horário da manhã', 'horarios.manha', (e.horarios || {}).manha), campo('Horário da tarde', 'horarios.tarde', (e.horarios || {}).tarde))),
    h('div', { class: 'linha fim' }, h('button', { class: 'primario', type: 'submit' }, 'Salvar')));
  form.addEventListener('submit', async ev => {
    ev.preventDefault();
    const { tri: novo, anoLetivo, ...resto } = lerFormulario(form);
    try {
      await sistema.salvarEscola({ ...resto, anoLetivo: Number(anoLetivo), trimestres: { ...(e.trimestres || {}), [ano]: novo } });
      avisar('Dados da escola salvos.');
    } catch (err) { avisar(err.message, 'erro'); }
  });
  return [h('h1', {}, 'Dados da escola'), form];
}
