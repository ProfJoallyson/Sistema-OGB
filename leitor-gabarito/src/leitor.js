// Leitura do cartão-resposta a partir de uma imagem (ImageData).
// Depende de layout.js e da biblioteca jsQR (global "jsQR").

// ---------- utilidades de imagem ----------
function paraCinza(img) {
  const { width: w, height: h, data } = img;
  const g = new Uint8Array(w * h);
  for (let i = 0, j = 0; i < g.length; i++, j += 4) g[i] = (data[j] * 77 + data[j + 1] * 150 + data[j + 2] * 29) >> 8;
  return { w, h, g };
}

function reduzir(c, fator) {
  const w = Math.floor(c.w / fator), h = Math.floor(c.h / fator), g = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let s = 0, n = 0;
    for (let yy = 0; yy < fator; yy++) for (let xx = 0; xx < fator; xx++) { s += c.g[(y * fator + yy) * c.w + x * fator + xx]; n++; }
    g[y * w + x] = s / n;
  }
  return { w, h, g };
}

// Binarização adaptativa (média local por imagem integral).
function binarizar(c, janela) {
  const { w, h, g } = c, W = w + 1;
  const integ = new Float64Array(W * (h + 1));
  for (let y = 0; y < h; y++) {
    let linha = 0;
    for (let x = 0; x < w; x++) { linha += g[y * w + x]; integ[(y + 1) * W + x + 1] = integ[y * W + x + 1] + linha; }
  }
  const r = Math.max(4, Math.floor(janela / 2)), b = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - r), y1 = Math.min(h, y + r + 1);
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - r), x1 = Math.min(w, x + r + 1);
      const soma = integ[y1 * W + x1] - integ[y0 * W + x1] - integ[y1 * W + x0] + integ[y0 * W + x0];
      const media = soma / ((x1 - x0) * (y1 - y0));
      const v = g[y * w + x];
      b[y * w + x] = (v < media * 0.72 && v < 150) ? 1 : 0;
    }
  }
  return b;
}

// Componentes conexos escuros (4-vizinhança).
function componentes(bin, w, h) {
  const rot = new Int32Array(w * h), lista = [], pilha = new Int32Array(w * h);
  let id = 0;
  for (let i = 0; i < bin.length; i++) {
    if (!bin[i] || rot[i]) continue;
    id++;
    let topo = 0, area = 0, sx = 0, sy = 0, minx = w, maxx = 0, miny = h, maxy = 0;
    pilha[topo++] = i; rot[i] = id;
    while (topo) {
      const p = pilha[--topo], x = p % w, y = (p - x) / w;
      area++; sx += x; sy += y;
      if (x < minx) minx = x; if (x > maxx) maxx = x; if (y < miny) miny = y; if (y > maxy) maxy = y;
      const viz = [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, y > 0 ? p - w : -1, y < h - 1 ? p + w : -1];
      for (const q of viz) if (q >= 0 && bin[q] && !rot[q]) { rot[q] = id; pilha[topo++] = q; }
    }
    lista.push({ area, cx: sx / area, cy: sy / area, minx, maxx, miny, maxy });
  }
  return lista;
}

// ---------- homografia ----------
function resolver(A, b) {
  const n = b.length;
  for (let i = 0; i < n; i++) {
    let m = i;
    for (let k = i + 1; k < n; k++) if (Math.abs(A[k][i]) > Math.abs(A[m][i])) m = k;
    [A[i], A[m]] = [A[m], A[i]]; [b[i], b[m]] = [b[m], b[i]];
    for (let k = i + 1; k < n; k++) {
      const f = A[k][i] / A[i][i];
      for (let j = i; j < n; j++) A[k][j] -= f * A[i][j];
      b[k] -= f * b[i];
    }
  }
  const x = new Array(n);
  for (let i = n - 1; i >= 0; i--) { let s = b[i]; for (let j = i + 1; j < n; j++) s -= A[i][j] * x[j]; x[i] = s / A[i][i]; }
  return x;
}
function homografia(origem, destino) {
  const A = [], b = [];
  for (let i = 0; i < 4; i++) {
    const [x, y] = origem[i], [u, v] = destino[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.push(u);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); b.push(v);
  }
  const h = resolver(A, b);
  return (x, y) => { const d = h[6] * x + h[7] * y + 1; return [(h[0] * x + h[1] * y + h[2]) / d, (h[3] * x + h[4] * y + h[5]) / d]; };
}

function amostrar(c, x, y) {
  if (x < 0 || y < 0 || x >= c.w - 1 || y >= c.h - 1) return 255;
  const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0, i = y0 * c.w + x0, g = c.g;
  return g[i] * (1 - fx) * (1 - fy) + g[i + 1] * fx * (1 - fy) + g[i + c.w] * (1 - fx) * fy + g[i + c.w + 1] * fx * fy;
}

// ---------- marcadores ----------
function acharMarcadores(c) {
  const fator = Math.max(1, Math.round(Math.max(c.w, c.h) / 700));
  const p = fator > 1 ? reduzir(c, fator) : c;
  const bin = binarizar(p, Math.max(p.w, p.h) / 6);
  const comps = componentes(bin, p.w, p.h);
  const minArea = (Math.min(p.w, p.h) / 120) ** 2;
  const cand = comps.filter(k => {
    const bw = k.maxx - k.minx + 1, bh = k.maxy - k.miny + 1;
    if (k.area < minArea) return false;
    if (k.minx <= 1 || k.miny <= 1 || k.maxx >= p.w - 2 || k.maxy >= p.h - 2) return false;
    const asp = bw / bh, fill = k.area / (bw * bh);
    return asp > 0.5 && asp < 2 && fill > 0.5;
  }).sort((a, b) => b.area - a.area).slice(0, 10);
  if (cand.length < 4) return [];

  const razaoEsperada = (FOLHA.marcadores[3][1] - FOLHA.marcadores[0][1]) / (FOLHA.marcadores[1][0] - FOLHA.marcadores[0][0]);
  const quads = [];
  const n = cand.length, maiorArea = cand[0].area;
  for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) for (let d = b + 1; d < n; d++) for (let e = d + 1; e < n; e++) {
    const q = [cand[a], cand[b], cand[d], cand[e]];
    const areas = q.map(k => k.area), amax = Math.max(...areas), amin = Math.min(...areas);
    if (amax / amin > 6) continue; // perspectiva forte deixa os marcadores de longe menores
    // ordena em volta do centro (sentido horário a partir do canto superior esquerdo da imagem)
    const mx = q.reduce((s, k) => s + k.cx, 0) / 4, my = q.reduce((s, k) => s + k.cy, 0) / 4;
    q.sort((k1, k2) => Math.atan2(k1.cy - my, k1.cx - mx) - Math.atan2(k2.cy - my, k2.cx - mx));
    const dist = (i, j) => Math.hypot(q[i].cx - q[j].cx, q[i].cy - q[j].cy);
    const l = [dist(0, 1), dist(1, 2), dist(2, 3), dist(3, 0)];
    const ladoA = (l[0] + l[2]) / 2, ladoB = (l[1] + l[3]) / 2;
    if (Math.min(...l) < Math.max(p.w, p.h) * 0.15) continue;
    const razao = Math.max(ladoA, ladoB) / Math.min(ladoA, ladoB);
    // o tamanho do marcador deve combinar com a distância entre eles
    const ladoMarc = Math.sqrt(areas.reduce((s, v) => s + v, 0) / 4);
    const escala = Math.min(ladoA, ladoB) / (FOLHA.marcadores[1][0] - FOLHA.marcadores[0][0]);
    const coerencia = ladoMarc / (FOLHA.ladoMarcador * escala);
    if (coerencia < 0.5 || coerencia > 1.6) continue;
    const pont = Math.abs(Math.log(razao / razaoEsperada)) * 3 + Math.log(amax / amin) * 0.5 + Math.abs(Math.log(coerencia)) + Math.log(maiorArea / amin) * 1.5;
    quads.push({ pont, pts: q.map(k => [(k.cx + 0.5) * fator - 0.5, (k.cy + 0.5) * fator - 0.5]) });
  }
  // devolve as melhores combinações; quem chama confirma pelo QR code
  return quads.sort((a, b) => a.pont - b.pont).slice(0, 4).map(m => m.pts);
}

// ---------- leitura completa ----------
// Recebe ImageData, devolve { ok, motivo, qr, respostas[], detalhes, cantos }
function lerFolha(img, opcoes = {}) {
  const c = paraCinza(img);
  const opcoesCantos = acharMarcadores(c);
  if (!opcoesCantos || !opcoesCantos.length) return { ok: false, motivo: 'Não encontrei os 4 quadrados dos cantos.' };

  // pts está em sentido horário. Testa as 4 rotações e usa a que tiver QR válido.
  const mm = [FOLHA.marcadores[0], FOLHA.marcadores[1], FOLHA.marcadores[3], FOLHA.marcadores[2]]; // TL, TR, BR, BL
  let H = null, qr = null, pts = opcoesCantos[0];
  busca: for (const cand of opcoesCantos) for (let r = 0; r < 4; r++) {
    const dest = [0, 1, 2, 3].map(i => cand[(i + r) % 4]);
    const Hr = homografia(mm, dest);
    const texto = lerQR(c, Hr);
    if (texto) { H = Hr; qr = texto; pts = dest; break busca; }
  }
  let info = null;
  if (qr) {
    const partes = qr.split('|').map(v => { try { return decodeURIComponent(v); } catch (e) { return v; } });
    if (partes[0] !== 'OGB1') return { ok: false, motivo: 'Este QR code não é de um cartão do app.', cantos: pts };
    info = { simuladoId: partes[1], turma: partes[2], numero: partes[3] };
  } else {
    // Sem QR: acha a orientação pelas faixas escuras do cabeçalho e lê as respostas mesmo assim.
    let melhor = null;
    for (const cand of opcoesCantos.slice(0, 2)) for (let r = 0; r < 4; r++) {
      const dest = [0, 1, 2, 3].map(i => cand[(i + r) % 4]);
      const Hr = homografia(mm, dest);
      let faixa = 0, papel = 0, n = 0;
      const O = FOLHA.orientacao;
      for (let x = O.x0; x <= O.x1; x += 0.5) for (const dy of [-2.5, -1.5, -0.5, 0.5]) {
        faixa += amostrar(c, ...Hr(x, O.y + dy)); papel += amostrar(c, ...Hr(x, O.y + 12 + dy * 0.2)); n++;
      }
      const contraste = (papel - faixa) / n;
      if (!melhor || contraste > melhor.contraste) melhor = { contraste, Hr, dest };
    }
    if (!melhor || melhor.contraste < 15) return { ok: false, motivo: 'Achei os cantos, mas não reconheci a folha.', cantos: pts };
    H = melhor.Hr; pts = melhor.dest;
  }
  const nQuestoes = (info && opcoes.nQuestoesPorSimulado && opcoes.nQuestoesPorSimulado(info.simuladoId)) || opcoes.nQuestoes;
  if (!nQuestoes) return { ok: false, motivo: 'Simulado do QR code não está cadastrado neste aparelho.', qr: info, cantos: pts };

  const g = layoutGrade(nQuestoes);
  const rAmostra = g.raio * 0.62;
  const offs = [];
  for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) if (dx * dx + dy * dy <= 9.5) offs.push([dx / 3 * rAmostra, dy / 3 * rAmostra]);

  const medias = g.questoes.map(q => q.bolhas.map(b => {
    let s = 0;
    for (const [ox, oy] of offs) { const [x, y] = H(b.x + ox, b.y + oy); s += amostrar(c, x, y); }
    return s / offs.length;
  }));
  // referência de papel por região (mediana das bolhas da questão) e global
  const todas = medias.flat().sort((a, b) => a - b);
  const refGlobal = todas[Math.floor(todas.length * 0.85)];

  const respostas = [], detalhes = [];
  medias.forEach((m, qi) => {
    const ord = [...m].sort((a, b) => a - b), mediana = ord[2];
    const ref = Math.max(mediana, refGlobal * 0.85);
    const escuro = m.map(v => Math.max((ref - v) / ref, 0));
    const marcadas = [], duvidas = [];
    escuro.forEach((d, i) => { if (d > 0.33 || v_absoluto(m[i], refGlobal)) marcadas.push(i); else if (d > 0.18) duvidas.push(i); });
    let resp;
    if (marcadas.length === 0) resp = '';
    else if (marcadas.length === 1) resp = FOLHA.alternativas[marcadas[0]];
    else resp = '*'; // mais de uma marcada
    respostas.push(resp);
    detalhes.push({ numero: qi + 1, escuro: escuro.map(v => +v.toFixed(2)), duvida: duvidas.length > 0 });
  });
  const campo = (def) => {
    const m = def.opcoes.map(op => mediaDisco(c, H, op.x, def.y, def.raio * 0.62, offs, g.raio * 0.62));
    const marc = m.map((v, i) => [v, i]).filter(([v]) => (refGlobal - v) / refGlobal > 0.33).map(([, i]) => def.opcoes[i].valor);
    return marc.length === 1 ? marc[0] : (marc.length > 1 ? '*' : '');
  };
  return { ok: true, qr: info, nQuestoes, respostas, detalhes, lingua: campo(FOLHA.lingua), cor: campo(FOLHA.cor), cantos: pts };
}
function mediaDisco(c, H, cx, cy, r, offs, rOffs) {
  let s = 0;
  for (const [ox, oy] of offs) { const [x, y] = H(cx + ox * r / rOffs, cy + oy * r / rOffs); s += amostrar(c, x, y); }
  return s / offs.length;
}
function v_absoluto(v, refGlobal) { return v < refGlobal * 0.5; }

function lerQR(c, H) {
  // Recorta só a área do QR e acrescenta margem branca, como o padrão do QR pede.
  const x0 = FOLHA.qr.x - 0.5, y0 = FOLHA.qr.y - 0.5, lado = FOLHA.qr.lado + 1, ppm = 8, borda = 40, n = Math.round(lado * ppm) + 2 * borda;
  const dados = new Uint8ClampedArray(n * n * 4).fill(255);
  for (let y = 0; y < n - 2 * borda; y++) for (let x = 0; x < n - 2 * borda; x++) {
    const [u, v] = H(x0 + x / ppm, y0 + y / ppm);
    const val = amostrar(c, u, v), i = ((y + borda) * n + x + borda) * 4;
    dados[i] = dados[i + 1] = dados[i + 2] = val;
  }
  const r = jsQR(dados, n, n, { inversionAttempts: 'dontInvert' });
  return r ? r.data : null;
}

// ---------- correção ----------
// gabarito: string ou array com letras; 'X' = questão anulada (conta acerto para todos).
function corrigir(respostas, gabarito) {
  let acertos = 0;
  const porQuestao = respostas.map((r, i) => {
    const g = gabarito[i];
    const certo = g === 'X' || (r !== '' && r !== '*' && r === g);
    if (certo) acertos++;
    return certo;
  });
  return { acertos, porQuestao };
}

if (typeof module !== 'undefined') module.exports = { lerFolha, corrigir, homografia };
