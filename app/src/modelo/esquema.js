// Modelo de dados do sistema. Cada coleção vira uma coleção do Firestore depois.
// Os campos abaixo servem de documentação e para validar o que é salvo.

import { PERFIS, DOMINIO_ESCOLA } from './perfis.js';
import { SERIES } from '../regras/curriculo.js';

export const COLECOES = {
  escola: 'Dados da escola (um documento "config"): nome, razão social, CNPJ, endereço, telefone, ano letivo atual, assinaturas.',
  usuarios: 'Quem entra no sistema: e-mail da escola, nome, perfis, permissão de corrigir notas, ativo.',
  funcionarios: 'Cadastro de funcionários (declaração de funcionário e assinaturas).',
  alunos: 'Ficha individual: dados pessoais, filiação, contato, foto, vida escolar anterior e o e-mail da escola do aluno (um e-mail por aluno).',
  turmas: 'Turma de um ano letivo: série, letra, turno, horário, disciplinas.',
  matriculas: 'Aluno em uma turma num ano letivo: número na turma, bolsa, situação.',
  atribuicoes: 'Qual professor dá qual disciplina em qual turma.',
  notas: 'Notas digitadas: um documento por ano, turma, disciplina e aluno.',
  simulados: 'Acertos dos simulados: um documento por ano, aluno e trimestre.',
  faltas: 'Faltas por dia (catraca): um documento por aluno e dia.',
  historico: 'Registro de toda alteração: quem, quando, o que, valor anterior e novo.',
  emissoes: 'Documentos emitidos: tipo, para quem, quem emitiu, quando, código de autenticidade.',
};

const req = (v, nome) => {
  if (v === undefined || v === null || String(v).trim() === '') throw new Error(`Preencha: ${nome}.`);
};

export const SEXOS = { F: 'Feminino', M: 'Masculino' };
export const BOLSAS = { nenhuma: 'Sem bolsa', '50': 'Bolsa de 50%', integral: 'Bolsa integral' };
export const TURNOS = { manha: 'manhã', tarde: 'tarde', noite: 'noite' };
export const SITUACOES_MATRICULA = { ativa: 'Cursando', transferida: 'Transferido(a)', desistente: 'Desistente', concluida: 'Concluída' };

export function normalizarEmail(email) {
  return String(email || '').trim().toLowerCase();
}

export const VALIDAR = {
  usuarios(u) {
    req(u.nome, 'nome');
    const email = normalizarEmail(u.email);
    if (!/^[^@\s]+@[^@\s]+$/.test(email)) throw new Error(`E-mail inválido: ${u.email}`);
    if (!email.endsWith('@' + DOMINIO_ESCOLA)) throw new Error(`O e-mail precisa ser da escola (@${DOMINIO_ESCOLA}): ${u.email}`);
    if (!Array.isArray(u.perfis) || !u.perfis.length) throw new Error(`Escolha ao menos um perfil para ${u.nome}.`);
    for (const p of u.perfis) if (!PERFIS[p]) throw new Error(`Perfil desconhecido: ${p}`);
  },
  alunos(a) {
    req(a.nome, 'nome do aluno');
    if (a.sexo && !SEXOS[a.sexo]) throw new Error('Sexo deve ser F ou M.');
    if (a.nascimento && !/^\d{4}-\d{2}-\d{2}$/.test(a.nascimento)) throw new Error('Data de nascimento inválida.');
    // Conta Google da escola criada para o aluno (decisão de 07/11: cada e-mail fica ligado a um aluno).
    if (a.email) {
      const email = normalizarEmail(a.email);
      if (!/^[^@\s]+@[^@\s]+$/.test(email) || !email.endsWith('@' + DOMINIO_ESCOLA)) {
        throw new Error(`O e-mail do aluno precisa ser da escola (@${DOMINIO_ESCOLA}): ${a.email}`);
      }
    }
  },
  turmas(t) {
    req(t.ano, 'ano letivo');
    if (!SERIES.find(s => s.id === t.serie)) throw new Error('Série inválida.');
    req(t.letra, 'letra da turma');
    if (!Array.isArray(t.disciplinas) || !t.disciplinas.length) throw new Error('A turma precisa de disciplinas.');
  },
  matriculas(m) {
    req(m.alunoId, 'aluno'); req(m.turmaId, 'turma'); req(m.ano, 'ano letivo');
    if (m.bolsa && !BOLSAS[m.bolsa]) throw new Error('Bolsa inválida.');
  },
  atribuicoes(a) { req(a.professorId, 'professor'); req(a.turmaId, 'turma'); req(a.disciplinaId, 'disciplina'); },
  funcionarios(f) { req(f.nome, 'nome'); req(f.funcao, 'função'); },
};

// Nome da turma como aparece nos documentos: "6º Ano A", "1ª Série U".
export function nomeTurma(t) {
  const s = SERIES.find(x => x.id === t.serie);
  return `${s ? s.nome : t.serie} ${t.letra}`;
}

// Chaves determinísticas: facilitam a sincronização e evitam duplicatas.
export const chaves = {
  nota: (ano, turmaId, disciplinaId, alunoId) => `${ano}_${turmaId}_${disciplinaId}_${alunoId}`,
  simulado: (ano, alunoId, trimestre) => `${ano}_${alunoId}_${trimestre}`,
  falta: (alunoId, data) => `${alunoId}_${data}`,
  matricula: (ano, alunoId) => `${ano}_${alunoId}`,
  atribuicao: (turmaId, disciplinaId) => `${turmaId}_${disciplinaId}`,
  usuario: email => normalizarEmail(email),
};
