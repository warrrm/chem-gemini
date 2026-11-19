import React, { useState } from 'react';
import { gradeCalculationAnswer } from '../modules/quiz/calculations';
import { CalculationQuestion } from '../types/chemistry';

interface Props {
  question: CalculationQuestion;
  teacherDelayReveal: boolean;
}

/** 计算题与其他题型共用换题控件；换题时父组件按题目 ID 重置这份作答。 */
export const CalculationQuestionCard: React.FC<Props> = ({ question, teacherDelayReveal }) => {
  const [answer, setAnswer] = useState('');
  const [feedback, setFeedback] = useState<ReturnType<typeof gradeCalculationAnswer> | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [revealed, setRevealed] = useState(false);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (submitted) return;
    const result = gradeCalculationAnswer(answer, question);
    setFeedback(result);
    if (result.inputValid) {
      setSubmitted(true);
      setRevealed(!teacherDelayReveal);
    }
  };

  return (
    <section className="calculation-card" aria-labelledby="calculation-title" data-testid="calculation-card">
      <h3 id="calculation-title">{question.title}</h3>
      <p className="quiz-stem" data-testid="calculation-stem">{question.stem}</p>
      {question.equation && <p className="calculation-equation">{question.equation}</p>}
      <p className="mass-ratio-note">本题采用的相对原子质量：{question.atomicMasses}。</p>
      <form onSubmit={submit} className="calculation-answer-form">
        <label htmlFor="calculation-answer-input">
          你的计算结果{question.unit ? `（单位：${question.unit}）` : '（无单位）'}
        </label>
        <div className="calculation-input-row">
          <input id="calculation-answer-input" type="text" inputMode="decimal" value={answer}
            onChange={event => setAnswer(event.target.value)} disabled={submitted} autoComplete="off"
            placeholder={question.unit === '%' ? '填写百分数值，如 25，不填 0.25' : '填写计算所得数值'} />
          <button type="submit" className="btn-primary" disabled={submitted}>提交计算答案</button>
        </div>
      </form>
      {feedback && <div className={`status-banner ${feedback.correct ? 'is-success' : 'is-warn'}`} role="status" data-testid="calculation-feedback">
        {feedback.feedback}
      </div>}
      {submitted && !revealed && <div className="teacher-delay-bar">
        <span>已记录作答，教师讲解后再揭晓答案和计算过程。</span>
        <button type="button" className="btn-teacher btn-sm" onClick={() => setRevealed(true)}>揭晓计算过程</button>
      </div>}
      {submitted && revealed && <div className="calculation-solution" data-testid="calculation-solution">
        <h4>参考答案：{question.answer.toFixed(question.decimalPlaces)}{question.unit ? ` ${question.unit}` : '（无单位）'}</h4>
        <ol>{question.steps.map((step, stepIndex) => <li key={stepIndex}>{step}</li>)}</ol>
      </div>}
    </section>
  );
};
