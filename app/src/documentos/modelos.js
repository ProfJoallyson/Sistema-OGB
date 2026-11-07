// Modelos de documento da secretaria. O texto segue os modelos atuais da escola,
// com as correções da análise: concordância pelo sexo do cadastro, "Declaramos",
// data por extenso sempre igual e texto montado do zero a cada emissão.
//
// Cada modelo recebe o contexto (escola, aluno, matrícula, turma, boletim...) e as
// respostas das perguntas que só a secretaria sabe, e devolve o corpo do documento.

import { esc, g, palavra, dataCurta, serieExtenso, naSerie, filiacao, maiusculo, TURNOS_EXTENSO } from './texto.js';
import { boletimHTML, relacaoNotasHTML } from './boletim.js';
import { disciplina } from '../regras/curriculo.js';
import { nomeTurma, BOLSAS } from '../modelo/esquema.js';

export const GRUPOS = {
  declaracao: { nome: 'Declarações', cor: 'azul' },
  aluno: { nome: 'Registros do aluno', cor: 'verde' },
  turma: { nome: 'Turma inteira', cor: 'laranja' },
};

const p = t => `<p class="texto">${t}</p>`;
const FECHO = p('Em virtude desta e expressão máxima da verdade, firmamos a presente, que vai devidamente assinada.');

// "ANA LIMA, nascida em 10/05/2010, filha do Sr. ... e da Sra. ...,"
function identificacao(a) {
  const partes = [`<b>${esc(maiusculo(a.nome))}</b>`];
  if (a.nascimento) partes.push(`${palavra(a, 'nascido', 'nascida')} em ${dataCurta(a.nascimento)}`);
  const f = filiacao(a);
  if (f) partes.push(esc(f));
  return partes.join(', ');
}

const situacaoDoAno = ctx => {
  if (ctx.matricula && ctx.matricula.situacao === 'desistente') return 'desistente';
  return (ctx.boletim && ctx.boletim.situacao) || 'cursando';
};

export const MODELOS = [
  {
    id: 'matricula', nome: 'Declaração de matrícula', grupo: 'declaracao', alvo: 'aluno', titulo: 'DECLARAÇÃO',
    perguntas: () => [
      { id: 'tempo', rotulo: 'O aluno', tipo: 'opcoes', opcoes: { esta: 'está matriculado (ano atual)', esteve: 'esteve matriculado' }, padrao: 'esta' },
      { id: 'mostrar', rotulo: 'Mostrar no texto', tipo: 'opcoes', opcoes: { turno: 'o turno', horario: 'o horário', nada: 'nenhum dos dois' }, padrao: 'turno' },
    ],
    montar(ctx, r) {
      const { aluno: a, matricula: m, turma: t, escola } = ctx;
      const verbo = r.tempo === 'esteve' ? 'esteve' : 'está';
      let quando = '';
      const turno = m.turno || t.turno;
      if (r.mostrar === 'turno' && turno) quando = `, no turno ${TURNOS_EXTENSO[turno] || turno}`;
      if (r.mostrar === 'horario' && escola.horarios && escola.horarios[turno]) quando = `, no horário de ${esc(escola.horarios[turno])}`;
      return p(`Declaramos, para os devidos fins, que ${identificacao(a)}, ${verbo} regularmente ${palavra(a, 'matriculado', 'matriculada')} ` +
        `${naSerie(t.serie)} deste Estabelecimento de Ensino${quando}, no ano letivo de ${t.ano}.`) + FECHO;
    },
  },
  {
    id: 'bolsista', nome: 'Declaração de bolsista', grupo: 'declaracao', alvo: 'aluno', titulo: 'DECLARAÇÃO',
    disponivel: ctx => (!ctx.matricula.bolsa || ctx.matricula.bolsa === 'nenhuma' ? 'O aluno não tem bolsa na matrícula.' : null),
    montar(ctx) {
      const { aluno: a, matricula: m, turma: t } = ctx;
      const bolsa = m.bolsa === 'integral' ? 'bolsista integral' : 'bolsista com desconto de 50%';
      return p(`Declaramos, para os devidos fins, que ${identificacao(a)}, está ${palavra(a, 'matriculado', 'matriculada')} e cursando ` +
        `${serieExtenso(t.serie)} como ${palavra(a, 'aluno', 'aluna')} ${bolsa} deste Estabelecimento de Ensino, no ano letivo de ${t.ano}.`) + FECHO;
    },
  },
  {
    id: 'conclusao', nome: 'Declaração de conclusão', grupo: 'declaracao', alvo: 'aluno', titulo: 'DECLARAÇÃO',
    disponivel: ctx => {
      if (!['9EF', '3EM'].includes(ctx.turma.serie)) return 'Só para o 9º Ano e a 3ª Série.';
      if (situacaoDoAno(ctx) !== 'aprovado' && ctx.matricula.situacao !== 'concluida') return 'O aluno ainda não foi aprovado neste ano.';
      return null;
    },
    montar(ctx) {
      const { aluno: a, turma: t } = ctx;
      return p(`Declaramos, para os devidos fins, que ${identificacao(a)}, concluiu ${serieExtenso(t.serie)}, ` +
        `neste Estabelecimento de Ensino, no ano letivo de ${t.ano}.`) + FECHO;
    },
  },
  {
    id: 'transferencia', nome: 'Declaração de transferência', grupo: 'declaracao', alvo: 'aluno', titulo: 'DECLARAÇÃO',
    perguntas: () => [
      { id: 'quem', rotulo: 'Quem pediu a transferência', tipo: 'opcoes', opcoes: { mae: 'A mãe', pai: 'O pai', responsavel: 'O(A) responsável', aluno: 'O(A) próprio(a) aluno(a)' }, padrao: 'mae' },
      { id: 'quando', rotulo: 'A transferência será providenciada', tipo: 'opcoes', opcoes: { fim: 'ao terminar o ano letivo', agora: 'imediatamente' }, padrao: 'fim' },
    ],
    montar(ctx, r) {
      const { aluno: a, turma: t } = ctx;
      const quem = { mae: 'A mãe', pai: 'O pai', responsavel: 'O(A) responsável', aluno: `${g(a, 'O', 'A')} próprio(a) ${palavra(a, 'aluno', 'aluna')}` }[r.quem] || 'O(A) responsável';
      const quando = r.quando === 'agora' ? 'que será providenciada' : 'que será providenciada assim que terminar o ano letivo';
      const sit = situacaoDoAno(ctx);
      const caixa = (k, rot) => `<span class="caixa">[ ${sit === k ? 'X' : '&nbsp;'} ] ${rot}</span>`;
      return p(`Declaramos, para os devidos fins, que ${identificacao(a)}, está ${palavra(a, 'matriculado', 'matriculada')} e cursando ` +
        `${serieExtenso(t.serie)}, no ano letivo de ${t.ano}. ${quem} solicitou a sua transferência, ${quando}.`) +
        p(`Situação d${g(a, 'o', 'a')} ${palavra(a, 'aluno', 'aluna')} referente ao ano letivo de ${t.ano}:`) +
        `<p class="caixas">${caixa('aprovado', 'APROVADO(A)')} ${caixa('reprovado', 'REPROVADO(A)')} ${caixa('cursando', 'CURSANDO')} ${caixa('desistente', 'DESISTENTE')}</p>`;
    },
  },
  {
    id: 'boaConduta', nome: 'Atestado de boa conduta', grupo: 'declaracao', alvo: 'aluno', titulo: 'ATESTADO DE BOA CONDUTA ESCOLAR',
    perguntas: ctx => {
      const anos = (ctx.matriculas || []).map(m => m.ano).sort();
      return [
        { id: 'de', rotulo: 'Estudou na escola de', tipo: 'numero', padrao: anos[0] || ctx.turma.ano },
        { id: 'ate', rotulo: 'até', tipo: 'numero', padrao: anos[anos.length - 1] || ctx.turma.ano },
        { id: 'assina', rotulo: 'Quem assina', tipo: 'opcoes', opcoes: { secretaria: 'Secretária', diretor: 'Diretor' }, padrao: 'secretaria' },
      ];
    },
    assinatura: r => r.assina || 'secretaria',
    montar(ctx, r) {
      const a = ctx.aluno;
      const cpf = a.cpf ? `, ${palavra(a, 'inscrito', 'inscrita')} no CPF sob o nº ${esc(a.cpf)}` : '';
      const periodo = String(r.de) === String(r.ate) ? `no ano de ${esc(r.de)}` : `durante o período de ${esc(r.de)} a ${esc(r.ate)}`;
      return p(`Certificamos, para os devidos fins, que ${g(a, 'o', 'a')} ${palavra(a, 'aluno', 'aluna')} <b>${esc(maiusculo(a.nome))}</b>${cpf}, ` +
        `frequentou esta instituição de ensino ${periodo}, demonstrando comportamento exemplar e boa conduta escolar, ` +
        'cumprindo com suas obrigações acadêmicas de maneira satisfatória.') +
        p(`Durante seu período de estudo nesta instituição, ${g(a, 'o', 'a')} ${palavra(a, 'aluno', 'aluna')} apresentou-se como uma pessoa responsável, ` +
        'respeitosa e dedicada, mantendo sempre um relacionamento harmonioso com colegas, professores e demais funcionários.') +
        p('Este atestado é expedido a pedido do(a) interessado(a), para os devidos fins que se fizerem necessários.');
    },
  },
  {
    id: 'funcionario', nome: 'Declaração de funcionário', grupo: 'declaracao', alvo: 'funcionario', titulo: 'DECLARAÇÃO',
    // A declaração da própria secretária é assinada pelo diretor.
    assinatura: (r, ctx) => (ctx.funcionario.id === ctx.escola.secretariaId ? 'diretor' : 'secretaria'),
    montar(ctx) {
      const { funcionario: f, escola } = ctx;
      const docs = [];
      if (f.cpf) docs.push(`${palavra(f, 'inscrito', 'inscrita')} no CPF sob o nº ${esc(f.cpf)}`);
      if (f.rg) docs.push(`${palavra(f, 'portador', 'portadora')} do RG nº ${esc(f.rg)}`);
      if (f.ctps) docs.push(`CTPS nº ${esc(f.ctps)}`);
      const desde = f.admissao ? `, desde o ano de ${String(f.admissao).slice(0, 4)}` : '';
      return p(`Declaramos, para os devidos fins, que <b>${esc(maiusculo(f.nome))}</b>, ${palavra(f, 'brasileiro', 'brasileira')}` +
        `${docs.length ? ', ' + docs.join(' e ') : ''}, é ${palavra(f, 'funcionário', 'funcionária')} desta empresa, ` +
        `${esc(maiusculo(escola.razaoSocial))}, CNPJ ${esc(escola.cnpj)}${desde}, exercendo a função de ${esc(f.descricaoFuncao || f.funcao)}.`) + FECHO;
    },
  },
  {
    id: 'boletim', nome: 'Boletim escolar', grupo: 'aluno', alvo: 'aluno', titulo: 'BOLETIM ESCOLAR', orientacao: 'paisagem', assinatura: () => null,
    loteTurma: true,
    montar: ctx => boletimHTML(ctx.boletim),
  },
  {
    id: 'ficha', nome: 'Ficha individual', grupo: 'aluno', alvo: 'aluno', titulo: 'FICHA INDIVIDUAL DO ALUNO', orientacao: 'paisagem',
    loteTurma: true,
    montar(ctx) {
      const { aluno: a, matricula: m, turma: t } = ctx;
      const linha = (r, v) => `<tr><th>${r}</th><td>${esc(v || '')}</td></tr>`;
      const end = a.endereco ? [a.endereco.rua, a.endereco.numero, a.endereco.bairro, a.endereco.cidade && `${a.endereco.cidade}-${a.endereco.uf || ''}`, a.endereco.cep].filter(Boolean).join(', ') : '';
      const contatos = Object.values(a.contatos || {}).filter(Boolean).join(' · ');
      const foto = a.foto ? `<img class="foto" src="${esc(a.foto)}" alt="">` : '<div class="foto vazia">foto</div>';
      return `<div class="ficha">${foto}<table class="dados">` +
        linha('Nome', a.nome) + linha('Nº / Turma', `${m.numero || ''} · ${nomeTurma(t)} · ${t.ano}`) +
        linha('Nascimento', `${dataCurta(a.nascimento)}${a.naturalidade ? ` · ${a.naturalidade}-${a.ufNascimento || ''}` : ''}`) +
        linha('Pai', a.pai && [a.pai.nome, a.pai.profissao].filter(Boolean).join(' · ')) +
        linha('Mãe', a.mae && [a.mae.nome, a.mae.profissao].filter(Boolean).join(' · ')) +
        linha('Endereço', end) + linha('Contatos', contatos) + (a.email ? linha('E-mail da escola', a.email) : '') + linha('Bolsa', BOLSAS[m.bolsa || 'nenhuma']) +
        '</table></div>' + boletimHTML(ctx.boletim, { semCabecalho: true });
    },
  },
  {
    id: 'listaAlunos', nome: 'Lista de alunos da turma', grupo: 'turma', alvo: 'turma', titulo: 'LISTA DE ALUNOS', assinatura: () => null,
    montar(ctx) {
      const linhas = ctx.alunos.map(a => `<tr><td class="n">${a.matricula.numero || ''}</td><td>${esc(a.nome)}</td><td class="c">${a.sexo || ''}</td><td class="c">${dataCurta(a.nascimento)}</td></tr>`).join('');
      return `<p class="subtitulo">${esc(nomeTurma(ctx.turma))} · ${serieExtenso(ctx.turma.serie, { artigo: false })} · Ano letivo ${ctx.turma.ano} · ${ctx.alunos.length} alunos</p>` +
        `<table class="grade"><thead><tr><th>Nº</th><th>Nome</th><th>Sexo</th><th>Nascimento</th></tr></thead><tbody>${linhas}</tbody></table>`;
    },
  },
  {
    id: 'folhaAvaliacao', nome: 'Folha de frequência de avaliação', grupo: 'turma', alvo: 'turma', titulo: 'FOLHA DE FREQUÊNCIA DE AVALIAÇÃO', assinatura: () => null,
    perguntas: ctx => [
      { id: 'disciplina', rotulo: 'Componente curricular', tipo: 'opcoes', opcoes: Object.fromEntries(ctx.turma.disciplinas.map(d => [d, disciplina(d).nome])), padrao: ctx.turma.disciplinas[0] },
      { id: 'professor', rotulo: 'Professor(a)', tipo: 'texto', padrao: '' },
      { id: 'trimestre', rotulo: 'Trimestre', tipo: 'opcoes', opcoes: { 1: '1º', 2: '2º', 3: '3º' }, padrao: '1' },
      { id: 'data', rotulo: 'Data da avaliação', tipo: 'data', padrao: '' },
      { id: 'tipo', rotulo: 'Atividade', tipo: 'opcoes', opcoes: { PP: 'Parcial', PE: 'Prova Específica', SO: 'Simulado Obrigatório', REP: 'Reposição', RO: 'Recuperação', AULA: 'Aula' }, padrao: 'PE' },
    ],
    montar(ctx, r) {
      const tipos = { PP: 'Parcial', PE: 'Prova Específica', SO: 'Simulado Obrigatório', REP: 'Reposição', RO: 'Recuperação', AULA: 'Aula' };
      const marcas = Object.entries(tipos).map(([k, v]) => `<span class="caixa">( ${r.tipo === k ? 'X' : '&nbsp;'} ) ${v}</span>`).join(' ');
      const linhas = ctx.alunos.map(a => `<tr><td class="n">${a.matricula.numero || ''}</td><td>${esc(a.nome)}</td><td class="assin"></td><td></td><td></td><td></td></tr>`).join('');
      const nomeDisc = r.disciplina && disciplina(r.disciplina) ? disciplina(r.disciplina).nome : '';
      return `<table class="cab-avaliacao"><tr><th>Componente curricular</th><td>${esc(nomeDisc)}</td><th>Professor(a)</th><td>${esc(r.professor)}</td></tr>` +
        `<tr><th>Ano/Série · Turma</th><td>${esc(nomeTurma(ctx.turma))}</td><th>Trimestre · Data</th><td>${esc(r.trimestre)}º · ${dataCurta(r.data)}</td></tr></table>` +
        `<p class="caixas">${marcas}</p>` +
        `<table class="grade"><thead><tr><th>Nº</th><th>Nome do aluno</th><th>Assinatura</th><th>Nota 1</th><th>Nota 2</th><th>Nota 3</th></tr></thead><tbody>${linhas}</tbody></table>` +
        '<div class="rodape-avaliacao"><span>Fiscal da prova: ____________________</span><span>Coordenação: ____________________</span>' +
        '<span>Data da correção: ___/___/______</span><span>Professor(a): ____________________</span></div>';
    },
  },
  {
    id: 'relacaoNotas', nome: 'Relação de notas da turma', grupo: 'turma', alvo: 'turma', titulo: 'RELAÇÃO DE NOTAS', orientacao: 'paisagem', assinatura: () => null,
    perguntas: ctx => [
      { id: 'disciplina', rotulo: 'Disciplina', tipo: 'opcoes', opcoes: Object.fromEntries(ctx.turma.disciplinas.map(d => [d, disciplina(d).nome])), padrao: ctx.turma.disciplinas[0] },
    ],
    montar: (ctx, r) => relacaoNotasHTML(ctx.turma, ctx.boletins, r.disciplina),
  },
];

export const modelo = id => MODELOS.find(m => m.id === id);

// Pendentes: dependem de respostas da escola (carga horária, assinaturas, modelo da ata).
export const EM_BREVE = [
  { id: 'historicoEF', nome: 'Histórico escolar (Fundamental)', grupo: 'aluno', motivo: 'Falta definir assinaturas e a importação dos anos anteriores.' },
  { id: 'historicoEM', nome: 'Histórico escolar (Médio)', grupo: 'aluno', motivo: 'Falta a carga horária de cada disciplina do Médio.' },
  { id: 'ata', nome: 'Ata de resultados finais', grupo: 'turma', motivo: 'Falta o modelo da escola.' },
];
