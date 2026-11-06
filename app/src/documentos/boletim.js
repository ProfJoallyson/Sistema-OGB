// Boletim no layout das planilhas: disciplinas nas linhas, trimestres nas colunas,
// MPA, PF, MDA e MG, faltas, legenda e gráfico da média do aluno x média da turma.

import { esc, serieExtenso } from './texto.js';
import { disciplina, avaliacoes, SIGLAS } from '../regras/curriculo.js';
import { formatar, LIMITES, TRIMESTRES } from '../regras/boletim.js';
import { nomeTurma } from '../modelo/esquema.js';

const COLUNAS = {
  EF: ['PP', 'PE', 'PT', 'VL', 'SO'],
  EM12: ['PE', 'SO', 'PT', 'VL'],
  EM3: ['SP', 'SG', 'SE', 'PT', 'VL'],
};
const COLUNAS_ITIN = ['AV1', 'AV2', 'AV3'];

const vermelho = (v, limite) => (typeof v === 'number' && v < limite ? ' class="baixa"' : '');

function tabela(b, linhas, colunas, titulo) {
  if (!linhas.length) return '';
  const cab1 = TRIMESTRES.map((t, i) => `<th colspan="${colunas.length + 3}">${i + 1}º Trimestre</th>`).join('');
  const cab2 = TRIMESTRES.map(() => [...colunas, 'MPT', 'RO', 'MDT'].map(c => `<th>${c}</th>`).join('')).join('');
  const corpo = linhas.map(l => {
    const d = disciplina(l.disciplina);
    const usadas = new Set(avaliacoes(b.modelo, l.disciplina));
    if (b.modelo === 'EM3' && !d.itinerario) usadas.add('SE');
    const tri = TRIMESTRES.map(t => {
      const x = l.trimestres[t];
      const cel = colunas.map(c => {
        if (!usadas.has(c)) return '<td class="na"></td>';
        if (c === 'SE') return `<td>${x.bonusSE ? '+' + formatar(x.bonusSE) : '-'}</td>`;
        return `<td>${formatar(x.notas[c])}</td>`;
      }).join('');
      return cel + `<td${vermelho(x.MPT, LIMITES.provaFinal)}>${formatar(x.MPT)}</td><td>${formatar(x.RO)}</td><td class="forte${typeof x.MDT === 'number' && x.MDT < LIMITES.provaFinal ? ' baixa' : ''}">${formatar(x.MDT)}</td>`;
    }).join('');
    return `<tr><th class="disc">${esc(d.curto || d.nome)}</th>${tri}` +
      `<td${vermelho(l.MPA, LIMITES.provaFinal)}>${formatar(l.MPA)}</td><td>${formatar(l.PF)}</td><td class="forte${typeof l.MDA === 'number' && l.MDA < LIMITES.aprovacao ? ' baixa' : ''}">${formatar(l.MDA)}</td></tr>`;
  }).join('');
  return `<table class="boletim"><thead><tr><th rowspan="2">${titulo}</th>${cab1}<th colspan="3">Resultado anual</th></tr>` +
    `<tr>${cab2}<th>MPA</th><th>PF</th><th>MDA</th></tr></thead><tbody>${corpo}</tbody></table>`;
}

function grafico(MA, MT) {
  const w = 300, h = 110, base = 90, barra = 22;
  const y = v => base - (Math.max(0, Math.min(10, v || 0)) / 10) * 80;
  let s = `<svg class="grafico" viewBox="0 0 ${w} ${h}" role="img" aria-label="Média do aluno e média da turma por trimestre">`;
  s += `<line x1="20" y1="${base}" x2="${w - 10}" y2="${base}" stroke="currentColor" stroke-width="0.5"/>`;
  TRIMESTRES.forEach((t, i) => {
    const x = 40 + i * 90;
    if (MA[t] !== null && MA[t] !== undefined) s += `<rect x="${x}" y="${y(MA[t])}" width="${barra}" height="${base - y(MA[t])}" class="ma"/><text x="${x + barra / 2}" y="${y(MA[t]) - 3}" text-anchor="middle">${formatar(MA[t])}</text>`;
    if (MT && MT[t] !== null && MT[t] !== undefined) s += `<rect x="${x + barra + 4}" y="${y(MT[t])}" width="${barra}" height="${base - y(MT[t])}" class="mt"/><text x="${x + barra * 1.5 + 4}" y="${y(MT[t]) - 3}" text-anchor="middle">${formatar(MT[t])}</text>`;
    s += `<text x="${x + barra + 2}" y="${base + 12}" text-anchor="middle">${i + 1}º tri</text>`;
  });
  return s + '</svg>';
}

export function boletimHTML(b, { semCabecalho = false } = {}) {
  const fgb = b.linhas.filter(l => !disciplina(l.disciplina).itinerario);
  const itin = b.linhas.filter(l => disciplina(l.disciplina).itinerario);
  const sit = b.situacao;
  const cab = semCabecalho ? '' : `<table class="cab-boletim"><tr>
      <td><b>Aluno(a):</b> ${esc(b.aluno.nome)}</td><td><b>Nº</b> ${b.matricula.numero || ''}</td>
      <td><b>Turma:</b> ${esc(nomeTurma(b.turma))}</td><td><b>Ano letivo:</b> ${b.ano}</td></tr>
      <tr><td colspan="2"><b>Segmento:</b> ${serieExtenso(b.turma.serie, { artigo: false })}</td>
      <td colspan="2" class="situacao"><span class="${sit === 'aprovado' ? 'marcado' : ''}">[ ${sit === 'aprovado' ? 'X' : '&nbsp;'} ] APROVADO(A)</span>
      <span class="${sit === 'reprovado' ? 'marcado' : ''}">[ ${sit === 'reprovado' ? 'X' : '&nbsp;'} ] REPROVADO(A)</span></td></tr></table>`;
  const mg = b.MG;
  const mgTxt = itin.length
    ? `<b>MG formação geral:</b> ${formatar(mg.formacaoGeral)} · <b>MG itinerários:</b> ${formatar(mg.itinerarios)} · <b>MG geral:</b> ${formatar(mg.geral)}`
    : `<b>Média global (MG):</b> ${formatar(mg.formacaoGeral)}`;
  const f = b.faltas;
  const usadas = new Set([...(COLUNAS[b.modelo] || []), ...(itin.length ? COLUNAS_ITIN : []), 'MPT', 'RO', 'MDT', 'MPA', 'PF', 'MDA', 'MG', 'MA', 'MT']);
  const legenda = Object.entries(SIGLAS).filter(([k]) => usadas.has(k)).map(([k, v]) => `<b>${k}</b> ${v}`).join(' · ');
  return cab + tabela(b, fgb, COLUNAS[b.modelo], 'Formação geral') + tabela(b, itin, COLUNAS_ITIN, 'Itinerários') +
    `<div class="rodape-boletim"><div><p>${mgTxt}</p>` +
    `<p><b>Faltas:</b> 1º tri ${f.t1} · 2º tri ${f.t2} · 3º tri ${f.t3} · <b>Total ${f.total}</b></p>` +
    `<p class="legenda">${legenda}</p></div>` +
    `<div class="caixa-grafico"><p class="leg-grafico"><span class="ma"></span> Média do aluno <span class="mt"></span> Média da turma</p>${grafico(b.MA, b.MT)}</div></div>`;
}

// Relação de notas de uma disciplina para a turma inteira (diário).
export function relacaoNotasHTML(turma, boletins, discId) {
  const d = disciplina(discId);
  const linhas = boletins.map(b => {
    const l = b.linhas.find(x => x.disciplina === discId);
    if (!l) return '';
    const tri = TRIMESTRES.map(t => `<td>${formatar(l.trimestres[t].MPT)}</td><td>${formatar(l.trimestres[t].RO)}</td><td class="forte">${formatar(l.trimestres[t].MDT)}</td>`).join('');
    return `<tr><td class="n">${b.matricula.numero || ''}</td><td class="nome">${esc(b.aluno.nome)}</td>${tri}<td>${formatar(l.MPA)}</td><td>${formatar(l.PF)}</td><td class="forte">${formatar(l.MDA)}</td></tr>`;
  }).join('');
  const cab = TRIMESTRES.map((t, i) => `<th>MPT ${i + 1}</th><th>RO ${i + 1}</th><th>MDT ${i + 1}</th>`).join('');
  return `<p class="subtitulo">${esc(d.nome)} · ${esc(nomeTurma(turma))} · Ano letivo ${turma.ano}</p>` +
    `<table class="grade notas"><thead><tr><th>Nº</th><th>Aluno(a)</th>${cab}<th>MPA</th><th>PF</th><th>MDA</th></tr></thead><tbody>${linhas}</tbody></table>`;
}
