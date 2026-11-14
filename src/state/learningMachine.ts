import {
  LearningStep,
  RecognitionResult,
  SampleHotspot,
  SystemStatus,
  TextbookEdition,
} from '../types/chemistry';

export interface LearningState {
  edition: TextbookEdition;
  currentStep: LearningStep;
  systemStatus: SystemStatus;
  statusMessage: string | null;
  guardNotice: string | null;

  /** 当前图片来源信息 */
  imageSourceType: 'none' | 'sample' | 'upload' | 'camera';
  activeSampleId: string | null;
  uploadedImageUrl: string | null;
  uploadedFileName: string | null;

  /** 识别阶段 */
  recognitionResult: RecognitionResult | null;
  selectedHotspotId: string | null;
  apparatusNotice: string | null;

  /** 确认物质阶段 */
  confirmedSubstanceId: string | null;

  /** 化学式书写与解锁记录（按 substanceId 隔离） */
  formulaVerified: Record<string, boolean>;
}

export const INITIAL_LEARNING_STATE: LearningState = {
  edition: '通用版',
  currentStep: 1,
  systemStatus: 'idle',
  statusMessage: null,
  guardNotice: null,
  imageSourceType: 'none',
  activeSampleId: null,
  uploadedImageUrl: null,
  uploadedFileName: null,
  recognitionResult: null,
  selectedHotspotId: null,
  apparatusNotice: null,
  confirmedSubstanceId: null,
  formulaVerified: {},
};

export type LearningAction =
  | { type: 'SET_EDITION'; edition: TextbookEdition }
  | { type: 'START_UPLOADING' }
  | { type: 'START_RECOGNIZING'; sourceType: 'sample' | 'upload' | 'camera'; sampleId?: string; imageUrl?: string; fileName?: string }
  | { type: 'RECOGNITION_DONE'; result: RecognitionResult }
  | { type: 'SET_ERROR_STATUS'; status: SystemStatus; message: string }
  | { type: 'SELECT_HOTSPOT'; hotspot: SampleHotspot }
  | { type: 'CONFIRM_SUBSTANCE'; substanceId: string }
  | { type: 'FORMULA_VERIFIED_SUCCESS'; substanceId: string }
  | { type: 'NAVIGATE_STEP'; step: LearningStep }
  | { type: 'CLEAR_GUARD_NOTICE' }
  | { type: 'RESET_ALL' };

export function isStepUnlocked(state: LearningState, step: LearningStep): boolean {
  if (step === 1) return true;
  if (step === 2) {
    return state.imageSourceType !== 'none' || state.recognitionResult !== null;
  }
  if (step === 3) {
    return Boolean(state.confirmedSubstanceId);
  }
  // Steps 4, 5, 6 strictly require formulaVerified[confirmedSubstanceId] === true
  if (!state.confirmedSubstanceId) return false;
  return state.formulaVerified[state.confirmedSubstanceId] === true;
}

export function learningReducer(state: LearningState, action: LearningAction): LearningState {
  switch (action.type) {
    case 'SET_EDITION':
      return {
        ...state,
        edition: action.edition,
      };

    case 'START_UPLOADING':
      return {
        ...state,
        systemStatus: 'uploading',
        statusMessage: '正在读取图片...',
        guardNotice: null,
      };

    case 'START_RECOGNIZING':
      return {
        ...state,
        currentStep: 2,
        systemStatus: 'recognizing',
        statusMessage: '正在识别图片中的化学物质...',
        guardNotice: null,
        imageSourceType: action.sourceType,
        activeSampleId: action.sampleId ?? null,
        uploadedImageUrl: action.imageUrl ?? null,
        uploadedFileName: action.fileName ?? null,
        recognitionResult: null,
        selectedHotspotId: null,
        apparatusNotice: null,
        confirmedSubstanceId: null,
        formulaVerified: {},
      };

    case 'RECOGNITION_DONE': {
      const nextStatus: SystemStatus =
        action.result.status === 'ok'
          ? 'waiting_confirm'
          : action.result.status === 'out_of_scope'
          ? 'no_match'
          : 'unreadable';

      return {
        ...state,
        currentStep: 2,
        systemStatus: nextStatus,
        statusMessage: action.result.message ?? null,
        recognitionResult: action.result,
        selectedHotspotId: null,
        apparatusNotice: null,
        confirmedSubstanceId: null,
        formulaVerified: {},
      };
    }

    case 'SET_ERROR_STATUS':
      return {
        ...state,
        systemStatus: action.status,
        statusMessage: action.message,
      };

    case 'SELECT_HOTSPOT': {
      const hs = action.hotspot;
      if (hs.isApparatus || !hs.substanceId) {
        return {
          ...state,
          selectedHotspotId: hs.id,
          apparatusNotice: hs.apparatusMessage ?? '该对象是实验仪器，不是化学物质，请点选实验药品或材料。',
        };
      }
      return {
        ...state,
        selectedHotspotId: hs.id,
        apparatusNotice: null,
        recognitionResult: {
          status: 'ok',
          candidates: [{ substanceId: hs.substanceId }],
          objects: state.recognitionResult?.objects,
        },
        systemStatus: 'waiting_confirm',
        statusMessage: null,
        confirmedSubstanceId: null,
        formulaVerified: {},
      };
    }

    case 'CONFIRM_SUBSTANCE':
      // Changing or confirming substance always clears unlock state (Hard Constraint #6)
      return {
        ...state,
        confirmedSubstanceId: action.substanceId,
        formulaVerified: {},
        currentStep: 3,
        systemStatus: 'waiting_formula',
        statusMessage: null,
        guardNotice: null,
      };

    case 'FORMULA_VERIFIED_SUCCESS':
      if (state.confirmedSubstanceId !== action.substanceId) {
        return state;
      }
      return {
        ...state,
        formulaVerified: {
          [action.substanceId]: true,
        },
        currentStep: 4,
        systemStatus: 'idle',
        statusMessage: null,
        guardNotice: null,
      };

    case 'NAVIGATE_STEP': {
      if (isStepUnlocked(state, action.step)) {
        return {
          ...state,
          currentStep: action.step,
          guardNotice: null,
        };
      }
      const guardMsg =
        action.step >= 4
          ? '先完成化学式书写，校验通过后即可解锁物质知识卡片、反应方程式与随堂练习。'
          : action.step === 3
          ? '请先在步骤 2 中确认你要学习的物质名称。'
          : '请先上传图片或选择一个演示样例。';
      return {
        ...state,
        guardNotice: guardMsg,
      };
    }

    case 'CLEAR_GUARD_NOTICE':
      return {
        ...state,
        guardNotice: null,
      };

    case 'RESET_ALL':
      return {
        ...INITIAL_LEARNING_STATE,
        edition: state.edition,
      };

    default:
      return state;
  }
}
