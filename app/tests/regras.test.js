import { test } from 'node:test';
import assert from 'node:assert/strict';
import { notaSimulado80, notaAreaSG, bonusSE } from '../src/regras/simulados.js';
import { calcularTrimestre, calcularDisciplina, calcularBoletim, mediaDaTurma, formatar, validarNota } from '../src/regras/boletim.js';
import { avaliacoes, colunasDoProfessor, GRADE_PADRAO, ordenarDisciplinas } from '../src/regras/curriculo.js';

const perto = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`);
const tri = x => ({ t1: x, t2: x, t3: x });

test('tabela de 80 questões (0 acertos = 0)', () => {
  assert.equal(notaSimulado80(0), 0);
  assert.equal(notaSimulado80(1), 2);
  assert.equal(notaSimulado80(9), 2);
  assert.equal(notaSimulado80(10), 3);
  assert.equal(notaSimulado80(45), 7);
  assert.equal(notaSimulado80(65), 8);
  assert.equal(notaSimulado80(72), 10);
  assert.equal(notaSimulado80(80), 10);
  assert.equal(notaSimulado80(null), null);
  assert.throws(() => notaSimulado80(81));
});

test('SG por área: limites divididos por 2', () => {
  assert.equal(notaAreaSG(0), 0);
  assert.equal(notaAreaSG(4), 2);
  assert.equal(notaAreaSG(5), 3);
  assert.equal(notaAreaSG(20), 7);
  assert.equal(notaAreaSG(25), 8);
  assert.equal(notaAreaSG(40), 10);
  assert.throws(() => notaAreaSG(41));
});

test('bônus do SE', () => {
  assert.equal(bonusSE(19), 0);
  assert.equal(bonusSE(20), 0.5);
  assert.equal(bonusSE(40), 1);
  assert.equal(bonusSE(64), 2);
});

test('avaliações por modelo', () => {
  assert.deepEqual(avaliacoes('EF', 'port'), ['PP', 'PE', 'PT', 'VL', 'SO']);
  assert.deepEqual(avaliacoes('EF', 'mat'), ['PP', 'PE', 'SO']);
  assert.deepEqual(avaliacoes('EM12', 'arte'), ['PE', 'SO', 'VL']);
  assert.deepEqual(avaliacoes('EM3', 'mat'), ['SP', 'SG']);
  assert.deepEqual(avaliacoes('EM3', 'it_pv'), ['AV1', 'AV2', 'AV3']);
  assert.deepEqual(colunasDoProfessor('EM3', 'mat'), ['RO']);
  assert.deepEqual(colunasDoProfessor('EF', 'port'), ['PP', 'PE', 'PT', 'VL', 'RO']);
});

test('EF: Português com simulado nos 3 trimestres', () => {
  const sim = tri({ SO: 45 }); // nota 7
  const r = calcularDisciplina('EF', 'port', tri({ PP: 8, PE: 6, PT: 7, VL: 9 }), sim);
  for (const t of ['t1', 't2', 't3']) perto(r.trimestres[t].MPT, 7.4);
  perto(r.MPA, 7.4);
  perto(r.MDA, 7.4);
  assert.equal(r.situacao, 'aprovado');
});

test('RO substitui a MPT só quando é maior', () => {
  const sim = { SO: 45 };
  const r1 = calcularTrimestre('EF', 'mat', { PP: 5, PE: 4, RO: 6.5 }, sim);
  perto(r1.MPT, 16 / 3);
  assert.equal(r1.MDT, 6.5);
  const r2 = calcularTrimestre('EF', 'mat', { PP: 5, PE: 4, RO: 3 }, sim);
  perto(r2.MDT, 16 / 3);
  const r3 = calcularTrimestre('EF', 'mat', { PP: 8, PE: 8, RO: 10 }, sim);
  assert.equal(r3.MDT, r3.MPT, 'RO ignorada com MPT ≥ 7');
  const r4 = calcularTrimestre('EF', 'mat', { PP: 5, PE: 4, RO: 'NC' }, sim);
  perto(r4.MDT, 16 / 3);
});

test('PF: MDA = 0,6·MPA + 0,4·PF e reprovação', () => {
  const sim = tri({ SO: 45 });
  const semPF = calcularDisciplina('EF', 'cien', tri({ PP: 3, PE: 2, RO: 4 }), sim);
  assert.equal(semPF.MPA, 4);
  assert.equal(semPF.MDA, null, 'aguarda a PF');
  assert.equal(semPF.precisaPF, true);
  const comPF = calcularDisciplina('EF', 'cien', { ...tri({ PP: 3, PE: 2, RO: 4 }), PF: 6 }, sim);
  perto(comPF.MDA, 4.8);
  assert.equal(comPF.situacao, 'reprovado');
  const nc = calcularDisciplina('EF', 'cien', { ...tri({ PP: 3, PE: 2, RO: 4 }), PF: 'NC' }, sim);
  perto(nc.MDA, 2.4);
});

test('nota em branco não conta como zero', () => {
  const r = calcularTrimestre('EF', 'ing', {}, { SO: 45 });
  assert.equal(r.MPT, 7);
  assert.deepEqual(r.faltando, ['PP', 'PE']);
  const vazio = calcularTrimestre('EF', 'ing', {}, {});
  assert.equal(vazio.MPT, null);
});

test('MPA só com os 3 trimestres', () => {
  const r = calcularDisciplina('EF', 'hist', { t1: { PP: 9, PE: 8 }, t2: { PP: 9, PE: 8 } }, { t1: { SO: 45 }, t2: { SO: 45 } });
  assert.equal(r.MPA, null);
});

test('1ª série: VL de Arte conta', () => {
  const r = calcularTrimestre('EM12', 'arte', { PE: 9, VL: 10 }, { SO: 30 });
  perto(r.MPT, (9 + 6 + 10) / 3);
  const it = calcularTrimestre('EM12', 'it_pv', { AV1: 8, AV2: 7, AV3: 9 }, { SO: 30 });
  assert.equal(it.MPT, 8);
});

test('3ª série: SP, SG por área e bônus do SE', () => {
  const sim = { SP: 35, SE: 40, SG: { linguagens: 25, humanas: 30, matematica: 15, natureza: 20 } };
  // SP 6; SG linguagens 8; humanas 9; matemática 6; natureza 7; SE +1
  perto(calcularTrimestre('EM3', 'port', { PT: 8, VL: 7 }, sim).MPT, (6 + 8 + 8 + 7) / 4 + 1);
  perto(calcularTrimestre('EM3', 'mat', {}, sim).MPT, 7);
  perto(calcularTrimestre('EM3', 'hist', {}, sim).MPT, 8);
  perto(calcularTrimestre('EM3', 'qui', {}, sim).MPT, 7.5);
  perto(calcularTrimestre('EM3', 'edf', {}, sim).MPT, 8);
  // limitado a 10
  const max = { SP: 80, SE: 80, SG: { linguagens: 40 } };
  assert.equal(calcularTrimestre('EM3', 'ing', {}, max).MPT, 10);
  // itinerário não ganha bônus
  assert.equal(calcularTrimestre('EM3', 'it_pv', { AV1: 6, AV2: 6, AV3: 6 }, sim).MPT, 6);
  // itinerário com RO não passa de 10 (erro 5 da planilha)
  assert.equal(calcularTrimestre('EM3', 'it_pv', { AV1: 2, AV2: 2, AV3: 2, RO: 10 }, sim).MDT, 10);
});

test('boletim: MG com Ed. Física, MA, situação e faltas', () => {
  const disciplinas = GRADE_PADRAO['6EF'];
  const lancamentos = Object.fromEntries(disciplinas.map(d => [d, tri({ PP: 8, PE: 8, PT: 8, VL: 8 })]));
  const b = calcularBoletim({ modelo: 'EF', disciplinas, lancamentos, simulados: tri({ SO: 50 }), faltas: { t1: 6, t2: 12 } });
  assert.equal(b.linhas.length, 9);
  perto(b.MG.formacaoGeral, 8);
  perto(b.MA.t1, 8);
  assert.equal(b.situacao, 'aprovado');
  assert.deepEqual(b.faltas, { t1: 6, t2: 12, t3: 0, total: 18 });
  const mt = mediaDaTurma([b, { MA: { t1: 6, t2: null, t3: null } }]);
  perto(mt.t1, 7);
});

test('boletim: cursando enquanto falta nota; reprovado com uma MDA < 5', () => {
  const disciplinas = ['port', 'mat'];
  const sim = tri({ SO: 45 });
  const parcial = calcularBoletim({ modelo: 'EF', disciplinas, lancamentos: { port: tri({ PP: 8 }) }, simulados: { t1: { SO: 45 } } });
  assert.equal(parcial.situacao, 'cursando');
  const reprov = calcularBoletim({ modelo: 'EF', disciplinas, simulados: sim,
    lancamentos: { port: tri({ PP: 8, PE: 8 }), mat: { ...tri({ PP: 1, PE: 1 }), PF: 2 } } });
  assert.equal(reprov.situacao, 'reprovado');
});

test('3ª série: MG da formação geral, dos itinerários e geral', () => {
  const disciplinas = GRADE_PADRAO['3EM'];
  const sim = tri({ SP: 50, SE: 0, SG: { matematica: 25, natureza: 25, linguagens: 25, humanas: 25 } });
  const lancamentos = { port: tri({ PT: 8, VL: 8 }), arte: tri({ VL: 8 }), it_pv: tri({ AV1: 8, AV2: 8, AV3: 8 }),
    it_amat: tri({ AV1: 8, AV2: 8, AV3: 8 }), it_aprod: tri({ AV1: 8, AV2: 8, AV3: 8 }) };
  const b = calcularBoletim({ modelo: 'EM3', disciplinas, lancamentos, simulados: sim });
  perto(b.MG.formacaoGeral, 8);
  perto(b.MG.itinerarios, 8);
  perto(b.MG.geral, 8);
});

test('formatação e validação', () => {
  assert.equal(formatar(7.4), '7,4');
  assert.equal(formatar(6.95), '7,0');
  assert.equal(formatar(null), '-');
  assert.equal(formatar('NC'), 'NC');
  assert.equal(validarNota('7,5', 'PE'), 7.5);
  assert.equal(validarNota('nc', 'RO'), 'NC');
  assert.equal(validarNota('', 'PE'), null);
  assert.throws(() => validarNota('11', 'PE'));
  assert.throws(() => validarNota('NC', 'PE'));
  assert.throws(() => validarNota('abc', 'PE'));
});

test('ordem do boletim: Sociologia e Filosofia depois de Geografia', () => {
  assert.deepEqual(ordenarDisciplinas(['mat', 'fil', 'port', 'soc', 'geo', 'hist']), ['port', 'hist', 'geo', 'soc', 'fil', 'mat']);
});
