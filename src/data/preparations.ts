export interface PreparationNote {
  kind: '实验室制取' | '工业制取' | '配制' | '分离提纯' | '天然来源' | '形成原理' | '生成示例';
  text: string;
  /** 只关联确实生成该物质的现有方程式；不把溶质的生成当成溶液的配制。 */
  productReactionId?: string;
}

/** P0 步骤四使用的课堂摘要。只讲来源与原理，不提供操作步骤、用量或工业工艺参数。 */
export const SUBSTANCE_PREPARATIONS: Readonly<Partial<Record<string, readonly PreparationNote[]>>> = {
  o2: [
    { kind: '实验室制取', text: '过氧化氢在二氧化锰催化下分解，生成水和氧气。', productReactionId: 'rxn_h2o2_decomp' },
    { kind: '实验室制取', text: '高锰酸钾受热分解，也能生成氧气。', productReactionId: 'rxn_kmno4_decomp' },
    { kind: '分离提纯', text: '工业上可利用液态空气中各组分沸点不同分离出氧气，属于物理变化。' },
  ],
  h2: [{ kind: '实验室制取', text: '锌与稀硫酸发生置换反应，生成氢气和硫酸锌。', productReactionId: 'rxn_zn_h2so4' }],
  c: [{ kind: '天然来源', text: '石墨可由天然石墨矿分选获得。木炭则是木材炭化得到的富碳材料，不等于纯石墨。' }],
  s: [{ kind: '工业制取', text: '工业上可从天然气、石油加工产生的含硫气流中回收单质硫。' }],
  fe: [{ kind: '工业制取', text: '高炉炼铁的原理之一是一氧化碳还原铁矿石中的氧化铁。高炉产物生铁是含碳合金，不是纯铁。', productReactionId: 'rxn_co_fe2o3' }],
  cu: [{ kind: '生成示例', text: '铁可从硫酸铜溶液中置换出铜，这是湿法炼铜的原理示例。', productReactionId: 'rxn_fe_cuso4' }],
  mg: [{ kind: '工业制取', text: '电解熔融氯化镁可得到金属镁。熔融盐不是氯化镁水溶液。' }],
  zn: [{ kind: '工业制取', text: '工业上可把含锌矿物转化成氧化锌，再将氧化锌还原得到金属锌。' }],
  h2o: [{ kind: '分离提纯', text: '蒸馏水由水蒸气冷凝获得。蒸馏只分离物质，不生成新的水分子，没有对应的化学方程式。' }],
  co2: [{ kind: '实验室制取', text: '石灰石或大理石中的碳酸钙与稀盐酸反应，放出二氧化碳。', productReactionId: 'rxn_caco3_hcl' }],
  co: [{ kind: '形成原理', text: '含碳燃料不完全燃烧时可能产生一氧化碳。它有毒，只了解形成原因，不作制取实验。' }],
  cao: [{ kind: '工业制取', text: '石灰石中的碳酸钙高温分解，生成生石灰和二氧化碳。', productReactionId: 'rxn_caco3_calcine' }],
  cuo: [{ kind: '生成示例', text: '铜在空气中受热氧化，表面可生成黑色的氧化铜。', productReactionId: 'rxn_cu_o2_heat' }],
  fe2o3: [{ kind: '天然来源', text: '赤铁矿富含三氧化二铁。矿石中的杂质和铁锈中的其他成分不能当作纯氧化铁。' }],
  mno2: [
    { kind: '天然来源', text: '二氧化锰是软锰矿的主要成分。' },
    { kind: '生成示例', text: '高锰酸钾分解可生成二氧化锰；所得固体还含锰酸钾，不是纯二氧化锰。', productReactionId: 'rxn_kmno4_decomp' },
  ],
  hcl: [{ kind: '工业制取', text: '氯化氢可从化工生产的副产气体中回收。它被水吸收形成盐酸，盐酸不是纯氯化氢。' }],
  dilute_hcl: [{ kind: '配制', text: '稀盐酸由盐酸经稀释得到。稀释只改变浓度，不是制取氯化氢的化学反应。' }],
  h2so4: [{ kind: '工业制取', text: '工业常用接触法，其核心是含硫原料的氧化与吸收转化。这不是学生制备实验。' }],
  naoh: [
    { kind: '工业制取', text: '氯碱工业通过电解食盐水生产氢氧化钠。' },
    { kind: '生成示例', text: '苛化反应也可生成氢氧化钠：碳酸钠与氢氧化钙反应，氢氧化钠留在溶液中。', productReactionId: 'rxn_na2co3_caoh2' },
  ],
  caoh2: [{ kind: '工业制取', text: '生石灰与水反应生成熟石灰，这一过程称为石灰熟化，会放热。', productReactionId: 'rxn_cao_h2o' }],
  limewater: [{ kind: '配制', text: '氢氧化钙微溶于水，所得澄清的水溶液是石灰水；含未溶固体的石灰乳不是澄清溶液。' }],
  nacl: [{ kind: '分离提纯', text: '海水或盐湖卤水经蒸发结晶可得到以氯化钠为主要成分的粗盐。蒸发结晶属于物理变化。' }],
  na2co3: [{ kind: '工业制取', text: '工业上可从天然碱矿提取碳酸钠，也可用氨碱法等工艺生产。' }],
  caco3: [{ kind: '生成示例', text: '二氧化碳与澄清石灰水中的氢氧化钙反应，可生成白色碳酸钙沉淀。', productReactionId: 'rxn_co2_caoh2' }],
  limestone: [{ kind: '天然来源', text: '石灰石是天然沉积岩，大理岩是变质岩，常见样品均以碳酸钙为主要成分。标本来自开采，不是把实验室的碳酸钙沉淀当作石灰石。' }],
  cuso4: [{ kind: '生成示例', text: '五水硫酸铜失去结晶水，可得到无水硫酸铜。生成硫酸铜溶液并不等于得到无水固体。' }],
  cuso4_solution: [{ kind: '配制', text: '硫酸铜溶于水形成蓝色溶液。这里学习的是溶液，不能把它当作无水硫酸铜固体。' }],
  kmno4: [{ kind: '工业制取', text: '工业上可将锰酸钾氧化为高锰酸钾。高锰酸钾分解制氧是它的用途，不是它的制法。' }],
  h2o2: [{ kind: '工业制取', text: '工业通常用蒽醌法生产过氧化氢；双氧水是它的水溶液。过氧化氢分解制氧时被消耗，而不是被制得。' }],
  ch4: [{ kind: '天然来源', text: '甲烷是天然气和沼气的主要成分，可由含甲烷的气体混合物分离提纯。' }],
  so2: [{ kind: '形成原理', text: '硫被氧化时可以生成二氧化硫。含硫燃料燃烧也可能排放这种有害气体，本卡片不作制取指导。', productReactionId: 'rxn_s_o2_burn' }],
  fe3o4: [{ kind: '生成示例', text: '铁在氧气中燃烧可生成四氧化三铁。天然磁铁矿的主要成分也是四氧化三铁。', productReactionId: 'rxn_fe_o2_burn' }],
  mgo: [{ kind: '生成示例', text: '镁与氧气反应可生成氧化镁；教材常用方程式表示镁条燃烧时的主要反应。', productReactionId: 'rxn_mg_o2_burn' }],
  znso4: [{ kind: '生成示例', text: '锌与硫酸铜溶液发生置换反应，生成硫酸锌溶液。', productReactionId: 'rxn_zn_cuso4' }],
  feso4: [{ kind: '生成示例', text: '铁置换出硫酸铜溶液中的铜，溶液中生成硫酸亚铁。', productReactionId: 'rxn_fe_cuso4' }],
  fecl2: [{ kind: '生成示例', text: '铁与稀盐酸反应，在溶液中生成氯化亚铁，不是氯化铁。', productReactionId: 'rxn_fe_hcl' }],
  fecl3: [{ kind: '生成示例', text: '氧化铁与稀盐酸反应，生成氯化铁溶液和水。', productReactionId: 'rxn_fe2o3_hcl' }],
  cucl2: [{ kind: '生成示例', text: '氧化铜与稀盐酸反应，生成氯化铜溶液和水。', productReactionId: 'rxn_cuo_hcl' }],
  cacl2: [{ kind: '生成示例', text: '碳酸钙与稀盐酸反应时，氯化钙留在溶液中，同时放出二氧化碳。', productReactionId: 'rxn_caco3_hcl' }],
  h2co3: [{ kind: '形成原理', text: '溶于水的二氧化碳中只有一小部分与水反应生成碳酸。这是可逆变化，方程式按初中教材的简式展示。', productReactionId: 'rxn_co2_h2o' }],
  cuoh2: [{ kind: '生成示例', text: '硫酸铜溶液与氢氧化钠溶液反应，生成蓝色氢氧化铜沉淀。', productReactionId: 'rxn_naoh_cuso4' }],
  na2so4: [{ kind: '生成示例', text: '氢氧化钠与稀硫酸中和，生成硫酸钠溶液和水。', productReactionId: 'rxn_naoh_h2so4' }],
  k2mno4: [{ kind: '生成示例', text: '高锰酸钾受热分解后，残余固体含锰酸钾和二氧化锰，不是纯锰酸钾。', productReactionId: 'rxn_kmno4_decomp' }],
  agno3: [{ kind: '工业制取', text: '专业生产将银转化为硝酸银，再从溶液中结晶取得产品。制备涉及腐蚀性试剂和有害气体，不作学生实验。' }],
  agcl: [{ kind: '生成示例', text: '硝酸银溶液与氯化钠溶液反应，可得到白色氯化银沉淀。', productReactionId: 'rxn_nacl_agno3' }],
  nano3: [{ kind: '生成示例', text: '氯化钠溶液与硝酸银溶液反应时，氯化银沉淀，硝酸钠留在溶液中。', productReactionId: 'rxn_nacl_agno3' }],
  mgcl2: [{ kind: '生成示例', text: '镁与稀盐酸反应生成氯化镁溶液。工业上也可从卤水中提取氯化镁。', productReactionId: 'rxn_mg_hcl' }],
  cuno32: [{ kind: '生成示例', text: '铜与硝酸银溶液发生置换反应，溶液中生成硝酸铜。', productReactionId: 'rxn_cu_agno3' }],
  ag: [{ kind: '生成示例', text: '铜能从硝酸银溶液中置换出银，这是比较金属活动性的反应示例。', productReactionId: 'rxn_cu_agno3' }],
};
