import React, { useState } from 'react';
import { normalizeEndpoint } from '../modules/recognition';
import {
  AI_PROVIDER_PRESETS,
  applyProviderPreset,
  clearOnlineAIConfig,
  DEFAULT_ONLINE_AI_CONFIG,
  saveOnlineAIConfig,
} from '../modules/recognition/aiConfig';
import { AIProviderPresetId, OnlineAIConfig, TeacherModeState } from '../types/chemistry';

interface OnlineSettingsModalProps {
  isOpen: boolean;
  config: OnlineAIConfig;
  teacherMode: TeacherModeState;
  onClose: () => void;
  onSaveConfig: (next: OnlineAIConfig) => void;
  onUpdateTeacherMode: (patch: Partial<TeacherModeState>) => void;
}

const SUGGESTED_MODELS = ['deepseek-chat', 'deepseek-reasoner', 'gpt-4o-mini', 'qwen-vl-plus'];

export const OnlineSettingsModal: React.FC<OnlineSettingsModalProps> = ({
  isOpen,
  config,
  teacherMode,
  onClose,
  onSaveConfig,
  onUpdateTeacherMode,
}) => {
  const [draft, setDraft] = useState<OnlineAIConfig>(config);
  const [showKey, setShowKey] = useState(false);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);
  const [testStatus, setTestStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  React.useEffect(() => {
    if (isOpen) {
      setDraft(config);
      setSavedNotice(null);
      setTestStatus(null);
    }
  }, [isOpen, config]);

  if (!isOpen) return null;

  const handlePresetChange = (presetId: AIProviderPresetId) => {
    if (presetId === 'demo') {
      setDraft((prev) => ({ ...prev, enabled: false, providerPreset: 'demo' }));
    } else {
      setDraft((prev) => applyProviderPreset(prev, presetId));
    }
    setTestStatus(null);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned: OnlineAIConfig = {
      ...draft,
      baseURL: draft.baseURL.trim() || DEFAULT_ONLINE_AI_CONFIG.baseURL,
      model: draft.model.trim() || DEFAULT_ONLINE_AI_CONFIG.model,
      apiKey: draft.apiKey.trim(),
    };
    saveOnlineAIConfig(cleaned);
    onSaveConfig(cleaned);
    if (cleaned.enabled && !cleaned.apiKey) {
      setSavedNotice(
        '已保存配置。注意：你勾选了“启用在线增强模式”，但尚未填写 API Key，系统将暂时保持「演示模式」直到填入 Key。'
      );
    } else {
      setSavedNotice(
        '设置已保存（仅保存在当前浏览器标签页 sessionStorage 中，关闭标签页自动清除）。'
      );
    }
  };

  const handleTestConnection = async () => {
    const key = draft.apiKey.trim();
    if (!key) {
      setTestStatus({ ok: false, text: '请先填写 API Key 再测试接口连通性。' });
      return;
    }
    const endpoint = normalizeEndpoint(draft.baseURL || DEFAULT_ONLINE_AI_CONFIG.baseURL);
    const modelName = draft.model.trim() || DEFAULT_ONLINE_AI_CONFIG.model;

    setIsTesting(true);
    setTestStatus(null);
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
      setTestStatus({
        ok: true,
        text: `连接成功！接口（${endpoint}）与模型（${modelName}）响应正常，请点击下方“保存并应用设置”生效。`,
      });
    } catch (err) {
      const detail = err instanceof Error ? err.message : '网络或跨域 CORS 异常';
      setTestStatus({
        ok: false,
        text: `连接测试未通过（${detail}）。请检查接口地址、模型名称、Key 或浏览器跨域策略；即使不可用，学习流程仍会自动降级为本地搜索。`,
      });
    } finally {
      clearTimeout(timer);
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
    setDraft(resetCfg);
    onSaveConfig(resetCfg);
    setTestStatus(null);
    setSavedNotice('已清除会话中的 API Key 并切换回默认「演示模式」。');
  };

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-modal-title"
    >
      <div className="modal-card modal-card-lg">
        <div className="modal-header">
          <h3 id="settings-modal-title">运行模式与课堂设置（P1 正式版）</h3>
          <button type="button" className="btn-ghost btn-sm" onClick={onClose}>
            关闭
          </button>
        </div>

        <form onSubmit={handleSave} className="settings-form">
          {/* 1. 在线增强模式配置 */}
          <div className="settings-section">
            <div className="settings-section-head">
              <h4>1. 在线增强模式（DeepSeek / 多模态识图 / 文本辅助）</h4>
              <label className="switch-label">
                <input
                  type="checkbox"
                  checked={draft.enabled}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      enabled: e.target.checked,
                      providerPreset:
                        e.target.checked && prev.providerPreset === 'demo'
                          ? 'deepseek'
                          : prev.providerPreset,
                    }))
                  }
                />
                <span>启用在线增强模式</span>
              </label>
            </div>

            <p className="settings-desc">
              说明：启用后，模型<strong>仅负责将标签文字、描述或图片映射到知识库白名单物质 ID</strong>，所有化学式、方程式与题目仍严格来自已校验的本地结构化知识库；调用失败时自动降级为本地搜索。
            </p>

            {/* 快速切换模型预设 */}
            <div className="modal-preset-row">
              {AI_PROVIDER_PRESETS.filter((p) => p.id !== 'demo').map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  className={`mini-chip ${draft.providerPreset === preset.id ? 'is-active' : ''}`}
                  onClick={() => handlePresetChange(preset.id)}
                >
                  {preset.shortLabel}
                </button>
              ))}
            </div>

            <div className="settings-grid">
              <div className="form-field">
                <label htmlFor="ai-provider-mode">识别能力模式</label>
                <select
                  id="ai-provider-mode"
                  value={draft.providerMode}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      providerMode: e.target.value as OnlineAIConfig['providerMode'],
                    }))
                  }
                >
                  <option value="text_assist">仅文本辅助映射，不上传图片（DeepSeek 适用）</option>
                  <option value="vision">多模态识图 + 文本映射（支持看图的视觉模型）</option>
                </select>
              </div>

              <div className="form-field">
                <label htmlFor="ai-base-url">OpenAI 兼容接口地址（baseURL）</label>
                <input
                  id="ai-base-url"
                  type="url"
                  value={draft.baseURL}
                  onChange={(e) =>
                    setDraft((prev) => ({ ...prev, baseURL: e.target.value }))
                  }
                  placeholder="https://api.deepseek.com/v1"
                />
              </div>

              <div className="form-field">
                <label htmlFor="ai-model">模型名称（model）</label>
                <input
                  id="ai-model"
                  type="text"
                  value={draft.model}
                  onChange={(e) =>
                    setDraft((prev) => ({ ...prev, model: e.target.value }))
                  }
                  placeholder="deepseek-chat"
                />
                <div className="model-quick-chips">
                  {SUGGESTED_MODELS.map((m) => (
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
              </div>

              <div className="form-field">
                <label htmlFor="ai-api-key">API Key（仅存 sessionStorage）</label>
                <div className="key-input-wrap">
                  <input
                    id="ai-api-key"
                    type={showKey ? 'text' : 'password'}
                    value={draft.apiKey}
                    onChange={(e) =>
                      setDraft((prev) => ({ ...prev, apiKey: e.target.value }))
                    }
                    placeholder="sk-..."
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
                <div>
                  <button
                    type="button"
                    className="btn-secondary btn-xs"
                    disabled={isTesting}
                    onClick={handleTestConnection}
                  >
                    {isTesting ? '正在测试连接...' : '测试接口连通性'}
                  </button>
                </div>
              </div>
            </div>

            {testStatus && (
              <div
                className={`status-banner ${testStatus.ok ? 'is-success' : 'is-warn'}`}
                role="status"
              >
                {testStatus.text}
              </div>
            )}

            {draft.providerMode === 'vision' && (
              <label className="consent-checkbox-row">
                <input
                  type="checkbox"
                  checked={draft.imageUploadConsented}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      imageUploadConsented: e.target.checked,
                    }))
                  }
                />
                <span>
                  我已知晓并同意：在多模态识图模式下，所选图片将发送至上述配置的第三方模型接口进行识别（不在后端保存）。
                </span>
              </label>
            )}
          </div>

          {/* 2. 教师课堂演示模式 */}
          <div className="settings-section">
            <h4>2. 教师课堂演示模式</h4>
            <div className="teacher-options-list">
              <label className="consent-checkbox-row">
                <input
                  type="checkbox"
                  checked={teacherMode.enabled}
                  onChange={(e) =>
                    onUpdateTeacherMode({ enabled: e.target.checked })
                  }
                />
                <span>
                  <strong>开启教师演示模式</strong>（允许步骤 3 手动强制解锁展示、支持键盘快捷键 <kbd>Alt</kbd> + <kbd>←</kbd>/<kbd>→</kbd> 切换步骤）
                </span>
              </label>

              <label className="consent-checkbox-row">
                <input
                  type="checkbox"
                  checked={teacherMode.projectorLargeText}
                  disabled={!teacherMode.enabled}
                  onChange={(e) =>
                    onUpdateTeacherMode({ projectorLargeText: e.target.checked })
                  }
                />
                <span>教室投影大字号模式（增大化学式、方程式与选项字号，便于后排学生观看）</span>
              </label>

              <label className="consent-checkbox-row">
                <input
                  type="checkbox"
                  checked={teacherMode.delayRevealAnswers}
                  disabled={!teacherMode.enabled}
                  onChange={(e) =>
                    onUpdateTeacherMode({ delayRevealAnswers: e.target.checked })
                  }
                />
                <span>随堂练习答案延迟揭晓（提交后先高亮正误，点击“揭晓逐项解析”后再展示答案详解）</span>
              </label>
            </div>
          </div>

          {savedNotice && (
            <div className="status-banner is-success" role="status">
              {savedNotice}
            </div>
          )}

          <div className="action-row justify-between">
            <button type="button" className="btn-ghost btn-sm" onClick={handleClearKey}>
              清除密钥并切回演示模式
            </button>
            <div className="action-row">
              <button type="button" className="btn-secondary" onClick={onClose}>
                取消
              </button>
              <button type="submit" className="btn-primary">
                保存并应用设置
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

interface ThirdPartyConsentModalProps {
  isOpen: boolean;
  baseURL: string;
  model: string;
  onAgree: () => void;
  onDecline: () => void;
}

export const ThirdPartyConsentModal: React.FC<ThirdPartyConsentModalProps> = ({
  isOpen,
  baseURL,
  model,
  onAgree,
  onDecline,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="consent-modal-title"
    >
      <div className="modal-card">
        <div className="modal-header">
          <h3 id="consent-modal-title">第三方图像识别数据传输确认</h3>
        </div>
        <div className="about-content">
          <p>
            你当前处于<strong>在线增强模式（多模态识图）</strong>，继续识别将会把你选择的图片发送至你配置的第三方模型接口：
          </p>
          <div className="consent-target-box">
            <div><strong>接口地址：</strong>{baseURL}</div>
            <div><strong>调用模型：</strong>{model}</div>
          </div>
          <p>
            请勿上传包含个人隐私、人脸或敏感信息的照片。如果你不同意发送图片，可选择<strong>“不同意，保持本地模式”</strong>，在本地通过名称搜索继续学习。
          </p>
        </div>
        <div className="action-row">
          <button type="button" className="btn-primary" onClick={onAgree}>
            同意并继续在线识图
          </button>
          <button type="button" className="btn-secondary" onClick={onDecline}>
            不同意，保持本地模式
          </button>
        </div>
      </div>
    </div>
  );
};
