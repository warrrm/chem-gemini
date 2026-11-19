import { describe, expect, it } from 'vitest';
import { validateMicroStructure } from '../scripts/validate-microstructure';
import { MICRO_STRUCTURES } from '../src/data/microStructures';
import { DEMO_SAMPLES } from '../src/data/samples';
import { ALL_SUBSTANCES, SUBSTANCE_BY_ID } from '../src/data/substances';
import { describeMicroDiagram, formatIonCharge } from '../src/modules/knowledge/microDiagram';
import { SubstanceComposition } from '../src/types/microstructure';

function model(id: string): SubstanceComposition {
  return SUBSTANCE_BY_ID.get(id)!.composition;
}

const tiles = (id: string) => describeMicroDiagram(model(id)).tiles;
const particle = (id: string) => tiles(id)[0].particle;
const symbols = (id: string) => particle(id).atoms.map(([symbol]) => symbol);

function links(id: string) {
  const { atoms, bonds } = particle(id);
  return bonds.map(([a, b, style]) => [atoms[a][0], atoms[b][0], style ?? 'line']);
}

describe('P1 微观结构图的组成和键连', () => {
  it('所有本地物质条目都有对应结构，组成、离子电荷、原子间隔和键端点均有效', () => {
    expect(Object.keys(MICRO_STRUCTURES).sort()).toEqual(ALL_SUBSTANCES.map(substance => substance.id).sort());
    for (const substance of ALL_SUBSTANCES) {
      expect(substance.composition, substance.id).toBe(MICRO_STRUCTURES[substance.id as keyof typeof MICRO_STRUCTURES]);
      expect(validateMicroStructure(substance), substance.id).toEqual([]);
    }
  });

  it('过氧化氢为扭转的 H—O—O—H：一条氧氧单键，每个氧各连一个氢', () => {
    expect(symbols('h2o2')).toEqual(['H', 'O', 'O', 'H']);
    const { bonds } = particle('h2o2');
    expect(bonds).toEqual([[1, 0, 'away'], [1, 2], [2, 3, 'towards']]);
    expect(describeMicroDiagram(model('h2o2')).description).toContain('非平面');
  });

  it('区分水和二氧化硫的折线形、二氧化碳的直线形和甲烷的四面体', () => {
    for (const id of ['h2o', 'so2']) {
      const [, [, , y1], [, , y2]] = particle(id).atoms;
      expect(y1).toBe(y2);
      expect(y1).not.toBe(particle(id).atoms[0][2]);
      expect(particle(id).bonds).toEqual([[0, 1], [0, 2]]);
    }
    expect(new Set(particle('co2').atoms.map(([, , y]) => y)).size).toBe(1);
    expect(links('co2')).toEqual([['O', 'C', 'double'], ['C', 'O', 'double']]);
    expect(links('co')).toEqual([['C', 'O', 'triple']]);
    expect(links('o2')).toEqual([['O', 'O', 'double']]);
    expect(particle('ch4').bonds.map(([, , style]) => style ?? 'line').sort()).toEqual(['away', 'line', 'line', 'towards']);
  });

  it('含氧酸中的氢接在两个不同的氧上，不直接接在硫或碳上', () => {
    for (const id of ['h2so4', 'h2co3']) {
      const { atoms, bonds } = particle(id);
      expect(links(id).filter(([, to]) => to === 'H')).toEqual([['O', 'H', 'line'], ['O', 'H', 'line']]);
      expect(new Set(bonds.filter(([, j]) => atoms[j][0] === 'H').map(([i]) => i)).size).toBe(2);
    }
  });

  it('离子电荷在整个原子团上，氢氧根、碳酸根、硫酸根等具有独立键连', () => {
    for (const [id, central, anion, charge, multiplicity, edges] of [
      ['naoh', 'O', '氢氧根离子', -1, 1, 1], ['caoh2', 'O', '氢氧根离子', -1, 2, 1],
      ['limestone', 'C', '碳酸根离子', -2, 1, 3], ['cuso4', 'S', '硫酸根离子', -2, 1, 4],
      ['cuno32', 'N', '硝酸根离子', -1, 2, 3], ['kmno4', 'Mn', '高锰酸根离子', -1, 1, 4],
      ['k2mno4', 'Mn', '锰酸根离子', -2, 1, 4],
    ] as const) {
      const [cation, group] = tiles(id);
      expect(cation.particle.bonds).toHaveLength(0);
      expect(group).toMatchObject({ name: anion, charge, count: multiplicity });
      expect(group.particle.atoms).toHaveLength(edges + 1);
      expect(group.particle.bonds).toHaveLength(edges);
      expect(group.particle.bonds.every(([from]) => group.particle.atoms[from][0] === central)).toBe(true);
    }
    expect(tiles('fe3o4').map(({ charge, count }) => [charge, count])).toEqual([[2, 1], [3, 2], [-2, 4]]);
    expect([2, -1, -2].map(formatIonCharge)).toEqual(['2+', '−', '2−']);
  });

  it('稀盐酸画水合氢离子和氯离子，其他溶液也将溶质微粒与溶剂水分开', () => {
    expect(tiles('hcl')).toHaveLength(1);
    const [hydronium, chloride, solvent] = tiles('dilute_hcl');
    expect(hydronium).toMatchObject({ name: '水合氢离子', charge: 1, count: 1 });
    expect(hydronium.particle.atoms.map(([symbol]) => symbol)).toEqual(['O', 'H', 'H', 'H']);
    expect(hydronium.particle.bonds).toHaveLength(3);
    expect(chloride).toMatchObject({ name: '氯离子', charge: -1, count: 1 });
    expect(solvent.particle).toBe(particle('h2o'));
    for (const id of ['dilute_hcl', 'cuso4_solution', 'limewater']) {
      expect(model(id).structureType).toBe('aqueous');
      const water = tiles(id).at(-1)!;
      expect(water).toMatchObject({ name: '水分子（溶剂）', particle: particle('h2o') });
      expect(water.count).toBeUndefined();
      expect(water.charge).toBeUndefined();
    }
    expect(model('limestone').note).toContain('主要成分碳酸钙');
  });

  it('教材硫符号不误画原子晶格，铁用同种原子排列，二氧化锰不误画独立分子', () => {
    expect(symbols('s')).toEqual(Array(8).fill('S'));
    const { bonds } = particle('s');
    expect(bonds).toHaveLength(8);
    for (let i = 0; i < 8; i++) expect(bonds.filter(([a, b]) => a === i || b === i)).toHaveLength(2);
    expect(model('c').note).toContain('相邻两格');
    expect(model('fe').structureType).toBe('atomic_lattice');
    expect(new Set(symbols('fe'))).toEqual(new Set(['Fe']));
    expect(particle('fe').bonds).toHaveLength(0);
    expect(model('mno2').structureType).toBe('solid_ratio');
  });

  it('适用的演示样例候选和点选物质均用同一套本地图库，范围外及仪器不编造结构', () => {
    for (const sample of DEMO_SAMPLES) {
      for (const { substanceId } of sample.candidates) expect(tiles(substanceId).length).toBeGreaterThan(0);
      for (const hotspot of sample.hotspots ?? []) {
        if (hotspot.isApparatus) expect(hotspot.substanceId).toBeUndefined();
        else expect(tiles(hotspot.substanceId!).length).toBeGreaterThan(0);
      }
      if (sample.outOfScopeId) expect(SUBSTANCE_BY_ID.has(sample.outOfScopeId)).toBe(false);
    }
  });
});
