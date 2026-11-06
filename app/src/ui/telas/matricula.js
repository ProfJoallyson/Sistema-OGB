// Matrícula feita pela tesouraria (ou secretaria): os dados vão direto para a ficha do aluno.

import { h, campo, avisar, lerFormulario } from '../dom.js';
import { SEXOS, BOLSAS, TURNOS } from '../../modelo/esquema.js';

const UFS = Object.fromEntries(['AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MG', 'MS', 'MT', 'PA', 'PB', 'PE', 'PI', 'PR', 'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO'].map(u => [u, u]));

export function formularioAluno(a = {}, { desabilitado = false } = {}) {
  const o = (x, k) => (x && x[k]) || '';
  const grupo = (titulo, ...campos) => h('fieldset', { disabled: desabilitado }, h('legend', {}, titulo), h('div', { class: 'campos' }, campos));
  return h('form', {},
    grupo('Aluno',
      campo('Nome completo', 'nome', a.nome, { obrigatorio: true, largo: true }),
      campo('Sexo', 'sexo', a.sexo || '', { tipo: 'select', opcoes: { '': '—', ...SEXOS }, ajuda: 'Usado para o texto das declarações (filho/filha).' }),
      campo('Data de nascimento', 'nascimento', a.nascimento, { tipo: 'date' }),
      campo('Cidade onde nasceu', 'naturalidade', a.naturalidade),
      campo('Estado', 'ufNascimento', a.ufNascimento || 'PB', { tipo: 'select', opcoes: UFS }),
      campo('CPF', 'cpf', a.cpf, { inputmode: 'numeric' }),
      campo('RG', 'rg', a.rg)),
    grupo('Filiação',
      campo('Nome do pai', 'pai.nome', o(a.pai, 'nome')), campo('Profissão do pai', 'pai.profissao', o(a.pai, 'profissao')),
      campo('Nome da mãe', 'mae.nome', o(a.mae, 'nome')), campo('Profissão da mãe', 'mae.profissao', o(a.mae, 'profissao'))),
    grupo('Endereço e contatos',
      campo('Rua', 'endereco.rua', o(a.endereco, 'rua')), campo('Número', 'endereco.numero', o(a.endereco, 'numero')),
      campo('Bairro', 'endereco.bairro', o(a.endereco, 'bairro')), campo('Cidade', 'endereco.cidade', o(a.endereco, 'cidade') || 'Guarabira'),
      campo('Estado', 'endereco.uf', o(a.endereco, 'uf') || 'PB', { tipo: 'select', opcoes: UFS }), campo('CEP', 'endereco.cep', o(a.endereco, 'cep')),
      campo('Telefone do pai', 'contatos.telefonePai', o(a.contatos, 'telefonePai'), { tipo: 'tel' }),
      campo('Telefone da mãe', 'contatos.telefoneMae', o(a.contatos, 'telefoneMae'), { tipo: 'tel' }),
      campo('Telefone do aluno', 'contatos.telefoneAluno', o(a.contatos, 'telefoneAluno'), { tipo: 'tel' }),
      campo('E-mail do pai', 'contatos.emailPai', o(a.contatos, 'emailPai'), { tipo: 'email' }),
      campo('E-mail da mãe', 'contatos.emailMae', o(a.contatos, 'emailMae'), { tipo: 'email' }),
      campo('E-mail do aluno', 'contatos.emailAluno', o(a.contatos, 'emailAluno'), { tipo: 'email' })));
}

export async function tela(ctx) {
  const { sistema } = ctx;
  const turmas = await sistema.turmas();
  const form = formularioAluno();
  form.append(h('fieldset', {}, h('legend', {}, `Matrícula ${await sistema.anoLetivo()}`), h('div', { class: 'campos' },
    campo('Turma', 'm.turmaId', '', { tipo: 'select', opcoes: Object.fromEntries(turmas.map(t => [t.id, t.nome])) }),
    campo('Turno', 'm.turno', '', { tipo: 'select', opcoes: { '': 'O da turma', ...TURNOS } }),
    campo('Número na turma', 'm.numero', '', { tipo: 'number', min: 1, ajuda: 'Em branco: o próximo número livre.' }),
    campo('Bolsa', 'm.bolsa', 'nenhuma', { tipo: 'select', opcoes: BOLSAS }))),
  h('div', { class: 'linha fim' }, h('button', { class: 'primario', type: 'submit' }, 'Matricular')));
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const { m, ...aluno } = lerFormulario(form);
    try {
      const id = await sistema.matricular({ ...aluno, vidaEscolarAnterior: [] }, m);
      avisar('Matrícula feita.');
      ctx.ir(`alunos/${id}`);
    } catch (err) { avisar(err.message, 'erro'); }
  });
  return [h('h1', {}, 'Nova matrícula'), h('p', { class: 'suave' }, 'Os dados vão direto para a ficha individual do aluno. Campos com * são obrigatórios.'), form];
}
