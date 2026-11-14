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
 * 优先匹配初中教材范围内的物质，避免单字（如“水”“酸”）误命中超纲物质全称中的子串（如“乙酰水杨酸”“石炭酸”）。
 */
export function searchSubstancesByName(rawQuery: string): TextSearchOutcome {
  const q = rawQuery.trim().toLowerCase();
  if (!q) {
    return { type: 'not_found', substances: [] };
  }

  // 1. Exact name or alias match in SUBSTANCES first
  const exactCore = SUBSTANCES.filter(
    (s) =>
      s.name.toLowerCase() === q ||
      s.aliases.some((a) => a.toLowerCase() === q)
  );
  if (exactCore.length > 0) {
    return { type: 'matched', substances: exactCore };
  }

  // 2. Exact match in OUT_OF_SCOPE_SUBSTANCES
  const exactOutMatch = OUT_OF_SCOPE_SUBSTANCES.find(
    (item) =>
      item.name.toLowerCase() === q ||
      item.aliases.some((a) => a.toLowerCase() === q)
  );
  if (exactOutMatch) {
    return { type: 'out_of_scope', substances: [], outOfScope: exactOutMatch };
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

  // 5. Fuzzy match in OUT_OF_SCOPE_SUBSTANCES (require q.length >= 2 for substring match)
  const fuzzyOutMatch = OUT_OF_SCOPE_SUBSTANCES.find(
    (item) =>
      (q.length >= 2 && item.name.toLowerCase().includes(q)) ||
      q.includes(item.name.toLowerCase()) ||
      item.aliases.some((a) => (q.length >= 2 && a.toLowerCase().includes(q)) || (a.length >= 2 && q.includes(a.toLowerCase())))
  );
  if (fuzzyOutMatch) {
    return { type: 'out_of_scope', substances: [], outOfScope: fuzzyOutMatch };
  }

  return { type: 'not_found', substances: [] };
}
