import { parseChemicalFormula } from '../src/modules/formula/parser';
import { ELEMENT_CHINESE_NAMES } from '../src/modules/knowledge/massRatio';
import { describeMicroDiagram, getAtomStyle } from '../src/modules/knowledge/microDiagram';
import { SubstanceEntry } from '../src/types/chemistry';

export function validateMicroStructure(substance: SubstanceEntry): string[] {
  const { composition, formula } = substance;
  const { description, tiles } = describeMicroDiagram(composition);
  const problems: string[] = [];
  const parsed = parseChemicalFormula(formula);
  if (!parsed.ok) return ['无效化学式'];
  const expected: Record<string, number> = { ...parsed.counts };
  const actual: Record<string, number> = {};
  if ((substance.kind === 'solution') !== (composition.structureType === 'aqueous')) problems.push('溶液应展示水溶液中的微粒');
  if (!tiles.length) problems.push('没有可绘制的微粒');
  let chargeSum = 0;
  for (const { particle, charge, count, name } of tiles) {
    const { atoms, bonds } = particle;
    if (!atoms.length) problems.push('微粒没有原子');
    if (count !== undefined && (!Number.isInteger(count) || count < 1)) problems.push('比例数必须为正整数');
    if (charge !== undefined) {
      if (!Number.isInteger(charge) || charge === 0 || !count) problems.push('离子电荷或比例无效');
      chargeSum += charge * (count ?? 1);
    }
    for (const [index, [symbol, x, y]] of atoms.entries()) {
      if (!ELEMENT_CHINESE_NAMES[symbol] || ![x, y].every(Number.isFinite)) problems.push(`原子 ${symbol} 缺少有效的图例或坐标`);
      if (atoms.slice(index + 1).some(([other, ox, oy]) =>
        Math.hypot(ox - x, oy - y) <= getAtomStyle(symbol).radius + getAtomStyle(other).radius + 2)) {
        problems.push(`原子 ${symbol} 与相邻原子重叠`);
      }
      // 溶剂水另画一份作图例，不计入溶质或离子化学计量。
      if (composition.structureType !== 'aqueous' || charge !== undefined) actual[symbol] = (actual[symbol] ?? 0) + (count ?? 1);
    }
    const edges = new Set<string>();
    const neighbors = atoms.map(() => [] as number[]);
    for (const [from, to] of bonds) {
      const key = `${Math.min(from, to)}-${Math.max(from, to)}`;
      if (from === to || !atoms[from] || !atoms[to] || edges.has(key)) {
        problems.push('键端点无效或重复');
        continue;
      }
      edges.add(key);
      neighbors[from].push(to);
      neighbors[to].push(from);
    }
    if (composition.structureType !== 'atomic_lattice') {
      const seen = new Set([0]);
      const pending = [0];
      while (pending.length && atoms.length) {
        for (const to of neighbors[pending.pop()!]) if (!seen.has(to)) { seen.add(to); pending.push(to); }
      }
      if (seen.size !== atoms.length) problems.push('同一微粒的原子应连通');
    }
    if (formula.length > 1 && name?.includes(formula)) problems.push('微粒名称直接出现答案化学式');
  }
  if (chargeSum !== 0) problems.push('所示离子按计量组成后总电荷不为零');
  if (composition.structureType === 'aqueous') {
    const solvent = composition.solvent.atoms.map(([symbol]) => symbol).sort().join('');
    if (solvent !== 'HHO') problems.push('溶剂微粒不是水分子');
    const water = composition.solventWatersInIons ?? 0;
    if (!Number.isInteger(water) || water < 0) problems.push('离子中的溶剂水数无效');
    if (water > 0) {
      expected.H = (expected.H ?? 0) + 2 * water;
      expected.O = (expected.O ?? 0) + water;
    }
  }
  // 硫的反应用教材元素符号；图画的是常温常见的八元冠状分子。
  if (substance.id === 's') expected.S = 8;
  const symbols = new Set([...Object.keys(actual), ...Object.keys(expected)]);
  if ([...symbols].some(symbol => composition.structureType === 'atomic_lattice'
    ? !actual[symbol] || !expected[symbol] : actual[symbol] !== expected[symbol])) problems.push('微观图组成与目标化学式不符');
  if (formula.length > 1 && [description, composition.note].some(text => text?.includes(formula))) problems.push('线索文字直接出现答案化学式');
  return problems;
}
