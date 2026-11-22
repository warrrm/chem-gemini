import { SUBSTANCE_PREPARATIONS, type PreparationNote } from '../../data/preparations';
import type { SubstanceEntry, TextbookEdition } from '../../types/chemistry';
import { queryReactionsForSubstance, type FormattedReaction } from '../reactions';

export const CARD_EQUATION_LIMIT = 3;

interface CardEquation {
  reaction: FormattedReaction;
  preparationKind?: PreparationNote['kind'];
}

function getEquationScope(substance: SubstanceEntry): string | undefined {
  if (substance.kind === 'mixture') return `方程式写的是主要成分「${substance.mainComponentName}」的反应，不代表整个混合物。`;
  if (substance.kind === 'solution') return `方程式写的是溶质「${substance.mainComponentName}」参与的反应，不是溶液配制。`;
  if (substance.id === 'hcl') return '以下方程式涉及氯化氢的水溶液（稀盐酸），并非氯化氢气体的反应。';
  if (substance.id === 'h2so4') return '以下方程式使用稀硫酸，不能直接套用于浓硫酸。';
  if (substance.id === 'cuso4') return '下列反应中的硫酸铜以水溶液形式参与。';
}

export function getKnowledgeCardStudy(substance: SubstanceEntry, edition: TextbookEdition) {
  const preparations = SUBSTANCE_PREPARATIONS[substance.id] ?? [];
  const { asReactant, asProduct } = queryReactionsForSubstance(substance.id, edition);
  const equations = new Map<string, CardEquation>();

  // 优先展示和本条制法直接对应的生成反应；同一方程式只展示一次。
  // 对混合物和溶液不把「生成成分」误列成「制得整个样品」。
  if (substance.kind === 'pure') {
    for (const prep of preparations) {
      const reaction = asProduct.find(item => item.id === prep.productReactionId && item.roleLabel === '作为生成物');
      if (reaction) equations.set(reaction.id, { reaction, preparationKind: prep.kind });
    }
  }
  const related = substance.kind === 'pure' ? [...asReactant, ...asProduct] : asReactant;
  for (const reaction of related) {
    if (equations.size >= CARD_EQUATION_LIMIT) break;
    if (!equations.has(reaction.id)) equations.set(reaction.id, { reaction });
  }

  return {
    preparations, equations: [...equations.values()].slice(0, CARD_EQUATION_LIMIT),
    equationScope: getEquationScope(substance),
  };
}
