export type TextbookEdition = '通用版' | '人教版' | '沪教版' | '鲁教版';

export type SubstanceKind = 'pure' | 'mixture' | 'solution';

export type SubstanceCategory =
  | '单质'
  | '氧化物'
  | '酸'
  | '碱'
  | '盐'
  | '有机化合物'
  | '混合物';

export type MicroStructureType = 'molecule' | 'ionic' | 'metallic' | 'network_atom';

export interface MicroAtomSpec {
  symbol: string;
  count: number;
  charge?: string;
  role?: 'center' | 'ligand' | 'cation' | 'anion' | 'lattice';
}

export interface SubstanceComposition {
  structureType: MicroStructureType;
  /** 描述构成微粒数量关系，严禁出现化学式字符串 */
  unitDescription: string;
  atoms: MicroAtomSpec[];
}

export interface MassRatioItem {
  symbol: string;
  name: string;
  ratioValue: number;
}

export interface SubstanceEntry {
  id: string;
  name: string;
  aliases: string[];
  kind: SubstanceKind;
  mainComponentId?: string;
  mainComponentName?: string;
  formula: string;
  acceptedForms: string[];
  category: SubstanceCategory;
  composition: SubstanceComposition;
  /** 单质无元素质量比，设为 null */
  massRatio: MassRatioItem[] | null;
  /** 三级提示：元素组成 -> 原子个数比 -> 化合价交叉法步骤（严禁直接出现答案字符串） */
  hints: [string, string, string];
  physical: string;
  chemical: string;
  uses: string[];
  conceptNotes: string;
  scope: 'middle_school';
  featured: boolean;
  editions: TextbookEdition[];
  reviewStatus: string;
  source: string;
  verified?: boolean;
}

export interface OutOfScopeEntry {
  id: string;
  name: string;
  aliases: string[];
  reason: string;
}

export interface ReactionParticipant {
  substanceId: string;
  coef: number;
  mark?: '↑' | '↓';
}

export interface ReactionEntry {
  id: string;
  name: string;
  reactants: ReactionParticipant[];
  products: ReactionParticipant[];
  condition: string;
  phenomenon: string;
  knowledgePoint: string;
  editions: TextbookEdition[];
  source: string;
  verified?: boolean;
  priority: number;
  reviewStatus: string;
  arrowNote?: string;
  editionNote?: string;
}

export interface McqQuestion {
  id: string;
  type: 'mcq';
  substanceId: string;
  reactionIds: string[];
  editions: TextbookEdition[];
  stem: string;
  options: [string, string, string, string];
  correctIndex: 0 | 1 | 2 | 3;
  optionExplanations: [string, string, string, string];
  editionNote?: string;
}

export interface InquirySubQuestion {
  prompt: string;
  placeholder: string;
  referenceAnswer: string;
  scoringPoints: string[];
  explanation: string;
}

export interface InquiryQuestion {
  id: string;
  type: 'inquiry';
  substanceId: string;
  reactionIds: string[];
  editions: TextbookEdition[];
  title: string;
  scenario: string;
  reagentsAndApparatus: string;
  apparatusDiagram?:
    | 'gas_collection_up'
    | 'gas_collection_water'
    | 'heating_solid'
    | 'solution_test'
    | 'limestone_acid'
    | 'metal_displacement';
  subQuestions: InquirySubQuestion[];
}

export type QuizQuestion = McqQuestion | InquiryQuestion;

export interface SampleHotspot {
  id: string;
  label: string;
  /** [x%, y%, width%, height%] */
  bbox: [number, number, number, number];
  isApparatus?: boolean;
  apparatusMessage?: string;
  substanceId?: string;
}

export type SampleSvgKind =
  | 'hcl_bottle'
  | 'naoh_bottle'
  | 'unlabeled_liquid'
  | 'limestone_rock'
  | 'lab_bench_multi'
  | 'phenol_bottle'
  | 'limewater_bottle'
  | 'kmno4_bottle';

export interface DemoSample {
  id: string;
  title: string;
  categoryBadge: string;
  description: string;
  svgKind: SampleSvgKind;
  recognitionStatus: 'ok' | 'ambiguous' | 'out_of_scope';
  candidates: { substanceId: string }[];
  outOfScopeId?: string;
  statusMessage?: string;
  hotspots?: SampleHotspot[];
}

export type AppRunMode = 'demo' | 'online';

export type OnlineProviderMode = 'vision' | 'text_assist';

export type AIProviderPresetId = 'demo' | 'deepseek' | 'volcengine_deepseek' | 'opencode_vision' | 'custom';

export interface OnlineAIConfig {
  enabled: boolean;
  providerPreset: AIProviderPresetId;
  providerMode: OnlineProviderMode;
  baseURL: string;
  model: string;
  /** server: 本地网关使用 .env.local；session: 用户自备 Key，仅存当前标签页。 */
  credentialSource: 'server' | 'session';
  apiKey: string;
  imageUploadConsented: boolean;
}

export interface TeacherModeState {
  enabled: boolean;
  projectorLargeText: boolean;
  delayRevealAnswers: boolean;
}

export type RecognitionProviderKind = 'demo' | 'local_text' | 'llm_text_assist' | 'vision';

export type RecognitionResult = {
  status: 'ok' | 'ambiguous' | 'out_of_scope' | 'unreadable' | 'network_error';
  candidates: { substanceId: string }[];
  objects?: SampleHotspot[];
  message?: string;
  outOfScopeName?: string;
  providerUsed?: RecognitionProviderKind;
  fallbackNotice?: string;
};

export interface RecognitionProvider {
  id: string;
  recognize(input: { image?: Blob; text?: string; sampleId?: string }): Promise<RecognitionResult>;
}

export type LearningStep = 1 | 2 | 3 | 4 | 5 | 6;

export type SystemStatus =
  | 'idle'
  | 'uploading'
  | 'recognizing'
  | 'waiting_confirm'
  | 'waiting_formula'
  | 'querying'
  | 'generating_quiz'
  | 'unreadable'
  | 'no_match'
  | 'network_error';
