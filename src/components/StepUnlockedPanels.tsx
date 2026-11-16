import React, { useEffect, useMemo, useState } from 'react';
import { formatFormulaPreview } from '../modules/formula/parser';
import {
  getInquiriesForSubstance,
  getMcqsForSubstance,
  pickNextQuestion,
} from '../modules/quiz';
import { FormattedReaction, queryReactionsForSubstance } from '../modules/reactions';
import { InquiryQuestion, McqQuestion, SubstanceEntry, TextbookEdition } from '../types/chemistry';
import { ApparatusDiagram } from './ApparatusDiagram';
import { CalculationQuestionCard } from './CalculationQuestionCard';

/* ==================== Step 4: 物质知识卡片 ==================== */
interface StepKnowledgeCardProps {
  substance: SubstanceEntry;
  onNextStep: () => void;
}

export const StepKnowledgeCard: React.FC<StepKnowledgeCardProps> = ({
  substance,
  onNextStep,
}) => {
  const formulaDisplay = formatFormulaPreview(substance.formula);

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
        <div className="detail-block">
          <h3>主要物理性质</h3>
          <p>{substance.physical}</p>
        </div>

        <div className="detail-block">
          <h3>主要化学性质</h3>
          <p>{substance.chemical}</p>
        </div>

        <div className="detail-block">
          <h3>常见用途</h3>
          <ul className="uses-list">
            {substance.uses.map((u, idx) => (
              <li key={idx}>{u}</li>
            ))}
          </ul>
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

/* ==================== Step 5: 相关反应方程式 ==================== */
interface StepReactionsProps {
  substance: SubstanceEntry;
  edition: TextbookEdition;
  onNextStep: () => void;
}

const EquationDisplay: React.FC<{ rxn: FormattedReaction }> = ({ rxn }) => {
  const showCondition = rxn.condition && rxn.condition !== '常温';

  return (
    <div className="equation-scroll-box" aria-label={`化学方程式：${rxn.plainEquationText}`}>
      <div className="equation-line">
        {rxn.formattedReactants.map((r, idx) => (
          <React.Fragment key={`${r.substanceId}-${idx}`}>
            {idx > 0 && <span className="eq-plus">+</span>}
            <span className="eq-term" title={r.name}>
              {r.coef > 1 && <span className="eq-coef">{r.coef}</span>}
              <span className="eq-formula">{r.formulaDisplay}</span>
            </span>
          </React.Fragment>
        ))}

        <span className="eq-arrow-wrap">
          {showCondition && <span className="eq-condition">{rxn.condition}</span>}
          <span className="eq-equals">═══</span>
        </span>

        {rxn.formattedProducts.map((p, idx) => (
          <React.Fragment key={`${p.substanceId}-${idx}`}>
            {idx > 0 && <span className="eq-plus">+</span>}
            <span className="eq-term" title={p.name}>
              {p.coef > 1 && <span className="eq-coef">{p.coef}</span>}
              <span className="eq-formula">{p.formulaDisplay}</span>
              {p.mark && <span className="eq-mark">{p.mark}</span>}
            </span>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};

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

  const [quizMode, setQuizMode] = useState<'mcq' | 'inquiry'>('mcq');
  const [currentMcq, setCurrentMcq] = useState<McqQuestion | null>(null);
  const [currentInquiry, setCurrentInquiry] = useState<InquiryQuestion | null>(null);

  // MCQ answer state
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [mcqSubmitted, setMcqSubmitted] = useState(false);
  const [mcqExplanationRevealed, setMcqExplanationRevealed] = useState(false);

  // Inquiry answer state
  const [inquiryAnswers, setInquiryAnswers] = useState<string[]>([]);
  const [inquirySubmitted, setInquirySubmitted] = useState(false);
  const [inquiryAnswerRevealed, setInquiryAnswerRevealed] = useState(false);

  useEffect(() => {
    setQuizMode('mcq');
    const firstMcq = pickNextQuestion(mcqPool);
    const firstInq = pickNextQuestion(inquiryPool);
    setCurrentMcq(firstMcq);
    setCurrentInquiry(firstInq);
    setSelectedOption(null);
    setMcqSubmitted(false);
    setMcqExplanationRevealed(false);
    setInquiryAnswers(firstInq ? firstInq.subQuestions.map(() => '') : []);
    setInquirySubmitted(false);
    setInquiryAnswerRevealed(false);
  }, [substance.id, edition, mcqPool, inquiryPool]);

  const handleSwitchQuestion = () => {
    if (quizMode === 'mcq') {
      const next = pickNextQuestion(mcqPool, currentMcq?.id);
      setCurrentMcq(next);
      setSelectedOption(null);
      setMcqSubmitted(false);
      setMcqExplanationRevealed(false);
    } else {
      const next = pickNextQuestion(inquiryPool, currentInquiry?.id);
      setCurrentInquiry(next);
      setInquiryAnswers(next ? next.subQuestions.map(() => '') : []);
      setInquirySubmitted(false);
      setInquiryAnswerRevealed(false);
    }
  };

  const hasInquiry = inquiryPool.length > 0;

  return (
    <section className="card step-card" aria-labelledby="step6-title">
      <div className="step-header-row">
        <div>
          <span className="step-badge">步骤 6 · 巩固检测</span>
          <h2 id="step6-title">随堂练习与作答反馈</h2>
        </div>

        <div className="quiz-controls">
          <div className="quiz-type-tabs" role="tablist" aria-label="选择题型">
            <button
              type="button"
              role="tab"
              aria-selected={quizMode === 'mcq'}
              className={`clue-tab ${quizMode === 'mcq' ? 'is-active' : ''}`}
              onClick={() => setQuizMode('mcq')}
            >
              单项选择题
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={quizMode === 'inquiry'}
              disabled={!hasInquiry}
              className={`clue-tab ${quizMode === 'inquiry' ? 'is-active' : ''}`}
              onClick={() => hasInquiry && setQuizMode('inquiry')}
              title={
                hasInquiry
                  ? '切换到实验探究题'
                  : '该物质暂未配置安全规范的实验探究题'
              }
            >
              实验探究题
            </button>
          </div>

          <button type="button" className="btn-secondary btn-sm" onClick={handleSwitchQuestion}>
            换一道题
          </button>
        </div>
      </div>

      {!hasInquiry && (
        <p className="inquiry-disabled-note">
          说明：当前物质暂未配置适合中学生操作的实验探究题，已为你提供精选单项选择题。
        </p>
      )}

      {/* 单项选择题视图 */}
      {quizMode === 'mcq' && (
        <div className="quiz-body">
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
      )}

      {/* 实验探究题视图 */}
      {quizMode === 'inquiry' && currentInquiry && (
        <div className="quiz-body">
          <div className="inquiry-header-card">
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
        </div>
      )}

      <CalculationQuestionCard key={`${substance.id}:${edition}`} substance={substance} edition={edition} teacherDelayReveal={teacherDelayReveal} />

      <div className="step-nav-footer">
        <button type="button" className="btn-secondary" onClick={onRestartFlow}>
          学习另一种物质（返回步骤 1）
        </button>
      </div>
    </section>
  );
};
