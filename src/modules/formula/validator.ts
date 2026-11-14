import { SubstanceEntry } from '../../types/chemistry';
import {
  ElementCountMap,
  normalizeSubscripts,
  parseChemicalFormula,
  tryParseCaseInsensitive,
} from './parser';

export type ValidationErrorCode =
  | 'INVALID_SYNTAX'
  | 'CASE_ERROR'
  | 'WRONG_ELEMENTS'
  | 'WRONG_COUNTS'
  | 'NON_STANDARD_FORM';

export interface FormulaValidationResult {
  valid: boolean;
  errorCode?: ValidationErrorCode;
  feedback: string;
}

function mapsHaveSameElementKeys(a: ElementCountMap, b: ElementCountMap): boolean {
  const keysA = Object.keys(a).sort();
  const keysB = Object.keys(b).sort();
  if (keysA.length !== keysB.length) return false;
  return keysA.every((k, i) => k === keysB[i]);
}

function mapsEqual(a: ElementCountMap, b: ElementCountMap): boolean {
  if (!mapsHaveSameElementKeys(a, b)) return false;
  return Object.keys(a).every((k) => a[k] === b[k]);
}

/**
 * 化学式分级校验器（严格遵循开发任务书第 5 节规格）：
 * 1. 先检查是否与目标化学式或其 acceptedForms 完全一致（区分大小写、书写顺序）。
 * 2. 若不一致，按以下优先级检查错误分支，每次只返回一条明确指导：
 *    - 非法字符或无法解析 -> 提示检查输入
 *    - 元素符号大小写错误 -> 提示大小写规范
 *    - 元素种类不对 -> 提示再想想由哪几种元素组成
 *    - 元素对但原子个数比不对 -> 提示检查各元素原子个数比
 *    - 原子个数对但写法不规范 -> 提示书写顺序/括号写法
 */
export function validateUserFormula(
  userInput: string,
  targetSubstance: Pick<SubstanceEntry, 'formula' | 'acceptedForms'>
): FormulaValidationResult {
  const normalized = normalizeSubscripts(userInput);

  if (!normalized) {
    return {
      valid: false,
      errorCode: 'INVALID_SYNTAX',
      feedback: '请输入化学式后再提交（可直接使用键盘输入数字，会自动转为下标）。',
    };
  }

  const validTargets = new Set<string>([
    normalizeSubscripts(targetSubstance.formula),
    ...targetSubstance.acceptedForms.map((f) => normalizeSubscripts(f)),
  ]);

  // 1. Exact match check (case-sensitive & order-sensitive)
  if (validTargets.has(normalized)) {
    return {
      valid: true,
      feedback: '回答正确！已解锁该物质的知识卡片、相关反应方程式和随堂练习。',
    };
  }

  const targetParsed = parseChemicalFormula(targetSubstance.formula);
  if (!targetParsed.ok) {
    throw new Error(`Invalid target formula in knowledge base: ${targetSubstance.formula}`);
  }
  const targetCounts = targetParsed.counts;

  // 2. Try strict case-sensitive parse
  const strictParsed = parseChemicalFormula(normalized);

  if (!strictParsed.ok) {
    // Check if it fails specifically due to element capitalization (e.g. cao, CAO, h2o, caco3, naoh)
    const caseInsensitiveCounts = tryParseCaseInsensitive(normalized);
    if (caseInsensitiveCounts !== null) {
      return {
        valid: false,
        errorCode: 'CASE_ERROR',
        feedback:
          '元素符号大小写不规范！请检查：单字母元素符号必须大写（如 H、O、C），双字母元素符号第一个字母大写、第二个字母小写（如 Ca、Cl、Na、Cu）。',
      };
    }

    return {
      valid: false,
      errorCode: 'INVALID_SYNTAX',
      feedback:
        '输入包含非法字符或格式无法解析，请检查元素符号、下标数字和括号是否完整（不要在最前面写系数）。',
    };
  }

  const userCounts = strictParsed.counts;

  // 3. Check if element types match
  if (!mapsHaveSameElementKeys(userCounts, targetCounts)) {
    return {
      valid: false,
      errorCode: 'WRONG_ELEMENTS',
      feedback: '元素种类不对，再想想该物质由哪几种元素组成（可查看上方线索或点击“查看提示”）。',
    };
  }

  // 4. Check if atom counts match
  if (!mapsEqual(userCounts, targetCounts)) {
    return {
      valid: false,
      errorCode: 'WRONG_COUNTS',
      feedback: '元素种类对了，但各元素的原子个数（或个数比）不对，请结合上方线索检查角标或括号。',
    };
  }

  // 5. Atom counts match, but order or parentheses differ from accepted forms (e.g., ClH, CuO2H2, O2C)
  return {
    valid: false,
    errorCode: 'NON_STANDARD_FORM',
    feedback:
      '各元素原子个数都对了！但书写顺序或括号写法不规范（金属/氢元素通常写在前面，氧元素写在后面，多个原子团需加括号）。',
  };
}
