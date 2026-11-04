// Gera o SVG do cartão-resposta (modelo baseado no cartão-resposta do ENEM).
// Depende de layout.js e da biblioteca qrcode-generator (global "qrcode").

const COR = { rosa: '#d6336c', rosaTexto: '#c2255c', rosaClaro: '#f8d3df', rosaMedio: '#ee9ab5', cinza: '#e6e6e6', texto: '#111' };

function esc(s) {
  return String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

// Conteúdo do QR: OGB1|<idSimulado>|<turma>|<numero>
function conteudoQR(simuladoId, aluno) {
  // Campos codificados em ASCII (encodeURIComponent) para qualquer leitor de QR entender.
  return ['OGB1', simuladoId, aluno.turma, aluno.numero].map(v => encodeURIComponent(String(v))).join('|');
}

function svgQR(texto, x, y, tamanho) {
  const qr = qrcode(0, 'L');
  qr.addData(texto);
  qr.make();
  const n = qr.getModuleCount();
  const m = tamanho / (n + 2); // margem de 1 módulo
  let d = '';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    if (qr.isDark(r, c)) d += `M${(x + (c + 1) * m).toFixed(3)} ${(y + (r + 1) * m).toFixed(3)}h${m.toFixed(3)}v${m.toFixed(3)}h-${m.toFixed(3)}z`;
  }
  return `<rect x="${x}" y="${y}" width="${tamanho}" height="${tamanho}" fill="#fff"/><path d="${d}" fill="#000"/>`;
}

function bolha(x, y, r, letra, tam) {
  return `<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="${r}" fill="#fff" stroke="${COR.rosa}" stroke-width="0.25"/>` +
    (letra ? `<text x="${x.toFixed(2)}" y="${(y + tam * 0.36).toFixed(2)}" font-size="${tam}" fill="${COR.rosa}" text-anchor="middle">${letra}</text>` : '');
}

// opcoes: { titulo, selo, escola, simuladoId, nQuestoes, aluno:{nome,turma,numero}, data, areas:[{nome,de,ate}], linguaEstrangeira:bool, corDaProva:bool }
function renderFolha(o) {
  const { titulo, selo = '', escola = 'Colégio e Curso OGB', simuladoId, nQuestoes, aluno, data = '' } = o;
  const areas = o.areas && o.areas.length ? o.areas : [];
  const g = layoutGrade(nQuestoes);
  const out = [];
  const t = (x, y, txt, opts = '') => out.push(`<text x="${x}" y="${y}" ${opts}>${esc(txt)}</text>`);
  const tb = (x, y, partes, opts = '') => out.push(`<text x="${x}" y="${y}" ${opts}>${partes.map(([s, b]) => b ? `<tspan font-weight="700">${esc(s)}</tspan>` : esc(s)).join('')}</text>`);

  out.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${FOLHA.largura} ${FOLHA.altura}" width="${FOLHA.largura}mm" height="${FOLHA.altura}mm" font-family="Arial, Helvetica, sans-serif">`);
  out.push(`<defs><linearGradient id="sub" x1="0" x2="1"><stop offset="0" stop-color="#555"/><stop offset="1" stop-color="${COR.rosaMedio}"/></linearGradient></defs>`);
  out.push(`<rect width="210" height="297" fill="#fff"/>`);

  // Marcadores dos cantos
  const h = FOLHA.ladoMarcador / 2;
  for (const [x, y] of FOLHA.marcadores) out.push(`<rect x="${x - h}" y="${y - h}" width="${FOLHA.ladoMarcador}" height="${FOLHA.ladoMarcador}" fill="#000"/>`);

  // Título
  t(21, 30, 'CARTÃO-RESPOSTA', `font-size="10.5" font-weight="700" fill="#222" letter-spacing="-0.2"`);
  out.push(`<rect x="22" y="32" width="88" height="0.9" fill="url(#sub)"/>`);
  t(26, 37.6, (titulo || '').toUpperCase(), `font-size="3.4" fill="#333"`);
  if (selo) {
    out.push(`<ellipse cx="170" cy="27" rx="19" ry="9.5" fill="#fff" stroke="#000" stroke-width="0.9"/>`);
    t(170, 30.6, selo, `font-size="${selo.length > 6 ? 6.5 : 10}" font-weight="700" text-anchor="middle"`);
  }

  // Identificação
  out.push(`<rect x="20" y="41" width="170" height="51" rx="6" fill="#fff" stroke="#555" stroke-width="0.35"/>`);
  out.push(`<path d="M146 41 H184 a6 6 0 0 1 6 6 V92 H146 Z" fill="${COR.rosaClaro}" stroke="#555" stroke-width="0.3"/>`);
  t(168, 46, 'Identificação da prova', `font-size="3.2" font-weight="700" fill="${COR.rosaTexto}" text-anchor="middle"`);
  out.push(svgQR(conteudoQR(simuladoId, aluno), FOLHA.qr.x, FOLHA.qr.y, FOLHA.qr.lado));
  // caixas de acertos (como Linguagens / Humanas / Total no ENEM)
  const caixas = [...areas.map(a => a.nome.toUpperCase()), 'TOTAL'].slice(-3);
  const lc = 44 / caixas.length;
  caixas.forEach((nome, i) => {
    const x = 146 + i * lc;
    out.push(`<rect x="${x.toFixed(2)}" y="77" width="${lc.toFixed(2)}" height="15" fill="#fff" stroke="#555" stroke-width="0.25"/>`);
    t((x + lc / 2).toFixed(2), 80, nome, `font-size="${nome.length > 10 ? 1.7 : 2.1}" fill="${COR.rosaTexto}" text-anchor="middle"`);
  });

  t(24, 48, 'Nome completo:', `font-size="3.4" font-weight="700"`);
  t(24, 56, aluno.nome.toUpperCase(), `font-size="${aluno.nome.length > 40 ? 4 : 4.8}" font-weight="700"`);
  out.push(`<line x1="24" y1="58" x2="142" y2="58" stroke="${COR.rosaMedio}" stroke-width="0.3"/>`);
  tb(24, 64.5, [['Unidade: ', true], [escola]], `font-size="3.1"`);
  tb(92, 64.5, [['Turma: ', true], [aluno.turma]], `font-size="3.1"`);
  tb(118, 64.5, [['Nº: ', true], [aluno.numero]], `font-size="3.1"`);
  if (data) tb(24, 64.5 - 0.01, [], '');

  // Língua estrangeira e cor da prova (bolinhas lidas pela câmera)
  const L = FOLHA.lingua, C = FOLHA.cor;
  t(24, L.y + 1.1, 'Língua estrangeira:', `font-size="2.8" font-weight="700"`);
  for (const op of L.opcoes) { out.push(bolha(op.x, L.y, L.raio, '', 0)); t(op.x + 3, L.y + 1, op.valor, `font-size="2.8"`); }
  t(24, C.y + 1.1, 'Cor da prova:', `font-size="2.8" font-weight="700"`);
  for (const op of C.opcoes) { out.push(bolha(op.x, C.y, C.raio, '', 0)); t(op.x + 3, C.y + 1, op.valor, `font-size="2.8"`); }

  out.push(`<line x1="62" y1="87.5" x2="142" y2="87.5" stroke="#888" stroke-width="0.25" stroke-dasharray="0.8 0.8"/>`);
  t(102, 91, 'Assinatura do participante', `font-size="3" fill="${COR.rosaTexto}" text-anchor="middle"`);
  if (data) t(24, 87, `Data: ${data}`, `font-size="2.8"`);

  // Instruções
  out.push(`<path d="M18 104 V97.5 H30 M192 104 V97.5 H180" fill="none" stroke="#222" stroke-width="0.8"/>`);
  t(105, 103, 'INSTRUÇÕES', `font-size="4.6" font-weight="700" fill="${COR.rosaTexto}" text-anchor="middle"`);
  const esq = [
    [['1. ', true], ['Confira se o nome, a turma e o número impressos neste']],
    [['    cartão são os seus. Se houver erro, avise o aplicador.']],
    [['2. ', true], ['Marque a sua opção de língua estrangeira e a cor da']],
    [['    capa do seu caderno de questões.']],
    [['3. ', true], ['Não haverá substituição do '], ['CARTÃO-RESPOSTA', true], [', por']],
    [['    isso tenha muita atenção durante a marcação.']],
  ];
  const dir = [
    [['4. ', true], ['Transcreva a frase da '], ['CAPA DO CADERNO', true], [' no']],
    [['    local indicado abaixo.']],
    [['5. ', true], ['O '], ['CARTÃO-RESPOSTA', true], [' é o único documento usado']],
    [['    na correção. Não o amasse, não o dobre, nem o rasure.']],
    [['6. ', true], ['Use caneta esferográfica de tinta preta, fabricada em']],
    [['    material transparente. Não use lápis ou lapiseira.']],
  ];
  esq.forEach((l, i) => tb(22, 109 + i * 3.7, l, `font-size="2.85" xml:space="preserve"`));
  dir.forEach((l, i) => tb(108, 109 + i * 3.7, l, `font-size="2.85" xml:space="preserve"`));

  // Frase
  out.push(`<rect x="20" y="133" width="170" height="16" fill="#fff" stroke="${COR.rosa}" stroke-width="0.4"/>`);
  out.push(`<rect x="20" y="133" width="58" height="16" fill="${COR.rosaClaro}" stroke="${COR.rosa}" stroke-width="0.4"/>`);
  ['ATENÇÃO: TRANSCREVA AQUI COM A SUA', 'CALIGRAFIA USUAL A FRASE APRESENTADA', 'NA CAPA DO SEU CADERNO DE QUESTÕES.'].forEach((s, i) =>
    t(22, 137.6 + i * 3.6, s, `font-size="2.25" ${i === 0 ? '' : ''}fill="#222"`));
  out.push(`<path d="M79 137 h4 v-2.5 l5 6.5 l-5 6.5 v-2.5 h-4 z" fill="#fff" stroke="${COR.rosa}" stroke-width="0.35"/>`);

  // Exemplo de marcação
  out.push(`<rect x="20" y="152" width="170" height="18" fill="${COR.cinza}"/>`);
  tb(23, 158, [['Para todas as marcações neste '], ['CARTÃO-RESPOSTA', true], [', preencha os']], `font-size="3"`);
  tb(23, 162, [['círculos completamente e com nitidez, utilizando '], ['caneta', true]], `font-size="3"`);
  tb(23, 166, [['esferográfica de tinta preta', true], [', conforme a ilustração.']], `font-size="3"`);
  t(160, 155.8, 'EXEMPLO DE RESPOSTA', `font-size="2.5" fill="${COR.rosaTexto}" text-anchor="middle"`);
  out.push(`<rect x="131" y="157.2" width="57" height="11.6" fill="#fff" stroke="${COR.rosa}" stroke-width="0.3"/>`);
  [['A', 0], ['B', 1], ['D', 3]].forEach(([l, idx], i) => {
    const y = 159.4 + i * 3.6;
    t(132.5, y + 0.8, `Resposta da questão ${'XYZ'[i]} = ${l}  ➜`, `font-size="2"`);
    t(161, y + 0.8, 'XYZ'[i], `font-size="2.2" font-weight="700"`);
    for (let k = 0; k < 5; k++) {
      const x = 165 + k * 4.4;
      if (k === idx) out.push(`<circle cx="${x}" cy="${y}" r="1.55" fill="#000"/>`);
      else out.push(bolha(x, y, 1.55, 'ABCDE'[k], 1.9));
    }
  });

  // Grade de respostas
  out.push(`<line x1="8" y1="174" x2="202" y2="174" stroke="#222" stroke-width="0.4"/>`);
  if (g.colunas > g.metade) {
    const xm = g.xColuna(g.metade) - g.gapMetade / 2 - 0.4;
    out.push(`<line x1="${xm}" y1="174" x2="${xm}" y2="${g.y0 + (g.linhas - 0.5) * g.alturaLinha + 1}" stroke="#222" stroke-width="0.4"/>`);
  }
  for (let c = 0; c < g.colunas; c++) {
    const xc = g.xColuna(c), w = g.larguraCol - 0.8;
    const nLinhas = Math.min(g.linhas, nQuestoes - c * g.linhas);
    out.push(`<rect x="${xc}" y="${g.yCabecalho}" width="${w}" height="${g.alturaCabecalho}" fill="${COR.rosaClaro}"/>`);
    t((xc + w / 2).toFixed(2), g.yCabecalho + 3.5, 'QUESTÃO/RESPOSTA', `font-size="2.35" font-weight="700" fill="#333" text-anchor="middle"`);
    for (let l = 0; l < nLinhas; l++) {
      const y = g.y0 + (l - 0.5) * g.alturaLinha;
      out.push(`<rect x="${xc}" y="${y.toFixed(2)}" width="${w}" height="${g.alturaLinha}" fill="${l % 2 ? COR.rosaClaro : '#fff'}" stroke="${COR.rosaMedio}" stroke-width="0.15"/>`);
    }
    out.push(`<line x1="${xc + 5.6}" y1="${g.y0 - g.alturaLinha / 2}" x2="${xc + 5.6}" y2="${(g.y0 + (nLinhas - 0.5) * g.alturaLinha).toFixed(2)}" stroke="${COR.rosaMedio}" stroke-width="0.15"/>`);
  }
  for (const q of g.questoes) {
    t((q.xNumero - 0.6).toFixed(2), (q.y + 1).toFixed(2), String(q.numero).padStart(2, '0'), `font-size="2.7" font-weight="700" fill="#222" text-anchor="middle"`);
    for (const b of q.bolhas) out.push(bolha(b.x, b.y, g.raio, b.letra, 2.3));
  }

  // Rodapé
  t(22, 280, '*Modelo baseado no CARTÃO-RESPOSTA do Enem', `font-size="2" font-weight="700" fill="#333"`);
  t(188, 280, `${simuladoId} · ${aluno.turma} · Nº ${aluno.numero}`, `font-size="2.2" fill="${COR.rosaTexto}" text-anchor="end"`);

  out.push('</svg>');
  return out.join('');
}

if (typeof module !== 'undefined') module.exports = { renderFolha, conteudoQR };
