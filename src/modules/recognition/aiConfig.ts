import { AIProviderPresetId, OnlineAIConfig, OnlineProviderMode } from '../../types/chemistry';

const SESSION_STORAGE_KEY = 'chem_gemini_p1_online_config_v1';

export interface AIProviderPresetSpec {
  id: AIProviderPresetId;
  title: string;
  shortLabel: string;
  badge: string;
  description: string;
  requiresKey: boolean;
  providerMode: OnlineProviderMode;
  defaultBaseURL: string;
  defaultModel: string;
  suggestedModels: string[];
}

export const AI_PROVIDER_PRESETS: AIProviderPresetSpec[] = [
  {
    id: 'demo',
    title: '演示模式（默认 · 无需 API Key）',
    shortLabel: '演示模式（本地）',
    badge: '本地离线',
    description: '使用内置 6 组教学样例与本地名称词库运行，无需填写任何 API Key。',
    requiresKey: false,
    providerMode: 'text_assist',
    defaultBaseURL: 'https://api.deepseek.com/v1',
    defaultModel: 'deepseek-chat',
    suggestedModels: [],
  },
  {
    id: 'deepseek',
    title: 'DeepSeek 官方模型（推荐 · 智能文本识物）',
    shortLabel: 'DeepSeek',
    badge: '推荐 · 文本辅助',
    description:
      '调用 DeepSeek（deepseek-chat）智能解析试剂瓶标签文字、俗称或外观描述并映射到初中化学知识库（不上传图片，保护隐私）。',
    requiresKey: true,
    providerMode: 'text_assist',
    defaultBaseURL: 'https://api.deepseek.com/v1',
    defaultModel: 'deepseek-chat',
    suggestedModels: ['deepseek-chat', 'deepseek-reasoner'],
  },
  {
    id: 'opencode_vision',
    title: '多模态识图（OpenCode Zen / GPT-4o-mini）',
    shortLabel: '多模态识图',
    badge: '支持看图',
    description:
      '调用支持图像输入的多模态大模型直接识别上传或拍摄的照片，并映射物质 ID（上传前会弹窗确认）。',
    requiresKey: true,
    providerMode: 'vision',
    defaultBaseURL: 'https://opencode.ai/zen/v1',
    defaultModel: 'gpt-4o-mini',
    suggestedModels: ['gpt-4o-mini', 'gpt-4o', 'gemini-2.5-flash', 'qwen-vl-plus'],
  },
  {
    id: 'custom',
    title: '自定义 OpenAI 兼容接口',
    shortLabel: '自定义接口',
    badge: '自由配置',
    description:
      '自由填写任意 OpenAI 兼容接口的 baseURL、模型名称及 API Key，可按需选择文本辅助或多模态识图模式。',
    requiresKey: true,
    providerMode: 'text_assist',
    defaultBaseURL: 'https://api.deepseek.com/v1',
    defaultModel: 'deepseek-chat',
    suggestedModels: ['deepseek-chat', 'deepseek-reasoner', 'gpt-4o-mini', 'qwen-vl-plus'],
  },
];

export const DEFAULT_ONLINE_AI_CONFIG: OnlineAIConfig = {
  enabled: false,
  providerPreset: 'deepseek',
  providerMode: 'text_assist',
  baseURL: 'https://api.deepseek.com/v1',
  model: 'deepseek-chat',
  apiKey: '',
  imageUploadConsented: false,
};

export function applyProviderPreset(
  current: OnlineAIConfig,
  presetId: AIProviderPresetId
): OnlineAIConfig {
  if (presetId === 'demo') {
    return {
      ...current,
      enabled: false,
      providerPreset: 'demo',
    };
  }
  const spec = AI_PROVIDER_PRESETS.find((p) => p.id === presetId);
  if (!spec) return current;

  return {
    ...current,
    enabled: true,
    providerPreset: presetId,
    providerMode: spec.providerMode,
    baseURL: presetId === 'custom' ? current.baseURL || spec.defaultBaseURL : spec.defaultBaseURL,
    model: presetId === 'custom' ? current.model || spec.defaultModel : spec.defaultModel,
  };
}

export function getActiveProviderDisplayName(config: OnlineAIConfig): string {
  if (!config.enabled || !config.apiKey.trim()) {
    return '演示模式';
  }
  if (config.providerPreset === 'deepseek' || config.baseURL.includes('deepseek')) {
    return `DeepSeek (${config.model || 'deepseek-chat'})`;
  }
  if (config.providerPreset === 'opencode_vision') {
    return `多模态识图 (${config.model || 'gpt-4o-mini'})`;
  }
  return `在线模型 (${config.model || 'custom'})`;
}

/**
 * 严格遵守硬性约束 #9：
 * - API Key 只保存在当前浏览器会话的 sessionStorage 中（关闭标签页即销毁）
 * - 绝不写入 localStorage、IndexedDB 或任何代码/构建变量
 */
export function loadOnlineAIConfig(): OnlineAIConfig {
  try {
    if (typeof window === 'undefined' || !window.sessionStorage) {
      return { ...DEFAULT_ONLINE_AI_CONFIG };
    }
    const raw = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_ONLINE_AI_CONFIG };
    const parsed = JSON.parse(raw) as Partial<OnlineAIConfig>;
    const validPresets: AIProviderPresetId[] = ['demo', 'deepseek', 'opencode_vision', 'custom'];
    const preset: AIProviderPresetId =
      parsed.providerPreset && validPresets.includes(parsed.providerPreset)
        ? parsed.providerPreset
        : 'deepseek';

    return {
      enabled: Boolean(parsed.enabled),
      providerPreset: preset,
      providerMode: parsed.providerMode === 'vision' ? 'vision' : 'text_assist',
      baseURL:
        typeof parsed.baseURL === 'string' && parsed.baseURL.trim()
          ? parsed.baseURL.trim()
          : DEFAULT_ONLINE_AI_CONFIG.baseURL,
      model:
        typeof parsed.model === 'string' && parsed.model.trim()
          ? parsed.model.trim()
          : DEFAULT_ONLINE_AI_CONFIG.model,
      apiKey: typeof parsed.apiKey === 'string' ? parsed.apiKey : '',
      imageUploadConsented: Boolean(parsed.imageUploadConsented),
    };
  } catch {
    return { ...DEFAULT_ONLINE_AI_CONFIG };
  }
}

export function saveOnlineAIConfig(config: OnlineAIConfig): void {
  try {
    if (typeof window === 'undefined' || !window.sessionStorage) return;
    window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(config));
  } catch {
    // Ignore storage quota errors in restricted sandboxes
  }
}

export function clearOnlineAIConfig(): void {
  try {
    if (typeof window === 'undefined' || !window.sessionStorage) return;
    window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
  } catch {
    // Ignore
  }
}
