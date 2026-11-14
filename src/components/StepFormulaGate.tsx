import React, { useEffect, useState } from 'react';
import { formatFormulaPreview } from '../modules/formula/parser';
import { validateUserFormula } from '../modules/formula/validator';
import { formatMassRatioText } from '../modules/knowledge/massRatio';
import { SubstanceEntry } from '../types/chemistry';
import { MicroDiagramSvg } from './MicroDiagramSvg';

interface StepFormulaGateProps {
  substance: SubstanceEntry;
  isAlreadyVerified: boolean;
  onVerifiedSuccess: (substanceId: string) => void;
  onContinueToCards: () => void;
}

const SUBSCRIPT_BUTTONS = ['2', '3', '4', '(', ')'];

export const StepFormulaGate: React.FC<StepFormulaGateProps> = ({
  substance,
  isAlreadyVerified,
  onVerifiedSuccess,
  onContinueToCards,
}) => {
  const hasMassRatio = substance.massRatio !== null && substance.massRatio.length > 0;
  const [clueTab, setClueTab] = useState<'micro' | 'mass'>('micro');
  const [formulaInput, setFormulaInput] = useState('');
  const [feedback, setFeedback] = useState<{ valid: boolean; text: string } | null>(null);
  const [hintLevel, setHintLevel] = useState<0 | 1 | 2 | 3>(0);

  // Reset input & hints whenever substance changes
  useEffect(() => {
    setClueTab('micro');
    setFormulaInput('');
    setFeedback(null);
    setHintLevel(0);
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
    }
  };

  const handleRevealNextHint = () => {
    setHintLevel((prev) => (prev < 3 ? ((prev + 1) as 1 | 2 | 3) : 3));
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

      {/* 线索切换区：微观示意图 / 元素质量比 */}
      <div className="clue-panel">
        <div className="clue-tabs" role="tablist" aria-label="化学式推导线索">
          <button
            type="button"
            role="tab"
            aria-selected={clueTab === 'micro'}
            className={`clue-tab ${clueTab === 'micro' ? 'is-active' : ''}`}
            onClick={() => setClueTab('micro')}
          >
            线索一：微观构成示意图
          </button>
          {hasMassRatio ? (
            <button
              type="button"
              role="tab"
              aria-selected={clueTab === 'mass'}
              className={`clue-tab ${clueTab === 'mass' ? 'is-active' : ''}`}
              onClick={() => setClueTab('mass')}
            >
              线索二：元素质量比
            </button>
          ) : (
            <span className="clue-tab-disabled" title="单质只含一种元素，无元素质量比">
              单质只含一种元素（仅提供微观示意图）
            </span>
          )}
        </div>

        {clueTab === 'micro' && <MicroDiagramSvg composition={substance.composition} />}

        {clueTab === 'mass' && hasMassRatio && substance.massRatio && (
          <div className="mass-ratio-card">
            <div className="mass-ratio-title">各元素质量比（最简整数比）</div>
            <div className="mass-ratio-formula">{formatMassRatioText(substance.massRatio)}</div>
            <div className="mass-ratio-detail">
              {substance.massRatio.map((item) => (
                <span key={item.symbol} className="mass-chip">
                  {item.name}（{item.symbol}）：{item.ratioValue}
                </span>
              ))}
            </div>
            <p className="mass-ratio-note">
              提示：结合常用相对原子质量（H=1, C=12, N=14, O=16, Na=23, Mg=24, S=32, Cl=35.5, K=39, Ca=40, Mn=55, Fe=56, Cu=64, Zn=65）可推算原子个数比。
            </p>
          </div>
        )}
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
                ? `输入${substance.mainComponentName ?? '主要成分'}化学式，如 CaCO3`
                : '输入化学式，如 H2O、NaOH、Ca(OH)2'
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

      {/* 分级提示（共 3 级，绝不直接给出答案字符串） */}
      <div className="hints-section">
        <div className="hints-header">
          <button
            type="button"
            className="btn-secondary btn-sm"
            onClick={handleRevealNextHint}
            disabled={hintLevel >= 3}
          >
            {hintLevel === 0
              ? '查看提示（第 1 级：元素组成）'
              : hintLevel === 1
              ? '继续看提示（第 2 级：原子个数比）'
              : hintLevel === 2
              ? '继续看提示（第 3 级：化合价交叉步骤）'
              : '已展开全部 3 级提示'}
          </button>
          {isAlreadyVerified && (
            <button type="button" className="btn-primary btn-sm" onClick={onContinueToCards}>
              查看已解锁的知识卡片 →
            </button>
          )}
        </div>

        {hintLevel > 0 && (
          <ol className="hint-list">
            {substance.hints.slice(0, hintLevel).map((h, i) => (
              <li key={i} className="hint-item">
                <strong>提示 {i + 1}：</strong>
                {h}
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
};
