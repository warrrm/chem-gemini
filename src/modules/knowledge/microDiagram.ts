import { MicroParticle, SubstanceComposition } from '../../types/microstructure';
import { ELEMENT_CHINESE_NAMES } from './massRatio';

// 颜色与尺寸仅为教学图例，不代表物质颜色或实际原子半径。
const ATOM_COLORS: Record<string, readonly [fill: string, stroke: string, textColor?: string]> = {
  H: ['#f8fafc', '#475569', '#0f172a'],
  O: ['#dc2626', '#991b1b'],
  C: ['#334155', '#0f172a'],
  N: ['#1d4ed8', '#1e3a8a'],
  S: ['#facc15', '#a16207', '#422006'],
  Cl: ['#15803d', '#14532d'],
  Na: ['#7c3aed', '#5b21b6'],
  Ca: ['#0369a1', '#075985'],
  Fe: ['#b45309', '#78350f'],
  Cu: ['#c2410c', '#7c2d12'],
  Mg: ['#0f766e', '#134e4a'],
  Zn: ['#475569', '#1e293b'],
  Mn: ['#9333ea', '#581c87'],
  K: ['#be185d', '#831843'],
  Ag: ['#cbd5e1', '#475569', '#0f172a'],
};

export function getAtomStyle(symbol: string) {
  const [fill, stroke, textColor = '#fff'] = ATOM_COLORS[symbol] ?? ['#2563eb', '#1e40af'];
  return { fill, stroke, textColor, radius: symbol === 'H' ? 11 : 15 };
}

interface MicroTile {
  particle: MicroParticle;
  name?: string;
  count?: number;
  charge?: number;
}

export function describeMicroDiagram(composition: SubstanceComposition): {
  title: string; description: string; tiles: MicroTile[];
} {
  switch (composition.structureType) {
    case 'molecule':
    case 'atomic_lattice':
      return {
        title: composition.structureType === 'molecule' ? '分子结构示意' : '固体原子排列示意',
        description: composition.description,
        tiles: [{ particle: composition.particle }],
      };
    case 'ionic':
    case 'aqueous': {
      const inWater = composition.structureType === 'aqueous';
      return {
        title: inWater ? '水溶液中的主要微粒' : '固体中的离子个数比',
        description: `离子个数比（按图中顺序）：${composition.ions.map(ion => ion.count).join(' : ')}。`,
        tiles: inWater ? [...composition.ions, { name: '水分子（溶剂）', particle: composition.solvent }] : [...composition.ions],
      };
    }
    case 'solid_ratio':
      return {
        title: '固体的元素组成示意',
        description: '标出固体中各元素的个数比，不画离散分子。',
        tiles: composition.elements.map(({ symbol, count }) => ({
          name: `${ELEMENT_CHINESE_NAMES[symbol]}元素`, count, particle: { atoms: [[symbol, 0, 0]], bonds: [] },
        })),
      };
  }
}

export function formatIonCharge(charge: number): string {
  return `${Math.abs(charge) > 1 ? Math.abs(charge) : ''}${charge > 0 ? '+' : '−'}`;
}

export function buildMicroLegend(particles: readonly MicroParticle[]) {
  const symbols = new Set(particles.flatMap(particle => particle.atoms.map(([symbol]) => symbol)));
  return [...symbols].map(symbol => ({
    symbol, label: `${symbol}（${ELEMENT_CHINESE_NAMES[symbol]}）`, ...getAtomStyle(symbol),
  }));
}
