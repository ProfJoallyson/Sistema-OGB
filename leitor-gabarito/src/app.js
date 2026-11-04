// Aplicativo: cadastro, impressão, correção pela câmera e resultados.
// Depende de layout.js, folha.js, leitor.js, notas.js, qrcode-generator, jsQR e SheetJS (XLSX).

// ================= Dados (guardados neste aparelho) =================
// Tudo passa por este objeto. Para integrar ao app de notas / sistema da escola,
// basta trocar carregar() e salvar() por chamadas ao servidor.
const CHAVE = 'ogb-leitor-gabarito-v1';
const Dados = {
  estado: { alunos: [], simulados: [], resultados: {} },
  carregar() {
    try {
      const s = JSON.parse(localStorage.getItem(CHAVE));
      if (s && s.alunos) this.estado = Object.assign({ alunos: [], simulados: [], resultados: {} }, s);
    } catch (e) { /* armazenamento indisponível: segue só na memória */ }
  },
  salvar() {
    try { localStorage.setItem(CHAVE, JSON.stringify(this.estado)); return true; }
    catch (e) { avisar('Não consegui guardar no aparelho. Baixe uma cópia de segurança.'); return false; }
  },
  get alunos() { return this.estado.alunos; },
  get simulados() { return this.estado.simulados; },
  simulado(id) { return this.estado.simulados.find(s => s.id === id); },
  turmas() { return [...new Set(this.estado.alunos.map(a => a.turma))].sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true })); },
  alunosDaTurma(t) { return this.estado.alunos.filter(a => a.turma === t).sort((a, b) => (+a.numero || 0) - (+b.numero || 0) || a.nome.localeCompare(b.nome)); },
  aluno(turma, numero) { return this.estado.alunos.find(a => a.turma === turma && String(+a.numero || a.numero) === String(+numero || numero)); },
  resultados(simId) { return (this.estado.resultados[simId] = this.estado.resultados[simId] || {}); },
};
const chaveAluno = (turma, numero) => `${turma}|${+numero || numero}`;

// ================= utilidades =================
const $ = s => document.querySelector(s);
const el = (tag, attrs = {}, ...filhos) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (v !== false && v !== undefined && v !== null) e.setAttribute(k, v === true ? '' : v);
  }
  for (const f of filhos.flat()) if (f !== null && f !== undefined && f !== false) e.append(f instanceof Node ? f : document.createTextNode(String(f)));
  return e;
};
function avisar(msg, tipo = '') {
  const s = $('#status-leitura');
  s.textContent = msg; s.className = 'status ' + tipo;
}
function baixar(nome, blob) {
  const a = el('a', { href: URL.createObjectURL(blob), download: nome });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
function novoId(tipo, trimestre) {
  const base = `${tipo}-T${trimestre}`;
  let n = 1, id = base;
  while (Dados.simulado(id)) id = `${base}-${++n}`;
  return id;
}
function abrir(dlg) { if (!dlg.open) dlg.showModal(); }
document.addEventListener('click', e => { const b = e.target.closest('[data-fechar]'); if (b) b.closest('dialog').close(); });

// ================= navegação =================
function irPara(tela) {
  document.querySelectorAll('section.tela').forEach(s => s.classList.toggle('ativa', s.id === 'tela-' + tela));
  document.querySelectorAll('nav.abas button').forEach(b => b.classList.toggle('ativa', b.dataset.tela === tela));
  if (tela !== 'corrigir') pararCamera();
  ({ simulados: renderSimulados, alunos: renderTurmas, corrigir: renderCorrigir, resultados: renderResultados })[tela]();
  window.scrollTo(0, 0);
}
document.querySelectorAll('nav.abas button').forEach(b => b.addEventListener('click', () => irPara(b.dataset.tela)));

// Nota principal para mostrar: a do simulado ou, no Global, as notas das áreas.
function notaCurta(sim, c) {
  return sim.notaPorArea ? c.areas.map(a => formatarNota(sim, a.nota)).join(' · ') : formatarNota(sim, c.nota);
}
function blocoNota(sim, c) {
  if (!sim.notaPorArea) return el('div', { class: 'nota' }, formatarNota(sim, c.nota));
  return el('div', { class: 'nota-areas' }, c.areas.map(a => el('div', {}, el('b', {}, formatarNota(sim, a.nota)), el('span', {}, a.nome))));
}

// ================= SIMULADOS =================
function preenchimentoGabarito(sim) {
  const cores = sim.usaCor ? ['Azul', 'Amarela', 'Branca', 'Rosa'] : ['Única'];
  let falta = 0;
  for (const c of cores) {
    const g = (sim.gabaritos || {})[c] || { principal: [] };
    for (let i = 0; i < sim.nQuestoes; i++) if (!g.principal[i]) falta++;
  }
  return falta;
}
function renderSimulados() {
  const box = $('#lista-simulados'); box.innerHTML = '';
  if (!Dados.simulados.length) {
    box.append(el('div', { class: 'cartao' }, el('p', {}, 'Nenhum simulado cadastrado.'),
      el('p', { class: 'suave' }, 'Comece cadastrando as turmas na aba Alunos. Depois crie o simulado, digite o gabarito e imprima os cartões-resposta.')));
    return;
  }
  for (const sim of [...Dados.simulados].reverse()) {
    const lidos = Object.keys(Dados.resultados(sim.id)).length;
    const falta = preenchimentoGabarito(sim);
    box.append(el('div', { class: 'cartao' },
      el('div', { class: 'linha entre' }, el('b', {}, sim.titulo), el('span', { class: 'etiqueta' }, sim.id)),
      el('div', { class: 'suave' }, `${TIPOS[sim.tipo].nome} · ${sim.nQuestoes} questões · ${sim.turmas.length ? sim.turmas.join(', ') : 'sem turmas'}`),
      el('div', { class: 'linha', style: 'margin:8px 0' },
        falta ? el('span', { class: 'etiqueta alerta' }, `Gabarito: faltam ${falta}`) : el('span', { class: 'etiqueta ok' }, 'Gabarito completo'),
        el('span', { class: 'etiqueta' }, `${lidos} folha${lidos === 1 ? '' : 's'} lida${lidos === 1 ? '' : 's'}`)),
      el('div', { class: 'linha' },
        el('button', { class: 'btn mini', onclick: () => abrirGabarito(sim) }, 'Gabarito'),
        el('button', { class: 'btn mini', onclick: () => abrirImpressao(sim) }, 'Imprimir folhas'),
        el('button', { class: 'btn mini', onclick: () => { simEscolhido = sim.id; irPara('corrigir'); } }, 'Corrigir'),
        el('button', { class: 'btn mini', onclick: () => abrirSimulado(sim) }, 'Editar'))));
  }
}

let simEditando = null;
const fTipo = $('#f-tipo');
for (const [k, v] of Object.entries(TIPOS)) fTipo.append(el('option', { value: k }, `${k} — ${v.nome}`));
fTipo.addEventListener('change', () => {
  if (fTipo.value === 'SG') {
    $('#f-nota-area').checked = true;
    if (!$('#f-areas').value.trim()) $('#f-areas').value = 'Linguagens 1-40\nHumanas 41-80';
  }
  if (fTipo.value !== 'OUTRO') $('#f-n').value = TIPOS[fTipo.value].n;
  if (!$('#f-selo').value || Object.keys(TIPOS).includes($('#f-selo').value)) $('#f-selo').value = fTipo.value === 'OUTRO' ? '' : fTipo.value;
});
$('#f-usa-lingua').addEventListener('change', e => $('#f-lingua-faixa').hidden = !e.target.checked);
$('#novo-simulado').addEventListener('click', () => abrirSimulado(null));

function abrirSimulado(sim) {
  simEditando = sim;
  $('#dlg-sim-titulo').textContent = sim ? 'Editar simulado' : 'Novo simulado';
  $('#f-titulo').value = sim ? sim.titulo : '';
  fTipo.value = sim ? sim.tipo : 'SO';
  $('#f-n').value = sim ? sim.nQuestoes : 80;
  $('#f-trimestre').value = sim ? sim.trimestre : '1';
  $('#f-selo').value = sim ? sim.selo : 'SO';
  $('#f-areas').value = sim ? (sim.areas || []).map(a => `${a.nome} ${a.de}-${a.ate}`).join('\n') : '';
  $('#f-usa-cor').checked = !!(sim && sim.usaCor);
  $('#f-nota-area').checked = !!(sim && sim.notaPorArea);
  $('#f-usa-lingua').checked = !!(sim && sim.usaLingua);
  $('#f-lingua-faixa').hidden = !(sim && sim.usaLingua);
  $('#f-lingua-de').value = sim && sim.lingua ? sim.lingua.de : 1;
  $('#f-lingua-ate').value = sim && sim.lingua ? sim.lingua.ate : 5;
  // tipo e número de questões não mudam depois que há folhas lidas
  const travado = sim && Object.keys(Dados.resultados(sim.id)).length > 0;
  fTipo.disabled = $('#f-n').disabled = !!travado;
  const ft = $('#f-turmas'); ft.innerHTML = '';
  const turmas = Dados.turmas();
  if (!turmas.length) ft.append(el('span', { class: 'suave' }, 'Nenhuma turma cadastrada ainda (aba Alunos).'));
  for (const t of turmas) ft.append(el('label', { class: 'btn mini' }, el('input', { type: 'checkbox', value: t, checked: sim ? sim.turmas.includes(t) : false }), ' ' + t));
  $('#f-excluir').hidden = !sim;
  abrir($('#dlg-simulado'));
}
function lerAreas(txt, n) {
  const areas = [];
  for (const linha of txt.split('\n')) {
    const m = linha.trim().match(/^(.+?)\s+(\d+)\s*[-–a]\s*(\d+)$/i);
    if (!m) { if (linha.trim()) throw new Error(`Não entendi a área "${linha.trim()}". Use o formato: Nome 1-45`); continue; }
    const de = +m[2], ate = +m[3];
    if (de < 1 || ate > n || de > ate) throw new Error(`A área "${m[1]}" precisa ficar entre 1 e ${n}.`);
    areas.push({ nome: m[1].trim(), de, ate });
  }
  return areas;
}
$('#f-salvar').addEventListener('click', () => {
  try {
    const n = Math.round(+$('#f-n').value);
    if (!(n >= 5 && n <= 90)) throw new Error('O número de questões vai de 5 a 90.');
    const titulo = $('#f-titulo').value.trim() || `${TIPOS[fTipo.value].nome} — ${$('#f-trimestre').value}º trimestre`;
    const dados = {
      titulo, tipo: fTipo.value, nQuestoes: n, trimestre: $('#f-trimestre').value, selo: $('#f-selo').value.trim(),
      turmas: [...document.querySelectorAll('#f-turmas input:checked')].map(i => i.value),
      areas: lerAreas($('#f-areas').value, n),
      notaPorArea: $('#f-nota-area').checked,
      usaCor: $('#f-usa-cor').checked, usaLingua: $('#f-usa-lingua').checked,
      lingua: { de: +$('#f-lingua-de').value, ate: +$('#f-lingua-ate').value },
    };
    if (dados.notaPorArea && !dados.areas.length) throw new Error('Para dar nota por área, escreva as áreas. Ex.: Linguagens 1-40 e Humanas 41-80.');
    if (dados.usaLingua && !(dados.lingua.de >= 1 && dados.lingua.ate <= n && dados.lingua.de <= dados.lingua.ate)) throw new Error('Faixa de língua estrangeira inválida.');
    if (simEditando) Object.assign(simEditando, dados);
    else Dados.simulados.push(Object.assign({ id: novoId(dados.tipo, dados.trimestre), gabaritos: {}, criadoEm: new Date().toISOString() }, dados));
    Dados.salvar();
    $('#dlg-simulado').close();
    renderSimulados();
  } catch (e) { alertaNoDialogo($('#dlg-simulado'), e.message); }
});
$('#f-excluir').addEventListener('click', () => {
  if (!simEditando) return;
  const lidos = Object.keys(Dados.resultados(simEditando.id)).length;
  if (!confirm(`Excluir "${simEditando.titulo}"${lidos ? ` e as ${lidos} folhas já lidas` : ''}? Isso não pode ser desfeito.`)) return;
  Dados.estado.simulados = Dados.simulados.filter(s => s !== simEditando);
  delete Dados.estado.resultados[simEditando.id];
  Dados.salvar(); $('#dlg-simulado').close(); renderSimulados();
});
function alertaNoDialogo(dlg, msg) {
  let a = dlg.querySelector('.aviso');
  if (!a) { a = el('div', { class: 'aviso' }); dlg.querySelector('.corpo').prepend(a); }
  a.textContent = msg; a.scrollIntoView({ block: 'nearest' });
}

// ---------- gabarito ----------
let gabSim = null, gabCor = null, gabTmp = null;
function coresDo(sim) { return sim.usaCor ? ['Azul', 'Amarela', 'Branca', 'Rosa'] : ['Única']; }
function abrirGabarito(sim, cor) {
  gabSim = sim;
  gabTmp = JSON.parse(JSON.stringify(sim.gabaritos || {}));
  for (const c of coresDo(sim)) gabTmp[c] = gabTmp[c] || { principal: [], espanhol: [] };
  gabCor = cor || coresDo(sim)[0];
  $('#gab-info').textContent = `${sim.titulo} · ${sim.nQuestoes} questões. Toque na alternativa certa de cada questão. Dica: também dá para imprimir a "Folha para o gabarito", preencher e ler pela câmera.`;
  renderGabarito();
  abrir($('#dlg-gabarito'));
}
function linhaGab(n, arr, i) {
  const atual = arr[i] || '';
  return el('div', { class: 'gab-q' }, el('b', {}, String(n).padStart(2, '0')),
    ...['A', 'B', 'C', 'D', 'E', 'X'].map(l => el('button', {
      class: (l === 'X' ? 'anul ' : '') + (atual === l ? 'sel' : ''), title: l === 'X' ? 'Anulada' : l,
      onclick: e => { arr[i] = arr[i] === l ? '' : l; renderGabarito(); },
    }, l === 'X' ? 'anul' : l)));
}
function renderGabarito() {
  const sim = gabSim, g = gabTmp[gabCor];
  const cores = $('#gab-cores'); cores.innerHTML = '';
  if (sim.usaCor) for (const c of coresDo(sim)) cores.append(el('button', { class: 'btn mini' + (c === gabCor ? ' prim' : ''), onclick: () => { gabCor = c; renderGabarito(); } }, 'Prova ' + c));
  $('#gab-titulo-principal').textContent = sim.usaCor ? `Respostas — prova ${gabCor}` : 'Respostas';
  const grade = $('#gab-grade'); grade.innerHTML = '';
  for (let i = 0; i < sim.nQuestoes; i++) grade.append(linhaGab(i + 1, g.principal, i));
  $('#gab-espanhol-bloco').hidden = !sim.usaLingua;
  if (sim.usaLingua) {
    const ge = $('#gab-grade-esp'); ge.innerHTML = '';
    g.espanhol = g.espanhol || [];
    for (let q = sim.lingua.de; q <= sim.lingua.ate; q++) ge.append(linhaGab(q, g.espanhol, q - sim.lingua.de));
  }
  const feitas = Array.from({ length: sim.nQuestoes }, (_, i) => g.principal[i]).filter(Boolean).length;
  $('#gab-contagem').textContent = `${feitas} de ${sim.nQuestoes} preenchidas`;
  $('#gab-texto').value = Array.from({ length: sim.nQuestoes }, (_, i) => g.principal[i] || '-').join('');
}
$('#gab-aplicar').addEventListener('click', () => {
  const letras = $('#gab-texto').value.toUpperCase().replace(/[^A-EX\-?.]/g, '').split('');
  const g = gabTmp[gabCor];
  for (let i = 0; i < gabSim.nQuestoes; i++) g.principal[i] = /[A-EX]/.test(letras[i] || '') ? letras[i] : '';
  renderGabarito();
});
$('#gab-salvar').addEventListener('click', () => {
  gabSim.gabaritos = gabTmp; Dados.salvar();
  $('#dlg-gabarito').close(); renderSimulados();
});

// ---------- impressão ----------
let impSim = null;
function abrirImpressao(sim) {
  impSim = sim;
  const sel = $('#imp-turma'); sel.innerHTML = '';
  const turmas = sim.turmas.length ? sim.turmas : Dados.turmas();
  for (const t of turmas) sel.append(el('option', { value: t }, `${t} (${Dados.alunosDaTurma(t).length} alunos)`));
  $('#imp-info').textContent = turmas.length ? '' : 'Cadastre as turmas na aba Alunos para imprimir as folhas dos alunos.';
  $('#imp-ok').disabled = !turmas.length;
  abrir($('#dlg-imprimir'));
}
function imprimirFolhas(sim, alunos) {
  const caixa = $('#impressao');
  caixa.innerHTML = alunos.map(aluno => renderFolha({
    titulo: sim.titulo, selo: sim.selo, simuladoId: sim.id, nQuestoes: sim.nQuestoes,
    aluno, data: $('#imp-data').value.trim(), areas: sim.areas,
  })).join('');
  $('#dlg-imprimir').close();
  setTimeout(() => window.print(), 50);
}
$('#imp-ok').addEventListener('click', () => {
  const alunos = Dados.alunosDaTurma($('#imp-turma').value);
  if (!alunos.length) return alertaNoDialogo($('#dlg-imprimir'), 'Essa turma não tem alunos.');
  imprimirFolhas(impSim, alunos);
});
$('#imp-gabarito').addEventListener('click', () => {
  imprimirFolhas(impSim, [{ nome: 'GABARITO OFICIAL (preencha e leia pela câmera)', turma: 'GAB', numero: '0' }]);
});
window.addEventListener('afterprint', () => { $('#impressao').innerHTML = ''; });

// ================= ALUNOS =================
function normalizar(s) { return String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim(); }
$('#arquivo-alunos').addEventListener('change', async e => {
  const arq = e.target.files[0]; e.target.value = '';
  if (!arq) return;
  const msg = $('#msg-importacao');
  try {
    const wb = XLSX.read(await arq.arrayBuffer(), { type: 'array' });
    const linhas = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' });
    const iCab = linhas.findIndex(l => l.some(c => normalizar(c).startsWith('nome')));
    if (iCab < 0) throw new Error('Não achei a coluna "Nome" na planilha.');
    const cab = linhas[iCab].map(normalizar);
    const col = (...nomes) => cab.findIndex(c => nomes.some(n => c === n || c.startsWith(n)));
    const cNome = col('nome'), cTurma = col('turma', 'classe', 'serie'), cNum = col('numero', 'n°', 'nº', 'n.', 'num', 'chamada', 'n');
    const turmaPadrao = $('#turma-padrao').value.trim();
    if (cTurma < 0 && !turmaPadrao) throw new Error('A planilha não tem coluna "Turma". Escreva o nome da turma no campo acima e escolha a planilha de novo.');
    const novos = [], contador = {};
    for (const l of linhas.slice(iCab + 1)) {
      const nome = String(l[cNome] || '').trim();
      if (!nome) continue;
      const turma = cTurma >= 0 ? String(l[cTurma] || '').trim() || turmaPadrao : turmaPadrao;
      if (!turma) continue;
      contador[turma] = (contador[turma] || 0) + 1;
      const numero = cNum >= 0 && String(l[cNum]).trim() ? String(l[cNum]).trim().replace(/\.0+$/, '') : String(contador[turma]);
      novos.push({ turma, numero: numero.padStart(2, '0'), nome });
    }
    if (!novos.length) throw new Error('Não encontrei alunos na planilha.');
    const turmas = [...new Set(novos.map(a => a.turma))];
    // números repetidos na mesma turma deixariam o QR ambíguo
    const vistos = new Set();
    for (const a of novos) { const k = chaveAluno(a.turma, a.numero); if (vistos.has(k)) throw new Error(`O número ${a.numero} aparece duas vezes na turma ${a.turma}.`); vistos.add(k); }
    Dados.estado.alunos = Dados.alunos.filter(a => !turmas.includes(a.turma)).concat(novos);
    Dados.salvar();
    msg.innerHTML = ''; msg.append(el('div', { class: 'status ok' }, `Importei ${novos.length} alunos: ${turmas.map(t => `${t} (${novos.filter(a => a.turma === t).length})`).join(', ')}.`));
    renderTurmas();
  } catch (err) {
    msg.innerHTML = ''; msg.append(el('div', { class: 'status alerta' }, err.message || 'Não consegui ler essa planilha.'));
  }
});
$('#baixar-modelo').addEventListener('click', () => {
  const ws = XLSX.utils.aoa_to_sheet([['Turma', 'Número', 'Nome'], ['3ª A', 1, 'Nome do aluno'], ['3ª A', 2, 'Outro aluno']]);
  ws['!cols'] = [{ wch: 10 }, { wch: 9 }, { wch: 40 }];
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Alunos');
  baixar('modelo-alunos.xlsx', new Blob([XLSX.write(wb, { type: 'array', bookType: 'xlsx' })]));
});
function renderTurmas() {
  const box = $('#lista-turmas'); box.innerHTML = '';
  const turmas = Dados.turmas();
  if (!turmas.length) return;
  const c = el('div', { class: 'cartao lista' });
  for (const t of turmas) {
    const alunos = Dados.alunosDaTurma(t);
    const det = el('details', {}, el('summary', {}, el('b', {}, t), ` · ${alunos.length} alunos`),
      el('div', { class: 'suave pequeno', style: 'margin-top:6px' }, alunos.map(a => `${a.numero} ${a.nome}`).join(' · ')));
    c.append(el('div', {}, det, el('button', { class: 'btn mini perigo', onclick: () => {
      if (!confirm(`Remover a turma ${t} e seus ${alunos.length} alunos? As leituras já feitas continuam guardadas.`)) return;
      Dados.estado.alunos = Dados.alunos.filter(a => a.turma !== t); Dados.salvar(); renderTurmas();
    } }, 'Remover')));
  }
  box.append(c);
}
$('#baixar-backup').addEventListener('click', () => {
  const data = new Date().toISOString().slice(0, 10);
  baixar(`leitor-gabarito-backup-${data}.json`, new Blob([JSON.stringify(Dados.estado)], { type: 'application/json' }));
});
$('#arquivo-backup').addEventListener('change', async e => {
  const arq = e.target.files[0]; e.target.value = '';
  if (!arq) return;
  try {
    const s = JSON.parse(await arq.text());
    if (!s || !Array.isArray(s.alunos) || !Array.isArray(s.simulados)) throw new Error();
    if (!confirm('Substituir todos os dados deste aparelho pela cópia escolhida?')) return;
    Dados.estado = Object.assign({ alunos: [], simulados: [], resultados: {} }, s); Dados.salvar();
    alert('Cópia restaurada.'); renderTurmas();
  } catch (err) { alert('Esse arquivo não é uma cópia do Leitor de Gabaritos.'); }
});

// ================= CORRIGIR =================
const video = $('#video'), sobre = $('#sobreposicao');
const trabalho = document.createElement('canvas');
const ctxTrab = trabalho.getContext('2d', { willReadFrequently: true });
let simEscolhido = null;
let stream = null, ocupado = false, ultimoQuadro = 0, anterior = null, ultimoAceito = null, semQR = 0;
const lidosSessao = [];

function renderCorrigir() {
  const sel = $('#sim-corrigir'), atual = sel.value;
  sel.innerHTML = '';
  for (const s of [...Dados.simulados].reverse()) sel.append(el('option', { value: s.id }, `${s.titulo} (${s.id})`));
  const pref = simEscolhido || atual; simEscolhido = null;
  if (pref && Dados.simulado(pref)) sel.value = pref;
  if (!Dados.simulados.length) avisar('Cadastre um simulado antes de corrigir.', 'alerta');
  renderLidosSessao();
}
const simAtual = () => Dados.simulado($('#sim-corrigir').value);

$('#abrir-camera').addEventListener('click', async () => {
  if (!simAtual()) return avisar('Cadastre um simulado antes de corrigir.', 'alerta');
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return avisar('Este navegador não deixa usar a câmera aqui. Use o botão Tirar foto.', 'alerta');
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } } });
    video.srcObject = stream; await video.play();
    video.hidden = sobre.hidden = false; $('#camera-vazia').hidden = true;
    $('#abrir-camera').hidden = true; $('#fechar-camera').hidden = false;
    avisar('Procurando o cartão-resposta…');
    requestAnimationFrame(laco);
  } catch (e) {
    avisar('Não consegui abrir a câmera. Verifique a permissão do navegador, ou use o botão Tirar foto.', 'alerta');
  }
});
$('#fechar-camera').addEventListener('click', pararCamera);
function pararCamera() {
  if (stream) stream.getTracks().forEach(t => t.stop());
  stream = null; video.hidden = sobre.hidden = true; $('#camera-vazia').hidden = false;
  $('#abrir-camera').hidden = false; $('#fechar-camera').hidden = true;
}
function laco(t) {
  if (!stream) return;
  if (!ocupado && t - ultimoQuadro > 120 && video.videoWidth) {
    ocupado = true; ultimoQuadro = t;
    try { processarQuadro(); } finally { ocupado = false; }
  }
  requestAnimationFrame(laco);
}
function opcoesLeitura() {
  return { nQuestoesPorSimulado: id => (Dados.simulado(id) || {}).nQuestoes, nQuestoes: simAtual() ? simAtual().nQuestoes : 0 };
}
function processarQuadro() {
  const w = video.videoWidth, h = video.videoHeight;
  if (trabalho.width !== w) { trabalho.width = w; trabalho.height = h; sobre.width = w; sobre.height = h; }
  ctxTrab.drawImage(video, 0, 0, w, h);
  const r = lerFolha(ctxTrab.getImageData(0, 0, w, h), opcoesLeitura());
  desenharCantos(r);
  if (!r.ok) {
    anterior = null;
    if (r.cantos) avisar(r.motivo + ' Aproxime ou firme o celular.');
    else avisar('Procurando o cartão-resposta… deixe os 4 quadrados pretos aparecerem.');
    return;
  }
  if (!r.qr) {
    // na câmera ao vivo só aceitamos com QR; sem ele, sugerimos a foto
    anterior = null;
    if (++semQR > 15) avisar('Leio a folha, mas não o QR code. Aproxime o celular, melhore a luz, ou use Tirar foto.', 'alerta');
    return;
  }
  semQR = 0;
  const chave = JSON.stringify([r.qr, r.respostas, r.lingua, r.cor]);
  const alunoKey = r.qr.simuladoId + '|' + chaveAluno(r.qr.turma, r.qr.numero);
  if (ultimoAceito && ultimoAceito.aluno === alunoKey) { ultimoAceito.visto = performance.now(); return; }
  if (anterior !== chave) { anterior = chave; avisar('Lendo… segure firme.'); return; }
  // duas leituras iguais seguidas: aceita
  anterior = null;
  ultimoAceito = { aluno: alunoKey, visto: performance.now() };
  registrarLeitura(r);
}
function desenharCantos(r) {
  const c = sobre.getContext('2d');
  c.clearRect(0, 0, sobre.width, sobre.height);
  if (!r.cantos) return;
  c.lineWidth = Math.max(4, sobre.width / 200);
  c.strokeStyle = r.ok && r.qr ? '#2ecc71' : '#ffb547';
  c.beginPath(); r.cantos.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.closePath(); c.stroke();
}
function sinalSonoro() {
  try { navigator.vibrate && navigator.vibrate(120); } catch (e) {}
  try {
    const ac = sinalSonoro.ac || (sinalSonoro.ac = new (window.AudioContext || window.webkitAudioContext)());
    const o = ac.createOscillator(), g = ac.createGain();
    o.frequency.value = 880; g.gain.value = 0.15; o.connect(g); g.connect(ac.destination);
    o.start(); o.stop(ac.currentTime + 0.12);
  } catch (e) {}
}

// Foto (câmera do sistema ou galeria)
$('#foto').addEventListener('change', async e => {
  const arq = e.target.files[0]; e.target.value = '';
  if (!arq) return;
  if (!simAtual()) return avisar('Cadastre um simulado antes de corrigir.', 'alerta');
  avisar('Lendo a foto…');
  try {
    const bmp = await createImageBitmap(arq);
    const esc = Math.min(1, 2600 / Math.max(bmp.width, bmp.height));
    const w = Math.round(bmp.width * esc), h = Math.round(bmp.height * esc);
    trabalho.width = w; trabalho.height = h;
    ctxTrab.drawImage(bmp, 0, 0, w, h);
    const r = lerFolha(ctxTrab.getImageData(0, 0, w, h), opcoesLeitura());
    if (!r.ok) return avisar(r.motivo + ' Tente outra foto, com a folha inteira e bem iluminada.', 'alerta');
    if (!r.qr) return perguntarAluno(r);
    registrarLeitura(r);
  } catch (err) { avisar('Não consegui abrir essa foto.', 'alerta'); }
});

function perguntarAluno(r) {
  const sim = simAtual();
  const st = $('#al-turma'); st.innerHTML = '';
  const turmas = sim.turmas.length ? sim.turmas : Dados.turmas();
  for (const t of turmas) st.append(el('option', { value: t }, t));
  const encherAlunos = () => {
    const sa = $('#al-aluno'); sa.innerHTML = '';
    const res = Dados.resultados(sim.id);
    for (const a of Dados.alunosDaTurma(st.value)) sa.append(el('option', { value: a.numero }, `${a.numero} — ${a.nome}${res[chaveAluno(a.turma, a.numero)] ? ' (já lido)' : ''}`));
  };
  st.onchange = encherAlunos; encherAlunos();
  $('#al-ok').onclick = () => {
    if (!$('#al-aluno').value) return;
    $('#dlg-aluno').close();
    r.qr = { simuladoId: sim.id, turma: st.value, numero: $('#al-aluno').value, manual: true };
    registrarLeitura(r);
  };
  avisar('Escolha o aluno desta folha.');
  abrir($('#dlg-aluno'));
}

function registrarLeitura(r) {
  // Folha de gabarito oficial
  if (r.qr.turma === 'GAB') return registrarGabarito(r);
  let sim = Dados.simulado(r.qr.simuladoId);
  if (!sim) return avisar(`Esta folha é do simulado ${r.qr.simuladoId}, que não está cadastrado neste aparelho.`, 'alerta');
  if (sim !== simAtual()) { $('#sim-corrigir').value = sim.id; avisar('Troquei para o simulado ' + sim.id + ', que é o desta folha.'); }
  const chave = chaveAluno(r.qr.turma, r.qr.numero);
  const res = Dados.resultados(sim.id);
  const jaTinha = !!res[chave];
  const aluno0 = Dados.aluno(r.qr.turma, r.qr.numero);
  if (jaTinha && JSON.stringify([res[chave].respostas, res[chave].lingua, res[chave].cor]) === JSON.stringify([r.respostas, r.lingua, r.cor])) {
    return avisar(`A folha de ${aluno0 ? aluno0.nome : 'Nº ' + r.qr.numero} já estava lida, com as mesmas respostas. Pode passar a próxima.`, 'ok');
  }
  res[chave] = {
    turma: r.qr.turma, numero: r.qr.numero, respostas: r.respostas, lingua: r.lingua, cor: r.cor,
    duvidas: r.detalhes.filter(d => d.duvida).map(d => d.numero), lidoEm: new Date().toISOString(), manual: !!r.qr.manual,
  };
  Dados.salvar();
  sinalSonoro();
  const aluno = Dados.aluno(r.qr.turma, r.qr.numero);
  const c = corrigirResultado(sim, res[chave]);
  const iAnt = lidosSessao.findIndex(x => x.simId === sim.id && x.chave === chave);
  if (iAnt >= 0) lidosSessao.splice(iAnt, 1);
  lidosSessao.unshift({ simId: sim.id, chave });
  avisar(`${aluno ? aluno.nome : 'Aluno ' + r.qr.numero} (${r.qr.turma}): ${c.acertos} acertos${jaTinha ? ' · leitura anterior substituída' : ''}. Pode passar a próxima folha.`, 'ok');
  renderUltimo(sim, chave);
  renderLidosSessao();
}
function registrarGabarito(r) {
  const sim = Dados.simulado(r.qr.simuladoId);
  if (!sim) return avisar('Folha de gabarito de um simulado que não está neste aparelho.', 'alerta');
  const cor = sim.usaCor ? r.cor : 'Única';
  if (sim.usaCor && (!cor || cor === '*')) return avisar('Na folha do gabarito, marque a cor da prova.', 'alerta');
  const duplas = r.respostas.map((x, i) => x === '*' ? i + 1 : 0).filter(Boolean);
  sim.gabaritos = sim.gabaritos || {};
  const g = sim.gabaritos[cor] = sim.gabaritos[cor] || { principal: [], espanhol: [] };
  g.principal = r.respostas.map(x => (x === '*' ? '' : x));
  Dados.salvar(); sinalSonoro();
  const brancos = g.principal.filter(x => !x).length;
  avisar(`Gabarito${sim.usaCor ? ' da prova ' + cor : ''} lido: ${sim.nQuestoes - brancos} questões preenchidas${duplas.length ? `, questões com duas marcas ficaram em branco: ${duplas.join(', ')}` : ''}. Confira em Simulados › Gabarito.`, duplas.length || brancos ? 'alerta' : 'ok');
}
function renderUltimo(sim, chave) {
  const r = Dados.resultados(sim.id)[chave];
  const c = corrigirResultado(sim, r);
  const aluno = Dados.aluno(r.turma, r.numero);
  const avisos = [...c.avisos];
  if (c.duplas) avisos.push(`${c.duplas} questão(ões) com mais de uma marca (contam como erro)`);
  if (r.duvidas && r.duvidas.length) avisos.push(`Marcação fraca nas questões ${r.duvidas.join(', ')}: confira`);
  if (c.semGabarito) avisos.push(`Gabarito incompleto: faltam ${c.semGabarito} questões`);
  if (!aluno) avisos.push('Aluno não está na lista desta turma');
  const box = $('#ultimo-resultado'); box.innerHTML = '';
  box.append(el('div', { class: 'cartao' },
    el('div', { class: 'resultado-grande' },
      blocoNota(sim, c),
      el('div', {}, el('b', {}, aluno ? aluno.nome : `Nº ${r.numero}`), el('div', { class: 'suave' }, `${r.turma} · Nº ${r.numero}`),
        el('div', {}, `${c.acertos} de ${sim.nQuestoes} acertos`, c.areas.length ? el('span', { class: 'suave' }, ' · ' + c.areas.map(a => `${a.nome}: ${a.acertos}`).join(' · ')) : ''))),
    avisos.map(a => el('div', { class: 'aviso' }, a)),
    el('div', { class: 'linha' }, el('button', { class: 'btn mini', onclick: () => abrirDetalhe(sim, chave) }, 'Ver e corrigir respostas'))));
}
function renderLidosSessao() {
  const sim = simAtual(), box = $('#lidos-sessao');
  if (!sim) { box.innerHTML = ''; $('#titulo-lidos').textContent = ''; return; }
  const res = Dados.resultados(sim.id);
  const total = (sim.turmas.length ? sim.turmas : Dados.turmas()).reduce((s, t) => s + Dados.alunosDaTurma(t).length, 0);
  $('#titulo-lidos').textContent = `Lidas neste simulado: ${Object.keys(res).length}${total ? ' de ' + total : ''}`;
  const itens = lidosSessao.filter(x => x.simId === sim.id && res[x.chave]).slice(0, 30);
  box.innerHTML = '';
  if (!itens.length) { box.append(el('div', { class: 'suave' }, 'Nenhuma folha lida agora.')); return; }
  for (const it of itens) {
    const r = res[it.chave], c = corrigirResultado(sim, r), a = Dados.aluno(r.turma, r.numero);
    box.append(el('div', { class: 'clicavel', onclick: () => abrirDetalhe(sim, it.chave) },
      el('span', {}, `${r.turma} · ${r.numero} — ${a ? a.nome : '?'}`), el('b', {}, `${c.acertos} · ${notaCurta(sim, c)}`)));
  }
}
$('#sim-corrigir').addEventListener('change', () => { ultimoAceito = null; $('#ultimo-resultado').innerHTML = ''; renderLidosSessao(); });

// ---------- detalhe de um resultado ----------
let detAtual = null;
function abrirDetalhe(sim, chave) {
  detAtual = { sim, chave };
  renderDetalhe();
  abrir($('#dlg-detalhe'));
}
function renderDetalhe() {
  const { sim, chave } = detAtual;
  const r = Dados.resultados(sim.id)[chave];
  if (!r) { $('#dlg-detalhe').close(); return; }
  const c = corrigirResultado(sim, r), a = Dados.aluno(r.turma, r.numero);
  $('#det-titulo').textContent = a ? a.nome : `Nº ${r.numero}`;
  const corpo = $('#det-corpo'); corpo.innerHTML = '';
  const seletor = (rotulo, valor, opcoes, aoMudar) => el('label', { class: 'campo' }, el('span', {}, rotulo),
    el('select', { onchange: e => aoMudar(e.target.value) }, opcoes.map(o => el('option', { value: o, selected: o === valor }, o || '(não marcada)'))));
  corpo.append(
    el('p', { class: 'suave' }, `${r.turma} · Nº ${r.numero} · lido em ${new Date(r.lidoEm).toLocaleString('pt-BR')}${r.manual ? ' · aluno escolhido à mão' : ''}`),
    el('div', { class: 'resultado-grande' }, blocoNota(sim, c),
      el('div', {}, el('b', {}, `${c.acertos} de ${sim.nQuestoes} acertos`), c.areas.map(x => el('div', { class: 'suave' }, `${x.nome}: ${x.acertos} de ${x.total}`)))),
    c.avisos.map(x => el('div', { class: 'aviso' }, x)),
    el('div', { class: 'grade2' },
      sim.usaLingua ? seletor('Língua estrangeira', r.lingua, ['', 'Inglês', 'Espanhol'], v => { r.lingua = v; Dados.salvar(); renderDetalhe(); }) : '',
      sim.usaCor ? seletor('Cor da prova', r.cor, ['', 'Azul', 'Amarela', 'Branca', 'Rosa'], v => { r.cor = v; Dados.salvar(); renderDetalhe(); }) : ''),
    el('p', { class: 'suave pequeno' }, 'Verde = acerto, vermelho = erro, contorno laranja = marcação fraca. Toque numa questão para trocar a resposta lida (– = em branco, * = mais de uma marca).'),
    el('div', { class: 'questoes' }, r.respostas.map((resp, i) => el('div', {
      class: (c.certo[i] ? 'c' : (c.gabarito[i] ? 'e' : '')) + ((r.duvidas || []).includes(i + 1) ? ' d' : ''),
      title: `Gabarito: ${c.gabarito[i] || '?'}`,
      onclick: () => {
        const ciclo = ['A', 'B', 'C', 'D', 'E', '', '*'];
        r.respostas[i] = ciclo[(ciclo.indexOf(resp) + 1) % ciclo.length];
        r.duvidas = (r.duvidas || []).filter(q => q !== i + 1);
        Dados.salvar(); renderDetalhe();
      },
    }, el('span', {}, String(i + 1).padStart(2, '0')), el('b', {}, resp === '' ? '–' : resp)))));
}
$('#det-excluir').addEventListener('click', () => {
  const { sim, chave } = detAtual;
  if (!confirm('Apagar esta leitura? A folha poderá ser lida de novo.')) return;
  delete Dados.resultados(sim.id)[chave]; Dados.salvar();
  $('#dlg-detalhe').close(); $('#ultimo-resultado').innerHTML = '';
  if (ultimoAceito && ultimoAceito.aluno.endsWith(chave)) ultimoAceito = null;
  renderLidosSessao(); if ($('#tela-resultados').classList.contains('ativa')) renderResultados();
});
$('#dlg-detalhe').addEventListener('close', () => {
  if ($('#tela-resultados').classList.contains('ativa')) renderResultados();
  if ($('#tela-corrigir').classList.contains('ativa')) { renderLidosSessao(); if (detAtual && $('#ultimo-resultado').firstChild) renderUltimo(detAtual.sim, detAtual.chave); }
});

// ================= RESULTADOS =================
function linhasResultado(sim, turmaFiltro) {
  const res = Dados.resultados(sim.id);
  const turmas = turmaFiltro ? [turmaFiltro] : [...new Set([...(sim.turmas.length ? sim.turmas : Dados.turmas()), ...Object.values(res).map(r => r.turma)])];
  const linhas = [];
  for (const t of turmas.sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true }))) {
    const alunos = Dados.alunosDaTurma(t);
    const numeros = new Set(alunos.map(a => String(+a.numero || a.numero)));
    for (const a of alunos) linhas.push({ turma: t, numero: a.numero, nome: a.nome, r: res[chaveAluno(t, a.numero)] });
    // leituras de alunos que não estão na lista
    for (const r of Object.values(res)) if (r.turma === t && !numeros.has(String(+r.numero || r.numero))) linhas.push({ turma: t, numero: r.numero, nome: '(fora da lista)', r });
  }
  return linhas.map(l => Object.assign(l, l.r ? { c: corrigirResultado(sim, l.r) } : {}));
}
function renderResultados() {
  const sel = $('#sim-resultados'), atual = sel.value;
  sel.innerHTML = '';
  for (const s of [...Dados.simulados].reverse()) sel.append(el('option', { value: s.id }, `${s.titulo} (${s.id})`));
  if (atual && Dados.simulado(atual)) sel.value = atual;
  const sim = Dados.simulado(sel.value);
  const st = $('#turma-resultados'), tAtual = st.value;
  st.innerHTML = ''; st.append(el('option', { value: '' }, 'Todas'));
  if (sim) for (const t of (sim.turmas.length ? sim.turmas : Dados.turmas())) st.append(el('option', { value: t }, t));
  if ([...st.options].some(o => o.value === tAtual)) st.value = tAtual;
  const tab = $('#tabela-resultados'), resumo = $('#resumo-resultados');
  tab.innerHTML = ''; resumo.innerHTML = '';
  if (!sim) { tab.append(el('p', { class: 'suave' }, 'Nenhum simulado cadastrado.')); return; }
  const linhas = linhasResultado(sim, st.value);
  const lidas = linhas.filter(l => l.r);
  const media = lidas.length ? lidas.reduce((s, l) => s + l.c.acertos, 0) / lidas.length : 0;
  resumo.append(el('div', { class: 'linha', style: 'margin-bottom:10px' },
    el('span', { class: 'etiqueta ok' }, `${lidas.length} lidas`),
    el('span', { class: 'etiqueta alerta' }, `${linhas.length - lidas.length} sem leitura`),
    lidas.length ? el('span', { class: 'etiqueta' }, `Média: ${media.toFixed(1).replace('.', ',')} acertos`) : ''));
  const notaCol = sim.tipo === 'SE' ? 'Bônus' : 'Nota';
  tab.append(el('table', {},
    el('thead', {}, el('tr', {}, el('th', { class: 'larga' }, 'Turma'), el('th', {}, 'Nº'), el('th', {}, 'Nome'), sim.areas.map(a => el('th', { class: 'num larga' }, a.nome)), el('th', { class: 'num' }, 'Acertos'), el('th', { class: 'num' }, sim.notaPorArea ? 'Notas' : notaCol))),
    el('tbody', {}, linhas.map(l => el('tr', l.r ? { class: 'clicavel', onclick: () => abrirDetalhe(sim, chaveAluno(l.turma, l.numero)) } : {},
      el('td', { class: 'larga' }, l.turma), el('td', {}, l.numero), el('td', {}, l.nome, l.r && l.c.avisos.length ? el('span', { class: 'etiqueta alerta', style: 'margin-left:6px' }, '!') : '',
        !st.value ? el('div', { class: 'suave pequeno estreita' }, l.turma) : '', l.r && sim.areas.length ? el('div', { class: 'suave pequeno estreita' }, l.c.areas.map(a => `${a.nome}: ${a.acertos}${sim.notaPorArea ? ` (${formatarNota(sim, a.nota)})` : ''}`).join(' · ')) : ''),
      sim.areas.map((a, i) => el('td', { class: 'num larga' }, l.r ? (sim.notaPorArea ? `${l.c.areas[i].acertos} (${formatarNota(sim, l.c.areas[i].nota)})` : l.c.areas[i].acertos) : '')),
      el('td', { class: 'num' }, l.r ? el('b', {}, l.c.acertos) : el('span', { class: 'suave' }, 'não lido')),
      el('td', { class: 'num' }, l.r ? notaCurta(sim, l.c) : ''))))));
}
$('#sim-resultados').addEventListener('change', renderResultados);
$('#turma-resultados').addEventListener('change', renderResultados);
$('#baixar-planilha').addEventListener('click', () => {
  const sim = Dados.simulado($('#sim-resultados').value);
  if (!sim) return;
  const linhas = linhasResultado(sim, $('#turma-resultados').value);
  const notaCol = sim.tipo === 'SE' ? 'Bônus' : 'Nota';
  const cab = ['Turma', 'Nº', 'Nome', ...(sim.usaLingua ? ['Língua'] : []), ...(sim.usaCor ? ['Cor da prova'] : []), ...sim.areas.map(a => `Acertos ${a.nome}`), ...(sim.notaPorArea ? sim.areas.map(a => `Nota ${a.nome}`) : []), 'Acertos', ...(sim.notaPorArea ? [] : [notaCol]), 'Observações'];
  const dados = linhas.map(l => [l.turma, +l.numero || l.numero, l.nome,
    ...(sim.usaLingua ? [l.r ? l.r.lingua || '' : ''] : []), ...(sim.usaCor ? [l.r ? l.r.cor || '' : ''] : []),
    ...sim.areas.map((a, i) => l.r ? l.c.areas[i].acertos : ''),
    ...(sim.notaPorArea ? sim.areas.map((a, i) => l.r ? l.c.areas[i].nota : '') : []),
    l.r ? l.c.acertos : '', ...(sim.notaPorArea ? [] : [l.r ? (l.c.nota === null ? '-' : l.c.nota) : '']),
    l.r ? l.c.avisos.join('; ') : 'não lido']);
  const ws1 = XLSX.utils.aoa_to_sheet([cab, ...dados]);
  ws1['!cols'] = cab.map((c, i) => ({ wch: i === 2 ? 40 : Math.max(8, c.length + 2) }));
  const cab2 = ['Turma', 'Nº', 'Nome', ...Array.from({ length: sim.nQuestoes }, (_, i) => `Q${i + 1}`)];
  const lidas = linhas.filter(l => l.r);
  const respostas = lidas.map(l => [l.turma, +l.numero || l.numero, l.nome, ...l.r.respostas.map(x => x === '' ? '-' : x)]);
  const gab = coresDo(sim).map(cor => [`GABARITO ${cor === 'Única' ? '' : cor}`.trim(), '', '', ...Array.from({ length: sim.nQuestoes }, (_, i) => ((sim.gabaritos[cor] || {}).principal || [])[i] || '?')]);
  const ws2 = XLSX.utils.aoa_to_sheet([cab2, ...gab, ...respostas]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws1, 'Resultados');
  XLSX.utils.book_append_sheet(wb, ws2, 'Respostas');
  const nome = `${sim.id}${$('#turma-resultados').value ? '-' + $('#turma-resultados').value : ''}`.replace(/[^\wÀ-ú-]+/g, '_');
  baixar(`resultado-${nome}.xlsx`, new Blob([XLSX.write(wb, { type: 'array', bookType: 'xlsx' })]));
});

// ================= início =================
Dados.carregar();
renderSimulados();
