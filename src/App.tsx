import React, { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { CameraCaptureModal } from './components/CameraCaptureModal';
import { SampleIllustration } from './components/SampleIllustration';
import { StepFormulaGate } from './components/StepFormulaGate';
import {
  StepKnowledgeCard,
  StepQuizPanel,
  StepReactions,
} from './components/StepUnlockedPanels';
import { DEMO_SAMPLES } from './data/samples';
import { SUBSTANCES, SUBSTANCE_BY_ID } from './data/substances';
import { formatFormulaPreview } from './modules/formula/parser';
import { demoProvider, localTextMatcher } from './modules/recognition';
import {
  INITIAL_LEARNING_STATE,
  isStepUnlocked,
  learningReducer,
} from './state/learningMachine';
import {
  DemoSample,
  LearningStep,
  SampleHotspot,
  TextbookEdition,
} from './types/chemistry';

const STEPS: { step: LearningStep; shortTitle: string; fullTitle: string }[] = [
  { step: 1, shortTitle: '1. 上传预览', fullTitle: '1. 图片上传与预览' },
  { step: 2, shortTitle: '2. 确认名称', fullTitle: '2. 候选物质与名称确认' },
  { step: 3, shortTitle: '3. 书写化学式', fullTitle: '3. 推导并书写化学式' },
  { step: 4, shortTitle: '4. 知识卡片', fullTitle: '4. 物质知识卡片' },
  { step: 5, shortTitle: '5. 反应方程式', fullTitle: '5. 相关反应方程式' },
  { step: 6, shortTitle: '6. 随堂练习', fullTitle: '6. 随堂练习与反馈' },
];

const EDITIONS: TextbookEdition[] = ['通用版', '人教版', '沪教版', '鲁教版'];

export const App: React.FC = () => {
  const [state, dispatch] = useReducer(learningReducer, INITIAL_LEARNING_STATE);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);

  // Manual search state in Step 2 (never exposes formulas)
  const [manualQuery, setManualQuery] = useState('');
  const [manualMatches, setManualMatches] = useState<string[]>([]);
  const [manualFeedback, setManualFeedback] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const previousBlobUrlRef = useRef<string | null>(null);

  // Clean up object URLs on change and unmount (Hard Constraint #9)
  useEffect(() => {
    if (
      previousBlobUrlRef.current &&
      previousBlobUrlRef.current !== state.uploadedImageUrl
    ) {
      URL.revokeObjectURL(previousBlobUrlRef.current);
    }
    previousBlobUrlRef.current = state.uploadedImageUrl;
  }, [state.uploadedImageUrl]);

  useEffect(() => {
    return () => {
      if (previousBlobUrlRef.current) {
        URL.revokeObjectURL(previousBlobUrlRef.current);
      }
    };
  }, []);

  const activeSample: DemoSample | undefined = useMemo(
    () => DEMO_SAMPLES.find((s) => s.id === state.activeSampleId),
    [state.activeSampleId]
  );

  const confirmedSubstance = useMemo(
    () =>
      state.confirmedSubstanceId
        ? SUBSTANCE_BY_ID.get(state.confirmedSubstanceId)
        : undefined,
    [state.confirmedSubstanceId]
  );

  const isFormulaUnlocked = Boolean(
    state.confirmedSubstanceId &&
      state.formulaVerified[state.confirmedSubstanceId] === true
  );

  const resetManualSearch = () => {
    setManualQuery('');
    setManualMatches([]);
    setManualFeedback(null);
  };

  const handleSelectSample = async (sample: DemoSample) => {
    resetManualSearch();
    dispatch({
      type: 'START_RECOGNIZING',
      sourceType: 'sample',
      sampleId: sample.id,
    });
    const res = await demoProvider.recognize({ sampleId: sample.id });
    dispatch({ type: 'RECOGNITION_DONE', result: res });
  };

  const handleProcessBlob = async (
    blob: Blob,
    fileName: string,
    sourceType: 'upload' | 'camera'
  ) => {
    resetManualSearch();
    const objectUrl = URL.createObjectURL(blob);
    dispatch({
      type: 'START_RECOGNIZING',
      sourceType,
      imageUrl: objectUrl,
      fileName,
    });
    const res = await demoProvider.recognize({ image: blob });
    dispatch({ type: 'RECOGNITION_DONE', result: res });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    dispatch({ type: 'START_UPLOADING' });
    await handleProcessBlob(file, file.name, 'upload');
    e.target.value = '';
  };

  const triggerUploadPicker = () => {
    fileInputRef.current?.click();
  };

  const handleManualSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = manualQuery.trim();
    if (!q) {
      setManualMatches([]);
      setManualFeedback('请输入物质名称或常见俗称，例如“稀盐酸”“氢氧化钠”“石灰石”“水”。');
      return;
    }
    const res = await localTextMatcher.recognize({ text: q });
    if (res.status === 'ok' && res.candidates.length > 0) {
      setManualMatches(res.candidates.map((c) => c.substanceId));
      setManualFeedback(null);
    } else {
      setManualMatches([]);
      setManualFeedback(res.message ?? '暂不在当前学习范围内');
    }
  };

  const handleConfirmSubstance = (substanceId: string) => {
    dispatch({ type: 'CONFIRM_SUBSTANCE', substanceId });
  };

  const handleHotspotClick = (hotspot: SampleHotspot) => {
    dispatch({ type: 'SELECT_HOTSPOT', hotspot });
  };

  const handleResetAll = () => {
    resetManualSearch();
    dispatch({ type: 'RESET_ALL' });
  };

  // Candidate IDs to show in Step 2 (ONLY names rendered, zero formula spoilers)
  const step2CandidateIds = useMemo(() => {
    const ids = new Set<string>();
    state.recognitionResult?.candidates.forEach((c) => ids.add(c.substanceId));
    manualMatches.forEach((id) => ids.add(id));
    return Array.from(ids);
  }, [state.recognitionResult, manualMatches]);

  const hasMediaPreview =
    state.imageSourceType !== 'none' &&
    (Boolean(activeSample) || Boolean(state.uploadedImageUrl));

  return (
    <div className="app-shell">
      {/* Hidden file input shared by upload buttons */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={handleFileChange}
        data-testid="image-file-input"
      />

      {/* Top Header */}
      <header className="top-navbar">
        <div className="navbar-inner">
          <div className="brand-block">
            <button
              type="button"
              className="brand-btn"
              onClick={handleResetAll}
              title="返回首页"
            >
              <span className="brand-icon" aria-hidden="true">
                ⚗️
              </span>
              <span className="brand-texts">
                <strong className="brand-title">化学识物小课堂</strong>
                <span className="brand-slogan">从一张照片，认识一种物质</span>
              </span>
            </button>
          </div>

          <div className="navbar-controls">
            <span
              className="mode-badge is-demo"
              title="当前为演示模式：内置样例返回预设结果，上传图片仅在本地浏览器内存中预览"
            >
              演示模式
            </span>

            <div className="edition-selector">
              <label htmlFor="edition-select">教材范围：</label>
              <select
                id="edition-select"
                value={state.edition}
                onChange={(e) =>
                  dispatch({
                    type: 'SET_EDITION',
                    edition: e.target.value as TextbookEdition,
                  })
                }
              >
                {EDITIONS.map((ed) => (
                  <option key={ed} value={ed}>
                    {ed}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              className="btn-ghost btn-sm"
              onClick={() => setAboutOpen(true)}
            >
              关于与审校说明
            </button>
          </div>
        </div>

        {/* Textbook edition disclaimer bar */}
        <div className="edition-notice-bar">
          版本适配仅供参考，以所用教材为准 · 知识库当前状态：AI 整理，尚未经教师审校
        </div>
      </header>

      {/* 6-Step Progress Stepper */}
      <nav className="stepper-bar" aria-label="学习步骤导航">
        <ol className="stepper-list">
          {STEPS.map((item) => {
            const unlocked = isStepUnlocked(state, item.step);
            const isCurrent = state.currentStep === item.step;
            const isDone =
              (item.step === 1 && state.imageSourceType !== 'none') ||
              (item.step === 2 && Boolean(state.confirmedSubstanceId)) ||
              (item.step === 3 && isFormulaUnlocked) ||
              (item.step >= 4 && isFormulaUnlocked && state.currentStep > item.step);

            return (
              <li key={item.step} className="stepper-item">
                <button
                  type="button"
                  aria-current={isCurrent ? 'step' : undefined}
                  className={`stepper-btn ${isCurrent ? 'is-current' : ''} ${
                    unlocked ? 'is-unlocked' : 'is-locked'
                  } ${isDone ? 'is-done' : ''}`}
                  onClick={() =>
                    dispatch({ type: 'NAVIGATE_STEP', step: item.step })
                  }
                >
                  <span className="step-num">
                    {!unlocked && item.step >= 4 ? '🔒' : item.step}
                  </span>
                  <span className="step-label-full">{item.fullTitle}</span>
                  <span className="step-label-short">{item.shortTitle}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      {/* Step Guard Notice Banner */}
      {state.guardNotice && (
        <div className="container">
          <div className="status-banner is-warn guard-banner" role="alert">
            <span>{state.guardNotice}</span>
            <button
              type="button"
              className="btn-ghost btn-sm"
              onClick={() => dispatch({ type: 'CLEAR_GUARD_NOTICE' })}
            >
              知道了
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="container main-workspace">
        {state.currentStep === 1 ? (
          /* ==================== STEP 1: 首页与图片采集 ==================== */
          <div className="home-layout">
            <section className="hero-card">
              <div className="hero-badge">初中化学互动学习 · 六步闯关识物</div>
              <h1>从一张照片，认识一种物质</h1>
              <p className="hero-desc">
                拍照或上传身边的化学试剂、矿石标本或实验器材照片，先辨认物质名称，再通过微观粒子图与元素质量比推导书写化学式，解锁知识卡片、反应方程式与随堂练习。
              </p>

              <div className="hero-actions">
                <button
                  type="button"
                  className="btn-primary btn-lg"
                  onClick={() => setCameraOpen(true)}
                >
                  📷 拍照识物
                </button>
                <button
                  type="button"
                  className="btn-secondary btn-lg"
                  onClick={triggerUploadPicker}
                >
                  🖼️ 上传图片
                </button>
              </div>

              <p className="privacy-note">
                隐私说明：你上传或拍摄的图片仅在当前浏览器会话内存中使用，不上传至任何服务器，不写入本地缓存，刷新或重置后自动销毁。
              </p>
            </section>

            <section className="samples-section" aria-labelledby="samples-heading">
              <div className="section-head">
                <h2 id="samples-heading">试试内置样例（演示模式一键体验）</h2>
                <p>覆盖清晰标签溶液、纯净物、无标签未知液体、混合物、多物体识别与超纲物质 5 类典型场景：</p>
              </div>

              <div className="samples-grid">
                {DEMO_SAMPLES.map((sample) => (
                  <article key={sample.id} className="sample-card">
                    <SampleIllustration svgKind={sample.svgKind} compact />
                    <div className="sample-card-body">
                      <span className="sample-badge">{sample.categoryBadge}</span>
                      <h3>{sample.title}</h3>
                      <p>{sample.description}</p>
                      <button
                        type="button"
                        className="btn-primary btn-block"
                        onClick={() => handleSelectSample(sample)}
                      >
                        使用此样例开始学习
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </div>
        ) : (
          /* ==================== STEPS 2-6: 桌面左右分栏 / 手机纵向卡片 ==================== */
          <div className="study-two-col">
            {/* Left Sticky Context Column */}
            <aside className="study-sidebar" aria-label="当前学习对象状态">
              <div className="card sidebar-card">
                <div className="sidebar-card-head">
                  <h3>当前图片预览</h3>
                  <div className="sidebar-mini-actions">
                    <button
                      type="button"
                      className="btn-ghost btn-xs"
                      onClick={() => setCameraOpen(true)}
                    >
                      重拍
                    </button>
                    <button
                      type="button"
                      className="btn-ghost btn-xs"
                      onClick={triggerUploadPicker}
                    >
                      换图
                    </button>
                    <button
                      type="button"
                      className="btn-ghost btn-xs"
                      onClick={handleResetAll}
                    >
                      换样例
                    </button>
                  </div>
                </div>

                {hasMediaPreview ? (
                  activeSample ? (
                    <SampleIllustration svgKind={activeSample.svgKind} compact />
                  ) : (
                    state.uploadedImageUrl && (
                      <div className="uploaded-preview-box">
                        <img
                          src={state.uploadedImageUrl}
                          alt={state.uploadedFileName ?? '用户上传的图片预览'}
                          className="uploaded-preview-img"
                        />
                        <div className="sample-caption">
                          本地图片预览（仅当前会话内存保存）
                        </div>
                      </div>
                    )
                  )
                ) : (
                  <div className="empty-preview-box">暂无图片</div>
                )}

                {/* Current Substance Status (Zero Spoiler before formulaVerified!) */}
                <div className="sidebar-status-box">
                  <div className="sidebar-status-row">
                    <span className="status-label">已确认名称：</span>
                    <strong className="status-val">
                      {confirmedSubstance ? confirmedSubstance.name : '尚未确认'}
                    </strong>
                  </div>

                  <div className="sidebar-status-row">
                    <span className="status-label">化学式状态：</span>
                    {confirmedSubstance ? (
                      isFormulaUnlocked ? (
                        <strong
                          className="status-val is-unlocked-text"
                          data-testid="sidebar-formula-revealed"
                        >
                          {formatFormulaPreview(confirmedSubstance.formula)}（已解锁）
                        </strong>
                      ) : (
                        <span className="status-val is-locked-text">
                          待推导书写（解锁后显示）
                        </span>
                      )
                    ) : (
                      <span className="status-val is-muted-text">—</span>
                    )}
                  </div>
                </div>
              </div>
            </aside>

            {/* Right Active Step Panel */}
            <div className="study-main-col">
              {/* STEP 2: 候选物质与名称确认（仅显示名称，严禁剧透化学式） */}
              {state.currentStep === 2 && (
                <section className="card step-card" aria-labelledby="step2-title">
                  <div className="step-header-row">
                    <div>
                      <span className="step-badge">步骤 2 · 名称辨认</span>
                      <h2 id="step2-title">候选物质与名称确认</h2>
                    </div>
                  </div>

                  {state.systemStatus === 'recognizing' && (
                    <div className="status-banner is-info" role="status">
                      正在识别图片内容，请稍候...
                    </div>
                  )}

                  {/* 多物体图片热区点选 */}
                  {activeSample?.hotspots && activeSample.hotspots.length > 0 && (
                    <div className="multi-object-box">
                      <p className="multi-object-tip">
                        <strong>检测到图片中包含多个物体：</strong>
                        请先在下方图片中点击你要学习的物体（或点击对应热区标签）：
                      </p>
                      <SampleIllustration
                        svgKind={activeSample.svgKind}
                        hotspots={activeSample.hotspots}
                        selectedHotspotId={state.selectedHotspotId}
                        onSelectHotspot={handleHotspotClick}
                      />
                      {state.apparatusNotice && (
                        <div className="status-banner is-warn" role="alert">
                          {state.apparatusNotice}
                        </div>
                      )}
                    </div>
                  )}

                  {/* 系统状态提示（如无法仅凭外观确定 / 超纲物质 / 演示模式上传提示） */}
                  {state.statusMessage && (
                    <div
                      className={`status-banner ${
                        state.recognitionResult?.status === 'out_of_scope'
                          ? 'is-error'
                          : 'is-warn'
                      }`}
                      role="status"
                    >
                      {state.statusMessage}
                    </div>
                  )}

                  {/* 候选物质按钮列表：严格只显示物质名称！ */}
                  {step2CandidateIds.length > 0 && (
                    <div className="candidates-box">
                      <h3>请选择并确认本次要学习的物质名称：</h3>
                      <p className="candidate-hint">
                        为避免剧透，此处仅展示物质名称；确认后进入化学式推导环节。
                      </p>
                      <div className="candidate-btn-grid">
                        {step2CandidateIds.map((subId) => {
                          const sub = SUBSTANCE_BY_ID.get(subId);
                          if (!sub) return null;
                          const isSelected = state.confirmedSubstanceId === sub.id;
                          return (
                            <button
                              key={sub.id}
                              type="button"
                              className={`candidate-name-btn ${
                                isSelected ? 'is-selected' : ''
                              }`}
                              onClick={() => handleConfirmSubstance(sub.id)}
                            >
                              <span className="cand-name">{sub.name}</span>
                              <span className="cand-action">确认此物质 →</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* 手动输入或搜索物质名称 */}
                  <div className="manual-search-box">
                    <h3>手动输入或搜索物质名称</h3>
                    <p className="manual-search-desc">
                      如果图片无标签、未自动列出候选，或你想学习其他初中化学物质，可在此输入名称或常见俗称（如“稀盐酸”“烧碱”“石灰石”“铁钉”）：
                    </p>
                    <form onSubmit={handleManualSearch} className="manual-search-form">
                      <label htmlFor="manual-substance-input" className="sr-only">
                        输入物质名称
                      </label>
                      <input
                        id="manual-substance-input"
                        type="text"
                        value={manualQuery}
                        onChange={(e) => setManualQuery(e.target.value)}
                        placeholder="输入物质名称或俗称..."
                        className="text-input"
                      />
                      <button type="submit" className="btn-primary">
                        搜索名称
                      </button>
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={triggerUploadPicker}
                      >
                        重新上传
                      </button>
                    </form>

                    {manualFeedback && (
                      <div className="status-banner is-warn" role="status">
                        {manualFeedback}
                      </div>
                    )}

                    {/* 常见初中物质快捷点选（仅显示名称，不显示化学式） */}
                    <div className="quick-pick-area">
                      <span className="quick-pick-label">常见初中物质快捷选择：</span>
                      <div className="quick-pick-chips">
                        {SUBSTANCES.filter((s) => s.featured).map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            className="chip-btn"
                            onClick={() => handleConfirmSubstance(s.id)}
                          >
                            {s.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </section>
              )}

              {/* STEP 3: 推导并书写化学式（解锁关卡） */}
              {state.currentStep === 3 && confirmedSubstance && (
                <StepFormulaGate
                  substance={confirmedSubstance}
                  isAlreadyVerified={isFormulaUnlocked}
                  onVerifiedSuccess={(id) =>
                    dispatch({ type: 'FORMULA_VERIFIED_SUCCESS', substanceId: id })
                  }
                  onContinueToCards={() =>
                    dispatch({ type: 'NAVIGATE_STEP', step: 4 })
                  }
                />
              )}

              {/* STEP 4: 物质知识卡片（解锁后可见） */}
              {state.currentStep === 4 && confirmedSubstance && isFormulaUnlocked && (
                <StepKnowledgeCard
                  substance={confirmedSubstance}
                  onNextStep={() => dispatch({ type: 'NAVIGATE_STEP', step: 5 })}
                />
              )}

              {/* STEP 5: 相关反应方程式（解锁后可见） */}
              {state.currentStep === 5 && confirmedSubstance && isFormulaUnlocked && (
                <StepReactions
                  substance={confirmedSubstance}
                  edition={state.edition}
                  onNextStep={() => dispatch({ type: 'NAVIGATE_STEP', step: 6 })}
                />
              )}

              {/* STEP 6: 随堂练习与反馈（解锁后可见） */}
              {state.currentStep === 6 && confirmedSubstance && isFormulaUnlocked && (
                <StepQuizPanel
                  substance={confirmedSubstance}
                  edition={state.edition}
                  onRestartFlow={handleResetAll}
                />
              )}
            </div>
          </div>
        )}
      </main>

      {/* Camera Modal */}
      <CameraCaptureModal
        isOpen={cameraOpen}
        onClose={() => setCameraOpen(false)}
        onCaptureBlob={(blob, name) => handleProcessBlob(blob, name, 'camera')}
        onFallbackUpload={triggerUploadPicker}
      />

      {/* About & Data Review Modal */}
      {aboutOpen && (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="about-modal-title"
        >
          <div className="modal-card">
            <div className="modal-header">
              <h3 id="about-modal-title">关于「化学识物小课堂」与数据说明</h3>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setAboutOpen(false)}
              >
                关闭
              </button>
            </div>
            <div className="about-content">
              <p>
                <strong>教学设计理念：</strong>
                本网站专为初中化学学习设计，采用“先辨认名称 → 再根据微观粒子构成或元素质量比推导书写化学式 → 校验通过后解锁知识卡片、反应方程式与随堂练习”的闯关学习链路，帮助学生扎实掌握化学用语书写与物质性质规律。
              </p>
              <p>
                <strong>知识库与审校状态声明：</strong>
                本站内置的物质性质、化学方程式与随堂练习题库当前状态为「AI 整理，尚未经教师审校」，出处标注为「通用初中化学基础（知识库自编，未对应具体页码）」，未对应具体纸质教材章节页码；切换教材版本功能目前按标签筛选供教学参考，请以实际使用教材和任课教师讲解为准。
              </p>
              <p>
                <strong>隐私保护承诺：</strong>
                当前为纯前端演示模式，你上传或拍摄的照片仅保存在当前浏览器页面内存中，不会上传至任何服务器，也不会写入本地持久化存储。
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
