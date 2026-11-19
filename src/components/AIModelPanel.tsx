import React, { useEffect, useState } from 'react';
import {
  clearOnlineAIConfig,
  DEFAULT_ONLINE_AI_CONFIG,
  getActiveProviderDisplayName,
  getProviderPresetForURL,
  hasOnlineCredentials,
  isOnlineAIEnabled,
  normalizeBaseURL,
  parseImportedAIConfig,
  saveOnlineAIConfig,
  testAIConnection,
  updateOnlineAIConfig,
} from '../modules/recognition/aiConfig';
import { IS_STATIC_HOSTING } from '../modules/recognition/defaults';
import { AICredentialControl } from './AICredentialControl';
import { OnlineAIConfig } from '../types/chemistry';

type AIRunMode = 'online' | 'demo';

const AI_RUN_MODES: { id: AIRunMode; title: string; badge: string; description: string }[] = [
  {
    id: 'online',
    title: '在线 AI 识图',
    badge: '默认 DeepSeek',
    description: IS_STATIC_HOSTING
      ? '默认模型为 DeepSeek V4.1 Flash。静态网页请先填写自备 API Key，再授权上传识图；也可更换接口。'
      : '默认使用 DeepSeek V4.1 Flash。直接上传或拍照即可识图；需要更换 API 时，在下方填写连接信息。',
  },
  {
    id: 'demo',
    title: '离线演示',
    badge: '无需 Key',
    description: '使用内置样例和本地词库，不调用在线模型，适合无网络演示或先体验学习流程。',
  },
];

interface AIModelPanelProps {
  config: OnlineAIConfig;
  onSaveConfig: (next: OnlineAIConfig) => void;
  compact?: boolean;
}

export const AIModelPanel: React.FC<AIModelPanelProps> = ({
  config,
  onSaveConfig,
  compact = false,
}) => {
  const [selectedMode, setSelectedMode] = useState<AIRunMode>(config.enabled ? 'online' : 'demo');
  const [draft, setDraft] = useState<OnlineAIConfig>(config);
  const [importOpen, setImportOpen] = useState(false);
  const [importRawText, setImportRawText] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [statusFeedback, setStatusFeedback] = useState<{
    type: 'success' | 'warn' | 'info';
    text: string;
  } | null>(null);

  useEffect(() => {
    setDraft(config);
    setSelectedMode(config.enabled ? 'online' : 'demo');
  }, [config]);

  const isOnlineActive = isOnlineAIEnabled(config);
  const activeDisplayName = getActiveProviderDisplayName(config);
  const handleSelectMode = (mode: AIRunMode) => {
    setSelectedMode(mode);
    setStatusFeedback(null);

    if (mode === 'demo') {
      const nextCfg: OnlineAIConfig = {
        ...draft,
        enabled: false,
        providerPreset: 'demo',
      };
      setDraft(nextCfg);
      saveOnlineAIConfig(nextCfg);
      onSaveConfig(nextCfg);
      setStatusFeedback({
        type: 'info',
        text: '已切换为「演示模式（本地离线）」，内置样例可直接点击体验。',
      });
      return;
    }

    const updated = updateOnlineAIConfig(draft, {
      enabled: true,
      providerPreset: getProviderPresetForURL(draft.baseURL),
    });
    setDraft(updated);
    if (hasOnlineCredentials(updated)) {
      saveOnlineAIConfig(updated);
      onSaveConfig(updated);
      setStatusFeedback({
        type: 'info',
        text: `已切换至「${getActiveProviderDisplayName(updated)}」（${
          updated.providerMode === 'vision' ? '多模态识图模式' : '纯文本映射模式，不上传图片'
        }），可点击“测试连接”验证接口。`,
      });
    }
  };

  const handleSmartImport = () => {
    const result = parseImportedAIConfig(importRawText, draft);
    if (result.error) {
      setStatusFeedback({ type: 'warn', text: result.error });
      return;
    }

    setDraft(result.config);
    setSelectedMode(result.config.enabled ? 'online' : 'demo');
    saveOnlineAIConfig(result.config);
    onSaveConfig(result.config);
    setImportRawText('');
    setImportOpen(false);
    setStatusFeedback({
      type: 'success',
      text: `已成功导入（识别到：${result.extractedFields.join('、')}）并自动匹配为「${getActiveProviderDisplayName(
        result.config
      )}」，建议点击“测试连接”确认接口连通性。`,
    });
  };

  const handleTestOnly = async () => {
    const candidateCfg: OnlineAIConfig = {
      ...draft,
      enabled: true,
      providerPreset: getProviderPresetForURL(draft.baseURL),
      baseURL: normalizeBaseURL(draft.baseURL || DEFAULT_ONLINE_AI_CONFIG.baseURL),
      model: draft.model.trim() || DEFAULT_ONLINE_AI_CONFIG.model,
      apiKey: draft.apiKey.trim(),
    };
    if (!hasOnlineCredentials(candidateCfg)) {
      setStatusFeedback({
        type: 'warn',
        text: '请先输入与所选接口匹配的 API Key，再点击“测试连接”。',
      });
      return;
    }

    setIsTesting(true);
    try {
      const outcome = await testAIConnection(candidateCfg);
      setStatusFeedback({
        type: outcome.ok ? 'success' : 'warn',
        text: outcome.message,
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSubmitAI = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedMode === 'demo') {
      handleSelectMode('demo');
      return;
    }

    const trimmedKey = draft.apiKey.trim();
    if (!hasOnlineCredentials(draft)) {
      setStatusFeedback({
        type: 'warn',
        text: '请先在下方输入与所选接口匹配的 API Key，再点击“保存并启用”。',
      });
      return;
    }

    const cleaned: OnlineAIConfig = {
      ...draft,
      enabled: true,
      providerPreset: getProviderPresetForURL(draft.baseURL),
      baseURL: normalizeBaseURL(draft.baseURL || DEFAULT_ONLINE_AI_CONFIG.baseURL),
      model: draft.model.trim() || DEFAULT_ONLINE_AI_CONFIG.model,
      apiKey: trimmedKey,
    };

    setDraft(cleaned);
    saveOnlineAIConfig(cleaned);
    onSaveConfig(cleaned);

    setIsTesting(true);
    try {
      const outcome = await testAIConnection(cleaned);
      setStatusFeedback({
        type: outcome.ok ? 'success' : 'warn',
        text: outcome.message,
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleClearKey = () => {
    clearOnlineAIConfig();
    const resetCfg: OnlineAIConfig = {
      ...DEFAULT_ONLINE_AI_CONFIG,
      enabled: false,
      providerPreset: 'demo',
    };
    setSelectedMode('demo');
    setDraft(resetCfg);
    onSaveConfig(resetCfg);
    setStatusFeedback({
      type: 'info',
      text: '已清除本标签页的自备 Key，并切换为离线演示。本机服务端默认 Key 未被删除。',
    });
  };

  const handleRestoreDefault = () => {
    const next = { ...DEFAULT_ONLINE_AI_CONFIG };
    setSelectedMode('online');
    setDraft(next);
    saveOnlineAIConfig(next);
    onSaveConfig(next);
    setStatusFeedback({ type: 'info', text: IS_STATIC_HOSTING
      ? '已恢复 DeepSeek 默认地址与模型；GitHub Pages 请填写自备 API Key 后再启用。'
      : '已恢复内置 DeepSeek V4.1 Flash 识图连接；发送图片前仍需授权。' });
  };

  return (
    <section
      className={`ai-panel-card ${compact ? 'is-compact' : ''}`}
      aria-labelledby="ai-panel-heading"
      data-testid="ai-model-panel"
    >
      <div className="ai-panel-header">
        <div>
          <span className="ai-panel-eyebrow">选择运行方式 · 管理 API 连接</span>
          <h2 id="ai-panel-heading">AI 识图（默认 DeepSeek V4.1 Flash · 可更换 API）</h2>
        </div>
        <div className="ai-panel-status-wrap">
          <button
            type="button"
            className="btn-secondary btn-sm"
            onClick={() => setImportOpen((v) => !v)}
            data-testid="toggle-smart-import-btn"
          >
            {importOpen ? '收起批量导入' : '📋 一键粘贴导入配置'}
          </button>
          <span
            className={`ai-active-pill ${isOnlineActive ? 'is-online' : 'is-demo'}`}
            data-testid="ai-panel-active-status"
          >
            当前生效：{activeDisplayName}
          </span>
        </div>
      </div>

      {IS_STATIC_HOSTING && (
        <div className="status-banner is-info" role="note" data-testid="static-hosting-notice">
          <strong>P0 课堂展示版 · 静态网页</strong>：此网页不包含本机默认 Key 或密钥网关。
          在线识图请填写自备 API Key（接口需允许浏览器跨域）；内置样例和本地搜索无需 Key。
          {' '}<a href="./p1/">前往 P1 学习版</a>
        </div>
      )}

      {/* 一键粘贴导入区（支持纯 API Key / .env / JSON / curl） */}
      {importOpen && (
        <div className="smart-import-box" data-testid="smart-import-box">
          <label htmlFor="smart-import-textarea" className="smart-import-label">
            支持直接粘贴 <strong>API Key（sk-... 或 UUID）</strong>、<strong>.env 配置行</strong>（如{' '}
            <code>DEEPSEEK_API_KEY=...</code>）、<strong>JSON 对象</strong> 或 <strong>curl 命令</strong>：
          </label>
          <textarea
            id="smart-import-textarea"
            rows={3}
            className="smart-import-textarea"
            value={importRawText}
            onChange={(e) => setImportRawText(e.target.value)}
            placeholder={'示例 1：直接粘贴自备 API Key\n示例 2：\nBASE_URL=https://api.deepseek.com/v1\nMODEL=deepseek-flash\nAPI_KEY=sk-xxxx'}
          />
          <div className="action-row">
            <button
              type="button"
              className="btn-primary btn-sm"
              onClick={handleSmartImport}
              data-testid="apply-smart-import-btn"
            >
              智能识别并导入
            </button>
            <button
              type="button"
              className="btn-ghost btn-sm"
              onClick={() => {
                setImportRawText('');
                setImportOpen(false);
              }}
            >
              取消
            </button>
          </div>
        </div>
      )}

      {/* 只保留在线识图和离线演示，不再展示其他服务商快捷入口。 */}
      <div className="ai-preset-grid" role="radiogroup" aria-label="选择 AI 运行方式">
        {AI_RUN_MODES.map((mode) => {
          const isSelected = selectedMode === mode.id;
          return (
            <button
              key={mode.id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              className={`ai-preset-card ${isSelected ? 'is-selected' : ''}`}
              onClick={() => handleSelectMode(mode.id)}
              data-testid={`ai-mode-${mode.id}`}
            >
              <div className="ai-preset-top">
                <strong className="ai-preset-title">{mode.title}</strong>
                <span className="ai-preset-badge">{mode.badge}</span>
              </div>
              <p className="ai-preset-desc">{mode.description}</p>
            </button>
          );
        })}
      </div>

      {/* 在线模式统一编辑连接信息，保留手动更换 API 的能力。 */}
      {selectedMode === 'online' && (
        <form onSubmit={handleSubmitAI} className="ai-inline-form" data-testid="ai-inline-form">
          <div className="ai-capability-banner">
            {draft.providerMode === 'vision' ? (
              <span>
                <strong>当前能力模式：多模态识图 + 文本映射</strong> — 上传/拍摄照片后将经你授权发送给该模型识别。
              </span>
            ) : (
              <span>
                <strong>当前能力模式：纯文本智能映射（不上传图片）</strong> — 此配置仅发送你输入的文字；如需看图，请选择 DeepSeek V4.1 Flash 或其他支持图片的模型并启用多模态模式。
              </span>
            )}
          </div>

          <div className="ai-inline-grid">
            <AICredentialControl config={draft} inputId="panel-ai-key" onChange={setDraft} />

            <div className="form-field">
              <label htmlFor="panel-ai-model">模型名称（model）</label>
              <input
                id="panel-ai-model"
                type="text"
                value={draft.model}
                onChange={(e) =>
                  setDraft((prev) => updateOnlineAIConfig(prev, { model: e.target.value }))
                }
                placeholder={DEFAULT_ONLINE_AI_CONFIG.model}
              />
            </div>

            <div className="form-field">
              <label htmlFor="panel-ai-baseurl">接口地址（baseURL，自动规范化）</label>
              <input
                id="panel-ai-baseurl"
                type="url"
                value={draft.baseURL}
                onChange={(e) =>
                  setDraft((prev) => updateOnlineAIConfig(prev, { baseURL: e.target.value }))
                }
                placeholder={DEFAULT_ONLINE_AI_CONFIG.baseURL}
              />
            </div>

            <div className="form-field">
              <label htmlFor="panel-ai-mode">能力模式</label>
              <select
                id="panel-ai-mode"
                value={draft.providerMode}
                onChange={(e) =>
                  setDraft((prev) => updateOnlineAIConfig(prev, {
                    providerMode: e.target.value as OnlineAIConfig['providerMode'],
                  }))
                }
              >
                <option value="vision">图片识别 + 文本辅助</option>
                <option value="text_assist">仅文本辅助（不上传图片）</option>
              </select>
            </div>
          </div>

          <div className="ai-inline-footer">
            <span className="ai-security-tip">
              安全约束：模型仅返回知识库白名单 ID；默认 Key 仅在本机服务端，自备 Key 仅存当前标签页。更换接口后需重新授权图片上传。
            </span>
            <div className="action-row">
              <button type="button" className="btn-secondary btn-sm" onClick={handleRestoreDefault} data-testid="restore-default-ai-btn">
                {IS_STATIC_HOSTING ? '恢复 DeepSeek 默认参数' : '恢复内置 DeepSeek 识图'}
              </button>
              {isOnlineActive && (
                <button
                  type="button"
                  className="btn-ghost btn-sm"
                  onClick={handleClearKey}
                >
                  清除 Key 并切回演示模式
                </button>
              )}
              <button
                type="button"
                className="btn-secondary"
                disabled={isTesting}
                onClick={handleTestOnly}
                data-testid="test-ai-connection-btn"
              >
                {isTesting ? '正在探测...' : '测试连接'}
              </button>
              <button
                type="submit"
                className="btn-primary"
                disabled={isTesting}
                data-testid="submit-ai-config-btn"
              >
                {isTesting ? '正在验证...' : '保存并启用连接'}
              </button>
            </div>
          </div>
        </form>
      )}

      {statusFeedback && (
        <div
          className={`status-banner ${
            statusFeedback.type === 'success'
              ? 'is-success'
              : statusFeedback.type === 'warn'
              ? 'is-warn'
              : 'is-info'
          }`}
          role="status"
          data-testid="ai-panel-feedback"
        >
          {statusFeedback.text}
        </div>
      )}
    </section>
  );
};
