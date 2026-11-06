// Pedaços de texto dos documentos: concordância pelo sexo, datas e séries por extenso.

import { serie as dadosSerie } from '../regras/curriculo.js';

export const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// "2014-03-02" ou Date -> "02/03/2014"
export function dataCurta(d) {
  if (!d) return '';
  if (d instanceof Date) d = d.toISOString().slice(0, 10);
  const [a, m, dia] = String(d).slice(0, 10).split('-');
  return `${dia}/${m}/${a}`;
}

// Sempre no mesmo formato: "30 de julho de 2026".
export function dataPorExtenso(d = new Date()) {
  const dt = d instanceof Date ? d : new Date(`${d}T12:00:00`);
  return `${String(dt.getDate()).padStart(2, '0')} de ${MESES[dt.getMonth()]} de ${dt.getFullYear()}`;
}

// Concordância: g(aluno, 'o', 'a') -> "o" / "a" / "o(a)" se o sexo não estiver no cadastro.
export function g(pessoa, masc, fem) {
  const sexo = pessoa && pessoa.sexo;
  if (sexo === 'F') return fem;
  if (sexo === 'M') return masc;
  return masc === 'o' && fem === 'a' ? 'o(a)' : `${masc}(${fem})`;
}

// Palavra no masculino/feminino: palavra(aluno, 'filho', 'filha') -> "filha"
export const palavra = (p, m, f) => (p && p.sexo === 'F' ? f : p && p.sexo === 'M' ? m : `${m}(${f.slice(-1)})`);

// "o 6º Ano do Ensino Fundamental" / "a 1ª Série do Ensino Médio"
export function serieExtenso(serieId, { artigo = true } = {}) {
  const s = dadosSerie(serieId);
  if (!s) return serieId;
  const texto = `${s.nome} do ${s.segmento}`;
  if (!artigo) return texto;
  return `${s.tipo === 'serie' ? 'a' : 'o'} ${texto}`;
}

// contração com "em": "no 6º Ano do Ensino Fundamental" / "na 1ª Série do Ensino Médio"
export const naSerie = serieId => serieExtenso(serieId).replace(/^o /, 'no ').replace(/^a /, 'na ');

export const TURNOS_EXTENSO = { manha: 'matutino', tarde: 'vespertino', noite: 'noturno' };

// "filha do Sr. Fulano e da Sra. Beltrana"
export function filiacao(aluno) {
  const pai = aluno.pai && aluno.pai.nome;
  const mae = aluno.mae && aluno.mae.nome;
  const f = palavra(aluno, 'filho', 'filha');
  if (pai && mae) return `${f} do Sr. ${pai} e da Sra. ${mae}`;
  if (mae) return `${f} da Sra. ${mae}`;
  if (pai) return `${f} do Sr. ${pai}`;
  return '';
}

export const maiusculo = s => String(s ?? '').toLocaleUpperCase('pt-BR');
