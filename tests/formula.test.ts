import { describe, expect, it } from 'vitest';
import { SUBSTANCE_BY_ID } from '../src/data/substances';
import { formatFormulaPreview, parseChemicalFormula } from '../src/modules/formula/parser';
import { validateUserFormula } from '../src/modules/formula/validator';
import { computeElementMassRatio, formatMassRatioText } from '../src/modules/knowledge/massRatio';
import {
  INITIAL_LEARNING_STATE,
  isStepUnlocked,
  learningReducer,
} from '../src/state/learningMachine';

describe('Chemical Formula Parser & Preview Formatter', () => {
  it('parses simple, multi-element, and nested parenthesis formulas accurately', () => {
    const h2o = parseChemicalFormula('H2O');
    expect(h2o).toEqual({ ok: true, counts: { H: 2, O: 1 } });

    const caoh2 = parseChemicalFormula('Ca(OH)2');
    expect(caoh2).toEqual({ ok: true, counts: { Ca: 1, O: 2, H: 2 } });

    const al2so43 = parseChemicalFormula('Al2(SO4)3');
    expect(al2so43).toEqual({ ok: true, counts: { Al: 2, S: 3, O: 12 } });
  });

  it('formats ASCII digits into subscript Unicode characters for live preview', () => {
    expect(formatFormulaPreview('CaCO3')).toBe('CaCO₃');
    expect(formatFormulaPreview('Ca(OH)2')).toBe('Ca(OH)₂');
    expect(formatFormulaPreview('H2SO4')).toBe('H₂SO₄');
  });
});

describe('Chemical Formula Validator Error Branches (Section 5)', () => {
  const caco3 = SUBSTANCE_BY_ID.get('caco3')!;
  const caoh2 = SUBSTANCE_BY_ID.get('caoh2')!;
  const hcl = SUBSTANCE_BY_ID.get('hcl')!;

  it('accepts exact valid formulas including Unicode subscripts', () => {
    expect(validateUserFormula('CaCO3', caco3).valid).toBe(true);
    expect(validateUserFormula('CaCO₃', caco3).valid).toBe(true);
    expect(validateUserFormula('Ca(OH)2', caoh2).valid).toBe(true);
  });

  it('detects INVALID_SYNTAX on empty, illegal characters, or unmatched parens', () => {
    expect(validateUserFormula('', caco3).errorCode).toBe('INVALID_SYNTAX');
    expect(validateUserFormula('CaCO3!', caco3).errorCode).toBe('INVALID_SYNTAX');
    expect(validateUserFormula('Ca(OH2', caoh2).errorCode).toBe('INVALID_SYNTAX');
  });

  it('detects CASE_ERROR on wrong element capitalization', () => {
    expect(validateUserFormula('caco3', caco3).errorCode).toBe('CASE_ERROR');
    expect(validateUserFormula('CACO3', caco3).errorCode).toBe('CASE_ERROR');
    expect(validateUserFormula('hcl', hcl).errorCode).toBe('CASE_ERROR');
  });

  it('detects WRONG_ELEMENTS when element types do not match', () => {
    expect(validateUserFormula('Na2CO3', caco3).errorCode).toBe('WRONG_ELEMENTS');
    expect(validateUserFormula('CaO', caco3).errorCode).toBe('WRONG_ELEMENTS');
  });

  it('detects WRONG_COUNTS when elements match but atom counts differ', () => {
    expect(validateUserFormula('CaCO2', caco3).errorCode).toBe('WRONG_COUNTS');
    expect(validateUserFormula('Ca(OH)3', caoh2).errorCode).toBe('WRONG_COUNTS');
  });

  it('detects NON_STANDARD_FORM when atom counts match but order/parentheses are non-standard', () => {
    expect(validateUserFormula('ClH', hcl).errorCode).toBe('NON_STANDARD_FORM');
    expect(validateUserFormula('CaO2H2', caoh2).errorCode).toBe('NON_STANDARD_FORM');
    expect(validateUserFormula('O3CCa', caco3).errorCode).toBe('NON_STANDARD_FORM');
  });
});

describe('Mass Ratio Calculator', () => {
  it('returns null for single-element substances', () => {
    expect(computeElementMassRatio('O2')).toBeNull();
    expect(computeElementMassRatio('Fe')).toBeNull();
  });

  it('computes simplified integer mass ratios for compounds', () => {
    const h2oRatio = computeElementMassRatio('H2O')!;
    expect(formatMassRatioText(h2oRatio)).toBe('m(H) : m(O) = 1 : 8');

    const caco3Ratio = computeElementMassRatio('CaCO3')!;
    expect(formatMassRatioText(caco3Ratio)).toBe('m(Ca) : m(C) : m(O) = 10 : 3 : 12');
  });
});

describe('Learning State Machine & Step Guards', () => {
  it('locks steps 4-6 until formulaVerified[substanceId] === true and clears unlock on substance change', () => {
    let state = learningReducer(INITIAL_LEARNING_STATE, {
      type: 'START_RECOGNIZING',
      sourceType: 'sample',
      sampleId: 'sample_naoh',
    });
    state = learningReducer(state, {
      type: 'RECOGNITION_DONE',
      result: { status: 'ok', candidates: [{ substanceId: 'naoh' }] },
    });
    state = learningReducer(state, {
      type: 'CONFIRM_SUBSTANCE',
      substanceId: 'naoh',
    });

    expect(state.currentStep).toBe(3);
    expect(isStepUnlocked(state, 4)).toBe(false);
    expect(isStepUnlocked(state, 5)).toBe(false);
    expect(isStepUnlocked(state, 6)).toBe(false);

    state = learningReducer(state, { type: 'NAVIGATE_STEP', step: 4 });
    expect(state.currentStep).toBe(3);
    expect(state.guardNotice).toContain('先完成化学式书写');

    state = learningReducer(state, {
      type: 'FORMULA_VERIFIED_SUCCESS',
      substanceId: 'naoh',
    });
    expect(state.currentStep).toBe(4);
    expect(isStepUnlocked(state, 4)).toBe(true);
    expect(isStepUnlocked(state, 5)).toBe(true);
    expect(isStepUnlocked(state, 6)).toBe(true);

    state = learningReducer(state, {
      type: 'CONFIRM_SUBSTANCE',
      substanceId: 'fe',
    });
    expect(state.currentStep).toBe(3);
    expect(isStepUnlocked(state, 4)).toBe(false);
  });
});
