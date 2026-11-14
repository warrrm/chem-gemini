import { InquiryQuestion, McqQuestion, QuizQuestion } from '../types/chemistry';
import { QUIZZES_PART1_INQUIRY, QUIZZES_PART1_MCQ } from './quizzesPart1';
import { QUIZZES_PART2_INQUIRY, QUIZZES_PART2_MCQ } from './quizzesPart2';

export const MCQ_QUESTIONS: McqQuestion[] = [
  ...QUIZZES_PART1_MCQ,
  ...QUIZZES_PART2_MCQ,
];

export const INQUIRY_QUESTIONS: InquiryQuestion[] = [
  ...QUIZZES_PART1_INQUIRY,
  ...QUIZZES_PART2_INQUIRY,
];

export const ALL_QUIZZES: QuizQuestion[] = [
  ...MCQ_QUESTIONS,
  ...INQUIRY_QUESTIONS,
];
