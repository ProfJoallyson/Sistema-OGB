// Perfis de acesso e o que cada um pode fazer.
// Cada pessoa entra com a conta Google da escola; o perfil é definido no próprio app
// (tela de Usuários do administrador ou importação por planilha), não pelos grupos do Workspace.
// Uma pessoa pode ter mais de um perfil (por exemplo, professor e coordenação).

import { CAMPOS_PROFESSOR } from '../regras/curriculo.js';

export const PERFIS = {
  professor: { nome: 'Professor', descricao: 'Lança notas só das suas disciplinas e turmas. Vê o boletim das suas turmas.' },
  secretaria: { nome: 'Secretaria', descricao: 'Cadastros, simulados, frequência, boletins e documentos. Vê as notas, mas só corrige se tiver a permissão de notas.' },
  tesouraria: { nome: 'Tesouraria', descricao: 'Faz a matrícula (dados do aluno). Não vê notas, boletins nem frequência.' },
  coordenacao: { nome: 'Coordenação', descricao: 'Vê tudo (notas, boletins, frequência, cadastros e histórico), sem alterar.' },
  direcao: { nome: 'Direção', descricao: 'Vê tudo (notas, boletins, frequência, cadastros e histórico), sem alterar.' },
  admin: { nome: 'Administrador', descricao: 'Tudo, inclusive usuários, perfis e permissão de corrigir notas.' },
};

export const DOMINIO_ESCOLA = 'colegioecursoogb.com.br';

const VE_TUDO = ['secretaria', 'coordenacao', 'direcao', 'admin'];

// acao -> quem pode. `regra` recebe (usuario, contexto, dados) para checagens finas.
const ACOES = {
  'notas.ver': { perfis: VE_TUDO, professor: 'turma' },
  'boletim.ver': { perfis: VE_TUDO, professor: 'turma' },
  'notas.lancar': {
    perfis: ['admin'],
    regra: (u, ctx, dados) => {
      if (temPerfil(u, 'secretaria') && u.corrigeNotas) return true;
      if (temPerfil(u, 'professor')) {
        if (ctx.campo && !(CAMPOS_PROFESSOR.includes(ctx.campo) || ctx.campo === 'PF')) return false;
        return ehProfessorDe(u, ctx.turmaId, ctx.disciplinaId, dados);
      }
      return false;
    },
  },
  'simulados.lancar': { perfis: ['secretaria', 'admin'] },
  'frequencia.ver': { perfis: VE_TUDO, professor: 'turma' },
  'frequencia.lancar': { perfis: ['secretaria', 'admin'] },
  'alunos.ver': { perfis: [...VE_TUDO, 'tesouraria'], professor: 'turma' },
  'matricula.fazer': { perfis: ['tesouraria', 'secretaria', 'admin'] },
  'cadastros.editar': { perfis: ['secretaria', 'admin'] }, // turmas, disciplinas, professores, atribuições
  'documentos.emitir': { perfis: ['secretaria', 'admin'] },
  'documentos.ver': { perfis: VE_TUDO },
  'historico.ver': { perfis: ['coordenacao', 'direcao', 'admin'] },
  'usuarios.ver': { perfis: ['direcao', 'admin'] },
  'escola.editar': { perfis: ['admin'] }, // dados da escola, calendário, assinaturas
  'usuarios.gerenciar': { perfis: ['admin'] },
};

export const temPerfil = (u, p) => !!u && Array.isArray(u.perfis) && u.perfis.includes(p);

// dados.atribuicoes = [{ professorId, turmaId, disciplinaId }]
export function ehProfessorDe(u, turmaId, disciplinaId, dados = {}) {
  return (dados.atribuicoes || []).some(a => a.professorId === u.id && a.turmaId === turmaId &&
    (disciplinaId === undefined || a.disciplinaId === disciplinaId));
}

export function pode(usuario, acao, ctx = {}, dados = {}) {
  if (!usuario || usuario.ativo === false) return false;
  const def = ACOES[acao];
  if (!def) throw new Error('Ação desconhecida: ' + acao);
  if (def.perfis.some(p => temPerfil(usuario, p))) return true;
  if (def.professor === 'turma' && temPerfil(usuario, 'professor')) {
    if (!ctx.turmaId) return true; // listas: o serviço filtra pelas turmas do professor
    return ehProfessorDe(usuario, ctx.turmaId, undefined, dados);
  }
  if (def.regra) return def.regra(usuario, ctx, dados);
  return false;
}

export function exigir(usuario, acao, ctx, dados) {
  if (!pode(usuario, acao, ctx, dados)) {
    const e = new Error('Você não tem permissão para esta ação.');
    e.codigo = 'sem-permissao';
    throw e;
  }
}

export const ACOES_CONHECIDAS = Object.keys(ACOES);
