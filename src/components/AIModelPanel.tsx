import React, { useEffect, useState } from 'react';
import { normalizeEndpoint } from '../modules/recognition';
import {
  AI_PROVIDER_PRESETS,
  applyProviderPreset,
  clearOnlineAIConfig,
  DEFAULT_ONLINE_AI_CONFIG,
  getActiveProviderDisplayName,
  saveOnlineAIConfig,
} from '../modules/recognition/aiConfig';
import { AIProviderPresetId, OnlineAIConfig } from '../types/chemistry';

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
  const [selectedPreset, setSelectedPreset] = useState<AIProviderPresetId>(
    config.enabled ? config.providerPreset : 'demo'
  );
  const [draft, setDraft] = useState<OnlineAIConfig>(config);
  const [showKey, setShowKey] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [statusFeedback, setStatusFeedback] = useState<{
    type: 'success' | 'warn' | 'info';
    text: string;
  } | null>(null);

  useEffect(() => {
    setDraft(config);
    setSelectedPreset(config.enabled ? config.providerPreset : 'demo');
  }, [config]);

  const isOnlineActive = config.enabled && Boolean(config.apiKey.trim());
  const activeDisplayName = getActiveProviderDisplayName(config);
  const currentPresetSpec =
    AI_PROVIDER_PRESETS.find((p) => p.id === selectedPreset) ?? AI_PROVIDER_PRESETS[0];

  const handleSelectPresetCard = (presetId: AIProviderPresetId) => {
    setSelectedPreset(presetId);
    setStatusFeedback(null);

    if (presetId === 'demo') {
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

    const updated = applyProviderPreset(draft, presetId);
    setDraft(updated);
    if (updated.apiKey.trim()) {
      saveOnlineAIConfig(updated);
      onSaveConfig(updated);
    }
  };

  const verifyConnection = async (targetCfg: OnlineAIConfig) => {
    const key = targetCfg.apiKey.trim();
    if (!key) return;
    const endpoint = normalizeEndpoint(targetCfg.baseURL);
    const modelName = targetCfg.model.trim() || 'deepseek-chat';

    setIsTesting(true);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);

    try {
      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
          model: modelName,
          max_tokens: 16,
          messages: [{ role: 'user', content: 'Reply with OK' }],
        }),
        signal: controller.signal,
      });

      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}`);
      }

      setStatusFeedback({
        type: 'success',
        text: `已成功启用并连通 ${getActiveProviderDisplayName(targetCfg)}！接口（${endpoint}）响应正常，API Key 仅保存在当前标签页 sessionStorage 中。`,
      });
    } catch (err) {
      const detail = err instanceof Error ? err.message : '网络或跨域异常';
      setStatusFeedback({
        type: 'warn',
        text: `已保存 ${getActiveProviderDisplayName(targetCfg)} 配置（接口测试返回：${detail}）。如果网络或跨域受限，识别时会自动平滑降级到本地词库匹配。`,
      });
    } finally {
      clearTimeout(timer);
      setIsTesting(false);
    }
  };

  const handleSubmitAI = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedPreset === 'demo') {
      handleSelectPresetCard('demo');
      return;
    }

    const trimmedKey = draft.apiKey.trim();
    if (!trimmedKey) {
      setStatusFeedback({
        type: 'warn',
        text: `请先在下方输入 ${currentPresetSpec.shortLabel} 的 API Key，再点击“提交并启用 AI 调用”。`,
      });
      return;
    }

    const cleaned: OnlineAIConfig = {
      ...draft,
      enabled: true,
      providerPreset: selectedPreset,
      baseURL: draft.baseURL.trim() || currentPresetSpec.defaultBaseURL,
      model: draft.model.trim() || currentPresetSpec.defaultModel,
      apiKey: trimmedKey,
    };

    setDraft(cleaned);
    saveOnlineAIConfig(cleaned);
    onSaveConfig(cleaned);
    await verifyConnection(cleaned);
  };

  const handleClearKey = () => {
    clearOnlineAIConfig();
    const resetCfg: OnlineAIConfig = {
      ...DEFAULT_ONLINE_AI_CONFIG,
      enabled: false,
      providerPreset: 'demo',
    };
    setSelectedPreset('demo');
    setDraft(resetCfg);
    onSaveConfig(resetCfg);
    setStatusFeedback({
      type: 'info',
      text: '已清除当前会话中的 API Key，并恢复为默认「演示模式」。',
    });
  };

  return (
    <section
      className={`ai-panel-card ${compact ? 'is-compact' : ''}`}
      aria-labelledby="ai-panel-heading"
      data-testid="ai-model-panel"
    >
      <div className="ai-panel-header">
        <div>
          <span className="ai-panel-eyebrow">背后辅助模型选择 · 可视化配置</span>
          <h2 id="ai-panel-heading">选择识物辅助模型（支持 DeepSeek / 多模态 / 本地演示）</h2>
        </div>
        <div className="ai-panel-status-wrap">
          <span
            className={`ai-active-pill ${isOnlineActive ? 'is-online' : 'is-demo'}`}
            data-testid="ai-panel-active-status"
          >
            当前生效：{activeDisplayName}
          </span>
        </div>
      </div>

      {/* 4 个可视化模型预设选项卡片 */}
      <div className="ai-preset-grid" role="radiogroup" aria-label="选择背后辅助模型">
        {AI_PROVIDER_PRESETS.map((preset) => {
          const isSelected = selectedPreset === preset.id;
          return (
            <button
              key={preset.id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              className={`ai-preset-card ${isSelected ? 'is-selected' : ''}`}
              onClick={() => handleSelectPresetCard(preset.id)}
              data-testid={`ai-preset-${preset.id}`}
            >
              <div className="ai-preset-top">
                <strong className="ai-preset-title">{preset.shortLabel}</strong>
                <span className="ai-preset-badge">{preset.badge}</span>
              </div>
              <p className="ai-preset-desc">{preset.description}</p>
            </button>
          );
        })}
      </div>

      {/* 当选择 DeepSeek / 多模态识图 / 自定义 时，直接展开可填写的 API 提交表单 */}
      {selectedPreset !== 'demo' && (
        <form onSubmit={handleSubmitAI} className="ai-inline-form" data-testid="ai-inline-form">
          <div className="ai-inline-grid">
            <div className="form-field">
              <label htmlFor="panel-ai-key">
                {currentPresetSpec.shortLabel} API Key（必填 · 仅存当前标签页 sessionStorage）
              </label>
              <div className="key-input-wrap">
                <input
                  id="panel-ai-key"
                  type={showKey ? 'text' : 'password'}
                  value={draft.apiKey}
                  onChange={(e) =>
                    setDraft((prev) => ({ ...prev, apiKey: e.target.value }))
                  }
                  placeholder={
                    selectedPreset === 'deepseek'
                      ? '输入 DeepSeek API Key，例如 sk-...'
                      : '输入兼容接口 API Key，例如 sk-...'
                  }
                  autoComplete="off"
                />
                <button
                  type="button"
                  className="btn-ghost btn-xs"
                  onClick={() => setShowKey((v) => !v)}
                >
                  {showKey ? '隐藏' : '显示'}
                </button>
              </div>
            </div>

            <div className="form-field">
              <label htmlFor="panel-ai-model">模型名称（model）</label>
              <input
                id="panel-ai-model"
                type="text"
                value={draft.model}
                onChange={(e) =>
                  setDraft((prev) => ({ ...prev, model: e.target.value }))
                }
                placeholder={currentPresetSpec.defaultModel}
              />
              {currentPresetSpec.suggestedModels.length > 0 && (
                <div className="model-quick-chips">
                  {currentPresetSpec.suggestedModels.map((m) => (
                    <button
                      key={m}
                      type="button"
                      className={`mini-chip ${draft.model === m ? 'is-active' : ''}`}
                      onClick={() => setDraft((prev) => ({ ...prev, model: m }))}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="form-field">
              <label htmlFor="panel-ai-baseurl">接口地址（baseURL）</label>
              <input
                id="panel-ai-baseurl"
                type="url"
                value={draft.baseURL}
                onChange={(e) =>
                  setDraft((prev) => ({ ...prev, baseURL: e.target.value }))
                }
                placeholder={currentPresetSpec.defaultBaseURL}
              />
            </div>

            {selectedPreset === 'custom' && (
              <div className="form-field">
                <label htmlFor="panel-ai-mode">能力模式</label>
                <select
                  id="panel-ai-mode"
                  value={draft.providerMode}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      providerMode: e.target.value as OnlineAIConfig['providerMode'],
                    }))
                  }
                >
                  <option value="text_assist">文本辅助映射（DeepSeek 等文本模型）</option>
                  <option value="vision">多模态识图（支持图像输入的视觉模型）</option>
                </select>
              </div>
            )}
          </div>

          <div className="ai-inline-footer">
            <span className="ai-security-tip">
              安全约束：大模型仅负责将标签文字或描述映射到知识库白名单物质 ID，绝不编造化学式或方程式；API Key 不会写入代码或 localStorage。
            </span>
            <div className="action-row">
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
                type="submit"
                className="btn-primary"
                disabled={isTesting}
                data-testid="submit-ai-config-btn"
              >
                {isTesting ? '正在验证并连接...' : `提交并启用 ${currentPresetSpec.shortLabel}`}
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
