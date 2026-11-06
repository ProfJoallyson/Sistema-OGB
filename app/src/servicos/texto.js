// Utilidades para comparar nomes digitados de jeitos diferentes.

export const semAcento = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '');
export const normalizar = s => semAcento(s).toUpperCase().replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

// Distância de edição (Levenshtein).
export function distancia(a, b) {
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  let ant = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) cur[j] = Math.min(ant[j] + 1, cur[j - 1] + 1, ant[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    ant = cur;
  }
  return ant[n];
}

// Semelhança de 0 a 1 entre dois nomes, tolerante a erro de digitação,
// a sobrenome faltando e a nome abreviado ("MARIA S OLIVEIRA").
export function semelhanca(a, b) {
  const x = normalizar(a), y = normalizar(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  const porLetra = 1 - distancia(x, y) / Math.max(x.length, y.length);
  const tx = x.split(' '), ty = y.split(' ');
  const casa = (t, lista) => lista.some(u => u === t || (t.length === 1 && u[0] === t) || (u.length === 1 && t[0] === u) ||
    (t.length > 3 && u.length > 3 && distancia(t, u) <= 1));
  const [menor, maior] = tx.length <= ty.length ? [tx, ty] : [ty, tx];
  const comuns = menor.filter(t => casa(t, maior)).length;
  let porPalavra = comuns / maior.length;
  // mesmo primeiro nome e todas as palavras do nome mais curto presentes
  if (comuns === menor.length && menor[0] === maior[0]) porPalavra = Math.max(porPalavra, 0.85);
  return Math.max(porLetra, porPalavra);
}
