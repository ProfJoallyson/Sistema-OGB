// Dados de EXEMPLO (fictícios) para testar o app antes do Firebase.
// As turmas são as de 2026; alunos, professores e funcionários são inventados.

import { GRADE_PADRAO } from '../regras/curriculo.js';
import { chaves } from '../modelo/esquema.js';

export const ANO = 2026;
const D = '@colegioecursoogb.com.br';

const PRIMEIROS = ['Ana', 'Bruno', 'Camila', 'Davi', 'Eduarda', 'Felipe', 'Gabriela', 'Heitor', 'Isabela', 'João',
  'Larissa', 'Miguel', 'Natália', 'Otávio', 'Paula', 'Rafael', 'Sofia', 'Tiago', 'Valentina', 'Yuri'];
const SOBRENOMES = ['Almeida', 'Barbosa', 'Cavalcanti', 'Dantas', 'Esteves', 'Fernandes', 'Gomes', 'Holanda',
  'Lima', 'Medeiros', 'Nóbrega', 'Oliveira', 'Pereira', 'Queiroz', 'Rocha', 'Santos', 'Teixeira', 'Vasconcelos'];
const FEMININOS = new Set(['Ana', 'Camila', 'Eduarda', 'Gabriela', 'Isabela', 'Larissa', 'Natália', 'Paula', 'Sofia', 'Valentina']);

const TURMAS = [
  ['6EF', 'A', 'manha'], ['6EF', 'B', 'tarde'], ['7EF', 'U', 'manha'], ['8EF', 'U', 'manha'],
  ['9EF', 'A', 'manha'], ['9EF', 'B', 'tarde'], ['1EM', 'U', 'manha'], ['2EM', 'A', 'manha'],
  ['2EM', 'B', 'tarde'], ['3EM', 'U', 'manha'],
];

// Gerador determinístico para os dados saírem sempre iguais.
function sorteador(semente) {
  let s = semente;
  return () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; };
}

export function dadosDeExemplo() {
  const rnd = sorteador(42);
  const pega = l => l[Math.floor(rnd() * l.length)];
  const est = { escola: {}, usuarios: {}, funcionarios: {}, alunos: {}, turmas: {}, matriculas: {}, atribuicoes: {}, notas: {}, simulados: {}, faltas: {}, historico: {}, emissoes: {} };

  est.funcionarios.f_sec = { id: 'f_sec', nome: 'Maria das Graças Exemplo', sexo: 'F', funcao: 'Secretária', registro: '0000', cpf: '000.000.000-00', rg: '0.000.000', admissao: '2010-02-01' };
  est.funcionarios.f_dir = { id: 'f_dir', nome: 'José Roberto Exemplo', sexo: 'M', funcao: 'Diretor', registro: '0000', admissao: '2000-02-01' };
  est.funcionarios.f_prof = { id: 'f_prof', nome: 'Carlos Henrique Exemplo', sexo: 'M', funcao: 'Professor de Matemática', descricaoFuncao: 'professor de Matemática no nível fundamental e médio', cpf: '111.111.111-11', rg: '1.111.111', admissao: '2016-02-01' };

  est.escola.config = {
    id: 'config', nome: 'Colégio e Curso OGB', slogan: 'Para grandes conquistas, a melhor escola!',
    razaoSocial: 'Sociedade Guarabirense de Educação Ltda.', cnpj: '01.194.811/0001-33',
    endereco: 'Rua Epitácio Pessoa, nº 60, Centro', cidade: 'Guarabira', uf: 'PB', cep: '58.200-000',
    telefone: '', // a definir pela escola
    anoLetivo: ANO,
    secretariaId: 'f_sec', diretorId: 'f_dir',
    horarios: { manha: '07:00h às 11:50h', tarde: '13:30h às 18:10h' },
    // datas de exemplo; a secretaria ajusta ao calendário real
    trimestres: { [ANO]: { t1: { inicio: `${ANO}-02-02`, fim: `${ANO}-05-15` }, t2: { inicio: `${ANO}-05-18`, fim: `${ANO}-08-28` }, t3: { inicio: `${ANO}-08-31`, fim: `${ANO}-12-11` } } },
  };

  const usuario = (email, nome, perfis, extra = {}) => { est.usuarios[email + D] = { id: email + D, email: email + D, nome, perfis, corrigeNotas: false, ativo: true, ...extra }; };
  usuario('admin', 'Administrador (exemplo)', ['admin']);
  usuario('ana.prof', 'Ana Paula (Português)', ['professor']);
  usuario('carlos.prof', 'Carlos Henrique (Matemática)', ['professor']);
  usuario('bia.secretaria', 'Beatriz (Secretaria)', ['secretaria']);
  usuario('clara.secretaria', 'Clara (Secretaria, corrige notas)', ['secretaria'], { corrigeNotas: true });
  usuario('tesouraria', 'Tesouraria (exemplo)', ['tesouraria']);
  usuario('coordenacao', 'Coordenação (exemplo)', ['coordenacao', 'professor']);
  usuario('direcao', 'Direção (exemplo)', ['direcao']);

  let numAluno = 0;
  for (const [serie, letra, turno] of TURMAS) {
    const id = `${ANO}_${serie}_${letra}`.toLowerCase();
    est.turmas[id] = { id, ano: ANO, serie, letra, turno, disciplinas: GRADE_PADRAO[serie] };
    for (let n = 1; n <= 8; n++) {
      const primeiro = pega(PRIMEIROS);
      const sexo = FEMININOS.has(primeiro) ? 'F' : 'M';
      const nome = `${primeiro} ${pega(SOBRENOMES)} ${pega(SOBRENOMES)}`;
      const alunoId = `a${String(++numAluno).padStart(4, '0')}`;
      const anoNasc = ANO - 11 - ['6EF', '7EF', '8EF', '9EF', '1EM', '2EM', '3EM'].indexOf(serie);
      est.alunos[alunoId] = {
        id: alunoId, nome, sexo, nascimento: `${anoNasc}-0${1 + Math.floor(rnd() * 9)}-1${Math.floor(rnd() * 9)}`,
        naturalidade: 'Guarabira', ufNascimento: 'PB', cpf: '', rg: '',
        pai: { nome: `${pega(['Antônio', 'Francisco', 'Severino', 'Marcos', 'Paulo'])} ${nome.split(' ').slice(-1)[0]}`, profissao: pega(['Comerciante', 'Professor', 'Agricultor', 'Motorista']) },
        mae: { nome: `${pega(['Maria', 'Josefa', 'Fernanda', 'Patrícia', 'Luciana'])} ${nome.split(' ')[1]}`, profissao: pega(['Professora', 'Enfermeira', 'Comerciante', 'Do lar']) },
        endereco: { rua: 'Rua Exemplo', numero: String(10 + n), bairro: 'Centro', cidade: 'Guarabira', uf: 'PB', cep: '58200-000' },
        contatos: { telefoneMae: '(83) 90000-0000' }, vidaEscolarAnterior: [],
      };
      est.matriculas[chaves.matricula(ANO, alunoId)] = { id: chaves.matricula(ANO, alunoId), alunoId, turmaId: id, ano: ANO, numero: n,
        bolsa: n === 3 ? 'integral' : n === 5 ? '50' : 'nenhuma', turno, situacao: 'ativa' };

      // simulados do 1º e 2º trimestres
      for (const t of ['t1', 't2']) {
        const s = { id: chaves.simulado(ANO, alunoId, t), ano: ANO, alunoId, trimestre: t };
        if (serie === '3EM') {
          s.SP = 25 + Math.floor(rnd() * 50); s.SE = Math.floor(rnd() * 70);
          s.SG = { matematica: 10 + Math.floor(rnd() * 30), natureza: 10 + Math.floor(rnd() * 30), linguagens: 10 + Math.floor(rnd() * 30), humanas: 10 + Math.floor(rnd() * 30) };
        } else s.SO = 25 + Math.floor(rnd() * 50);
        est.simulados[s.id] = s;
      }
    }
  }

  // Atribuições: Ana dá Português e Carlos Matemática em todas as turmas;
  // a coordenadora de exemplo também dá Arte no 6º A.
  for (const t of Object.values(est.turmas)) {
    est.atribuicoes[chaves.atribuicao(t.id, 'port')] = { id: chaves.atribuicao(t.id, 'port'), turmaId: t.id, disciplinaId: 'port', professorId: 'ana.prof' + D };
    est.atribuicoes[chaves.atribuicao(t.id, 'mat')] = { id: chaves.atribuicao(t.id, 'mat'), turmaId: t.id, disciplinaId: 'mat', professorId: 'carlos.prof' + D };
  }
  est.atribuicoes[chaves.atribuicao(`${ANO}_6ef_a`, 'arte')] = { id: chaves.atribuicao(`${ANO}_6ef_a`, 'arte'), turmaId: `${ANO}_6ef_a`, disciplinaId: 'arte', professorId: 'coordenacao' + D };

  // Algumas notas de Português e Matemática no 1º trimestre do 6º A
  for (const m of Object.values(est.matriculas).filter(m => m.turmaId === `${ANO}_6ef_a`)) {
    for (const d of ['port', 'mat']) {
      const id = chaves.nota(ANO, m.turmaId, d, m.alunoId);
      const nota = () => Math.round((3 + rnd() * 7) * 2) / 2;
      est.notas[id] = { id, ano: ANO, turmaId: m.turmaId, disciplinaId: d, alunoId: m.alunoId,
        t1: d === 'port' ? { PP: nota(), PE: nota(), PT: nota(), VL: nota() } : { PP: nota(), PE: nota() } };
    }
  }
  return est;
}
