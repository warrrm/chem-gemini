import React, { useState } from 'react';
import {
  clearOnlineAIConfig,
  DEFAULT_ONLINE_AI_CONFIG,
  getActiveProviderDisplayName,
  getProviderPresetForURL,
  hasOnlineCredentials,
  normalizeBaseURL,
  parseImportedAIConfig,
  saveOnlineAIConfig,
  testAIConnection,
  updateOnlineAIConfig,
} from '../modules/recognition/aiConfig';
import { IS_STATIC_HOSTING } from '../modules/recognition/defaults';
import { AICredentialControl } from './AICredentialControl';
import { OnlineAIConfig, TeacherModeState } from '../types/chemistry';

interface OnlineSettingsModalProps {
  isOpen: boolean;
  config: OnlineAIConfig;
  teacherMode: TeacherModeState;
  onClose: () => void;
  onSaveConfig: (next: OnlineAIConfig) => void;
  onUpdateTeacherMode: (patch: Partial<TeacherModeState>) => void;
}

export const OnlineSettingsModal: React.FC<OnlineSettingsModalProps> = ({
  isOpen,
  config,
  teacherMode,
  onClose,
  onSaveConfig,
  onUpdateTeacherMode,
}) => {
  const [draft, setDraft] = useState<OnlineAIConfig>(config);
  const [importOpen, setImportOpen] = useState(false);
  const [importRawText, setImportRawText] = useState('');
  const [savedNotice, setSavedNotice] = useState<string | null>(null);
  const [testStatus, setTestStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  React.useEffect(() => {
    if (isOpen) {
      setDraft(config);
      setSavedNotice(null);
      setTestStatus(null);
      setImportOpen(false);
      setImportRawText('');
    }
  }, [isOpen, config]);

  if (!isOpen) return null;

  const handleSmartImport = () => {
    const result = parseImportedAIConfig(importRawText, draft);
    if (result.error) {
      setTestStatus({ ok: false, text: result.error });
      return;
    }
    setDraft(result.config);
    setImportRawText('');
    setImportOpen(false);
    setTestStatus({
      ok: true,
      text: `已解析并填入：${result.extractedFields.join('、')}（自动识别为 ${getActiveProviderDisplayName(
        result.config
      )}），可点击“测试接口连通性”或直接“保存并应用设置”。`,
    });
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned: OnlineAIConfig = {
      ...draft,
      baseURL: normalizeBaseURL(draft.baseURL || DEFAULT_ONLINE_AI_CONFIG.baseURL),
      model: draft.model.trim() || DEFAULT_ONLINE_AI_CONFIG.model,
      apiKey: draft.apiKey.trim(),
    };
    setDraft(cleaned);
    saveOnlineAIConfig(cleaned);
    onSaveConfig(cleaned);
    if (cleaned.enabled && !hasOnlineCredentials(cleaned)) {
      setSavedNotice(
        '已保存配置。注意：你勾选了“启用在线增强模式”，但尚未填写 API Key，系统将暂时保持「演示模式」直到填入 Key。'
      );
    } else {
      setSavedNotice(
        '设置已保存。默认 Key 由本机服务端保管；自备 Key 和偏好仅存当前标签页 sessionStorage。'
      );
    }
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestStatus(null);
    try {
      const outcome = await testAIConnection(draft);
      setTestStatus({ ok: outcome.ok, text: outcome.message });
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
    setDraft(resetCfg);
    onSaveConfig(resetCfg);
    setTestStatus(null);
    setSavedNotice('已清除本标签页的自备 Key 并切换离线演示；本机服务端默认 Key 未被删除。');
  };

  const handleRestoreDefault = () => {
    const next = { ...DEFAULT_ONLINE_AI_CONFIG };
    setDraft(next);
    saveOnlineAIConfig(next);
    onSaveConfig(next);
    setTestStatus(null);
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
              <h4>1. AI 识图设置</h4>
              <div className="action-row">
                <button
                  type="button"
                  className="btn-secondary btn-xs"
                  onClick={() => setImportOpen((v) => !v)}
                >
                  {importOpen ? '收起批量导入' : '📋 一键粘贴导入'}
                </button>
                <label className="switch-label">
                  <input
                    type="checkbox"
                    checked={draft.enabled}
                    onChange={(e) =>
                      setDraft((prev) => updateOnlineAIConfig(prev, {
                        enabled: e.target.checked,
                        ...(e.target.checked ? { providerPreset: getProviderPresetForURL(prev.baseURL) } : {}),
                      }))
                    }
                  />
                  <span>启用在线增强模式</span>
                </label>
              </div>
            </div>

            {importOpen && (
              <div className="smart-import-box">
                <label htmlFor="modal-smart-import" className="smart-import-label">
                  直接粘贴 API Key（sk-... 或 UUID）、<code>.env</code> 变量、JSON 或 <code>curl</code> 命令：
                </label>
                <textarea
                  id="modal-smart-import"
                  rows={3}
                  className="smart-import-textarea"
                  value={importRawText}
                  onChange={(e) => setImportRawText(e.target.value)}
                  placeholder="粘贴 API Key 或配置片段..."
                />
                <div className="action-row">
                  <button
                    type="button"
                    className="btn-primary btn-xs"
                    onClick={handleSmartImport}
                  >
                    解析并填入表单
                  </button>
                </div>
              </div>
            )}

            <p className="settings-desc">
              说明：启用后，模型<strong>仅负责将标签文字、描述或图片映射到知识库白名单物质 ID</strong>，所有化学式、方程式与题目仍严格来自已校验的本地结构化知识库；调用失败时自动降级为本地搜索。
            </p>

            <p className="settings-desc">
              默认使用 <strong>DeepSeek V4.1 Flash</strong>。如需更换 API，直接编辑下方接口地址、模型和自备 Key，无需选择额外的服务商入口。
            </p>

            <div className="settings-grid">
              <div className="form-field">
                <label htmlFor="ai-provider-mode">识别能力模式</label>
                <select
                  id="ai-provider-mode"
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

              <div className="form-field">
                <label htmlFor="ai-base-url">OpenAI 兼容接口地址（baseURL）</label>
                <input
                  id="ai-base-url"
                  type="url"
                  value={draft.baseURL}
                  onChange={(e) =>
                    setDraft((prev) => updateOnlineAIConfig(prev, { baseURL: e.target.value }))
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
                    setDraft((prev) => updateOnlineAIConfig(prev, { model: e.target.value }))
                  }
                  placeholder="deepseek-flash"
                />
              </div>

              <div className="form-field">
                <AICredentialControl config={draft} inputId="ai-api-key" onChange={setDraft} />
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
                  我已知晓并同意：在多模态识图模式下，所选图片将发送至上述配置的第三方模型接口进行识别；本机网关仅转发，不保存图片。
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
              <button type="button" className="btn-secondary" onClick={handleRestoreDefault}>
                {IS_STATIC_HOSTING ? '恢复 DeepSeek 默认参数' : '恢复内置 DeepSeek 识图'}
              </button>
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
