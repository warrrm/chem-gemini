import { REACTIONS } from '../../data/reactions';
import { SUBSTANCE_BY_ID } from '../../data/substances';
import { ReactionEntry, ReactionParticipant, TextbookEdition } from '../../types/chemistry';
import { formatFormulaPreview } from '../formula/parser';

export interface FormattedParticipant {
  substanceId: string;
  name: string;
  coef: number;
  formulaDisplay: string;
  mark?: '↑' | '↓';
}

export interface FormattedReaction extends ReactionEntry {
  roleLabel: '作为反应物' | '作为生成物' | '同时参与反应';
  formattedReactants: FormattedParticipant[];
  formattedProducts: FormattedParticipant[];
  plainEquationText: string;
}

function formatParticipant(p: ReactionParticipant): FormattedParticipant {
  const sub = SUBSTANCE_BY_ID.get(p.substanceId);
  if (!sub) {
    throw new Error(`Reaction references unknown substanceId: ${p.substanceId}`);
  }
  const formulaDisplay = formatFormulaPreview(sub.formula);
  return {
    substanceId: p.substanceId,
    name: sub.name,
    coef: p.coef,
    formulaDisplay,
    mark: p.mark,
  };
}

export function buildPlainEquationText(rxn: ReactionEntry): string {
  const left = rxn.reactants
    .map((r) => {
      const f = formatParticipant(r);
      return `${f.coef > 1 ? f.coef : ''}${f.formulaDisplay}`;
    })
    .join(' + ');

  const right = rxn.products
    .map((p) => {
      const f = formatParticipant(p);
      return `${f.coef > 1 ? f.coef : ''}${f.formulaDisplay}${f.mark ?? ''}`;
    })
    .join(' + ');

  const cond = rxn.condition && rxn.condition !== '常温' ? ` [${rxn.condition}] ` : ' ';
  return `${left} ===${cond}=== ${right}`;
}

export interface ReactionQueryResult {
  asReactant: FormattedReaction[];
  asProduct: FormattedReaction[];
  featuredList: FormattedReaction[];
  totalMatched: number;
}

/**
 * 检索与指定物质（或其主要成分）相关的初中化学反应方程式：
 * - 包含作为反应物和作为生成物两类
 * - 按所选教材版本过滤
 * - 默认返回最相关的 3—5 条（不足按实际数量返回，绝不凑数）
 */
export function queryReactionsForSubstance(
  substanceId: string,
  edition: TextbookEdition,
  limit = 5
): ReactionQueryResult {
  const sub = SUBSTANCE_BY_ID.get(substanceId);
  if (!sub) {
    return { asReactant: [], asProduct: [], featuredList: [], totalMatched: 0 };
  }

  // For mixtures/solutions (e.g. limestone -> caco3, dilute_hcl -> hcl), match both the object ID and mainComponentId
  const targetIds = new Set<string>([sub.id]);
  if (sub.mainComponentId) {
    targetIds.add(sub.mainComponentId);
  }

  const matched = REACTIONS.filter((rxn) => {
    if (!rxn.editions.includes(edition)) return false;
    const inReactants = rxn.reactants.some((r) => targetIds.has(r.substanceId));
    const inProducts = rxn.products.some((p) => targetIds.has(p.substanceId));
    return inReactants || inProducts;
  }).sort((a, b) => b.priority - a.priority);

  const formatted: FormattedReaction[] = matched.map((rxn) => {
    const inReactants = rxn.reactants.some((r) => targetIds.has(r.substanceId));
    const inProducts = rxn.products.some((p) => targetIds.has(p.substanceId));
    const roleLabel: FormattedReaction['roleLabel'] =
      inReactants && inProducts
        ? '同时参与反应'
        : inReactants
        ? '作为反应物'
        : '作为生成物';

    return {
      ...rxn,
      roleLabel,
      formattedReactants: rxn.reactants.map(formatParticipant),
      formattedProducts: rxn.products.map(formatParticipant),
      plainEquationText: buildPlainEquationText(rxn),
    };
  });

  const asReactant = formatted.filter((r) => r.roleLabel === '作为反应物' || r.roleLabel === '同时参与反应');
  const asProduct = formatted.filter((r) => r.roleLabel === '作为生成物' || r.roleLabel === '同时参与反应');

  return {
    asReactant,
    asProduct,
    featuredList: formatted.slice(0, limit),
    totalMatched: formatted.length,
  };
}
