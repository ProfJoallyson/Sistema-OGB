// Geometria da folha (em milímetros, A4 retrato, origem no canto superior esquerdo).
// Usada tanto para desenhar a folha quanto para ler a foto.
const FOLHA = {
  largura: 210,
  altura: 297,
  // Centros dos 4 marcadores pretos (quadrados) usados pela câmera.
  marcadores: [
    [12, 12], [198, 12], [12, 285], [198, 285]
  ],
  ladoMarcador: 8,
  // Área do QR code (inclui 1 módulo de margem branca).
  qr: { x: 151.5, y: 48.5, lado: 27 },
  alternativas: ['A', 'B', 'C', 'D', 'E'],
  // Campos extras de marcar, como no cartão do ENEM.
  lingua: { y: 71.5, opcoes: [{ valor: 'Inglês', x: 67 }, { valor: 'Espanhol', x: 88 }], raio: 1.9 },
  cor: { y: 78, opcoes: [{ valor: 'Azul', x: 67 }, { valor: 'Amarela', x: 85 }, { valor: 'Branca', x: 106 }, { valor: 'Rosa', x: 125 }], raio: 1.9 },
  // Faixa usada para achar a orientação quando o QR não é lido (título "CARTÃO-RESPOSTA").
  orientacao: { x0: 22, x1: 100, y: 26 },
};

// Grade de respostas no estilo ENEM: colunas de 15 questões, em duas metades.
function layoutGrade(nQuestoes) {
  const porColuna = 15;
  const colunas = Math.ceil(nQuestoes / porColuna);
  const metade = Math.ceil(colunas / 2);
  const larguraCol = 27.6, gapMetade = 3.4;
  const xInicio = 105 - (colunas * larguraCol + (colunas > metade ? gapMetade : 0)) / 2;
  const yCabecalho = 177, alturaCabecalho = 5;
  const alturaLinha = 6.2;
  const y0 = yCabecalho + alturaCabecalho + alturaLinha / 2 + 0.3; // centro da primeira linha
  const raio = 1.85, passo = 4.25, dxPrimeira = 7.9;
  const xColuna = c => xInicio + c * larguraCol + (c >= metade ? gapMetade : 0);
  const questoes = [];
  for (let q = 0; q < nQuestoes; q++) {
    const c = Math.floor(q / porColuna), l = q % porColuna;
    const xc = xColuna(c);
    const y = y0 + l * alturaLinha;
    questoes.push({
      numero: q + 1, coluna: c, linha: l,
      xNumero: xc + 3.4, y,
      bolhas: FOLHA.alternativas.map((letra, i) => ({ letra, x: xc + dxPrimeira + i * passo, y })),
    });
  }
  return { colunas, linhas: porColuna, metade, larguraCol, gapMetade, xColuna, yCabecalho, alturaCabecalho, y0, alturaLinha, raio, passo, dxPrimeira, questoes };
}

if (typeof module !== 'undefined') module.exports = { FOLHA, layoutGrade };
