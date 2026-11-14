import { SubstanceComposition } from '../../types/chemistry';
import { ELEMENT_CHINESE_NAMES } from './massRatio';

export interface AtomVisualStyle {
  fill: string;
  stroke: string;
  textColor: string;
  radius: number;
}

const ATOM_STYLES: Record<string, AtomVisualStyle> = {
  H: { fill: '#f8fafc', stroke: '#475569', textColor: '#0f172a', radius: 18 },
  O: { fill: '#ef4444', stroke: '#b91c1c', textColor: '#ffffff', radius: 24 },
  C: { fill: '#334155', stroke: '#0f172a', textColor: '#ffffff', radius: 24 },
  S: { fill: '#eab308', stroke: '#a16207', textColor: '#0f172a', radius: 26 },
  Cl: { fill: '#22c55e', stroke: '#15803d', textColor: '#ffffff', radius: 25 },
  Na: { fill: '#8b5cf6', stroke: '#5b21b6', textColor: '#ffffff', radius: 26 },
  Ca: { fill: '#0ea5e9', stroke: '#0369a1', textColor: '#ffffff', radius: 28 },
  Fe: { fill: '#d97706', stroke: '#92400e', textColor: '#ffffff', radius: 26 },
  Cu: { fill: '#ea580c', stroke: '#9a3412', textColor: '#ffffff', radius: 26 },
  Mg: { fill: '#14b8a6', stroke: '#0f766e', textColor: '#ffffff', radius: 25 },
  Zn: { fill: '#64748b', stroke: '#334155', textColor: '#ffffff', radius: 25 },
  Mn: { fill: '#a855f7', stroke: '#6b21a8', textColor: '#ffffff', radius: 26 },
  K: { fill: '#ec4899', stroke: '#9d174d', textColor: '#ffffff', radius: 28 },
  Al: { fill: '#3b82f6', stroke: '#1d4ed8', textColor: '#ffffff', radius: 25 },
};

export function getAtomStyle(symbol: string): AtomVisualStyle {
  return (
    ATOM_STYLES[symbol] ?? {
      fill: '#2563eb',
      stroke: '#1e40af',
      textColor: '#ffffff',
      radius: 24,
    }
  );
}

export interface MicroLegendItem {
  symbol: string;
  label: string;
  fill: string;
  stroke: string;
  textColor: string;
}

/**
 * 构建微观示意图图例（只显示单个元素/离子符号及名称，绝不出现目标化学式字符串）
 */
export function buildMicroLegend(composition: SubstanceComposition): MicroLegendItem[] {
  const seen = new Set<string>();
  const legend: MicroLegendItem[] = [];

  for (const atom of composition.atoms) {
    const key = `${atom.symbol}|${atom.charge ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const style = getAtomStyle(atom.symbol);
    const cnName = ELEMENT_CHINESE_NAMES[atom.symbol] ?? atom.symbol;
    const particleType =
      atom.charge && atom.charge.includes('+')
        ? '阳离子'
        : atom.charge && atom.charge.includes('-')
        ? '阴离子'
        : '原子';

    legend.push({
      symbol: atom.symbol,
      label: `${atom.symbol}（${cnName}${particleType}）`,
      fill: style.fill,
      stroke: style.stroke,
      textColor: style.textColor,
    });
  }

  return legend;
}
