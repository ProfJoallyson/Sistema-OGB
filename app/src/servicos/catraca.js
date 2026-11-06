// Confere a lista da catraca (quem entrou no dia) com os alunos das turmas.
// O formato do arquivo da catraca ainda não foi visto (pedir um exemplo à escola);
// por isso a leitura aceita uma lista de nomes ou uma planilha com uma coluna "nome".

import { normalizar, semelhanca } from './texto.js';

export const LIMITE_SUGESTAO = 0.75;

// linhas = matriz (primeira linha pode ser cabeçalho) ou lista de textos
export function nomesDaLista(linhas) {
  const ms = linhas.map(l => (Array.isArray(l) ? l : [l])).filter(l => l.some(c => String(c ?? '').trim()));
  if (!ms.length) return [];
  const cab = ms[0].map(c => normalizar(c));
  let col = cab.findIndex(c => c === 'NOME' || c.startsWith('NOME ') || c === 'ALUNO' || c.includes('NOME DO ALUNO'));
  const corpo = col >= 0 ? ms.slice(1) : ms;
  if (col < 0) {
    // sem cabeçalho: usa a coluna com mais letras
    const largura = Math.max(...ms.map(l => l.length));
    let melhor = 0, pontos = -1;
    for (let c = 0; c < largura; c++) {
      const p = ms.reduce((s, l) => s + (String(l[c] ?? '').match(/[A-Za-zÀ-ú]/g) || []).length, 0);
      if (p > pontos) { pontos = p; melhor = c; }
    }
    col = melhor;
  }
  return [...new Set(corpo.map(l => String(l[col] ?? '').trim()).filter(Boolean))];
}

// alunos = [{ id, nome }]. Devolve o que bateu, as dúvidas para a secretaria confirmar e quem faltou.
export function conferirCatraca(nomesCatraca, alunos) {
  const porNome = new Map(alunos.map(a => [normalizar(a.nome), a]));
  const presentes = new Set();
  const duvidas = [];
  const naoEncontrados = [];
  for (const nome of nomesCatraca) {
    const exato = porNome.get(normalizar(nome));
    if (exato) { presentes.add(exato.id); continue; }
    const sugestoes = alunos
      .map(a => ({ alunoId: a.id, nome: a.nome, semelhanca: semelhanca(nome, a.nome) }))
      .filter(s => s.semelhanca >= LIMITE_SUGESTAO)
      .sort((a, b) => b.semelhanca - a.semelhanca)
      .slice(0, 3);
    if (sugestoes.length) duvidas.push({ nomeCatraca: nome, sugestoes });
    else naoEncontrados.push(nome);
  }
  const ausentes = alunos.filter(a => !presentes.has(a.id) && !duvidas.some(d => d.sugestoes.some(s => s.alunoId === a.id)));
  return { presentes: [...presentes], duvidas, naoEncontrados, ausentes: ausentes.map(a => a.id) };
}
