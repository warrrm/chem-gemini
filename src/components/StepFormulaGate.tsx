import React, { useEffect, useState } from 'react';
import { formatFormulaPreview } from '../modules/formula/parser';
import { validateUserFormula } from '../modules/formula/validator';
import { formatMassRatioText } from '../modules/knowledge/massRatio';
import { formatValence, getAtomicMassClue, getElementValenceClue, getFormulaClueLevel } from '../modules/knowledge/formulaClues';
import { SubstanceEntry } from '../types/chemistry';
import { MicroDiagramSvg } from './MicroDiagramSvg';

interface StepFormulaGateProps {
  substance: SubstanceEntry;
  isAlreadyVerified: boolean;
  failedAttempts: number;
  onIncorrectAttempt: (substanceId: string) => void;
  teacherModeEnabled?: boolean;
  onVerifiedSuccess: (substanceId: string) => void;
  onTeacherForceUnlock?: (substanceId: string) => void;
  onContinueToCards: () => void;
}

const SUBSCRIPT_BUTTONS = ['2', '3', '4', '(', ')'];

export const StepFormulaGate: React.FC<StepFormulaGateProps> = ({
  substance,
  isAlreadyVerified,
  failedAttempts,
  onIncorrectAttempt,
  teacherModeEnabled = false,
  onVerifiedSuccess,
  onTeacherForceUnlock,
  onContinueToCards,
}) => {
  const hasMassRatio = substance.massRatio !== null && substance.massRatio.length > 0;
  const [formulaInput, setFormulaInput] = useState('');
  const [feedback, setFeedback] = useState<{ valid: boolean; text: string } | null>(null);
  const clueLevel = getFormulaClueLevel(failedAttempts);
  const valenceClue = clueLevel >= 2 ? getElementValenceClue(substance) : null;

  useEffect(() => {
    setFormulaInput('');
    setFeedback(null);
  }, [substance.id]);

  const handleAppendToken = (token: string) => {
    setFormulaInput((prev) => prev + token);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const res = validateUserFormula(formulaInput, substance);
    setFeedback({ valid: res.valid, text: res.feedback });
    if (res.valid) {
      onVerifiedSuccess(substance.id);
    } else if (formulaInput.trim() && !isAlreadyVerified) {
      onIncorrectAttempt(substance.id);
    }
  };

  const isMixtureOrSolution = substance.kind === 'mixture' || substance.kind === 'solution';
  const targetComponentLabel =
    substance.kind === 'mixture'
      ? `${substance.name}属于混合物，请写出其主要成分「${substance.mainComponentName ?? '主要成分'}」的化学式：`
      : substance.kind === 'solution'
      ? `${substance.name}属于溶液（混合物），请写出其溶质「${substance.mainComponentName ?? '溶质'}」的化学式：`
      : `请根据下方科学线索，推导并写出「${substance.name}」的化学式：`;

  return (
    <section className="card step-card" aria-labelledby="step3-title">
      <div className="step-header-row">
        <div>
          <span className="step-badge">步骤 3 · 解锁关卡</span>
          <h2 id="step3-title">推导并书写化学式</h2>
        </div>
        {isAlreadyVerified && (
          <span className="pill-success" data-testid="formula-unlocked-badge">
            已校验通过 · 后续内容已解锁
          </span>
        )}
      </div>

      <p className="target-instruction">{targetComponentLabel}</p>

      <p className="clue-progress-note" role="status" data-testid="formula-clue-progress">
        当前已开放 {clueLevel} / 3 条线索。先根据已有线索作答；首次答错后开放线索2，再答错后开放线索3。空白提交不开放新线索。
      </p>
      <div className="progressive-clues" aria-label="化学式逐步推导线索">
        <section className="clue-panel" aria-labelledby="mass-clue-title" data-testid="formula-clue-mass">
          <h3 id="mass-clue-title">线索1：元素质量比</h3>
          {hasMassRatio && substance.massRatio ? <div className="mass-ratio-card">
            <div className="mass-ratio-title">各元素质量比（最简整数比）</div>
            <div className="mass-ratio-formula">{formatMassRatioText(substance.massRatio)}</div>
            <div className="mass-ratio-detail">{substance.massRatio.map(item => (
              <span key={item.symbol} className="mass-chip">{item.name}（{item.symbol}）：{item.ratioValue}</span>
            ))}</div>
          </div> : <p>
            该物质属于单质，只含一种元素，不存在不同元素之间的质量比；该元素在纯净物中的质量分数为 100%。
          </p>}
          <p className="mass-ratio-note">常用相对原子质量：{getAtomicMassClue(substance)}。可先用各元素质量除以相对原子质量，再化简得到原子个数比。</p>
        </section>

        {valenceClue ? <section className="clue-panel" aria-labelledby="valence-clue-title" data-testid="formula-clue-valence">
          <h3 id="valence-clue-title">线索2：元素与化合价</h3>
          <div className="mass-ratio-detail">{valenceClue.elements.map(element => <span className="mass-chip" key={element.symbol}>
            {element.name}（{element.symbol}）：{element.valences.map(formatValence).join('、')} 价
          </span>)}</div>
          <p className="mass-ratio-note">{valenceClue.note}</p>
        </section> : <div className="clue-locked" data-testid="formula-clue-valence-locked">
          <strong>线索2：元素与化合价</strong><span>首次作答错误后开放</span>
        </div>}

        {clueLevel >= 3 ? <section className="clue-panel" aria-labelledby="micro-clue-title" data-testid="formula-clue-micro">
          <h3 id="micro-clue-title">线索3：微观示意图</h3>
          <MicroDiagramSvg composition={substance.composition} />
        </section> : <div className="clue-locked" data-testid="formula-clue-micro-locked">
          <strong>线索3：微观示意图</strong><span>结合线索2再次作答错误后开放</span>
        </div>}
      </div>

      {/* 化学式输入表单 */}
      <form onSubmit={handleSubmit} className="formula-form">
        <div className="formula-rule-tip">
          书写规范：单字母元素符号<strong>必须大写</strong>（如 H、O、C）；双字母元素符号<strong>第一个字母大写、第二个字母小写</strong>（如 Ca、Cl、Na、Cu）。直接输入数字会自动渲染为下标预览。
        </div>

        <div className="formula-input-row">
          <label htmlFor="formula-input" className="sr-only">
            输入化学式
          </label>
          <input
            id="formula-input"
            type="text"
            value={formulaInput}
            onChange={(e) => setFormulaInput(e.target.value)}
            placeholder={
              isMixtureOrSolution
                ? `输入${substance.mainComponentName ?? '主要成分'}的化学式`
                : '根据已开放线索填写化学式'
            }
            className="formula-input"
            autoComplete="off"
            spellCheck={false}
          />
          <button type="submit" className="btn-primary">
            提交校验并解锁
          </button>
        </div>

        {/* 快捷下标与预览 */}
        <div className="formula-helper-bar">
          <div className="subscript-pad" aria-label="快捷输入角标与括号">
            <span className="pad-label">快捷角标：</span>
            {SUBSCRIPT_BUTTONS.map((btn) => (
              <button
                key={btn}
                type="button"
                className="pad-btn"
                onClick={() => handleAppendToken(btn)}
              >
                {btn === '(' || btn === ')' ? btn : `下标 ${btn}`}
              </button>
            ))}
          </div>

          <div className="formula-live-preview" aria-live="polite">
            <span className="preview-label">排版预览：</span>
            <span className="preview-value">
              {formulaInput.trim() ? formatFormulaPreview(formulaInput) : '（等待输入）'}
            </span>
          </div>
        </div>
      </form>

      {/* 校验反馈 */}
      {feedback && (
        <div
          className={`status-banner ${feedback.valid ? 'is-success' : 'is-error'}`}
          role="status"
          data-testid="formula-feedback"
        >
          {feedback.text}
        </div>
      )}

      <div className="action-row">
        {teacherModeEnabled && !isAlreadyVerified && onTeacherForceUnlock && <button type="button" className="btn-teacher btn-sm"
          onClick={() => onTeacherForceUnlock(substance.id)}>教师演示控制：直接解锁展示</button>}
        {isAlreadyVerified && <button type="button" className="btn-primary btn-sm" onClick={onContinueToCards}>
          查看已解锁的知识卡片 →
        </button>}
      </div>
    </section>
  );
};
