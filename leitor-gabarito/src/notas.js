// Regras de correção e de nota dos simulados (tabelas do boletim do OGB).
// Ver analise-drive/regras-boletim.md, seção 4.

const TIPOS = {
  SO: { nome: 'Simulado Obrigatório', n: 80 },
  SP: { nome: 'Simulado Parcial', n: 80 },
  SG: { nome: 'Simulado Global', n: 90 },
  SE: { nome: 'Simulado Extra (bônus)', n: 80 },
  OUTRO: { nome: 'Outro', n: 45 },
};

// [acertos mínimos, nota] — PROCV aproximado, como na planilha.
const TABELA_80 = [[1, 2], [10, 3], [20, 5], [30, 6], [40, 7], [50, 8], [66, 9], [72, 10]];
const TABELA_90 = [[1, 2], [11, 3], [23, 5], [34, 6], [45, 7], [56, 8], [74, 9], [81, 10]]; // decisão de 20/10/2026
const TABELA_SE = [[0, 0], [20, 0.5], [35, 1], [50, 1.5], [64, 2]];

function tabelaDoSimulado(sim) {
  if (sim.tipo === 'SE') return TABELA_SE;
  if (sim.tipo === 'SG' || sim.nQuestoes === 90) return TABELA_90;
  if (sim.nQuestoes === 80) return TABELA_80;
  // outro tamanho: tabela de 80 proporcional (mesma regra usada para criar a do SG)
  return TABELA_80.map(([a, n]) => [Math.max(1, Math.round(a * sim.nQuestoes / 80)), n]);
}

// Devolve a nota (número) ou null quando a planilha mostraria "-" (0 acertos).
function notaPorAcertos(sim, acertos) {
  const tab = tabelaDoSimulado(sim);
  let nota = null;
  for (const [min, n] of tab) if (acertos >= min) nota = n;
  return nota;
}

// Gabarito efetivo de um aluno: considera cor da prova e língua estrangeira.
// sim.gabaritos = { 'Única' | 'Azul' | ... : { principal: [n letras], espanhol: [letras da faixa] } }
function gabaritoDoAluno(sim, cor, lingua) {
  const avisos = [];
  const cores = Object.keys(sim.gabaritos || {});
  let chave = cores[0];
  if (sim.usaCor) {
    if (cor && cor !== '*' && sim.gabaritos[cor]) chave = cor;
    else avisos.push(cor === '*' ? 'Mais de uma cor de prova marcada' : 'Cor da prova não marcada');
  }
  const g = (sim.gabaritos && sim.gabaritos[chave]) || { principal: [] };
  const final = Array.from({ length: sim.nQuestoes }, (_, i) => g.principal[i] || '');
  if (sim.usaLingua && sim.lingua) {
    const { de, ate } = sim.lingua;
    if (lingua === 'Espanhol') {
      for (let q = de; q <= ate; q++) final[q - 1] = (g.espanhol || [])[q - de] || '';
    } else if (lingua !== 'Inglês') {
      avisos.push(lingua === '*' ? 'Marcou as duas línguas (corrigido como Inglês)' : 'Língua estrangeira não marcada (corrigido como Inglês)');
    }
  }
  return { gabarito: final, cor: chave, avisos };
}

// Corrige um resultado lido. 'X' no gabarito = questão anulada (todos ganham).
function corrigirResultado(sim, r) {
  const { gabarito, cor, avisos } = gabaritoDoAluno(sim, r.cor, r.lingua);
  let acertos = 0, semGabarito = 0, brancos = 0, duplas = 0;
  const certo = r.respostas.map((resp, i) => {
    const g = gabarito[i];
    if (!g) { semGabarito++; return false; }
    if (resp === '') brancos++;
    if (resp === '*') duplas++;
    const ok = g === 'X' || (resp !== '' && resp !== '*' && resp === g);
    if (ok) acertos++;
    return ok;
  });
  const areas = (sim.areas || []).map(a => {
    let ac = 0;
    for (let q = a.de; q <= a.ate; q++) if (certo[q - 1]) ac++;
    return { nome: a.nome, acertos: ac, total: a.ate - a.de + 1 };
  });
  const nota = notaPorAcertos(sim, acertos);
  return { acertos, certo, areas, nota, corUsada: cor, avisos, semGabarito, brancos, duplas, gabarito };
}

function formatarNota(sim, nota) {
  if (nota === null || nota === undefined) return '-';
  const s = nota.toFixed(1).replace('.', ',');
  return sim.tipo === 'SE' ? '+' + s : s;
}

if (typeof module !== 'undefined') module.exports = { TIPOS, TABELA_80, TABELA_90, TABELA_SE, notaPorAcertos, corrigirResultado, gabaritoDoAluno, formatarNota, tabelaDoSimulado };
