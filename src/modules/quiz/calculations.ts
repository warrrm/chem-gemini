import { REACTIONS } from '../../data/reactions';
import { SUBSTANCE_BY_ID } from '../../data/substances';
import { CalculationQuestion, SubstanceEntry, TextbookEdition } from '../../types/chemistry';
import { formatFormulaPreview, parseChemicalFormula } from '../formula/parser';
import { ELEMENT_CHINESE_NAMES, RELATIVE_ATOMIC_MASS } from '../knowledge/massRatio';
import { buildPlainEquationText } from '../reactions';

const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export function getFormulaMass(formula: string): number {
  const parsed = parseChemicalFormula(formula);
  if (!parsed.ok) throw new Error('计算题的化学式无效。');
  return Object.entries(parsed.counts).reduce((sum, [symbol, count]) => {
    const mass = RELATIVE_ATOMIC_MASS[symbol];
    if (!mass) throw new Error(`未配置元素 ${symbol} 的相对原子质量。`);
    return sum + mass * count;
  }, 0);
}

function atomicMassText(formulas: string[]): string {
  const symbols = new Set<string>();
  formulas.forEach(formula => {
    const parsed = parseChemicalFormula(formula);
    if (!parsed.ok) throw new Error('计算题化学式无效。');
    Object.keys(parsed.counts).forEach(symbol => symbols.add(symbol));
  });
  return [...symbols].map(symbol => `${symbol}=${RELATIVE_ATOMIC_MASS[symbol]}`).join('，');
}

function pureTarget(substance: SubstanceEntry): SubstanceEntry {
  return substance.mainComponentId ? SUBSTANCE_BY_ID.get(substance.mainComponentId) ?? substance : substance;
}

function massLabel(substance: SubstanceEntry): string {
  return substance.kind === 'pure' ? substance.name : `${substance.mainComponentName ?? '主要成分'}（只计${substance.kind === 'solution' ? '溶质' : '主要成分'}）`;
}

/** 使用本地化学式、相对原子质量与配平方程式出题，不让模型编造数值或答案。 */
export function getCalculationQuestions(substance: SubstanceEntry, edition: TextbookEdition): CalculationQuestion[] {
  if (!substance.editions.includes(edition)) return [];
  const target = pureTarget(substance);
  const parsed = parseChemicalFormula(target.formula);
  if (!parsed.ok) throw new Error('计算题的目标化学式无效。');
  const entries = Object.entries(parsed.counts);
  const formulaMass = getFormulaMass(target.formula);
  const display = formatFormulaPreview(target.formula);
  const scopeNote = substance.kind === 'pure' ? ''
    : ` 本题只计算${substance.kind === 'solution' ? '溶质' : '主要成分'}${substance.mainComponentName}，不把整份${substance.kind === 'solution' ? '溶液' : '混合物'}当作纯净物。`;
  const massName = target.composition.structureType === 'molecule' ? '相对分子质量'
    : entries.length === 1 ? '相对原子质量' : '相对式量';
  const base = { type: 'calculation' as const, substanceId: substance.id, atomicMasses: atomicMassText([target.formula]), reactionIds: [] as string[] };
  const massTerms = entries.map(([symbol, count]) => `${RELATIVE_ATOMIC_MASS[symbol]}×${count}`).join(' + ');
  const questions: CalculationQuestion[] = [{
    ...base, id: `calc-${substance.id}-relative-mass`, kind: 'relative_mass', title: massName,
    stem: `根据化学式 ${display}，计算${target.name}的${massName}。${scopeNote}`,
    unit: '', answer: formulaMass, decimalPlaces: Number.isInteger(formulaMass) ? 0 : 1,
    steps: [
      `从化学式统计原子个数：${entries.map(([symbol, count]) => `${symbol} 为 ${count}`).join('，')}。`,
      `${massName} = ${massTerms} = ${formulaMass}。`,
      '相对质量是比值，没有单位，不能写成克。',
    ],
  }];

  if (entries.length > 1) {
    const [symbol, count] = entries[0];
    const elementMass = RELATIVE_ATOMIC_MASS[symbol] * count;
    const name = ELEMENT_CHINESE_NAMES[symbol];
    const fraction = round2(elementMass / formulaMass * 100);
    const sampleMass = round2(formulaMass / 5);
    const containedMass = round2(elementMass / 5);
    questions.push({
      ...base, id: `calc-${substance.id}-mass-fraction`, kind: 'mass_fraction', title: '元素质量分数',
      stem: `计算${target.name}（${display}）中${name}元素的质量分数，以百分数作答，结果可保留两位小数。${scopeNote}`,
      unit: '%', answer: fraction, decimalPlaces: 2,
      steps: [
        `相对质量 = ${massTerms} = ${formulaMass}。`,
        `${name}元素对应的相对质量为 ${RELATIVE_ATOMIC_MASS[symbol]}×${count} = ${elementMass}。`,
        `${name}元素的质量分数 = ${elementMass}÷${formulaMass}×100% ≈ ${fraction.toFixed(2)}%。`,
      ],
    }, {
      ...base, id: `calc-${substance.id}-element-mass`, kind: 'element_mass', title: '样品中的元素质量',
      stem: `已知纯${target.name}（${display}）的质量为 ${sampleMass} g，求其中${name}元素的质量，结果可保留两位小数。${scopeNote}`,
      unit: 'g', answer: containedMass, decimalPlaces: 2,
      steps: [
        `相对质量 = ${massTerms} = ${formulaMass}。`,
        `${name}元素的质量分数 = ${elementMass}÷${formulaMass}（计算时保留这个比值，不先四舍五入）。`,
        `${name}元素质量 = ${sampleMass}×${elementMass}÷${formulaMass} = ${containedMass.toFixed(2)} g。`,
      ],
    });
  }

  const reaction = REACTIONS.filter(r => r.editions.includes(edition) && [...r.reactants, ...r.products]
    .some(p => p.substanceId === substance.id || p.substanceId === target.id)).sort((a, b) => a.priority - b.priority)[0];
  if (reaction) {
    const participants = [...reaction.reactants, ...reaction.products];
    const known = participants.find(p => p.substanceId === substance.id || p.substanceId === target.id)!;
    const other = participants.find(p => p.substanceId !== known.substanceId && pureTarget(SUBSTANCE_BY_ID.get(p.substanceId)!).id !== target.id);
    if (other) {
      const knownSub = SUBSTANCE_BY_ID.get(known.substanceId)!;
      const otherSub = SUBSTANCE_BY_ID.get(other.substanceId)!;
      const knownWeight = getFormulaMass(knownSub.formula) * known.coef;
      const otherWeight = getFormulaMass(otherSub.formula) * other.coef;
      const givenMass = round2(knownWeight / 10);
      const answer = round2(otherWeight / 10);
      const equation = buildPlainEquationText(reaction);
      questions.push({
        ...base, id: `calc-${substance.id}-reaction-mass`, kind: 'reaction_mass', title: '根据化学方程式计算',
        stem: `在下列反应中，参与反应或生成的${massLabel(knownSub)}的质量为 ${givenMass} g，求对应${massLabel(otherSub)}的质量。其他反应物足量、反应完全，忽略损耗，结果可保留两位小数。所有质量只指纯物质或其中的溶质、主要成分，不指整份溶液或混合物。`,
        atomicMasses: atomicMassText([knownSub.formula, otherSub.formula]),
        reactionIds: [reaction.id], equation: `${equation}（条件：${reaction.condition}）`,
        unit: 'g', answer, decimalPlaces: 2,
        steps: [
          `使用已配平的反应方程式：${equation}。`,
          `对应质量比 = 化学计量数×相对质量之比 = ${knownWeight} : ${otherWeight}。`,
          `设所求质量为 x，则 ${givenMass} : x = ${knownWeight} : ${otherWeight}。`,
          `x = ${givenMass}×${otherWeight}÷${knownWeight} = ${answer.toFixed(2)} g。`,
        ],
      });
      // 单原子单质优先给出有实际运算的反应计算题，避免只照抄相对原子质量。
      if (entries.length === 1 && target.composition.structureType !== 'molecule') questions.unshift(questions.pop()!);
    }
  }
  return questions;
}

export function gradeCalculationAnswer(raw: string, question: CalculationQuestion): { inputValid: boolean; correct: boolean; feedback: string } {
  const normalized = raw.normalize('NFKC').trim();
  const match = normalized.length <= 80 ? normalized.match(/^([+]?(?:\d+(?:\.\d*)?|\.\d+))\s*(%|g|克)?$/i) : null;
  if (!match) return { inputValid: false, correct: false, feedback: '请输入非负数值，不要填写算式或无关文字。' };
  const number = Number(match[1]);
  const unit = match[2]?.toLowerCase();
  if (!Number.isFinite(number) || (unit && (unit === '克' ? 'g' : unit) !== question.unit)) {
    return { inputValid: false, correct: false, feedback: question.unit ? `请填写数值，单位应为 ${question.unit}。` : '相对质量没有单位，请只填写数值。' };
  }
  const tolerance = question.kind === 'relative_mass' ? 1e-8 : 0.005 - 1e-10;
  const correct = Math.abs(number - question.answer) <= tolerance;
  return { inputValid: true, correct, feedback: correct ? '计算正确！' : '计算结果有误，请结合计算过程检查相对质量、比例关系和单位。' };
}
