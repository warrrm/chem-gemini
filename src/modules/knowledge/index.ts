import { ALL_SUBSTANCES, OUT_OF_SCOPE_SUBSTANCES, SUBSTANCES, SUBSTANCE_BY_ID } from '../../data/substances';
import { OutOfScopeEntry, SubstanceEntry } from '../../types/chemistry';

export * from './massRatio';
export * from './microDiagram';

export function getSubstanceById(id: string): SubstanceEntry | undefined {
  return SUBSTANCE_BY_ID.get(id);
}

export function getCoreSubstances(): SubstanceEntry[] {
  return SUBSTANCES;
}

export function getFeaturedSubstances(): SubstanceEntry[] {
  return SUBSTANCES.filter((s) => s.featured);
}

export interface TextSearchOutcome {
  type: 'matched' | 'out_of_scope' | 'not_found';
  substances: SubstanceEntry[];
  outOfScope?: OutOfScopeEntry;
}

/**
 * 本地名称/别名/俗称模糊匹配（绝不在未解锁前暴露化学式）
 */
export function searchSubstancesByName(rawQuery: string): TextSearchOutcome {
  const q = rawQuery.trim().toLowerCase();
  if (!q) {
    return { type: 'not_found', substances: [] };
  }

  // 1. Check out-of-scope list first
  const outMatch = OUT_OF_SCOPE_SUBSTANCES.find(
    (item) =>
      item.name.toLowerCase().includes(q) ||
      q.includes(item.name.toLowerCase()) ||
      item.aliases.some((a) => a.toLowerCase() === q || q.includes(a.toLowerCase()))
  );
  if (outMatch) {
    return { type: 'out_of_scope', substances: [], outOfScope: outMatch };
  }

  // 2. Exact name or alias match in SUBSTANCES first, then ALL_SUBSTANCES
  const exactCore = SUBSTANCES.filter(
    (s) =>
      s.name.toLowerCase() === q ||
      s.aliases.some((a) => a.toLowerCase() === q)
  );
  if (exactCore.length > 0) {
    return { type: 'matched', substances: exactCore };
  }

  // 3. Substring fuzzy match in SUBSTANCES
  const fuzzyCore = SUBSTANCES.filter(
    (s) =>
      s.name.toLowerCase().includes(q) ||
      s.aliases.some((a) => a.toLowerCase().includes(q) || (a.length >= 2 && q.includes(a.toLowerCase())))
  );
  if (fuzzyCore.length > 0) {
    return { type: 'matched', substances: fuzzyCore.slice(0, 6) };
  }

  // 4. Fallback to ALL_SUBSTANCES (auxiliary reaction substances)
  const auxMatches = ALL_SUBSTANCES.filter(
    (s) =>
      s.name.toLowerCase().includes(q) ||
      s.aliases.some((a) => a.toLowerCase().includes(q))
  );
  if (auxMatches.length > 0) {
    return { type: 'matched', substances: auxMatches.slice(0, 6) };
  }

  return { type: 'not_found', substances: [] };
}
