import { MassRatioItem } from '../../types/chemistry';
import { parseChemicalFormula } from '../formula/parser';

export const RELATIVE_ATOMIC_MASS: Record<string, number> = {
  H: 1,
  C: 12,
  N: 14,
  O: 16,
  Na: 23,
  Mg: 24,
  Al: 27,
  S: 32,
  Cl: 35.5,
  K: 39,
  Ca: 40,
  Mn: 55,
  Fe: 56,
  Cu: 64,
  Zn: 65,
  Ag: 108,
};

export const ELEMENT_CHINESE_NAMES: Record<string, string> = {
  H: '氢',
  C: '碳',
  N: '氮',
  O: '氧',
  Na: '钠',
  Mg: '镁',
  Al: '铝',
  S: '硫',
  Cl: '氯',
  K: '钾',
  Ca: '钙',
  Mn: '锰',
  Fe: '铁',
  Cu: '铜',
  Zn: '锌',
  Ag: '银',
};

function gcd(a: number, b: number): number {
  let x = Math.abs(Math.round(a));
  let y = Math.abs(Math.round(b));
  while (y !== 0) {
    const t = y;
    y = x % y;
    x = t;
  }
  return x || 1;
}

/**
 * 根据化学式与初中常用相对原子质量计算最简整数元素质量比。
 * 单质只含一种元素，返回 null。
 */
export function computeElementMassRatio(formula: string): MassRatioItem[] | null {
  const parsed = parseChemicalFormula(formula);
  if (!parsed.ok) {
    throw new Error(`Cannot compute mass ratio for invalid formula: ${formula}`);
  }

  const entries = Object.entries(parsed.counts);
  if (entries.length <= 1) {
    return null;
  }

  const rawMasses = entries.map(([symbol, count]) => {
    const ar = RELATIVE_ATOMIC_MASS[symbol];
    if (ar === undefined) {
      throw new Error(`Missing relative atomic mass for element: ${symbol}`);
    }
    return {
      symbol,
      name: ELEMENT_CHINESE_NAMES[symbol] ?? symbol,
      mass: ar * count,
    };
  });

  // If any mass has .5 (e.g. Cl = 35.5 * odd), scale all masses by 2 to get exact integers
  const needsDouble = rawMasses.some((item) => !Number.isInteger(item.mass));
  const scaled = rawMasses.map((item) => ({
    ...item,
    intMass: Math.round(needsDouble ? item.mass * 2 : item.mass),
  }));

  const divisor = scaled.reduce((acc, item) => gcd(acc, item.intMass), scaled[0].intMass);

  return scaled.map((item) => ({
    symbol: item.symbol,
    name: item.name,
    ratioValue: item.intMass / divisor,
  }));
}

export function formatMassRatioText(items: MassRatioItem[]): string {
  const lhs = items.map((i) => `m(${i.symbol})`).join(' : ');
  const rhs = items.map((i) => i.ratioValue).join(' : ');
  return `${lhs} = ${rhs}`;
}
