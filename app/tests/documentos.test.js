import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RepositorioMemoria } from '../src/dados/memoria.js';
import { dadosDeExemplo, ANO } from '../src/dados/exemplo.js';
import { Sistema } from '../src/servicos/sistema.js';
import { emitir } from '../src/documentos/emitir.js';
import { MODELOS } from '../src/documentos/modelos.js';
import { dataPorExtenso, g, palavra, serieExtenso, naSerie, filiacao } from '../src/documentos/texto.js';

const D = '@colegioecursoogb.com.br';
async function sec() {
  const repo = new RepositorioMemoria(dadosDeExemplo());
  return { repo, s: new Sistema(repo, await repo.obter('usuarios', 'bia.secretaria' + D)) };
}
const semTags = h => h.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

test('texto: concordância, datas e séries', () => {
  assert.equal(dataPorExtenso('2026-07-30'), '30 de julho de 2026');
  assert.equal(dataPorExtenso('2026-06-09'), '09 de junho de 2026');
  assert.equal(g({ sexo: 'F' }, 'o', 'a'), 'a');
  assert.equal(g({}, 'o', 'a'), 'o(a)');
  assert.equal(palavra({}, 'nascido', 'nascida'), 'nascido(a)');
  assert.equal(serieExtenso('1EM'), 'a 1ª Série do Ensino Médio');
  assert.equal(naSerie('6EF'), 'no 6º Ano do Ensino Fundamental');
  assert.equal(filiacao({ sexo: 'F', pai: { nome: 'José' }, mae: { nome: 'Maria' } }), 'filha do Sr. José e da Sra. Maria');
});

test('declaração de matrícula sai com o sexo certo e registra a emissão', async () => {
  const { s, repo } = await sec();
  const a = (await repo.listar('alunos')).find(x => x.sexo === 'F');
  const { html, emissao } = await emitir(s, 'matricula', a.id);
  const t = semTags(html);
  assert.match(t, /nascida em/);
  assert.match(t, /filha do Sr\./);
  assert.match(t, /regularmente matriculada/);
  assert.match(t, new RegExp(`ano letivo de ${ANO}`));
  assert.doesNotMatch(t, /\(a\)/);
  assert.match(emissao.codigo, /^[A-Z2-9]{5}-[A-Z2-9]{5}$/);
  assert.equal((await repo.listar('emissoes')).length, 1);
});

test('todos os modelos geram sem erro com os dados de exemplo', async () => {
  const { s, repo } = await sec();
  const aluno = (await repo.listar('matriculas')).find(m => m.bolsa === 'integral');
  for (const m of MODELOS) {
    const alvo = m.alvo === 'turma' ? aluno.turmaId : m.alvo === 'funcionario' ? 'f_sec' : aluno.alunoId;
    if (m.id === 'conclusao') {
      await assert.rejects(emitir(s, m.id, alvo, {}, { previa: true }), /9º Ano|aprovado/);
      continue;
    }
    const { html } = await emitir(s, m.id, alvo, {}, { previa: true });
    assert.ok(html.includes('folha'), m.id);
    assert.doesNotMatch(html, /undefined|NaN|\[object/, m.id);
  }
});

test('declaração da secretária é assinada pelo diretor', async () => {
  const { s } = await sec();
  const { html } = await emitir(s, 'funcionario', 'f_sec', {}, { previa: true });
  assert.match(semTags(html), /José Roberto Exemplo Diretor/);
  const prof = semTags((await emitir(s, 'funcionario', 'f_prof', {}, { previa: true })).html);
  assert.match(prof, /desde o ano de 2016/);
  assert.match(prof, /Maria das Graças Exemplo Secretária/);
});

test('texto do cadastro é escapado', async () => {
  const { s, repo } = await sec();
  await repo.atualizar('alunos', 'a0001', { nome: '<script>x</script>' });
  const { html } = await emitir(s, 'matricula', 'a0001', {}, { previa: true });
  assert.doesNotMatch(html, /<script>/);
});
