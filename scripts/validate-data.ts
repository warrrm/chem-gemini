import { ALL_QUIZZES, INQUIRY_QUESTIONS, MCQ_QUESTIONS } from '../src/data/quizzes';
import { REACTIONS } from '../src/data/reactions';
import { ALL_SUBSTANCES, SUBSTANCES, SUBSTANCE_BY_ID } from '../src/data/substances';
import { parseChemicalFormula } from '../src/modules/formula/parser';
import { computeElementMassRatio } from '../src/modules/knowledge/massRatio';
import { getElementValenceClue } from '../src/modules/knowledge/formulaClues';
import { getCalculationQuestions, gradeCalculationAnswer } from '../src/modules/quiz/calculations';

const errors: string[] = [];

function fail(msg: string) {
  errors.push(msg);
}

if (SUBSTANCES.length < 25) {
  fail(`Core SUBSTANCES count must be >= 25, got ${SUBSTANCES.length}`);
}

for (const sub of ALL_SUBSTANCES) {
  const parsed = parseChemicalFormula(sub.formula);
  if (!parsed.ok) {
    fail(`Substance [${sub.id}] has invalid formula: ${sub.formula}`);
    continue;
  }

  const expectedMassRatio = computeElementMassRatio(sub.formula);
  if (expectedMassRatio === null) {
    if (sub.massRatio !== null) {
      fail(`Single-element substance [${sub.id}] must have massRatio = null`);
    }
  } else {
    if (!sub.massRatio || sub.massRatio.length !== expectedMassRatio.length) {
      fail(`Substance [${sub.id}] massRatio length mismatch`);
    } else {
      for (let i = 0; i < expectedMassRatio.length; i++) {
        const exp = expectedMassRatio[i];
        const actual = sub.massRatio.find((m) => m.symbol === exp.symbol);
        if (!actual || actual.ratioValue !== exp.ratioValue) {
          fail(
            `Substance [${sub.id}] massRatio mismatch for ${exp.symbol}: expected ${exp.ratioValue}, got ${actual?.ratioValue}`
          );
        }
      }
    }
  }

  if (sub.formula.length >= 2) {
    for (const hint of sub.hints) {
      if (hint.includes(sub.formula)) {
        fail(`Spoiler leak in substance [${sub.id}] hint: contains "${sub.formula}"`);
      }
    }
    if (sub.composition.unitDescription.includes(sub.formula)) {
      fail(`Spoiler leak in substance [${sub.id}] unitDescription: contains "${sub.formula}"`);
    }
  }
}

const reactionIdsSet = new Set<string>();
const GAS_IDS = new Set(['o2', 'h2', 'co2', 'co', 'so2', 'ch4']);
const PRECIPITATE_IDS = new Set(['caco3', 'cuoh2', 'agcl']);

for (const rxn of REACTIONS) {
  if (reactionIdsSet.has(rxn.id)) {
    fail(`Duplicate reaction ID: ${rxn.id}`);
  }
  reactionIdsSet.add(rxn.id);

  const leftAtoms: Record<string, number> = {};
  const rightAtoms: Record<string, number> = {};

  for (const r of rxn.reactants) {
    const sub = SUBSTANCE_BY_ID.get(r.substanceId);
    if (!sub) {
      fail(`Reaction [${rxn.id}] references unknown reactant substanceId: ${r.substanceId}`);
      continue;
    }
    const parsed = parseChemicalFormula(sub.formula);
    if (!parsed.ok) continue;
    for (const [el, cnt] of Object.entries(parsed.counts)) {
      leftAtoms[el] = (leftAtoms[el] ?? 0) + cnt * r.coef;
    }
  }

  for (const p of rxn.products) {
    const sub = SUBSTANCE_BY_ID.get(p.substanceId);
    if (!sub) {
      fail(`Reaction [${rxn.id}] references unknown product substanceId: ${p.substanceId}`);
      continue;
    }
    const parsed = parseChemicalFormula(sub.formula);
    if (!parsed.ok) continue;
    for (const [el, cnt] of Object.entries(parsed.counts)) {
      rightAtoms[el] = (rightAtoms[el] ?? 0) + cnt * p.coef;
    }
  }

  const allElements = new Set([...Object.keys(leftAtoms), ...Object.keys(rightAtoms)]);
  for (const el of allElements) {
    const l = leftAtoms[el] ?? 0;
    const r = rightAtoms[el] ?? 0;
    if (l !== r) {
      fail(`Reaction [${rxn.id}] violates atom conservation for element ${el}: left=${l}, right=${r}`);
    }
  }

  if (rxn.condition !== '常温' && rxn.phenomenon.includes('常温下')) {
    fail(
      `Reaction [${rxn.id}] has condition "${rxn.condition}" but phenomenon mentions "常温下"`
    );
  }

  const reactantHasGas = rxn.reactants.some((r) => GAS_IDS.has(r.substanceId));
  for (const p of rxn.products) {
    if (p.mark === '↑') {
      if (!GAS_IDS.has(p.substanceId)) {
        fail(`Reaction [${rxn.id}] puts ↑ on non-gas product ${p.substanceId}`);
      }
      if (reactantHasGas) {
        fail(`Reaction [${rxn.id}] puts ↑ on ${p.substanceId} even though reactants already contain gas`);
      }
    }
    if (p.mark === '↓') {
      if (!PRECIPITATE_IDS.has(p.substanceId)) {
        fail(`Reaction [${rxn.id}] puts ↓ on non-precipitate product ${p.substanceId}`);
      }
    }
  }
}

const BANNED_SAFETY_PHRASES = ['品尝', '直接闻', '凑近闻'];

for (const sub of SUBSTANCES) {
  const count = MCQ_QUESTIONS.filter((q) => q.substanceId === sub.id).length;
  if (count < 2) {
    fail(`Core substance [${sub.id}] has only ${count} MCQ(s), requires >= 2`);
  }
}

for (const q of ALL_QUIZZES) {
  if (!SUBSTANCE_BY_ID.has(q.substanceId)) {
    fail(`Quiz [${q.id}] references unknown substanceId: ${q.substanceId}`);
  }
  for (const rxnId of q.reactionIds) {
    if (!reactionIdsSet.has(rxnId)) {
      fail(`Quiz [${q.id}] references unknown reactionId: ${rxnId}`);
    }
  }

  if (q.type === 'mcq') {
    if (q.options.length !== 4) {
      fail(`MCQ [${q.id}] must have exactly 4 options`);
    }
    const distinctOptions = new Set(q.options.map((o) => o.trim()));
    if (distinctOptions.size !== 4) {
      fail(`MCQ [${q.id}] has duplicate options`);
    }
    if (q.correctIndex < 0 || q.correctIndex > 3) {
      fail(`MCQ [${q.id}] has invalid correctIndex: ${q.correctIndex}`);
    }
    if (q.optionExplanations.length !== 4 || q.optionExplanations.some((e) => !e.trim())) {
      fail(`MCQ [${q.id}] must have 4 non-empty optionExplanations`);
    }

    const fullText = [q.stem, ...q.options, ...q.optionExplanations].join(' ');
    for (const banned of BANNED_SAFETY_PHRASES) {
      if (fullText.includes(banned)) {
        fail(`MCQ [${q.id}] contains banned unsafe phrase: "${banned}"`);
      }
    }
  } else if (q.type === 'inquiry') {
    if (q.subQuestions.length < 1 || q.subQuestions.length > 3) {
      fail(`Inquiry [${q.id}] must have 1-3 subQuestions, got ${q.subQuestions.length}`);
    }
    const fullText = [
      q.title,
      q.scenario,
      q.reagentsAndApparatus,
      ...q.subQuestions.flatMap((sq) => [sq.prompt, sq.referenceAnswer, sq.explanation]),
    ].join(' ');
    for (const banned of BANNED_SAFETY_PHRASES) {
      if (fullText.includes(banned)) {
        fail(`Inquiry [${q.id}] contains banned unsafe phrase: "${banned}"`);
      }
    }
  }
}

let calculationCount = 0;
for (const sub of ALL_SUBSTANCES) {
  try {
    const clue = getElementValenceClue(sub);
    const parsed = parseChemicalFormula(sub.formula);
    if (parsed.ok && clue.elements.every(element => element.valences.length === 1)) {
      const total = clue.elements.reduce((sum, element) => sum + element.valences[0] * parsed.counts[element.symbol], 0);
      if (total !== 0) fail(`物质 [${sub.id}] 的化合价不满足代数和为零`);
    }
    const calculations = getCalculationQuestions(sub, '通用版');
    calculationCount += calculations.length;
    if (!calculations.length) fail(`物质 [${sub.id}] 未生成计算题`);
    for (const question of calculations) {
      if (!Number.isFinite(question.answer) || question.answer <= 0) fail(`计算题 [${question.id}] 答案无效`);
      if (!gradeCalculationAnswer(String(question.answer), question).correct) fail(`计算题 [${question.id}] 无法校验标准答案`);
      if (!question.steps.length || !question.atomicMasses) fail(`计算题 [${question.id}] 缺少解题过程或原子质量依据`);
      if (question.reactionIds.some(id => !reactionIdsSet.has(id))) fail(`计算题 [${question.id}] 引用未知反应`);
    }
  } catch (error) {
    fail(`物质 [${sub.id}] 的线索或计算题无效：${error instanceof Error ? error.message : '未知错误'}`);
  }
}

if (errors.length > 0) {
  console.error('Data validation failed with the following errors:');
  for (const err of errors) {
    console.error(`  - ${err}`);
  }
  throw new Error(`Data validation failed with ${errors.length} error(s).`);
}

console.log(
  `Data validation passed! (${SUBSTANCES.length} core substances, ${ALL_SUBSTANCES.length} total substances, ${REACTIONS.length} reactions, ${MCQ_QUESTIONS.length} MCQs, ${INQUIRY_QUESTIONS.length} inquiry questions, ${calculationCount} generated calculation templates)`
);
