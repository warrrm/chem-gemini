import { MicroAtom, MicroBond, MicroBondStyle, MicroIon, MicroParticle, SubstanceComposition } from '../types/microstructure';

const geometry = (atoms: readonly MicroAtom[], bonds: readonly MicroBond[] = []): MicroParticle => ({ atoms, bonds });
const singleAtom = (symbol: string) => geometry([[symbol, 0, 0]]);
const diatomic = (a: string, b: string, style?: MicroBondStyle) => geometry([[a, -30, 0], [b, 30, 0]], [[0, 1, style]]);
const bent = (center: string, ends: string, angle: number) => {
  const rad = angle * Math.PI / 360;
  const x = +(49 * Math.sin(rad)).toFixed(2);
  const y = +(49 * Math.cos(rad)).toFixed(2);
  return geometry([[center, 0, -y / 2], [ends, -x, y / 2], [ends, x, y / 2]], [[0, 1], [0, 2]]);
};
const planarTriangle = (center: string, ends: string) => geometry(
  [[center, 0, 0], [ends, 0, -45], [ends, -39, 22.5], [ends, 39, 22.5]], [[0, 1], [0, 2], [0, 3]],
);
const tetrahedral = (center: string, ends: string) => geometry(
  [[center, 0, 0], [ends, -42, -17], [ends, 0, -48], [ends, 45, 16], [ends, -29, 37]],
  [[0, 1, 'away'], [0, 2], [0, 3], [0, 4, 'towards']],
);
const WATER = bent('O', 'H', 104.5);
const HYDRONIUM = geometry(
  [['O', 0, -13], ['H', -42, 12], ['H', 42, 12], ['H', 0, 40]],
  [[0, 1, 'away'], [0, 2], [0, 3, 'towards']],
);

const molecule = (particle: MicroParticle, description: string, note?: string): SubstanceComposition =>
  ({ structureType: 'molecule', particle, description, note });
const ion = (name: string, charge: number, content: string | MicroParticle, count = 1): MicroIon =>
  ({ name, charge, particle: typeof content === 'string' ? singleAtom(content) : content, count });
const ionic = (...ions: MicroIon[]): SubstanceComposition => ({ structureType: 'ionic', ions });
const aqueous = (ions: MicroIon[], note?: string, solventWatersInIons?: number): SubstanceComposition =>
  ({ structureType: 'aqueous', ions, solvent: WATER, note, solventWatersInIons });

const sodium = (count = 1) => ion('钠离子', 1, 'Na', count);
const potassium = (count = 1) => ion('钾离子', 1, 'K', count);
const chloride = (count = 1) => ion('氯离子', -1, 'Cl', count);
const oxide = (count = 1) => ion('氧离子', -2, 'O', count);
const calcium = ion('钙离子', 2, 'Ca');
const copper = ion('铜离子', 2, 'Cu');
const magnesium = ion('镁离子', 2, 'Mg');
const silver = ion('银离子', 1, 'Ag');
const ironII = ion('亚铁离子', 2, 'Fe');
const ironIII = (count = 1) => ion('铁(Ⅲ)离子', 3, 'Fe', count);
const hydroxide = (count = 1) => ion('氢氧根离子', -1, diatomic('O', 'H'), count);
const carbonate = ion('碳酸根离子', -2, planarTriangle('C', 'O'));
const sulfate = ion('硫酸根离子', -2, tetrahedral('S', 'O'));
const nitrate = (count = 1) => ion('硝酸根离子', -1, planarTriangle('N', 'O'), count);
const calciumCarbonate = ionic(calcium, carbonate);

const graphite = geometry(
  [['C', -32, -38], ['C', 0, -19], ['C', 0, 19], ['C', -32, 38], ['C', -64, 19], ['C', -64, -19],
    ['C', 32, -38], ['C', 64, -19], ['C', 64, 19], ['C', 32, 38]],
  [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 0], [1, 6], [6, 7], [7, 8], [8, 9], [9, 2]],
);
const sulfurRing = geometry(
  // 将八个交替高低的硫沿倾斜方向投影，使冠状环的起伏可见。
  Array.from({ length: 8 }, (_, i): MicroAtom => {
    const angle = i * Math.PI / 4;
    const tilt = 24 * Math.PI / 180;
    return ['S', +(65 * Math.cos(angle)).toFixed(2), +(65 * Math.sin(angle) * Math.cos(tilt) - (i % 2) * 24 * Math.sin(tilt)).toFixed(2)];
  }),
  Array.from({ length: 8 }, (_, i): MicroBond => [i, (i + 1) % 8]),
);
function metal(symbol: string, name: string): SubstanceComposition {
  const grid = [-36, 0, 36].flatMap((y, row): MicroAtom[] => [-44, 0, 44].map(x => [symbol, x + (row % 2 ? 22 : 0), y]));
  return {
    structureType: 'atomic_lattice', particle: geometry(grid), description: `${name}原子在固体中重复排列。`,
    note: '仅示意同种金属原子的排列，不表示某种晶胞或独立分子。',
  };
}

/** 对应本地物质条目；不由分子式猜测键连，也不使用识图模型生成的结构。 */
export const MICRO_STRUCTURES = {
  o2: molecule(diatomic('O', 'O', 'double'), '两个氧原子以双键相连。'),
  h2: molecule(diatomic('H', 'H'), '两个氢原子以单键相连。'),
  c: {
    structureType: 'atomic_lattice', particle: graphite,
    description: '以石墨的一层为例，碳原子相连形成延伸的六角网。',
    note: '只画相邻两格，非独立分子，也不表示金刚石或木炭的实测结构。',
  },
  s: molecule(sulfurRing, '常温常见的固态硫由八个硫原子首尾相连成上下起伏的冠状分子。', '初中反应式仍按教材惯例用元素符号表示硫单质。'),
  fe: metal('Fe', '铁'),
  cu: metal('Cu', '铜'),
  mg: metal('Mg', '镁'),
  zn: metal('Zn', '锌'),
  h2o: molecule(WATER, '氧在中央，两个氢与它相连，分子呈折线形。'),
  co2: molecule(geometry([['O', -56, 0], ['C', 0, 0], ['O', 56, 0]], [[0, 1, 'double'], [1, 2, 'double']]),
    '碳在中央，分别与两侧的氧以双键相连，分子呈直线形。'),
  co: molecule(diatomic('C', 'O', 'triple'), '一个碳和一个氧相连，图中以三键表示。'),
  cao: ionic(calcium, oxide()),
  cuo: ionic(copper, oxide()),
  fe2o3: ionic(ironIII(2), oxide(3)),
  mno2: {
    structureType: 'solid_ratio', elements: [{ symbol: 'Mn', count: 1 }, { symbol: 'O', count: 2 }],
    note: '只画固体中锰与氧的组成比例，不把二氧化锰画成独立分子，也不指定晶型。',
  },
  hcl: molecule(diatomic('H', 'Cl'), '纯氯化氢的分子由氢与氯相连。', '这不是氯化氢溶于水后的微粒图。'),
  dilute_hcl: aqueous([ion('水合氢离子', 1, HYDRONIUM), chloride()], '氯化氢在水中电离；氢离子不以裸露质子存在，这里用与一分子水结合的最简形式表示。', 1),
  h2so4: molecule(geometry(
    [['S', 0, 0], ['O', -48, -9], ['O', -24, 45], ['O', 0, -51], ['O', 51, 18], ['H', -83, -29], ['H', -61, 48]],
    [[0, 1, 'away'], [0, 2, 'towards'], [0, 3, 'double'], [0, 4, 'double'], [1, 5], [2, 6]],
  ), '纯硫酸的单个分子：硫周围有四个氧，其中两个氧各连一个氢，硫周围近似四面体。', '此图不表示稀硫酸中电离后的微粒。'),
  naoh: ionic(sodium(), hydroxide()),
  caoh2: ionic(calcium, hydroxide(2)),
  limewater: aqueous([calcium, hydroxide(2)], '只示意已经溶入水中的离子，未画未溶固体。'),
  nacl: ionic(sodium(), chloride()),
  na2co3: ionic(sodium(2), carbonate),
  caco3: calciumCarbonate,
  limestone: { ...calciumCarbonate, note: '只展示主要成分碳酸钙的离子比例；不代表整块石灰石（混合物）的结构。' },
  cuso4: ionic(copper, sulfate),
  cuso4_solution: aqueous([ion('水合铜离子', 2, 'Cu'), sulfate], '铜离子在水中被水分子包围，这里只画铜中心，省略配位水与水合层。'),
  kmno4: ionic(potassium(), ion('高锰酸根离子', -1, tetrahedral('Mn', 'O'))),
  // 按 NIST 的非平面 H—O—O—H 键连绘制，楔线/虚线区分朝向，位置为教学投影。
  h2o2: molecule(geometry([['H', -65, -46], ['O', -50, 12], ['O', 48, 12], ['H', 83, 33]],
    [[1, 0, 'away'], [1, 2], [2, 3, 'towards']]), '两个氧以单键相连，每个氧各连一个氢。分子是扭转的非平面结构。',
  '图只画过氧化氢分子，不表示双氧水溶液的全部微粒。'),
  ch4: molecule(tetrahedral('C', 'H'), '四个氢围绕碳朝正四面体的四个方向排列，不在同一平面。'),
  so2: molecule(bent('S', 'O', 119), '硫在中央，两个氧与它相连，分子呈折线形。'),
  fe3o4: {
    ...ionic(ironII, ironIII(2), oxide(4)),
    note: '按理想混合价离子模型表示亚铁、三价铁与氧离子比例，不展示晶胞、占位或电子分布。',
  },
  mgo: ionic(magnesium, oxide()),
  znso4: ionic(ion('锌离子', 2, 'Zn'), sulfate),
  feso4: ionic(ironII, sulfate),
  fecl2: ionic(ironII, chloride(2)),
  fecl3: ionic(ironIII(), chloride(3)),
  cucl2: ionic(copper, chloride(2)),
  cacl2: ionic(calcium, chloride(2)),
  h2co3: molecule(geometry(
    [['C', 0, 0], ['O', 0, -50], ['O', -43, 25], ['O', 43, 25], ['H', -77, 1], ['H', 77, 1]],
    [[0, 1, 'double'], [0, 2], [0, 3], [2, 4], [3, 5]],
  ), '碳与三个氧相连：一个氧与碳成双键，另外两个氧各连一个氢。'),
  cuoh2: ionic(copper, hydroxide(2)),
  na2so4: ionic(sodium(2), sulfate),
  k2mno4: ionic(potassium(2), ion('锰酸根离子', -2, tetrahedral('Mn', 'O'))),
  agno3: ionic(silver, nitrate()),
  agcl: ionic(silver, chloride()),
  nano3: ionic(sodium(), nitrate()),
  mgcl2: ionic(magnesium, chloride(2)),
  cuno32: ionic(copper, nitrate(2)),
  ag: metal('Ag', '银'),
} satisfies Record<string, SubstanceComposition>;
