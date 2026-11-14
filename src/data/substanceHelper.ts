import {
  MassRatioItem,
  SubstanceCategory,
  SubstanceComposition,
  SubstanceEntry,
  SubstanceKind,
  TextbookEdition,
} from '../types/chemistry';

export const DEFAULT_SOURCE = '通用初中化学基础（知识库自编，未对应具体页码）';
export const DEFAULT_REVIEW = 'AI 整理，尚未经教师审校';
export const ALL_EDITIONS: TextbookEdition[] = ['通用版', '人教版', '沪教版', '鲁教版'];

export function auxSub(params: {
  id: string;
  name: string;
  aliases: string[];
  formula: string;
  category: SubstanceCategory;
  composition: SubstanceComposition;
  massRatio: MassRatioItem[] | null;
  hints: [string, string, string];
  physical: string;
  chemical: string;
  uses: string[];
  conceptNotes: string;
  kind?: SubstanceKind;
}): SubstanceEntry {
  return {
    id: params.id,
    name: params.name,
    aliases: params.aliases,
    kind: params.kind ?? 'pure',
    formula: params.formula,
    acceptedForms: [params.formula],
    category: params.category,
    composition: params.composition,
    massRatio: params.massRatio,
    hints: params.hints,
    physical: params.physical,
    chemical: params.chemical,
    uses: params.uses,
    conceptNotes: params.conceptNotes,
    scope: 'middle_school',
    featured: false,
    editions: ALL_EDITIONS,
    reviewStatus: DEFAULT_REVIEW,
    source: DEFAULT_SOURCE,
  };
}
