// Conversão de acertos dos simulados em nota.
// Decisões do Prof. Joallyson (04/11/2026, "por enquanto"): 0 acertos = nota 0;
// SG da 3ª série = 2 provas de 80 questões, 40 por área, com os limites da tabela divididos por 2.

// [acertos mínimos, nota]
export const TABELA_80 = [[0, 0], [1, 2], [10, 3], [20, 5], [30, 6], [40, 7], [50, 8], [66, 9], [72, 10]];
export const TABELA_AREA_40 = [[0, 0], [1, 2], [5, 3], [10, 5], [15, 6], [20, 7], [25, 8], [33, 9], [36, 10]];
export const TABELA_SE = [[0, 0], [20, 0.5], [35, 1], [50, 1.5], [64, 2]];

export const AREAS_SG = {
  matematica: 'Matemática',
  natureza: 'Ciências da Natureza',
  linguagens: 'Linguagens',
  humanas: 'Ciências Humanas',
};

// Qual área está em quais questões de cada prova do SG (a confirmar com a escola).
export const PROVAS_SG = [
  { prova: 1, areas: [{ area: 'matematica', de: 1, ate: 40 }, { area: 'natureza', de: 41, ate: 80 }] },
  { prova: 2, areas: [{ area: 'linguagens', de: 1, ate: 40 }, { area: 'humanas', de: 41, ate: 80 }] },
];

function procv(tabela, acertos) {
  let nota = null;
  for (const [min, n] of tabela) if (acertos >= min) nota = n;
  return nota;
}

function acertosValidos(acertos, max) {
  if (acertos === null || acertos === undefined || acertos === '') return null;
  const n = Number(acertos);
  if (!Number.isInteger(n) || n < 0 || n > max) throw new Error(`Acertos inválidos: ${acertos} (de 0 a ${max})`);
  return n;
}

export const notaSimulado80 = acertos => {
  const n = acertosValidos(acertos, 80);
  return n === null ? null : procv(TABELA_80, n);
};
export const notaAreaSG = acertos => {
  const n = acertosValidos(acertos, 40);
  return n === null ? null : procv(TABELA_AREA_40, n);
};
export const bonusSE = acertos => {
  const n = acertosValidos(acertos, 80);
  return n === null ? null : procv(TABELA_SE, n);
};
