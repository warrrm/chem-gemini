import { describe, expect, it } from 'vitest';
import { ALL_SUBSTANCES, SUBSTANCE_BY_ID } from '../src/data/substances';
import { CARD_EQUATION_LIMIT, getKnowledgeCardStudy } from '../src/modules/knowledge/cardStudy';
import { queryReactionsForSubstance } from '../src/modules/reactions';
import type { TextbookEdition } from '../src/types/chemistry';

const card = (id: string, edition: TextbookEdition = '通用版') => getKnowledgeCardStudy(SUBSTANCE_BY_ID.get(id)!, edition);

describe('P0 步骤四物质卡片学习摘要', () => {
  it('全库均有用途和制法或来源，方程式与当前教材及物质匹配且不重复', () => {
    for (const substance of ALL_SUBSTANCES) {
      expect(substance.uses.length, substance.id).toBeGreaterThan(0);
      expect(card(substance.id).equations.length, substance.id).toBeGreaterThan(0);
      for (const edition of substance.editions) {
        const { preparations, equations } = card(substance.id, edition);
        const query = queryReactionsForSubstance(substance.id, edition);
        const candidates = substance.kind === 'pure' ? [...query.asReactant, ...query.asProduct] : query.asReactant;
        const ids = equations.map(({ reaction }) => reaction.id);
        expect(preparations.length, substance.id).toBeGreaterThan(0);
        expect(ids, `${substance.id} · ${edition}`).toHaveLength(Math.min(CARD_EQUATION_LIMIT, new Set(candidates.map(item => item.id)).size));
        expect(new Set(ids).size).toBe(ids.length);
        for (const { reaction, preparationKind } of equations) {
          expect(candidates).toContainEqual(reaction);
          if (preparationKind) {
            expect(substance.kind).toBe('pure');
            expect(reaction.roleLabel).toBe('作为生成物');
            expect(preparations).toContainEqual(expect.objectContaining({ kind: preparationKind, productReactionId: reaction.id }));
          }
        }
      }
    }
  });

  it('氧气优先显示两条制取方程式，二氧化锰只在催化条件中出现', () => {
    const { equations } = card('o2');
    expect(equations.slice(0, 2).map(({ reaction }) => reaction.id)).toEqual(['rxn_h2o2_decomp', 'rxn_kmno4_decomp']);
    const { reaction, preparationKind } = equations[0];
    expect(preparationKind).toBe('实验室制取');
    expect(reaction.condition).toBe('MnO2');
    expect(reaction.plainEquationText).toBe('2H₂O₂ === [MnO2] === 2H₂O + O₂↑');
    expect([...reaction.reactants, ...reaction.products].some(term => term.substanceId === 'mno2')).toBe(false);
    expect(card('h2o2').equations[0]).not.toHaveProperty('preparationKind');
  });

  it('氢氧化钠先列苛化生成示例，碳酸钙沉淀符号不丢失', () => {
    const { reaction, preparationKind } = card('naoh').equations[0];
    expect(reaction.id).toBe('rxn_na2co3_caoh2');
    expect(preparationKind).toBe('生成示例');
    expect(reaction.plainEquationText).toBe('Na₂CO₃ + Ca(OH)₂ === === CaCO₃↓ + 2NaOH');
  });

  it.each(['dilute_hcl', 'limewater', 'cuso4_solution', 'limestone'])('%s 不把生成成分的反应当作配制或来源', (id) => {
    const sub = SUBSTANCE_BY_ID.get(id)!;
    const { preparations, equations, equationScope } = card(id);
    expect(preparations[0].kind).toBe(sub.kind === 'solution' ? '配制' : '天然来源');
    expect(preparations.every(item => !item.productReactionId)).toBe(true);
    expect(equations.every(({ reaction }) => reaction.roleLabel === '作为反应物')).toBe(true);
    expect(equationScope).toContain(sub.mainComponentName);
  });

  it('蒸馏是物理分离；没有教材匹配时不借用其他版方程式填空', () => {
    expect(card('h2o').preparations[0]).toMatchObject({ kind: '分离提纯', text: expect.stringContaining('没有对应的化学方程式') });
    expect(card('h2o').preparations[0]).not.toHaveProperty('productReactionId');
    expect(card('mgcl2', '沪教版').equations).toEqual([]);
    expect(card('mgcl2', '人教版').equations[0].reaction.id).toBe('rxn_mg_hcl');
  });
});
