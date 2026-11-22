import React, { useEffect, useMemo, useState } from 'react';
import { SUBSTANCE_BY_ID } from '../data/substances';
import { formatFormulaPreview } from '../modules/formula/parser';
import { getKnowledgeCardStudy } from '../modules/knowledge/cardStudy';
import {
  getInquiriesForSubstance,
  getInquiryMatchKind,
  getMcqsForSubstance,
  pickNextQuestion,
} from '../modules/quiz';
import { getCalculationQuestions } from '../modules/quiz/calculations';
import { FormattedReaction, queryReactionsForSubstance } from '../modules/reactions';
import { SubstanceEntry, TextbookEdition } from '../types/chemistry';
import { ApparatusDiagram } from './ApparatusDiagram';
import { CalculationQuestionCard } from './CalculationQuestionCard';

/* ==================== Step 4: 物质知识卡片 ==================== */
interface StepKnowledgeCardProps {
  substance: SubstanceEntry;
  edition: TextbookEdition;
  onNextStep: () => void;
}

export const StepKnowledgeCard: React.FC<StepKnowledgeCardProps> = ({
  substance,
  edition,
  onNextStep,
}) => {
  const formulaDisplay = formatFormulaPreview(substance.formula);
  const { preparations, equations, equationScope } = getKnowledgeCardStudy(substance, edition);

  return (
    <section className="card step-card" aria-labelledby="step4-title">
      <div className="choice-disclaimer-banner" role="note">
        以下内容按你选择的物质展示（供学习参考，不作为实验室仪器分析鉴定结论）
      </div>

      <div className="step-header-row">
        <div>
          <span className="step-badge">步骤 4 · 物质档案</span>
          <h2 id="step4-title">{substance.name}</h2>
        </div>
        <span className="category-pill">{substance.category}</span>
      </div>

      {/* 物体与成分区分提示 */}
      {substance.kind === 'mixture' && (
        <div className="mixture-distinction-box">
          <strong>物体与组成物质区分：</strong>
          物体：<strong>{substance.name}</strong>（混合物，无统一化学式） → 主要成分：
          <strong>{substance.mainComponentName}</strong>，化学式{' '}
          <span className="inline-formula">{formulaDisplay}</span>
        </div>
      )}

      {substance.kind === 'solution' && (
        <div className="mixture-distinction-box">
          <strong>溶液与溶质区分：</strong>
          物体：<strong>{substance.name}</strong>（溶液，属于混合物） → 主要溶质：
          <strong>{substance.mainComponentName}</strong>，化学式{' '}
          <span className="inline-formula">{formulaDisplay}</span>
        </div>
      )}

      <div className="knowledge-grid">
        <div className="knowledge-kv">
          <span className="kv-label">
            {substance.kind === 'pure' ? '化学式' : '主要成分 / 溶质化学式'}
          </span>
          <span className="kv-value formula-hero" data-testid="unlocked-formula-value">
            {formulaDisplay}
          </span>
        </div>

        <div className="knowledge-kv">
          <span className="kv-label">常见名称 / 俗称</span>
          <span className="kv-value">{substance.aliases.join('、')}</span>
        </div>

        <div className="knowledge-kv">
          <span className="kv-label">物质类别</span>
          <span className="kv-value">{substance.category}</span>
        </div>

        <div className="knowledge-kv">
          <span className="kv-label">组成类型</span>
          <span className="kv-value">
            {substance.kind === 'pure'
              ? '纯净物'
              : substance.kind === 'mixture'
              ? '混合物（展示主要成分）'
              : '溶液 / 混合物（展示溶质）'}
          </span>
        </div>
      </div>

      <div className="knowledge-detail-list">
        <div className="knowledge-study-grid">
          <section className="detail-block" aria-labelledby="step4-uses">
            <h3 id="step4-uses">常见用途</h3>
            <ul className="uses-list">
              {substance.uses.map(use => <li key={use}>{use}</li>)}
            </ul>
          </section>

          <section className="detail-block" aria-labelledby="step4-preparation">
            <h3 id="step4-preparation">制法与来源</h3>
            {preparations.length > 0 ? (
              <ul className="preparation-list" role="list">
                {preparations.map(prep => (
                  <li key={prep.text}>
                    <span className="role-badge">{prep.kind}</span>
                    <p>{prep.text}</p>
                  </li>
                ))}
              </ul>
            ) : <p>当前知识库暂无相关说明。</p>}
            <p className="knowledge-section-note">仅介绍原理，不作为实验操作指南。</p>
          </section>
        </div>

        <section className="detail-block knowledge-equations" aria-labelledby="step4-equations">
          <h3 id="step4-equations">典型化学方程式</h3>
          {equationScope && <p className="knowledge-section-note">{equationScope}</p>}
          {equations.length > 0 ? (
            <>
              <p className="knowledge-section-note">选录「{edition}」范围内的反应，实验现象与知识点见第 5 步。</p>
              <div className="knowledge-equation-list">
                {equations.map(({ reaction, preparationKind }) => (
                  <article key={reaction.id} className="knowledge-equation" data-reaction-id={reaction.id}>
                    <div className="knowledge-equation-title">
                      <h4>{reaction.name}</h4>
                      <span className="role-badge">{preparationKind ?? reaction.roleLabel}</span>
                    </div>
                    <EquationDisplay rxn={reaction} />
                  </article>
                ))}
              </div>
            </>
          ) : <p>「{edition}」范围内暂无匹配反应，可切换教材范围查看。</p>}
        </section>

        <div className="detail-block">
          <h3>主要物理性质</h3>
          <p>{substance.physical}</p>
        </div>

        <div className="detail-block">
          <h3>主要化学性质</h3>
          <p>{substance.chemical}</p>
        </div>

        <div className="detail-block is-concept">
          <h3>核心概念辨析</h3>
          <p>{substance.conceptNotes}</p>
        </div>
      </div>

      <div className="card-footer-meta">
        <span>审校状态：{substance.reviewStatus}</span>
        <span>来源：{substance.source}</span>
      </div>

      <div className="step-nav-footer">
        <button type="button" className="btn-primary" onClick={onNextStep}>
          下一步：查看相关化学反应方程式 →
        </button>
      </div>
    </section>
  );
};

// 两步共用同一方程式组件；卡片窄屏可按反应物、生成物分组换行。
function EquationSide({ terms }: { terms: FormattedReaction['formattedReactants'] }) {
  return (
    <span className="eq-side">
      {terms.map((term, index) => (
        <span className="eq-piece" key={`${term.substanceId}-${index}`}>
          {index > 0 && <span className="eq-plus">+</span>}
          <span className="eq-term" title={term.name}>
            {term.coef > 1 && <span className="eq-coef">{term.coef}</span>}
            <span className="eq-formula">{term.formulaDisplay}</span>
            {term.mark && <span className="eq-mark">{term.mark}</span>}
          </span>
        </span>
      ))}
    </span>
  );
}

function EquationDisplay({ rxn }: { rxn: FormattedReaction }) {
  const showCondition = rxn.condition && rxn.condition !== '常温';

  return (
    <div className="equation-scroll-box" role="math" aria-label={`化学方程式：${rxn.plainEquationText}`}>
      <div className="equation-line">
        <EquationSide terms={rxn.formattedReactants} />
        <span className="eq-arrow-wrap">
          {showCondition && <span className="eq-condition">{formatFormulaPreview(rxn.condition)}</span>}
          <span className="eq-equals">═══</span>
        </span>
        <EquationSide terms={rxn.formattedProducts} />
      </div>
    </div>
  );
}

/* ==================== Step 5: 相关反应方程式 ==================== */
interface StepReactionsProps {
  substance: SubstanceEntry;
  edition: TextbookEdition;
  onNextStep: () => void;
}

export const StepReactions: React.FC<StepReactionsProps> = ({
  substance,
  edition,
  onNextStep,
}) => {
  const [roleFilter, setRoleFilter] = useState<'all' | 'reactant' | 'product'>('all');

  const queryResult = useMemo(
    () => queryReactionsForSubstance(substance.id, edition, 5),
    [substance.id, edition]
  );

  useEffect(() => {
    setRoleFilter('all');
  }, [substance.id, edition]);

  const displayedReactions = useMemo(() => {
    if (roleFilter === 'reactant') return queryResult.asReactant.slice(0, 5);
    if (roleFilter === 'product') return queryResult.asProduct.slice(0, 5);
    return queryResult.featuredList;
  }, [queryResult, roleFilter]);

  return (
    <section className="card step-card" aria-labelledby="step5-title">
      <div className="step-header-row">
        <div>
          <span className="step-badge">步骤 5 · 反应规律</span>
          <h2 id="step5-title">相关化学反应方程式</h2>
        </div>
        <span className="edition-tag">当前范围：{edition}</span>
      </div>

      <p className="section-subtitle">
        检索与「{substance.mainComponentName ?? substance.name}」相关的初中化学反应（涵盖<strong>作为反应物</strong>与<strong>作为生成物</strong>两类，最多展示最相关的 5 条）：
      </p>

      <div className="filter-pills" role="group" aria-label="按反应角色筛选">
        <button
          type="button"
          className={`filter-pill ${roleFilter === 'all' ? 'is-active' : ''}`}
          onClick={() => setRoleFilter('all')}
        >
          全部相关（{queryResult.featuredList.length}）
        </button>
        <button
          type="button"
          className={`filter-pill ${roleFilter === 'reactant' ? 'is-active' : ''}`}
          onClick={() => setRoleFilter('reactant')}
        >
          作为反应物（{queryResult.asReactant.length}）
        </button>
        <button
          type="button"
          className={`filter-pill ${roleFilter === 'product' ? 'is-active' : ''}`}
          onClick={() => setRoleFilter('product')}
        >
          作为生成物（{queryResult.asProduct.length}）
        </button>
      </div>

      {displayedReactions.length === 0 ? (
        <div className="status-banner is-warn" role="status">
          当前知识库暂无匹配反应（可尝试切换上方角色筛选或切换为“通用版”范围）。
        </div>
      ) : (
        <div className="reactions-list">
          {displayedReactions.map((rxn) => (
            <article key={rxn.id} className="reaction-item-card">
              <div className="reaction-item-header">
                <h3>{rxn.name}</h3>
                <div className="reaction-badges">
                  <span className="role-badge">{rxn.roleLabel}</span>
                  <span className="cond-badge">条件：{rxn.condition}</span>
                </div>
              </div>

              <EquationDisplay rxn={rxn} />

              <div className="reaction-meta-grid">
                <div>
                  <strong>实验现象：</strong>
                  <span>{rxn.phenomenon}</span>
                </div>
                <div>
                  <strong>核心知识点：</strong>
                  <span>{rxn.knowledgePoint}</span>
                </div>
                {rxn.editionNote && (
                  <div className="edition-note-inline">
                    <strong>教材版本教学提示：</strong>
                    <span>{rxn.editionNote}</span>
                  </div>
                )}
              </div>

              <div className="reaction-source-line">
                <span>审校：{rxn.reviewStatus}</span>
                <span>来源：{rxn.source}</span>
              </div>
            </article>
          ))}
        </div>
      )}

      <div className="step-nav-footer">
        <button type="button" className="btn-primary" onClick={onNextStep}>
          下一步：完成随堂练习题 →
        </button>
      </div>
    </section>
  );
};

/* ==================== Step 6: 随堂练习与反馈 ==================== */
interface StepQuizPanelProps {
  substance: SubstanceEntry;
  edition: TextbookEdition;
  teacherDelayReveal?: boolean;
  onRestartFlow: () => void;
}

const OPTION_LETTERS = ['A', 'B', 'C', 'D'];
const QUIZ_TYPES = [
  { id: 'mcq', label: '单项选择题' },
  { id: 'inquiry', label: '实验探究题' },
  { id: 'calculation', label: '计算题' },
] as const;
type QuizMode = (typeof QUIZ_TYPES)[number]['id'];
const INQUIRY_SCOPE_NOTES = {
  direct: '本物质探究题：与当前学习物质直接对应。',
  component: '同成分探究题：主要成分或溶质相同，具体物态与实验条件以题目为准。',
  related: '关联反应探究题：题目涉及当前物质的相关反应，实验对象与条件以题目为准。',
  general: '同教材综合探究题：不是当前物质的专属实验，用于巩固实验探究方法。',
};

export const StepQuizPanel: React.FC<StepQuizPanelProps> = ({
  substance,
  edition,
  teacherDelayReveal = false,
  onRestartFlow,
}) => {
  const mcqPool = useMemo(
    () => getMcqsForSubstance(substance.id, edition),
    [substance.id, edition]
  );
  const inquiryPool = useMemo(
    () => getInquiriesForSubstance(substance.id, edition),
    [substance.id, edition]
  );

  const calculationPool = useMemo(() => getCalculationQuestions(substance, edition), [substance, edition]);

  // 父组件按物质和教材重新挂载此面板，各题型在本次练习中独立保存进度。
  const [quizMode, setQuizMode] = useState<QuizMode>('mcq');
  const [currentMcq, setCurrentMcq] = useState(() => pickNextQuestion(mcqPool));
  const [currentInquiry, setCurrentInquiry] = useState(() => pickNextQuestion(inquiryPool));
  const [currentCalculation, setCurrentCalculation] = useState(() => pickNextQuestion(calculationPool));

  // MCQ answer state
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [mcqSubmitted, setMcqSubmitted] = useState(false);
  const [mcqExplanationRevealed, setMcqExplanationRevealed] = useState(false);

  // Inquiry answer state
  const [inquiryAnswers, setInquiryAnswers] = useState<string[]>([]);
  const [inquirySubmitted, setInquirySubmitted] = useState(false);
  const [inquiryAnswerRevealed, setInquiryAnswerRevealed] = useState(false);

  const activePool = { mcq: mcqPool, inquiry: inquiryPool, calculation: calculationPool }[quizMode];
  const activeQuestion = { mcq: currentMcq, inquiry: currentInquiry, calculation: currentCalculation }[quizMode];
  const questionPosition = activeQuestion ? activePool.findIndex(question => question.id === activeQuestion.id) + 1 : 0;

  const handleSwitchQuestion = () => {
    if (activePool.length < 2) return;
    if (quizMode === 'mcq') {
      setCurrentMcq(pickNextQuestion(mcqPool, currentMcq?.id));
      setSelectedOption(null);
      setMcqSubmitted(false);
      setMcqExplanationRevealed(false);
    } else if (quizMode === 'inquiry') {
      setCurrentInquiry(pickNextQuestion(inquiryPool, currentInquiry?.id));
      setInquiryAnswers([]);
      setInquirySubmitted(false);
      setInquiryAnswerRevealed(false);
    } else {
      setCurrentCalculation(pickNextQuestion(calculationPool, currentCalculation?.id));
    }
  };

  const handleTabKey = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const index = QUIZ_TYPES.findIndex(type => type.id === quizMode);
    const size = QUIZ_TYPES.length;
    let next: number;
    switch (event.key) {
      case 'ArrowLeft': next = (index + size - 1) % size; break;
      case 'ArrowRight': next = (index + 1) % size; break;
      case 'Home': next = 0; break;
      case 'End': next = size - 1; break;
      default: return;
    }
    event.preventDefault();
    event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
    setQuizMode(QUIZ_TYPES[next].id);
  };

  return (
    <section className="card step-card" aria-labelledby="step6-title">
      <div className="step-header-row">
        <div>
          <span className="step-badge">步骤 6 · 巩固检测</span>
          <h2 id="step6-title">随堂练习与作答反馈</h2>
        </div>
      </div>

      <div className="quiz-controls">
        <div className="quiz-type-tabs" role="tablist" aria-label="选择题型" onKeyDown={handleTabKey}>
          {QUIZ_TYPES.map(({ id, label }) => (
            <button key={id} type="button" role="tab" id={`quiz-tab-${id}`} aria-controls={`quiz-panel-${id}`}
              aria-selected={quizMode === id} tabIndex={quizMode === id ? 0 : -1}
              className={`clue-tab ${quizMode === id ? 'is-active' : ''}`} onClick={() => setQuizMode(id)}>
              {label}
            </button>
          ))}
        </div>
        <div className="quiz-actions">
          <span className="quiz-question-count" role="status" data-testid="quiz-question-position">
            {activePool.length ? `${questionPosition} / ${activePool.length} 题` : '暂无题目'}
          </span>
          <button type="button" className="btn-secondary btn-sm" onClick={handleSwitchQuestion}
            disabled={activePool.length < 2} title={activePool.length < 2 ? '当前题型不足两道题，暂不能换题' : '切换当前题型的下一道题'}>
            换一道题
          </button>
        </div>
      </div>

      <div className="quiz-body" id="quiz-panel-mcq" role="tabpanel" tabIndex={0} aria-labelledby="quiz-tab-mcq" hidden={quizMode !== 'mcq'}>
          {!currentMcq ? (
            <div className="status-banner is-warn">当前版本下暂无匹配的选择题。</div>
          ) : (
            <>
              <p className="quiz-stem">{currentMcq.stem}</p>

              <div className="mcq-options" role="radiogroup" aria-label="选择题选项">
                {currentMcq.options.map((optText, idx) => {
                  const isChosen = selectedOption === idx;
                  const isCorrect = idx === currentMcq.correctIndex;
                  const showMcqAnswerNow = mcqSubmitted && (!teacherDelayReveal || mcqExplanationRevealed);
                  let stateClass = '';
                  if (showMcqAnswerNow) {
                    if (isCorrect) stateClass = 'is-correct';
                    else if (isChosen && !isCorrect) stateClass = 'is-wrong';
                  } else if (isChosen) {
                    stateClass = 'is-selected';
                  }

                  return (
                    <button
                      key={idx}
                      type="button"
                      role="radio"
                      aria-checked={isChosen}
                      disabled={mcqSubmitted}
                      className={`mcq-option-btn ${stateClass}`}
                      onClick={() => setSelectedOption(idx)}
                    >
                      <span className="opt-letter">{OPTION_LETTERS[idx]}</span>
                      <span className="opt-text">{optText}</span>
                    </button>
                  );
                })}
              </div>

              {!mcqSubmitted ? (
                <div className="action-row">
                  <button
                    type="button"
                    className="btn-primary"
                    disabled={selectedOption === null}
                    onClick={() => {
                      setMcqSubmitted(true);
                      if (!teacherDelayReveal) {
                        setMcqExplanationRevealed(true);
                      }
                    }}
                  >
                    提交答案
                  </button>
                </div>
              ) : (
                <div className="quiz-feedback-box" data-testid="mcq-feedback-box">
                  <div
                    className={`status-banner ${
                      selectedOption === currentMcq.correctIndex ? 'is-success' : 'is-error'
                    }`}
                  >
                    {selectedOption === currentMcq.correctIndex
                      ? `回答正确！正确答案是 ${OPTION_LETTERS[currentMcq.correctIndex]}。`
                      : `回答有误。你的选择是 ${
                          selectedOption !== null ? OPTION_LETTERS[selectedOption] : '未选'
                        }，正确答案是 ${OPTION_LETTERS[currentMcq.correctIndex]}。`}
                  </div>

                  {!mcqExplanationRevealed ? (
                    <div className="teacher-delay-bar">
                      <span>教师演示模式已开启答案延迟揭晓，可先组织课堂讨论后再展开详解：</span>
                      <button
                        type="button"
                        className="btn-teacher btn-sm"
                        onClick={() => setMcqExplanationRevealed(true)}
                      >
                        揭晓逐项解析
                      </button>
                    </div>
                  ) : (
                    <div className="explanations-list">
                      <h4>逐项解析：</h4>
                      {currentMcq.optionExplanations.map((exp, idx) => (
                        <div
                          key={idx}
                          className={`exp-item ${
                            idx === currentMcq.correctIndex ? 'is-right-exp' : ''
                          }`}
                        >
                          <strong>选项 {OPTION_LETTERS[idx]}：</strong>
                          <span>{exp}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
      </div>

      <div className="quiz-body" id="quiz-panel-inquiry" role="tabpanel" tabIndex={0} aria-labelledby="quiz-tab-inquiry" hidden={quizMode !== 'inquiry'}>
          {!currentInquiry ? <div className="status-banner is-warn" role="status">
            当前教材范围暂无可用的实验探究题，请切换教材范围或选择单项选择题。
          </div> : <>
          <p className="inquiry-scope-note" data-testid="inquiry-scope-note">
            {INQUIRY_SCOPE_NOTES[getInquiryMatchKind(currentInquiry, substance.id)]}
            本题主题：{SUBSTANCE_BY_ID.get(currentInquiry.substanceId)?.name}。实际实验须在教师指导的实验室中进行。
          </p>
          <div className="inquiry-header-card" data-testid="inquiry-question" data-question-id={currentInquiry.id}>
            <h3>{currentInquiry.title}</h3>
            <p className="inquiry-scenario">
              <strong>实验情境：</strong>
              {currentInquiry.scenario}
            </p>
            <p className="inquiry-reagents">
              <strong>试剂与仪器：</strong>
              {currentInquiry.reagentsAndApparatus}
            </p>
            <ApparatusDiagram kind={currentInquiry.apparatusDiagram} />
          </div>

          <div className="subquestions-list">
            {currentInquiry.subQuestions.map((sq, idx) => (
              <div key={idx} className="subquestion-item">
                <label className="subq-prompt" htmlFor={`subq-input-${idx}`}>
                  {sq.prompt}
                </label>
                <textarea
                  id={`subq-input-${idx}`}
                  rows={2}
                  className="subq-textarea"
                  disabled={inquirySubmitted}
                  placeholder={sq.placeholder}
                  value={inquiryAnswers[idx] ?? ''}
                  onChange={(e) => {
                    const next = [...inquiryAnswers];
                    next[idx] = e.target.value;
                    setInquiryAnswers(next);
                  }}
                />

                {inquirySubmitted && inquiryAnswerRevealed && (
                  <div className="subq-answer-reveal" data-testid={`inquiry-reveal-${idx}`}>
                    <div className="reveal-row">
                      <strong>参考答案：</strong>
                      <span>{sq.referenceAnswer}</span>
                    </div>
                    <div className="reveal-row">
                      <strong>评分要点：</strong>
                      <span>{sq.scoringPoints.join('；')}</span>
                    </div>
                    <div className="reveal-row">
                      <strong>解析：</strong>
                      <span>{sq.explanation}</span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {!inquirySubmitted ? (
            <div className="action-row">
              <button
                type="button"
                className="btn-primary"
                onClick={() => {
                  setInquirySubmitted(true);
                  if (!teacherDelayReveal) {
                    setInquiryAnswerRevealed(true);
                  }
                }}
              >
                提交作答并查看参考答案
              </button>
            </div>
          ) : (
            !inquiryAnswerRevealed && (
              <div className="teacher-delay-bar">
                <span>已记录作答内容，教师讲解后可点击揭晓参考答案与评分要点：</span>
                <button
                  type="button"
                  className="btn-teacher btn-sm"
                  onClick={() => setInquiryAnswerRevealed(true)}
                >
                  揭晓参考答案与评分要点
                </button>
              </div>
            )
          )}
          </>}
      </div>

      <div className="quiz-body" id="quiz-panel-calculation" role="tabpanel" tabIndex={0} aria-labelledby="quiz-tab-calculation" hidden={quizMode !== 'calculation'}>
        {currentCalculation ? (
          <CalculationQuestionCard key={currentCalculation.id} question={currentCalculation} teacherDelayReveal={teacherDelayReveal} />
        ) : <div className="status-banner is-warn">当前教材范围暂无匹配的计算题。</div>}
      </div>

      <footer className="quiz-resource-footer" data-testid="quiz-resource-footer">
        <span>拓展练习：学科网</span>
        <a href="https://www.zxxk.com/" target="_blank" rel="noopener noreferrer">https://www.zxxk.com/</a>
      </footer>

      <div className="step-nav-footer">
        <button type="button" className="btn-secondary" onClick={onRestartFlow}>
          学习另一种物质（返回步骤 1）
        </button>
      </div>
    </section>
  );
};
