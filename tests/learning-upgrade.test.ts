import { describe, expect, it } from 'vitest';
import { ALL_SUBSTANCES, SUBSTANCE_BY_ID } from '../src/data/substances';
import { REACTIONS } from '../src/data/reactions';
import { parseChemicalFormula } from '../src/modules/formula/parser';
import { getElementValenceClue, getFormulaClueLevel } from '../src/modules/knowledge/formulaClues';
import { buildMicroLegend, getMicroAtomCharge } from '../src/modules/knowledge/microDiagram';
import { getCalculationQuestions, getFormulaMass, gradeCalculationAnswer } from '../src/modules/quiz/calculations';
import { pickNextQuestion } from '../src/modules/quiz';
import { INITIAL_LEARNING_STATE, learningReducer } from '../src/state/learningMachine';
import { TextbookEdition } from '../src/types/chemistry';

const sub = (id: string) => SUBSTANCE_BY_ID.get(id)!;

describe('按作答顺序开放线索', () => {
  it('先质量比，首次错误后化合价，再错误后微观图，最多三级', () => {
    expect([0, 1, 2, 8].map(count => getFormulaClueLevel(count))).toEqual([1, 2, 3, 3]);
  });

  it('首次答对或纠错后答对均开放全部线索，导航和换物质按各自验证记录处理', () => {
    for (const failures of [0, 1, 2]) {
      let state = learningReducer(INITIAL_LEARNING_STATE, { type: 'CONFIRM_SUBSTANCE', substanceId: 'naoh' });
      for (let index = 0; index < failures; index++) state = learningReducer(state, { type: 'FORMULA_ATTEMPT_FAILED', substanceId: 'naoh' });
      state = learningReducer(state, { type: 'FORMULA_VERIFIED_SUCCESS', substanceId: 'naoh' });
      state = learningReducer(state, { type: 'NAVIGATE_STEP', step: 3 });
      expect(getFormulaClueLevel(state.formulaFailedAttempts.naoh ?? 0, state.formulaVerified.naoh)).toBe(3);
      state = learningReducer(state, { type: 'CONFIRM_SUBSTANCE', substanceId: 'h2o' });
      expect(getFormulaClueLevel(state.formulaFailedAttempts.h2o ?? 0, state.formulaVerified.h2o)).toBe(1);
    }
  });

  it('保留返回页面时的线索进度，换物质或重置时清空', () => {
    let state = learningReducer(INITIAL_LEARNING_STATE, { type: 'CONFIRM_SUBSTANCE', substanceId: 'h2o' });
    state = learningReducer(state, { type: 'FORMULA_ATTEMPT_FAILED', substanceId: 'h2o' });
    state = learningReducer(state, { type: 'NAVIGATE_STEP', step: 1 });
    state = learningReducer(state, { type: 'NAVIGATE_STEP', step: 3 });
    expect(state.formulaFailedAttempts.h2o).toBe(1);
    state = learningReducer(state, { type: 'FORMULA_ATTEMPT_FAILED', substanceId: 'h2o' });
    state = learningReducer(state, { type: 'FORMULA_ATTEMPT_FAILED', substanceId: 'h2o' });
    expect(state.formulaFailedAttempts.h2o).toBe(2);
    expect(learningReducer(state, { type: 'RESET_ALL' }).formulaFailedAttempts).toEqual({});
    expect(learningReducer(state, { type: 'CONFIRM_SUBSTANCE', substanceId: 'naoh' }).formulaFailedAttempts).toEqual({});
  });

  it('忽略过期物质的作答，正确解锁后也不再推进错误记录', () => {
    let state = learningReducer(INITIAL_LEARNING_STATE, { type: 'CONFIRM_SUBSTANCE', substanceId: 'h2o' });
    expect(learningReducer(state, { type: 'FORMULA_ATTEMPT_FAILED', substanceId: 'naoh' })).toBe(state);
    state = learningReducer(state, { type: 'FORMULA_VERIFIED_SUCCESS', substanceId: 'h2o' });
    expect(learningReducer(state, { type: 'FORMULA_ATTEMPT_FAILED', substanceId: 'h2o' })).toBe(state);
  });

  it('全部物质均有可靠元素化合价，单质为零，普通化合物代数和为零', () => {
    for (const substance of ALL_SUBSTANCES) {
      const parsed = parseChemicalFormula(substance.formula);
      expect(parsed.ok).toBe(true);
      if (!parsed.ok) continue;
      const clue = getElementValenceClue(substance);
      expect(clue.elements.map(element => element.symbol)).toEqual(Object.keys(parsed.counts));
      if (Object.keys(parsed.counts).length === 1) expect(clue.elements[0].valences).toEqual([0]);
      else if (clue.elements.every(element => element.valences.length === 1)) {
        expect(clue.elements.reduce((sum, element) => sum + parsed.counts[element.symbol] * element.valences[0], 0)).toBe(0);
      }
    }
  });

  it('正确处理过氧化物、甲烷、混合价态与不同价态的铁、锰', () => {
    const value = (id: string, symbol: string) => getElementValenceClue(sub(id)).elements.find(element => element.symbol === symbol)!.valences;
    expect(value('h2o2', 'O')).toEqual([-1]);
    expect(value('ch4', 'C')).toEqual([-4]);
    expect(value('fe3o4', 'Fe')).toEqual([2, 3]);
    expect(value('feso4', 'Fe')).toEqual([2]);
    expect(value('fecl3', 'Fe')).toEqual([3]);
    expect(value('kmno4', 'Mn')).toEqual([7]);
    expect(value('k2mno4', 'Mn')).toEqual([6]);
    expect(value('caco3', 'C')).toEqual([4]);
    expect(getElementValenceClue(sub('fe3o4')).note).toContain('不能');
  });

  it('微观图不把原子团电荷标在单个碳、硫或羟基氧原子上', () => {
    for (const id of ['caco3', 'cuso4', 'naoh', 'kmno4']) {
      const composition = sub(id).composition;
      for (const atom of composition.atoms.filter(item => item.role === 'center' || (item.symbol === 'O' && id === 'naoh'))) {
        expect(getMicroAtomCharge(atom, composition)).toBeUndefined();
      }
    }
    expect(buildMicroLegend(sub('caco3').composition).find(item => item.symbol === 'C')?.label).toBe('C（碳原子）');
    expect(getMicroAtomCharge(sub('nacl').composition.atoms[1], sub('nacl').composition)).toBe('-');
  });
});

describe('结构化计算题与数值校验', () => {
  it('正确计算相对质量，包括括号及氯的半整数质量', () => {
    expect(getFormulaMass('NaOH')).toBe(40);
    expect(getFormulaMass('HCl')).toBe(36.5);
    expect(getFormulaMass('Ca(OH)2')).toBe(74);
    expect(getFormulaMass('Fe3O4')).toBe(232);
  });

  it('覆盖全部物质和四个教材范围，答案有限且引用的反应真实存在', () => {
    const editions: TextbookEdition[] = ['通用版', '人教版', '沪教版', '鲁教版'];
    for (const substance of ALL_SUBSTANCES) for (const edition of editions) {
      const pool = getCalculationQuestions(substance, edition);
      expect(pool.length).toBeGreaterThan(0);
      expect(new Set(pool.map(question => question.id)).size).toBe(pool.length);
      for (const question of pool) {
        expect(Number.isFinite(question.answer)).toBe(true);
        expect(gradeCalculationAnswer(String(question.answer), question).correct).toBe(true);
        expect(question.steps.length).toBeGreaterThanOrEqual(3);
        expect(question.reactionIds.every(id => REACTIONS.some(reaction => reaction.id === id))).toBe(true);
      }
    }
  });

  it('计算质量分数与元素质量，不把溶液或混合物的质量当作纯物质质量', () => {
    const pool = getCalculationQuestions(sub('naoh'), '通用版');
    expect(pool.find(question => question.kind === 'mass_fraction')?.answer).toBe(57.5);
    expect(pool.find(question => question.kind === 'element_mass')?.answer).toBe(4.6);
    expect(getCalculationQuestions(sub('limestone'), '通用版')[0].stem).toContain('不把整份混合物');
    expect(getCalculationQuestions(sub('dilute_hcl'), '通用版')[0].stem).toContain('不把整份溶液');
    expect(getCalculationQuestions(sub('dilute_hcl'), '通用版')[0].answer).toBe(36.5);
  });

  it('单原子单质优先提供反应质量计算，双原子分子相对质量按整个分子计算', () => {
    expect(getCalculationQuestions(sub('fe'), '通用版')[0].kind).toBe('reaction_mass');
    expect(getCalculationQuestions(sub('o2'), '通用版')[0]).toMatchObject({ kind: 'relative_mass', answer: 32 });
  });

  it('接受等价数值及匹配单位，拒绝空白、算式、无穷大和错误单位', () => {
    const mass = getCalculationQuestions(sub('naoh'), '通用版')[0];
    expect(gradeCalculationAnswer('４０．０', mass).correct).toBe(true);
    for (const input of ['', 'abc40', '23+16+1', 'Infinity', '40g', '-40']) {
      expect(gradeCalculationAnswer(input, mass).inputValid).toBe(false);
    }
    expect(gradeCalculationAnswer('39.6', mass).correct).toBe(false);
    const percent = getCalculationQuestions(sub('naoh'), '通用版').find(question => question.kind === 'mass_fraction')!;
    expect(gradeCalculationAnswer('57.50％', percent).correct).toBe(true);
    expect(gradeCalculationAnswer('0.575', percent).correct).toBe(false);
    expect(gradeCalculationAnswer('57.5g', percent).inputValid).toBe(false);
    const grams = getCalculationQuestions(sub('naoh'), '通用版').find(question => question.kind === 'element_mass')!;
    expect(gradeCalculationAnswer('4.60 克', grams).correct).toBe(true);
  });

  it('按最终结果保留两位小数校验，不接受另一侧舍入边界', () => {
    const question = getCalculationQuestions(sub('h2o'), '通用版').find(item => item.kind === 'mass_fraction')!;
    expect(question.answer).toBe(11.11);
    expect(gradeCalculationAnswer('11.111111', question).correct).toBe(true);
    expect(gradeCalculationAnswer('11.115', question).correct).toBe(false);
  });

  it('换题依次遍历题池，不只在前两题间往返', () => {
    const pool = [{ id: '一' }, { id: '二' }, { id: '三' }];
    expect(pickNextQuestion(pool, '一')?.id).toBe('二');
    expect(pickNextQuestion(pool, '二')?.id).toBe('三');
    expect(pickNextQuestion(pool, '三')?.id).toBe('一');
  });
});
