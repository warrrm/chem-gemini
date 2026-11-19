/** 二维教学投影中的原子位置；不表示实际键长。 */
export type MicroAtom = readonly [symbol: string, x: number, y: number];
export type MicroBondStyle = 'double' | 'triple' | 'towards' | 'away';
export type MicroBond = readonly [from: number, to: number, style?: MicroBondStyle];

export interface MicroParticle {
  atoms: readonly MicroAtom[];
  /** 只连接同一微粒内部的原子。普通连线表示连接，未必表示单键。 */
  bonds: readonly MicroBond[];
}

export interface MicroIon {
  name: string;
  /** 整个离子的电荷，不是原子团内某个元素的化合价。 */
  charge: number;
  count: number;
  particle: MicroParticle;
}

export type SubstanceComposition = (
  | { structureType: 'molecule' | 'atomic_lattice'; particle: MicroParticle; description: string }
  | { structureType: 'ionic'; ions: readonly MicroIon[] }
  | {
      structureType: 'aqueous'; ions: readonly MicroIon[]; solvent: MicroParticle;
      /** 每个溶质化学式计入所示离子的溶剂水数，例如稀盐酸中水合氢离子的组成。 */
      solventWatersInIons?: number;
    }
  | { structureType: 'solid_ratio'; elements: readonly { symbol: string; count: number }[] }
) & { note?: string };
