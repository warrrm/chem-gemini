import { SubstanceEntry } from '../../types/chemistry';
import { parseChemicalFormula } from '../formula/parser';
import { ELEMENT_CHINESE_NAMES, RELATIVE_ATOMIC_MASS } from './massRatio';

export interface ElementValenceClue {
  symbol: string;
  name: string;
  valences: number[];
}

/** 当前知识库的元素化合价，不使用微观图中原子团的电荷代替元素化合价。 */
export function getElementValenceClue(substance: SubstanceEntry): { elements: ElementValenceClue[]; note: string } {
  const parsed = parseChemicalFormula(substance.formula);
  if (!parsed.ok) throw new Error('物质化学式无效，无法生成化合价线索。');
  const symbols = Object.keys(parsed.counts);
  if (symbols.length === 1) {
    return {
      elements: [{ symbol: symbols[0], name: ELEMENT_CHINESE_NAMES[symbols[0]], valences: [0] }],
      note: '单质中元素的化合价为 0。仅凭化合价不能判断一个分子中有几个原子，还需结合物质构成。',
    };
  }
  const values: Record<string, number[]> = {
    H: [1], O: [-2], Na: [1], K: [1], Mg: [2], Ca: [2], Zn: [2], Al: [3], Ag: [1],
    Cl: [-1], C: [4], S: [6], N: [5],
  };
  if (substance.formula === 'H2O2') values.O = [-1];
  if (substance.formula === 'CH4') values.C = [-4];
  if (substance.formula === 'CO') values.C = [2];
  if (substance.formula === 'SO2') values.S = [4];
  if (substance.formula === 'Fe3O4') values.Fe = [2, 3];

  const unknown = symbols.filter(symbol => !values[symbol]);
  if (unknown.length === 1) {
    const knownSum = symbols.filter(symbol => values[symbol]).reduce((sum, symbol) => sum + values[symbol][0] * parsed.counts[symbol], 0);
    const valence = -knownSum / parsed.counts[unknown[0]];
    if (!Number.isInteger(valence)) throw new Error('不能把平均化合价当作单一元素化合价。');
    values[unknown[0]] = [valence];
  } else if (unknown.length) {
    throw new Error('该物质尚未配置可靠的元素化合价线索。');
  }
  return {
    elements: symbols.map(symbol => ({ symbol, name: ELEMENT_CHINESE_NAMES[symbol], valences: values[symbol] })),
    note: substance.formula === 'Fe3O4'
      ? '这种物质中的铁存在不同化合价，不能把平均值当作铁的单一化合价，也不能只用简单交叉法确定化学式。'
      : '化合物中各元素正、负化合价的代数和为 0。化合价不是下标，请结合元素质量比推导原子个数比。',
  };
}

export function formatValence(value: number): string {
  return value > 0 ? `+${value}` : String(value);
}

export function getAtomicMassClue(substance: SubstanceEntry): string {
  const parsed = parseChemicalFormula(substance.formula);
  if (!parsed.ok) throw new Error('物质化学式无效。');
  return Object.keys(parsed.counts).map(symbol => `${symbol}=${RELATIVE_ATOMIC_MASS[symbol]}`).join('，');
}

/** 答对后可回顾全部线索；尚未答对时按错误次数递进开放。 */
export function getFormulaClueLevel(failedAttempts: number, isVerified = false): 1 | 2 | 3 {
  return isVerified || failedAttempts >= 2 ? 3 : failedAttempts >= 1 ? 2 : 1;
}
