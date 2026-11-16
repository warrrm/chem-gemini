import { describe, expect, it } from 'vitest';
import { INQUIRY_QUESTIONS } from '../src/data/quizzes';
import { ALL_SUBSTANCES } from '../src/data/substances';
import { getInquiriesForSubstance, getInquiryMatchKind, pickNextQuestion } from '../src/modules/quiz';
import { TextbookEdition } from '../src/types/chemistry';

const inquiry = (id: string) => INQUIRY_QUESTIONS.find(question => question.id === id)!;

describe('实验探究题显示与换题', () => {
  it('所有物质和四种教材均有可显示、可更换且不重复的实验题池', () => {
    const editions: TextbookEdition[] = ['通用版', '人教版', '沪教版', '鲁教版'];
    for (const substance of ALL_SUBSTANCES) for (const edition of editions) {
      const pool = getInquiriesForSubstance(substance.id, edition);
      expect(pool.length).toBeGreaterThan(1);
      expect(new Set(pool.map(question => question.id)).size).toBe(pool.length);
      expect(pool.every(question => question.editions.includes(edition))).toBe(true);
      expect(pool.every(question => question.title && question.scenario && question.subQuestions.length)).toBe(true);
    }
  });

  it('优先保留当前物质的直接探究题，不因扩展题池改变首题', () => {
    expect(getInquiriesForSubstance('naoh', '通用版')[0].id).toBe('inq_naoh_1');
    expect(getInquiriesForSubstance('fe', '通用版')[0].id).toBe('inq_fe_1');
    expect(getInquiriesForSubstance('dilute_hcl', '通用版')[0].id).toBe('inq_dilute_hcl_1');
    expect(getInquiryMatchKind(inquiry('inq_naoh_1'), 'naoh')).toBe('direct');
  });

  it('同成分或溶质题优先于一般关联题，明确它们不是原物质的完全等同物', () => {
    expect(getInquiriesForSubstance('caco3', '通用版')[0].id).toBe('inq_limestone_1');
    expect(getInquiriesForSubstance('hcl', '通用版')[0].id).toBe('inq_dilute_hcl_1');
    expect(getInquiryMatchKind(inquiry('inq_limestone_1'), 'caco3')).toBe('component');
    expect(getInquiryMatchKind(inquiry('inq_dilute_hcl_1'), 'hcl')).toBe('component');
  });

  it('无专属题的水可显示关联反应题；无关联的银显示明确的综合题', () => {
    const water = getInquiriesForSubstance('h2o', '通用版');
    expect(getInquiryMatchKind(water[0], 'h2o')).toBe('related');
    expect(getInquiryMatchKind(inquiry('inq_o2_1'), 'h2o2')).toBe('related');
    const silver = getInquiriesForSubstance('ag', '通用版');
    expect(silver.length).toBeGreaterThan(1);
    expect(silver.every(question => getInquiryMatchKind(question, 'ag') === 'general')).toBe(true);
  });

  it('按本物质、同成分、相关反应、综合题排序且不修改原始题库', () => {
    const originalOrder = INQUIRY_QUESTIONS.map(question => question.id);
    const priority = { direct: 0, component: 1, related: 2, general: 3 };
    for (const substance of ALL_SUBSTANCES) {
      const ranks = getInquiriesForSubstance(substance.id, '通用版')
        .map(question => priority[getInquiryMatchKind(question, substance.id)]);
      expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
    }
    expect(INQUIRY_QUESTIONS.map(question => question.id)).toEqual(originalOrder);
  });

  it('依次遍历整个实验题池后才循环返回，连续换题不重复上一题', () => {
    const pool = getInquiriesForSubstance('naoh', '通用版');
    let current = pickNextQuestion(pool)!;
    const seen = new Set([current.id]);
    for (let index = 1; index < pool.length; index++) {
      const next = pickNextQuestion(pool, current.id)!;
      expect(next.id).not.toBe(current.id);
      seen.add(next.id);
      current = next;
    }
    expect(seen.size).toBe(pool.length);
    expect(pickNextQuestion(pool, current.id)?.id).toBe(pool[0].id);
  });

  it('未知物质或无对应教材题时返回空池，空池及单题边界不抛错', () => {
    expect(getInquiriesForSubstance('unknown', '通用版')).toEqual([]);
    expect(getInquiriesForSubstance('naoh', '无题版本' as TextbookEdition)).toEqual([]);
    expect(pickNextQuestion([])).toBeNull();
    expect(pickNextQuestion([INQUIRY_QUESTIONS[0]], INQUIRY_QUESTIONS[0].id)).toBe(INQUIRY_QUESTIONS[0]);
  });
});
