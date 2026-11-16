import React, { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { AIModelPanel } from './components/AIModelPanel';
import { CameraCaptureModal } from './components/CameraCaptureModal';
import { OnlineSettingsModal, ThirdPartyConsentModal } from './components/P1Modals';
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
import {
  demoProvider,
  LLMTextAssistProvider,
  localTextMatcher,
  VisionProvider,
} from './modules/recognition';
import {
  getActiveProviderDisplayName,
  isOnlineAIEnabled,
  loadOnlineAIConfig,
  saveOnlineAIConfig,
} from './modules/recognition/aiConfig';
import {
  INITIAL_LEARNING_STATE,
  isStepUnlocked,
  learningReducer,
} from './state/learningMachine';
import {
  DemoSample,
  LearningStep,
  OnlineAIConfig,
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

const DEEPSEEK_EXAMPLE_PROMPTS = [
  '瓶身标签写着苛性钠，白色片状固体',
  '灰白色矿石标本，常用于实验室制取二氧化碳',
  '能使澄清石灰水变浑浊的无色无味气体',
];

export const App: React.FC = () => {
  const [state, dispatch] = useReducer(learningReducer, INITIAL_LEARNING_STATE);
  const [aiConfig, setAiConfig] = useState<OnlineAIConfig>(() => loadOnlineAIConfig());

  const [cameraOpen, setCameraOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [step2AIPanelOpen, setStep2AIPanelOpen] = useState(false);

  const [pendingConsentUpload, setPendingConsentUpload] = useState<{
    blob: Blob;
    fileName: string;
    sourceType: 'upload' | 'camera';
    config: OnlineAIConfig;
  } | null>(null);

  const [manualQuery, setManualQuery] = useState('');
  const [manualMatches, setManualMatches] = useState<string[]>([]);
  const [manualFeedback, setManualFeedback] = useState<string | null>(null);
  const [manualFeedbackType, setManualFeedbackType] = useState<'info' | 'warn'>('warn');
  const [isSearchingText, setIsSearchingText] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const previousBlobUrlRef = useRef<string | null>(null);
  const recognitionRequestId = useRef(0);
  const textRequestId = useRef(0);

  const isOnlineModeActive = isOnlineAIEnabled(aiConfig);
  const activeEngineLabel = getActiveProviderDisplayName(aiConfig);
  const isDeepSeekActive =
    isOnlineModeActive &&
    (aiConfig.providerPreset === 'deepseek' || aiConfig.baseURL.includes('deepseek'));

  useEffect(() => {
    dispatch({
      type: 'SET_RUN_MODE',
      mode: isOnlineModeActive ? 'online' : 'demo',
    });
  }, [isOnlineModeActive]);

  useEffect(() => {
    if (!state.teacherMode.enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!e.altKey) return;
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        const nextStep = Math.min(6, state.currentStep + 1) as LearningStep;
        dispatch({ type: 'NAVIGATE_STEP', step: nextStep });
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        const prevStep = Math.max(1, state.currentStep - 1) as LearningStep;
        dispatch({ type: 'NAVIGATE_STEP', step: prevStep });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [state.teacherMode.enabled, state.currentStep]);

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
    textRequestId.current++;
    setIsSearchingText(false);
    setManualQuery('');
    setManualMatches([]);
    setManualFeedback(null);
    setManualFeedbackType('warn');
  };

  const handleSelectSample = async (sample: DemoSample) => {
    const requestId = ++recognitionRequestId.current;
    setPendingConsentUpload(null);
    resetManualSearch();
    dispatch({
      type: 'START_RECOGNIZING',
      sourceType: 'sample',
      sampleId: sample.id,
    });
    const res = await demoProvider.recognize({ sampleId: sample.id });
    if (requestId === recognitionRequestId.current) dispatch({ type: 'RECOGNITION_DONE', result: res });
  };

  const runRecognitionForBlob = async (
    blob: Blob,
    fileName: string,
    sourceType: 'upload' | 'camera',
    useOnlineVision: boolean,
    config: OnlineAIConfig = aiConfig
  ) => {
    const requestId = ++recognitionRequestId.current;
    const online = isOnlineAIEnabled(config);
    resetManualSearch();
    const objectUrl = URL.createObjectURL(blob);
    dispatch({
      type: 'START_RECOGNIZING',
      sourceType,
      imageUrl: objectUrl,
      fileName,
    });

    if (useOnlineVision && online && config.providerMode === 'vision') {
      const vision = new VisionProvider(config);
      const res = await vision.recognize({ image: blob });
      if (requestId === recognitionRequestId.current) dispatch({ type: 'RECOGNITION_DONE', result: res });
      return;
    }

    if (online && config.providerMode === 'text_assist') {
      dispatch({
        type: 'RECOGNITION_DONE',
        result: {
          status: 'ambiguous',
          candidates: [],
          message: `已保存图片预览。当前已启用「${activeEngineLabel}」（文本辅助模式，不会将图片上传给第三方），请在下方输入照片中的标签文字或物质外观描述，点击调用 ${activeEngineLabel} 进行识别。`,
          providerUsed: 'llm_text_assist',
        },
      });
      return;
    }

    const res = await demoProvider.recognize({ image: blob });
    if (requestId === recognitionRequestId.current) dispatch({ type: 'RECOGNITION_DONE', result: res });
  };

  const handleProcessBlob = async (
    blob: Blob,
    fileName: string,
    sourceType: 'upload' | 'camera'
  ) => {
    recognitionRequestId.current++;
    if (
      isOnlineModeActive &&
      aiConfig.providerMode === 'vision' &&
      !aiConfig.imageUploadConsented
    ) {
      setPendingConsentUpload({ blob, fileName, sourceType, config: { ...aiConfig } });
      return;
    }

    await runRecognitionForBlob(
      blob,
      fileName,
      sourceType,
      isOnlineModeActive && aiConfig.providerMode === 'vision'
    );
  };

  const handleAgreeConsent = async () => {
    if (!pendingConsentUpload) return;
    const nextCfg: OnlineAIConfig = { ...pendingConsentUpload.config, imageUploadConsented: true };
    saveOnlineAIConfig(nextCfg);
    setAiConfig(nextCfg);
    const pending = pendingConsentUpload;
    setPendingConsentUpload(null);
    await runRecognitionForBlob(pending.blob, pending.fileName, pending.sourceType, true, nextCfg);
  };

  const handleDeclineConsent = async () => {
    if (!pendingConsentUpload) return;
    const pending = pendingConsentUpload;
    setPendingConsentUpload(null);
    await runRecognitionForBlob(pending.blob, pending.fileName, pending.sourceType, false, pending.config);
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

  const executeTextQuery = async (rawText: string) => {
    const q = rawText.trim();
    if (!q) {
      setManualMatches([]);
      setManualFeedbackType('warn');
      setManualFeedback('请输入物质名称、俗称或标签文字，例如“稀盐酸”“氢氧化钠”“石灰石”“水”。');
      return;
    }

    const requestId = ++textRequestId.current;
    setIsSearchingText(true);
    try {
      const res = isOnlineModeActive
        ? await new LLMTextAssistProvider(aiConfig).recognize({ text: q })
        : await localTextMatcher.recognize({ text: q });
      if (requestId !== textRequestId.current) return;

      if (res.status === 'ok' && res.candidates.length > 0) {
        setManualMatches(res.candidates.map((c) => c.substanceId));
        if (res.fallbackNotice) {
          setManualFeedbackType(res.fallbackNotice.includes('失败') ? 'warn' : 'info');
          setManualFeedback(res.fallbackNotice);
        } else {
          setManualFeedback(null);
        }
      } else {
        setManualMatches([]);
        setManualFeedbackType('warn');
        setManualFeedback(
          [res.fallbackNotice, res.message ?? '暂不在当前学习范围内']
            .filter(Boolean)
            .join(' ')
        );
      }
    } finally {
      if (requestId === textRequestId.current) setIsSearchingText(false);
    }
  };

  const handleManualSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    await executeTextQuery(manualQuery);
  };

  const handleConfirmSubstance = (substanceId: string) => {
    recognitionRequestId.current++;
    resetManualSearch();
    dispatch({ type: 'CONFIRM_SUBSTANCE', substanceId });
  };

  const handleHotspotClick = (hotspot: SampleHotspot) => {
    dispatch({ type: 'SELECT_HOTSPOT', hotspot });
  };

  const handleResetAll = () => {
    recognitionRequestId.current++;
    resetManualSearch();
    setPendingConsentUpload(null);
    setStep2AIPanelOpen(false);
    dispatch({ type: 'RESET_ALL' });
  };

  const handleUpdateAIConfig = (next: OnlineAIConfig) => {
    recognitionRequestId.current++;
    resetManualSearch();
    setPendingConsentUpload(null);
    setAiConfig(next);
  };

  const step2CandidateIds = useMemo(() => {
    const ids = new Set<string>();
    state.recognitionResult?.candidates.forEach((c) => ids.add(c.substanceId));
    manualMatches.forEach((id) => ids.add(id));
    return Array.from(ids);
  }, [state.recognitionResult, manualMatches]);

  const hasMediaPreview =
    state.imageSourceType !== 'none' &&
    (Boolean(activeSample) || Boolean(state.uploadedImageUrl));

  const shellClasses = [
    'app-shell',
    state.teacherMode.enabled ? 'is-teacher-mode' : '',
    state.teacherMode.enabled && state.teacherMode.projectorLargeText
      ? 'is-projector-large'
      : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={shellClasses}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={handleFileChange}
        data-testid="image-file-input"
      />

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
                <strong className="brand-title">化学识物小课堂 · P1</strong>
                <span className="brand-slogan">从一张照片，认识一种物质</span>
              </span>
            </button>
          </div>

          <div className="navbar-controls">
            <button
              type="button"
              className={`mode-badge ${isOnlineModeActive ? 'is-online' : 'is-demo'}`}
              onClick={() => setSettingsOpen(true)}
              title="管理在线识图、离线演示、API 连接与教师演示设置"
              data-testid="run-mode-badge"
            >
              {isOnlineModeActive ? `在线增强 · ${activeEngineLabel}` : '演示模式'}
            </button>

            {state.teacherMode.enabled && (
              <span className="teacher-pill" data-testid="teacher-mode-badge">
                教师演示中
              </span>
            )}

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
              className="btn-secondary btn-sm"
              onClick={() => setSettingsOpen(true)}
            >
              设置与教师模式
            </button>

            <button
              type="button"
              className="btn-ghost btn-sm"
              onClick={() => setAboutOpen(true)}
            >
              关于与审校说明
            </button>
          </div>
        </div>

        <div className="edition-notice-bar">
          版本适配仅供参考，以所用教材为准 · 知识库当前状态：AI 整理，尚未经教师审校
          {state.teacherMode.enabled && ' · 教师快捷键：Alt + ← / → 切换步骤'}
        </div>
      </header>

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

      <main className="container main-workspace">
        {state.currentStep === 1 ? (
          <div className="home-layout">
            <section className="hero-card">
              <div className="hero-badge">
                初中化学互动学习 · 六步闯关识物 · {activeEngineLabel}
              </div>
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
                隐私说明：图片预览仅保留在当前页面内存中；默认由 DeepSeek V4.1 Flash 识图，发送前需你授权。默认 Key 仅由本机服务端保管；自备 API Key 仅存当前标签页 sessionStorage。
              </p>
            </section>

            {/* 可视化 AI 辅助模型选择与 API 提交面板（直接展示在首页） */}
            <AIModelPanel config={aiConfig} onSaveConfig={handleUpdateAIConfig} />

            <section className="samples-section" aria-labelledby="samples-heading">
              <div className="section-head">
                <h2 id="samples-heading">试试内置样例（一键体验 5 大典型教学场景）</h2>
                <p>覆盖清晰标签溶液、纯净物、无标签未知液体、混合物、多物体识别与超纲物质：</p>
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
          <div className="study-two-col">
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

            <div className="study-main-col">
              {state.currentStep === 2 && (
                <section className="card step-card" aria-labelledby="step2-title">
                  <div className="step-header-row">
                    <div>
                      <span className="step-badge">步骤 2 · 名称辨认</span>
                      <h2 id="step2-title">候选物质与名称确认</h2>
                    </div>

                    <button
                      type="button"
                      className="btn-secondary btn-sm"
                      onClick={() => setStep2AIPanelOpen((v) => !v)}
                    >
                      {step2AIPanelOpen
                        ? '收起模型配置'
                        : `切换模型 / 配置 API（当前：${activeEngineLabel}）`}
                    </button>
                  </div>

                  {step2AIPanelOpen && (
                    <div className="step2-ai-drawer">
                      <AIModelPanel
                        config={aiConfig}
                        onSaveConfig={handleUpdateAIConfig}
                        compact
                      />
                    </div>
                  )}

                  {state.systemStatus === 'recognizing' && (
                    <div className="status-banner is-info" role="status">
                      正在识别内容，请稍候...
                    </div>
                  )}

                  {state.fallbackNotice && (
                    <div className="status-banner is-info" role="status">
                      {state.fallbackNotice}
                    </div>
                  )}

                  {((activeSample?.hotspots && activeSample.hotspots.length > 0) ||
                    (state.recognitionResult?.objects &&
                      state.recognitionResult.objects.length > 0)) && (
                    <div className="multi-object-box">
                      <p className="multi-object-tip">
                        <strong>检测到图片中包含多个物体：</strong>
                        请先在下方图片中点击你要学习的物体（或点击对应热区标签）：
                      </p>
                      {activeSample ? (
                        <SampleIllustration
                          svgKind={activeSample.svgKind}
                          hotspots={activeSample.hotspots}
                          selectedHotspotId={state.selectedHotspotId}
                          onSelectHotspot={handleHotspotClick}
                        />
                      ) : (
                        state.uploadedImageUrl &&
                        state.recognitionResult?.objects && (
                          <div className="sample-illustration-wrap">
                            <div className="sample-svg-stage">
                              <img
                                src={state.uploadedImageUrl}
                                alt="多物体识别图像"
                                className="sample-svg"
                              />
                              <div className="hotspot-overlay" aria-label="可点选物体区域">
                                {state.recognitionResult.objects.map((hs) => {
                                  const [x, y, w, h] = hs.bbox;
                                  const isSelected = state.selectedHotspotId === hs.id;
                                  return (
                                    <button
                                      key={hs.id}
                                      type="button"
                                      className={`hotspot-box ${isSelected ? 'is-selected' : ''} ${
                                        hs.isApparatus ? 'is-apparatus' : ''
                                      }`}
                                      style={{
                                        left: `${x}%`,
                                        top: `${y}%`,
                                        width: `${w}%`,
                                        height: `${h}%`,
                                      }}
                                      onClick={() => handleHotspotClick(hs)}
                                    >
                                      <span className="hotspot-tag">{hs.label}</span>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        )
                      )}

                      {state.apparatusNotice && (
                        <div className="status-banner is-warn" role="alert">
                          {state.apparatusNotice}
                        </div>
                      )}
                    </div>
                  )}

                  {state.statusMessage && (
                    <div
                      className={`status-banner ${
                        state.recognitionResult?.status === 'out_of_scope'
                          ? 'is-error'
                          : isOnlineModeActive
                          ? 'is-info'
                          : 'is-warn'
                      }`}
                      role="status"
                    >
                      {state.statusMessage}
                    </div>
                  )}

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

                  <div className="manual-search-box">
                    <h3>
                      {isDeepSeekActive
                        ? 'DeepSeek 智能标签文字 / 物质描述识别'
                        : isOnlineModeActive
                        ? `${activeEngineLabel} 文本辅助识别`
                        : '手动输入或搜索物质名称'}
                    </h3>
                    <p className="manual-search-desc">
                      {isDeepSeekActive
                        ? '请输入照片上的试剂标签文字、常见俗称或物质外观/用途描述，提交后由 DeepSeek 映射到初中化学知识库（仅返回物质名称，不剧透化学式）：'
                        : '如果图片无标签、未自动列出候选，或你想学习其他初中化学物质，可在此输入名称、常见俗称或标签文字（如“稀盐酸”“烧碱”“石灰石”“铁钉”）：'}
                    </p>
                    <form onSubmit={handleManualSearch} className="manual-search-form">
                      <label htmlFor="manual-substance-input" className="sr-only">
                        输入物质名称或描述
                      </label>
                      <input
                        id="manual-substance-input"
                        type="text"
                        value={manualQuery}
                        onChange={(e) => setManualQuery(e.target.value)}
                        placeholder={
                          isDeepSeekActive
                            ? '例如：瓶身写着苛性钠，白色片状固体...'
                            : '输入物质名称、俗称或标签描述...'
                        }
                        className="text-input"
                      />
                      <button
                        type="submit"
                        className="btn-primary"
                        disabled={isSearchingText}
                        data-testid="step2-search-submit-btn"
                      >
                        {isSearchingText
                          ? isDeepSeekActive
                            ? 'DeepSeek 识别中...'
                            : '正在匹配...'
                          : isDeepSeekActive
                          ? '调用 DeepSeek 识别'
                          : isOnlineModeActive
                          ? '调用 AI 识别'
                          : '搜索名称'}
                      </button>
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={triggerUploadPicker}
                      >
                        重新上传
                      </button>
                    </form>

                    {isDeepSeekActive && (
                      <div className="quick-pick-area">
                        <span className="quick-pick-label">一键填入描述测试 DeepSeek：</span>
                        <div className="quick-pick-chips">
                          {DEEPSEEK_EXAMPLE_PROMPTS.map((samplePrompt) => (
                            <button
                              key={samplePrompt}
                              type="button"
                              className="chip-btn"
                              onClick={() => {
                                setManualQuery(samplePrompt);
                                void executeTextQuery(samplePrompt);
                              }}
                            >
                              {samplePrompt}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {manualFeedback && (
                      <div
                        className={`status-banner ${
                          manualFeedbackType === 'info' ? 'is-info' : 'is-warn'
                        }`}
                        role="status"
                      >
                        {manualFeedback}
                      </div>
                    )}

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

              {state.currentStep === 3 && confirmedSubstance && (
                <StepFormulaGate
                  substance={confirmedSubstance}
                  isAlreadyVerified={isFormulaUnlocked}
                  failedAttempts={state.formulaFailedAttempts[confirmedSubstance.id] ?? 0}
                  onIncorrectAttempt={(id) => dispatch({ type: 'FORMULA_ATTEMPT_FAILED', substanceId: id })}
                  teacherModeEnabled={state.teacherMode.enabled}
                  onVerifiedSuccess={(id) =>
                    dispatch({ type: 'FORMULA_VERIFIED_SUCCESS', substanceId: id })
                  }
                  onTeacherForceUnlock={(id) =>
                    dispatch({ type: 'TEACHER_FORCE_UNLOCK', substanceId: id })
                  }
                  onContinueToCards={() =>
                    dispatch({ type: 'NAVIGATE_STEP', step: 4 })
                  }
                />
              )}

              {state.currentStep === 4 && confirmedSubstance && isFormulaUnlocked && (
                <StepKnowledgeCard
                  substance={confirmedSubstance}
                  onNextStep={() => dispatch({ type: 'NAVIGATE_STEP', step: 5 })}
                />
              )}

              {state.currentStep === 5 && confirmedSubstance && isFormulaUnlocked && (
                <StepReactions
                  substance={confirmedSubstance}
                  edition={state.edition}
                  onNextStep={() => dispatch({ type: 'NAVIGATE_STEP', step: 6 })}
                />
              )}

              {state.currentStep === 6 && confirmedSubstance && isFormulaUnlocked && (
                <StepQuizPanel
                  key={`${confirmedSubstance.id}:${state.edition}`}
                  substance={confirmedSubstance}
                  edition={state.edition}
                  teacherDelayReveal={
                    state.teacherMode.enabled && state.teacherMode.delayRevealAnswers
                  }
                  onRestartFlow={handleResetAll}
                />
              )}
            </div>
          </div>
        )}
      </main>

      <CameraCaptureModal
        isOpen={cameraOpen}
        onClose={() => setCameraOpen(false)}
        onCaptureBlob={(blob, name) => handleProcessBlob(blob, name, 'camera')}
        onFallbackUpload={triggerUploadPicker}
      />

      <OnlineSettingsModal
        isOpen={settingsOpen}
        config={aiConfig}
        teacherMode={state.teacherMode}
        onClose={() => setSettingsOpen(false)}
        onSaveConfig={handleUpdateAIConfig}
        onUpdateTeacherMode={(patch) =>
          dispatch({ type: 'UPDATE_TEACHER_MODE', patch })
        }
      />

      <ThirdPartyConsentModal
        isOpen={Boolean(pendingConsentUpload)}
        baseURL={pendingConsentUpload?.config.baseURL ?? aiConfig.baseURL}
        model={pendingConsentUpload?.config.model ?? aiConfig.model}
        onAgree={handleAgreeConsent}
        onDecline={handleDeclineConsent}
      />

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
                <strong>隐私与 API Key 安全承诺：</strong>
                图片预览仅保存在当前页面内存中（URL.createObjectURL）；在线识图会在你授权后将压缩图片发送给所选模型。内置 DeepSeek Key 只由本机服务端读取，不进入浏览器或构建产物；自备 Key 仅存当前标签页 sessionStorage。
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
