import { INQUIRY_QUESTIONS, MCQ_QUESTIONS } from '../../data/quizzes';
import { REACTIONS } from '../../data/reactions';
import { SUBSTANCE_BY_ID } from '../../data/substances';
import { InquiryQuestion, McqQuestion, TextbookEdition } from '../../types/chemistry';

export function getMcqsForSubstance(substanceId: string, edition: TextbookEdition): McqQuestion[] {
  const sub = SUBSTANCE_BY_ID.get(substanceId);
  const direct = MCQ_QUESTIONS.filter(
    (q) => q.substanceId === substanceId && q.editions.includes(edition)
  );
  if (direct.length > 0) return direct;

  if (sub?.mainComponentId) {
    return MCQ_QUESTIONS.filter(
      (q) => q.substanceId === sub.mainComponentId && q.editions.includes(edition)
    );
  }
  return [];
}

export type InquiryMatchKind = 'direct' | 'component' | 'related' | 'general';

const INQUIRY_MATCH_PRIORITY: Record<InquiryMatchKind, number> = {
  direct: 0, component: 1, related: 2, general: 3,
};
const REACTION_BY_ID = new Map(REACTIONS.map(reaction => [reaction.id, reaction]));
const componentId = (id: string) => SUBSTANCE_BY_ID.get(id)?.mainComponentId ?? id;

/** 关联范围仅用于排题和说明，不把综合实验题冒充当前物质的专属实验。 */
export function getInquiryMatchKind(question: InquiryQuestion, substanceId: string): InquiryMatchKind {
  if (question.substanceId === substanceId) return 'direct';
  const targetId = componentId(substanceId);
  if (componentId(question.substanceId) === targetId) return 'component';
  const participates = question.reactionIds.some(id => {
    const reaction = REACTION_BY_ID.get(id);
    return reaction && [...reaction.reactants, ...reaction.products]
      .some(participant => componentId(participant.substanceId) === targetId);
  });
  return participates ? 'related' : 'general';
}

/** 同教材内依次提供本物质、同成分、关联反应与综合题，避免零题或单题无法切换。 */
export function getInquiriesForSubstance(substanceId: string, edition: TextbookEdition): InquiryQuestion[] {
  const sub = SUBSTANCE_BY_ID.get(substanceId);
  if (!sub || !sub.editions.includes(edition)) return [];
  return INQUIRY_QUESTIONS.filter(question => question.editions.includes(edition))
    .sort((a, b) => INQUIRY_MATCH_PRIORITY[getInquiryMatchKind(a, substanceId)]
      - INQUIRY_MATCH_PRIORITY[getInquiryMatchKind(b, substanceId)]);
}

/**
 * 换一道题：当同类型题库数量 > 1 时，确保不与上一题重复
 */
export function pickNextQuestion<T extends { id: string }>(
  pool: T[],
  currentId?: string
): T | null {
  if (pool.length === 0) return null;
  if (pool.length === 1) return pool[0];

  const currentIndex = currentId ? pool.findIndex(item => item.id === currentId) : -1;
  return pool[(currentIndex + 1) % pool.length];
}
