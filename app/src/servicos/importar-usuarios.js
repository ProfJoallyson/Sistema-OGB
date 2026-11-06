// Importação de usuários e perfis por planilha (modelo: modelo-usuarios.xlsx).
// Aba "Pessoas": Nome | E-mail | Perfis | Pode corrigir notas
// Aba "Aulas":   E-mail do professor | Turma | Disciplina
// Primeiro monta um plano (com os erros por linha) para o administrador conferir;
// só depois o plano é gravado (Sistema.aplicarImportacaoUsuarios).

import { PERFIS, DOMINIO_ESCOLA } from '../modelo/perfis.js';
import { normalizarEmail, nomeTurma } from '../modelo/esquema.js';
import { DISCIPLINAS, SERIES } from '../regras/curriculo.js';
import { normalizar } from './texto.js';

const NOMES_PERFIL = {
  PROFESSOR: 'professor', PROFESSORA: 'professor', PROFESSORES: 'professor',
  SECRETARIA: 'secretaria', SECRETARIO: 'secretaria',
  TESOURARIA: 'tesouraria', TESOUREIRO: 'tesouraria', TESOUREIRA: 'tesouraria', FINANCEIRO: 'tesouraria',
  COORDENACAO: 'coordenacao', COORDENADOR: 'coordenacao', COORDENADORA: 'coordenacao',
  DIRECAO: 'direcao', DIRETOR: 'direcao', DIRETORA: 'direcao',
  ADMINISTRADOR: 'admin', ADMINISTRADORA: 'admin', ADMIN: 'admin',
};

const APELIDOS_DISCIPLINA = {
  PORTUGUES: 'port', 'LINGUA PORTUGUESA': 'port', 'L PORTUGUESA': 'port',
  INGLES: 'ing', 'LINGUA INGLESA': 'ing', ESPANHOL: 'esp', 'LINGUA ESPANHOLA': 'esp',
  RELIGIAO: 'rel', 'ENSINO RELIGIOSO': 'rel', 'EDUCACAO RELIGIOSA': 'rel', 'EDUCACAO RELIGIOSO': 'rel',
  'ED FISICA': 'edf', 'EDUCACAO FISICA': 'edf', ARTES: 'arte',
};

export function acharDisciplina(texto) {
  const n = normalizar(texto);
  if (APELIDOS_DISCIPLINA[n]) return APELIDOS_DISCIPLINA[n];
  const d = DISCIPLINAS.find(x => normalizar(x.nome) === n || (x.curto && normalizar(x.curto) === n) || normalizar(x.id) === n);
  return d ? d.id : null;
}

// "6º Ano A", "6A", "6º A", "1ª Série U", "1U", "3ª série" (sem letra = turma única)
export function chaveTurma(texto) {
  const n = normalizar(String(texto ?? '').replace(/[ºª°]/g, ' ')).replace(/\b(ANO|ANOS|SERIE|SERIES|TURMA|EM|EF|DO|ENSINO|MEDIO|FUNDAMENTAL)\b/g, ' ').replace(/\s+/g, '');
  const m = n.match(/^(\d)([A-Z])?$/);
  if (!m) return null;
  return { numero: m[1], letra: m[2] || null };
}

export function acharTurma(texto, turmas) {
  const k = chaveTurma(texto);
  if (!k) return null;
  const candidatas = turmas.filter(t => SERIES.find(s => s.id === t.serie).ordinal.startsWith(k.numero) &&
    (k.letra ? t.letra === k.letra : true));
  return candidatas.length === 1 ? candidatas[0] : null;
}

const simNao = v => ['SIM', 'S', 'X', 'TRUE', 'VERDADEIRO', '1'].includes(normalizar(v));

// Lê uma aba como lista de objetos usando a primeira linha como cabeçalho.
export function linhasComCabecalho(matriz) {
  const [cab = [], ...resto] = matriz;
  const chaves = cab.map(c => normalizar(c));
  return resto.map((l, i) => ({ _linha: i + 2, ...Object.fromEntries(chaves.map((k, j) => [k, l[j] ?? ''])) }))
    .filter(o => Object.entries(o).some(([k, v]) => k !== '_linha' && String(v).trim()));
}

const pegar = (o, ...nomes) => {
  for (const n of nomes) for (const k of Object.keys(o)) if (k === n || k.startsWith(n)) return String(o[k] ?? '').trim();
  return '';
};

// pessoas e aulas = matrizes (linhas x colunas) lidas da planilha; turmas = turmas do ano letivo
export function prepararImportacao({ pessoas = [], aulas = [] }, turmas) {
  const erros = [];
  const avisos = [];
  const usuarios = new Map();
  const exemplos = new Set(); // linhas de exemplo do modelo ("EXEMPLO ...") são ignoradas

  for (const l of linhasComCabecalho(pessoas)) {
    const nome = pegar(l, 'NOME');
    const email = normalizarEmail(pegar(l, 'E MAIL', 'EMAIL'));
    const err = msg => erros.push({ aba: 'Pessoas', linha: l._linha, msg });
    if (!nome) { err('Falta o nome.'); continue; }
    if (normalizar(nome).startsWith('EXEMPLO')) { exemplos.add(email); continue; }
    if (!email) { err(`Falta o e-mail de ${nome}.`); continue; }
    if (!email.endsWith('@' + DOMINIO_ESCOLA)) { err(`${email}: o e-mail precisa terminar em @${DOMINIO_ESCOLA}.`); continue; }
    const perfis = [];
    for (const p of pegar(l, 'PERFIS', 'PERFIL').split(/[,;/+]| E /i).map(s => s.trim()).filter(Boolean)) {
      const id = NOMES_PERFIL[normalizar(p).replace(/ /g, '')] || NOMES_PERFIL[normalizar(p)];
      if (id) perfis.push(id); else err(`Perfil desconhecido: "${p}". Use: ${Object.values(PERFIS).map(x => x.nome).join(', ')}.`);
    }
    if (!perfis.length) { err(`Falta o perfil de ${nome}.`); continue; }
    const corrigeNotas = simNao(pegar(l, 'PODE CORRIGIR', 'CORRIGE'));
    if (corrigeNotas && !perfis.includes('secretaria')) avisos.push({ aba: 'Pessoas', linha: l._linha, msg: `${nome}: "pode corrigir notas" só vale para a secretaria; ignorado.` });
    if (usuarios.has(email)) {
      const u = usuarios.get(email);
      u.perfis = [...new Set([...u.perfis, ...perfis])];
      avisos.push({ aba: 'Pessoas', linha: l._linha, msg: `${email} aparece mais de uma vez; os perfis foram somados.` });
    } else {
      usuarios.set(email, { nome, email, perfis: [...new Set(perfis)], corrigeNotas: corrigeNotas && perfis.includes('secretaria') });
    }
  }

  const atribuicoes = [];
  const ocupadas = new Map();
  for (const l of linhasComCabecalho(aulas)) {
    const err = msg => erros.push({ aba: 'Aulas', linha: l._linha, msg });
    const email = normalizarEmail(pegar(l, 'E MAIL', 'EMAIL'));
    const tTxt = pegar(l, 'TURMA');
    const dTxt = pegar(l, 'DISCIPLINA');
    const u = usuarios.get(email);
    if (!u && exemplos.has(email)) continue;
    if (!u) { err(`${email || '(sem e-mail)'} não está na aba Pessoas.`); continue; }
    if (!u.perfis.includes('professor')) { err(`${u.nome} não tem o perfil Professor.`); continue; }
    const turmasAlvo = normalizar(tTxt) === 'TODAS' ? turmas : tTxt.split(/[,;]/).map(s => s.trim()).filter(Boolean).map(s => acharTurma(s, turmas) || s);
    const disc = acharDisciplina(dTxt);
    if (!disc) { err(`Disciplina não reconhecida: "${dTxt}".`); continue; }
    for (const t of turmasAlvo) {
      if (typeof t === 'string') { err(`Turma não encontrada: "${t}".`); continue; }
      if (!t.disciplinas.includes(disc)) { err(`A turma ${nomeTurma(t)} não tem a disciplina ${dTxt}.`); continue; }
      const k = `${t.id}_${disc}`;
      if (ocupadas.has(k) && ocupadas.get(k) !== email) {
        err(`${nomeTurma(t)} / ${dTxt} já está com ${ocupadas.get(k)}. Cada disciplina de uma turma tem um professor só.`); continue;
      }
      if (ocupadas.has(k)) continue;
      ocupadas.set(k, email);
      atribuicoes.push({ email, turmaId: t.id, disciplinaId: disc });
    }
  }
  if (exemplos.size) avisos.push({ aba: 'Pessoas', linha: '-', msg: `${exemplos.size} linhas de EXEMPLO foram ignoradas.` });
  return { usuarios: [...usuarios.values()], atribuicoes, erros, avisos };
}
