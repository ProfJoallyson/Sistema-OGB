// Cálculo do boletim: MPT, MDT, MPA, MDA, MG, média do aluno (MA) e situação.
// Reproduz as fórmulas das planilhas do OGB, com os erros corrigidos e as decisões
// do Prof. Joallyson (ver analise-drive/regras-boletim.md e o resumo do sistema).
//
// Convenções:
// - nota em branco (null, undefined, '') não entra na média e não conta como zero;
// - "NC" (não compareceu) é aceito na RO e na PF;
// - toda média é limitada a 10; os valores não são arredondados (o boletim mostra 1 casa).

import { avaliacoes, disciplina, usaBonusSE } from './curriculo.js';
import { notaSimulado80, notaAreaSG, bonusSE } from './simulados.js';

// Limites usados nas planilhas. Ficam juntos para a escola poder ajustar.
export const LIMITES = {
  recuperacao: 7, // RO só vale quando MPT < 7
  provaFinal: 6.95, // PF só quando MPA < 6,95 (aparece como "7,0" no boletim)
  aprovacao: 4.95, // aprovado com MDA ≥ 5,0 (4,95 aparece como "5,0")
  pesoMPA: 0.6,
  pesoPF: 0.4,
};

export const TRIMESTRES = ['t1', 't2', 't3'];

const vazio = v => v === null || v === undefined || v === '';
const num = v => (vazio(v) || v === 'NC' ? null : Number(v));
const teto = v => (v === null ? null : Math.min(10, v));

export function media(valores) {
  const ns = valores.map(num).filter(v => v !== null && !Number.isNaN(v));
  if (!ns.length) return null;
  return ns.reduce((a, b) => a + b, 0) / ns.length;
}

// Notas de simulado de um trimestre para uma disciplina.
// simT = { SO: acertos, SP: acertos, SE: acertos, SG: { matematica, natureza, linguagens, humanas } }
export function notasDeSimulado(modelo, discId, simT = {}) {
  const r = {};
  if (modelo === 'EM3') {
    r.SP = notaSimulado80(simT.SP);
    const area = (disciplina(discId) || {}).areaSG;
    r.SG = area && simT.SG ? notaAreaSG(simT.SG[area]) : null;
    r.SE = bonusSE(simT.SE);
  } else {
    r.SO = notaSimulado80(simT.SO);
  }
  return r;
}

// Um trimestre de uma disciplina.
// lancT = notas digitadas pelo professor no trimestre { PP, PE, PT, VL, AV1, AV2, AV3, RO }
export function calcularTrimestre(modelo, discId, lancT = {}, simT = {}) {
  const sim = notasDeSimulado(modelo, discId, simT);
  const colunas = avaliacoes(modelo, discId);
  const notas = {};
  for (const c of colunas) notas[c] = c in sim ? sim[c] : (vazio(lancT[c]) ? null : Number(lancT[c]));

  let mpt = media(colunas.map(c => notas[c]));
  const bonus = usaBonusSE(modelo, discId) ? sim.SE : null;
  if (mpt !== null && bonus) mpt += bonus;
  mpt = teto(mpt);

  // Avaliações que ainda faltam (a MPT mostrada é provisória até tudo ser lançado).
  const faltando = colunas.filter(c => notas[c] === null);
  if (usaBonusSE(modelo, discId) && sim.SE === null) faltando.push('SE');

  const ro = lancT.RO;
  let mdt = mpt;
  if (mpt !== null && mpt < LIMITES.recuperacao && !vazio(ro) && ro !== 'NC') {
    mdt = teto(Math.max(mpt, Number(ro)));
  }
  return {
    notas, bonusSE: bonus, MPT: mpt, RO: vazio(ro) ? null : ro, MDT: mdt, faltando,
    precisaRO: mpt !== null && mpt < LIMITES.recuperacao,
  };
}

// Ano inteiro de uma disciplina.
// lanc = { t1: {...}, t2: {...}, t3: {...}, PF }
// sim  = { t1: {...}, t2: {...}, t3: {...} } (do aluno; vale para todas as disciplinas)
export function calcularDisciplina(modelo, discId, lanc = {}, sim = {}) {
  const tri = {};
  for (const t of TRIMESTRES) tri[t] = calcularTrimestre(modelo, discId, lanc[t], sim[t]);
  const mdts = TRIMESTRES.map(t => tri[t].MDT);
  // A MPA só sai com os 3 trimestres fechados (nas planilhas, depois do simulado do 3º).
  const mpa = mdts.every(v => v !== null) ? teto(media(mdts)) : null;
  const pf = vazio(lanc.PF) ? null : lanc.PF;
  let mda = null;
  const precisaPF = mpa !== null && mpa < LIMITES.provaFinal;
  if (mpa !== null) {
    if (!precisaPF) mda = mpa;
    else if (pf !== null) mda = teto(LIMITES.pesoMPA * mpa + LIMITES.pesoPF * (pf === 'NC' ? 0 : Number(pf)));
  }
  const situacao = mda === null ? null : mda >= LIMITES.aprovacao ? 'aprovado' : 'reprovado';
  return { disciplina: discId, trimestres: tri, MPA: mpa, PF: pf, MDA: mda, precisaPF, situacao };
}

// Boletim completo de um aluno.
// entrada = { modelo, disciplinas: [ids na ordem], lancamentos: { discId: lanc }, simulados: sim, faltas: { t1, t2, t3 } }
export function calcularBoletim({ modelo, disciplinas, lancamentos = {}, simulados = {}, faltas = {} }) {
  const linhas = disciplinas.map(id => calcularDisciplina(modelo, id, lancamentos[id], simulados));
  const fgb = linhas.filter(l => !(disciplina(l.disciplina) || {}).itinerario);
  const itin = linhas.filter(l => (disciplina(l.disciplina) || {}).itinerario);

  // MG: média das MDA; só aparece quando todas as MDA do grupo existem.
  // Ed. Física entra em todos os segmentos (decisão P3, 04/11).
  const mg = grupo => (grupo.length && grupo.every(l => l.MDA !== null) ? teto(media(grupo.map(l => l.MDA))) : null);

  // MA do trimestre: média das MDT de todas as disciplinas, com Ed. Física e itinerários.
  const MA = {};
  for (const t of TRIMESTRES) MA[t] = teto(media(linhas.map(l => l.trimestres[t].MDT)));

  let situacao = 'cursando';
  if (linhas.length && linhas.every(l => l.situacao)) {
    situacao = linhas.every(l => l.situacao === 'aprovado') ? 'aprovado' : 'reprovado';
  }

  const f = TRIMESTRES.map(t => (vazio(faltas[t]) ? 0 : Number(faltas[t])));
  return {
    modelo, linhas,
    MG: { formacaoGeral: mg(fgb), itinerarios: itin.length ? mg(itin) : null, geral: mg(linhas) },
    MA, situacao,
    faltas: { t1: f[0], t2: f[1], t3: f[2], total: f[0] + f[1] + f[2] },
  };
}

// MT: média da turma por trimestre (média das MA dos alunos que têm nota).
export function mediaDaTurma(boletins) {
  const MT = {};
  for (const t of TRIMESTRES) MT[t] = media(boletins.map(b => b.MA[t]));
  return MT;
}

// Formata para o boletim: uma casa decimal com vírgula; "-" quando não há nota.
export function formatar(v) {
  if (v === 'NC') return 'NC';
  if (vazio(v) || Number.isNaN(Number(v))) return '-';
  return Number(v).toFixed(1).replace('.', ',');
}

// Valida o que o professor digita. Devolve o valor normalizado ou lança erro.
export function validarNota(valor, campo) {
  if (vazio(valor)) return null;
  const s = String(valor).trim().toUpperCase().replace(',', '.');
  if (s === '') return null;
  if (s === 'NC') {
    if (campo === 'RO' || campo === 'PF') return 'NC';
    throw new Error('"NC" só vale na recuperação (RO) e na prova final (PF).');
  }
  const n = Number(s);
  if (Number.isNaN(n) || n < 0 || n > 10) throw new Error(`Nota inválida: ${valor}. Use um número de 0 a 10.`);
  return Math.round(n * 100) / 100;
}
