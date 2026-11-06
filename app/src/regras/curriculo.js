// Disciplinas, séries e avaliações de cada modelo de boletim do OGB.
// Fonte: análise das planilhas (analise-drive/regras-boletim.md) e decisões do Prof. Joallyson.

// Modelos de cálculo. As turmas B, C... usam o mesmo modelo da série.
export const MODELOS = {
  EF: { id: 'EF', nome: 'Ensino Fundamental' },
  EM12: { id: 'EM12', nome: 'Ensino Médio (1ª e 2ª série)' },
  EM3: { id: 'EM3', nome: 'Ensino Médio (3ª série)' },
};

// Séries que a escola oferece hoje.
export const SERIES = [
  { id: '6EF', nome: '6º Ano', segmento: 'Ensino Fundamental', modelo: 'EF', ordinal: '6º', tipo: 'ano' },
  { id: '7EF', nome: '7º Ano', segmento: 'Ensino Fundamental', modelo: 'EF', ordinal: '7º', tipo: 'ano' },
  { id: '8EF', nome: '8º Ano', segmento: 'Ensino Fundamental', modelo: 'EF', ordinal: '8º', tipo: 'ano' },
  { id: '9EF', nome: '9º Ano', segmento: 'Ensino Fundamental', modelo: 'EF', ordinal: '9º', tipo: 'ano' },
  { id: '1EM', nome: '1ª Série', segmento: 'Ensino Médio', modelo: 'EM12', ordinal: '1ª', tipo: 'serie' },
  { id: '2EM', nome: '2ª Série', segmento: 'Ensino Médio', modelo: 'EM12', ordinal: '2ª', tipo: 'serie' },
  { id: '3EM', nome: '3ª Série', segmento: 'Ensino Médio', modelo: 'EM3', ordinal: '3ª', tipo: 'serie' },
];

export const serie = id => SERIES.find(s => s.id === id);

// Catálogo único de disciplinas (evita "Educação Religioso" x "Ensino Religioso").
// areaSG: área do Simulado Global da 3ª série que dá a nota de SG da disciplina.
export const DISCIPLINAS = [
  { id: 'port', nome: 'Língua Portuguesa', curto: 'L. Portuguesa', areaSG: 'linguagens' },
  { id: 'ing', nome: 'Língua Inglesa', curto: 'Inglês', areaSG: 'linguagens' },
  { id: 'esp', nome: 'Língua Espanhola', curto: 'Espanhol', areaSG: 'linguagens' },
  { id: 'rel', nome: 'Ensino Religioso', curto: 'Ens. Religioso', areaSG: 'humanas' },
  { id: 'hist', nome: 'História', curto: 'História', areaSG: 'humanas' },
  { id: 'geo', nome: 'Geografia', curto: 'Geografia', areaSG: 'humanas' },
  { id: 'soc', nome: 'Sociologia', curto: 'Sociologia', areaSG: 'humanas' },
  { id: 'fil', nome: 'Filosofia', curto: 'Filosofia', areaSG: 'humanas' },
  { id: 'mat', nome: 'Matemática', curto: 'Matemática', areaSG: 'matematica' },
  { id: 'cien', nome: 'Ciências', curto: 'Ciências', areaSG: 'natureza' },
  { id: 'fis', nome: 'Física', curto: 'Física', areaSG: 'natureza' },
  { id: 'qui', nome: 'Química', curto: 'Química', areaSG: 'natureza' },
  { id: 'bio', nome: 'Biologia', curto: 'Biologia', areaSG: 'natureza' },
  { id: 'arte', nome: 'Arte', curto: 'Arte', areaSG: 'linguagens' },
  { id: 'edf', nome: 'Educação Física', curto: 'Ed. Física', areaSG: 'linguagens' },
  // Itinerários formativos
  { id: 'it_pv', nome: 'Projeto de Vida', itinerario: true },
  { id: 'it_cs', nome: 'Ciência e Saúde', itinerario: true },
  { id: 'it_ef', nome: 'Educação Financeira', itinerario: true },
  { id: 'it_sus', nome: 'Sustentabilidade', itinerario: true },
  { id: 'it_trab', nome: 'Trabalho', itinerario: true },
  { id: 'it_ds', nome: 'Desenvolvimento Sustentável', itinerario: true },
  { id: 'it_it', nome: 'Interpretação de Texto', itinerario: true },
  { id: 'it_mc', nome: 'Matemática do Cotidiano', itinerario: true },
  { id: 'it_pol', nome: 'Política', itinerario: true },
  { id: 'it_amat', nome: 'Aprofundamento em Matemática', itinerario: true },
  { id: 'it_aprod', nome: 'Aprofundamento em Produção Textual', itinerario: true },
];

export const disciplina = id => DISCIPLINAS.find(d => d.id === id);

// Grade padrão de cada série, já na ordem do boletim
// (Sociologia e Filosofia logo depois de História e Geografia).
export const GRADE_PADRAO = {
  '6EF': ['port', 'ing', 'rel', 'hist', 'geo', 'mat', 'cien', 'arte', 'edf'],
  '1EM': ['port', 'ing', 'esp', 'hist', 'geo', 'mat', 'fis', 'qui', 'bio', 'arte', 'edf',
    'it_pv', 'it_cs', 'it_ef', 'it_sus', 'it_trab'],
  '2EM': ['port', 'ing', 'esp', 'hist', 'geo', 'mat', 'fis', 'qui', 'bio', 'arte', 'edf',
    'it_pv', 'it_ds', 'it_it', 'it_mc', 'it_pol'],
  '3EM': ['port', 'ing', 'esp', 'hist', 'geo', 'soc', 'fil', 'mat', 'fis', 'qui', 'bio', 'arte', 'edf',
    'it_pv', 'it_amat', 'it_aprod'],
};
for (const s of ['7EF', '8EF', '9EF']) GRADE_PADRAO[s] = GRADE_PADRAO['6EF'];

const ORDEM = DISCIPLINAS.map(d => d.id);
// Ordena qualquer lista de disciplinas na ordem do boletim.
export const ordenarDisciplinas = ids => [...ids].sort((a, b) => ORDEM.indexOf(a) - ORDEM.indexOf(b));

// Siglas (legenda do boletim).
export const SIGLAS = {
  PP: 'Prova Parcial', PE: 'Prova Específica', PT: 'Produção Textual', VL: 'Verificação de Leitura',
  SO: 'Simulado Obrigatório', SP: 'Simulado Parcial', SG: 'Simulado Global', SE: 'Simulado Extra (soma pontos)',
  AV1: 'Avaliação 1', AV2: 'Avaliação 2', AV3: 'Avaliação 3',
  MPT: 'Média Provisória Trimestral', RO: 'Recuperação Obrigatória', MDT: 'Média Definitiva Trimestral',
  MPA: 'Média Provisória Anual', PF: 'Prova Final', MDA: 'Média Definitiva Anual', MG: 'Média Global',
  MA: 'Média do Aluno', MT: 'Média da Turma', NC: 'Não compareceu',
};

// Campos que o professor digita. Os simulados (SO, SP, SG, SE) vêm do leitor de gabarito.
export const CAMPOS_PROFESSOR = ['PP', 'PE', 'PT', 'VL', 'AV1', 'AV2', 'AV3', 'RO'];
export const CAMPOS_SIMULADO = ['SO', 'SP', 'SG', 'SE'];

// Avaliações que entram na MPT de uma disciplina, por modelo.
// Decisões: no EF o SO entra em Português nos 3 trimestres (P1, 04/11);
// no Médio a VL conta em Português e em Arte (P2, 04/11).
export function avaliacoes(modelo, discId) {
  const d = disciplina(discId);
  if (d && d.itinerario) return ['AV1', 'AV2', 'AV3'];
  if (modelo === 'EF') return discId === 'port' ? ['PP', 'PE', 'PT', 'VL', 'SO'] : ['PP', 'PE', 'SO'];
  if (modelo === 'EM12') {
    if (discId === 'port') return ['PE', 'SO', 'PT', 'VL'];
    if (discId === 'arte') return ['PE', 'SO', 'VL'];
    return ['PE', 'SO'];
  }
  if (modelo === 'EM3') {
    if (discId === 'port') return ['SP', 'SG', 'PT', 'VL'];
    if (discId === 'arte') return ['SP', 'SG', 'VL'];
    return ['SP', 'SG'];
  }
  throw new Error('Modelo desconhecido: ' + modelo);
}

// Colunas que o professor vê na grade de notas de um trimestre.
export function colunasDoProfessor(modelo, discId) {
  return [...avaliacoes(modelo, discId).filter(c => CAMPOS_PROFESSOR.includes(c)), 'RO'];
}

// O SE só existe na 3ª série (e não vale para itinerários).
export const usaBonusSE = (modelo, discId) => modelo === 'EM3' && !(disciplina(discId) || {}).itinerario;
