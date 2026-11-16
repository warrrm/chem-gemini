import { INQUIRY_QUESTIONS, MCQ_QUESTIONS } from '../../data/quizzes';
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

export function getInquiriesForSubstance(substanceId: string, edition: TextbookEdition): InquiryQuestion[] {
  const sub = SUBSTANCE_BY_ID.get(substanceId);
  const direct = INQUIRY_QUESTIONS.filter(
    (q) => q.substanceId === substanceId && q.editions.includes(edition)
  );
  if (direct.length > 0) return direct;

  if (sub?.mainComponentId) {
    return INQUIRY_QUESTIONS.filter(
      (q) => q.substanceId === sub.mainComponentId && q.editions.includes(edition)
    );
  }
  return [];
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
