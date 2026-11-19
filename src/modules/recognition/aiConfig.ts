import { AIProviderPresetId, OnlineAIConfig, OnlineProviderMode } from '../../types/chemistry';
import {
  AI_GATEWAY_PATH,
  AI_REQUEST_TIMEOUT_MS,
  DEEPSEEK_BASE_URL,
  DEEPSEEK_FLASH_LABEL,
  DEEPSEEK_FLASH_MODEL,
  IS_STATIC_HOSTING,
} from './defaults';

// 两版在 Pages 上同源：当前版不得继承、迁移或删除 P1 的凭据和图像授权。
const SESSION_STORAGE_KEY = 'chem_gemini_p0_online_config_v2';
const LEGACY_STORAGE_KEY = 'chem_gemini_p0_online_config_v1';

export interface AIProviderPresetSpec {
  id: AIProviderPresetId;
  title: string;
  shortLabel: string;
  badge: string;
  capabilityTag: string;
  description: string;
  requiresKey: boolean;
  providerMode: OnlineProviderMode;
  defaultBaseURL: string;
  defaultModel: string;
  suggestedModels: string[];
  keyPlaceholder: string;
}

/** 内部兼容历史配置与导入，不再作为页面上的服务商快捷选项。 */
export const AI_PROVIDER_PRESETS: AIProviderPresetSpec[] = [
  {
    id: 'demo',
    title: '演示模式（离线 · 无需 API Key）',
    shortLabel: '演示模式（本地）',
    badge: '本地离线',
    capabilityTag: '内置样例 + 本地词库',
    description: '使用内置 6 组教学样例与本地名称词库运行，无需填写任何 API Key。',
    requiresKey: false,
    providerMode: 'text_assist',
    defaultBaseURL: DEEPSEEK_BASE_URL,
    defaultModel: DEEPSEEK_FLASH_MODEL,
    suggestedModels: [],
    keyPlaceholder: '',
  },
  {
    id: 'deepseek',
    title: 'DeepSeek V4.1 Flash（默认 · 原生多模态识图）',
    shortLabel: 'DeepSeek V4.1 Flash',
    badge: '默认识图',
    capabilityTag: '图片识别 + 文本映射 · 内置默认连接',
    description:
      '使用官方 deepseek-flash 模型识别照片。默认 Key 由本机服务端保管，也可切换为你自己的 API Key。',
    requiresKey: false,
    providerMode: 'vision',
    defaultBaseURL: DEEPSEEK_BASE_URL,
    defaultModel: DEEPSEEK_FLASH_MODEL,
    suggestedModels: [DEEPSEEK_FLASH_MODEL],
    keyPlaceholder: '自备 Key 模式下填写；内置默认模式无需填写',
  },
  {
    id: 'volcengine_deepseek',
    title: '火山引擎 Ark（DeepSeek 兼容接口）',
    shortLabel: '火山方舟 DeepSeek',
    badge: '兼容接口',
    capabilityTag: '纯文本映射 · UUID/Ark Key',
    description:
      '适配火山引擎方舟（ark.cn-beijing.volces.com/api/v3）的 DeepSeek 模型或接入点 ID（ep-...）。',
    requiresKey: true,
    providerMode: 'text_assist',
    defaultBaseURL: 'https://ark.cn-beijing.volces.com/api/v3',
    defaultModel: 'deepseek-v3-250324',
    suggestedModels: ['deepseek-v3-250324', 'deepseek-r1-250120'],
    keyPlaceholder: '输入火山引擎 Ark API Key（UUID 格式）',
  },
  {
    id: 'opencode_vision',
    title: '多模态识图（OpenCode Zen / GPT-4o-mini）',
    shortLabel: '多模态识图',
    badge: '支持看图',
    capabilityTag: '图像识别 + 文本映射',
    description:
      '调用支持图像输入的多模态大模型直接识别上传或拍摄的照片（发送图片前会弹出隐私确认）。',
    requiresKey: true,
    providerMode: 'vision',
    defaultBaseURL: 'https://opencode.ai/zen/v1',
    defaultModel: 'gpt-4o-mini',
    suggestedModels: ['gpt-4o-mini', 'gpt-4o', 'gemini-2.5-flash', 'qwen-vl-plus'],
    keyPlaceholder: '输入多模态接口 API Key',
  },
  {
    id: 'custom',
    title: '自定义 OpenAI 兼容接口',
    shortLabel: '自定义接口',
    badge: '自由配置',
    capabilityTag: '可自选文本或看图模式',
    description:
      '自由填写任意 OpenAI 兼容接口的 baseURL、模型名称及 API Key（支持硅基流动、OneAPI 等）。',
    requiresKey: true,
    providerMode: 'vision',
    defaultBaseURL: DEEPSEEK_BASE_URL,
    defaultModel: DEEPSEEK_FLASH_MODEL,
    suggestedModels: [DEEPSEEK_FLASH_MODEL, 'deepseek-ai/DeepSeek-V3', 'gpt-4o-mini', 'qwen-vl-plus'],
    keyPlaceholder: '输入兼容接口 API Key',
  },
];

export const DEFAULT_ONLINE_AI_CONFIG: OnlineAIConfig = {
  enabled: true,
  providerPreset: 'deepseek',
  providerMode: 'vision',
  baseURL: DEEPSEEK_BASE_URL,
  model: DEEPSEEK_FLASH_MODEL,
  credentialSource: IS_STATIC_HOSTING ? 'session' : 'server',
  apiKey: '',
  imageUploadConsented: false,
};

/**
 * 规范化 baseURL：
 * - 去除首尾空白与多余末尾斜杠
 * - 若用户误粘贴了完整 /chat/completions 地址，自动剥离后缀保留干净 baseURL
 * - 对 api.deepseek.com / api.openai.com 根域名自动补全 /v1
 */
export function normalizeBaseURL(rawUrl: string): string {
  let cleaned = rawUrl.trim().replace(/\/+$/, '');
  if (!cleaned) return DEFAULT_ONLINE_AI_CONFIG.baseURL;

  if (cleaned.endsWith('/chat/completions')) {
    cleaned = cleaned.slice(0, -'/chat/completions'.length).replace(/\/+$/, '');
  }

  if (
    /^https?:\/\/(api\.deepseek\.com|api\.openai\.com)$/i.test(cleaned)
  ) {
    return `${cleaned}/v1`;
  }

  return cleaned;
}

/**
 * 生成标准 OpenAI 兼容 /chat/completions 请求端点
 */
export function normalizeEndpoint(rawUrl: string): string {
  const base = normalizeBaseURL(rawUrl);
  return `${base}/chat/completions`;
}

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

  const next = updateOnlineAIConfig(current, {
    enabled: true,
    providerPreset: presetId,
    providerMode: spec.providerMode,
    baseURL: presetId === 'custom' ? current.baseURL || spec.defaultBaseURL : spec.defaultBaseURL,
    model: presetId === 'custom' ? current.model || spec.defaultModel : spec.defaultModel,
  });
  return {
    ...next,
    credentialSource: presetId === 'deepseek' && !next.apiKey && canUseServerCredential(next) ? 'server' : 'session',
  };
}

function isOfficialFlashConfig(config: OnlineAIConfig): boolean {
  return normalizeBaseURL(config.baseURL) === DEEPSEEK_BASE_URL && config.model.trim() === DEEPSEEK_FLASH_MODEL;
}

export function canUseServerCredential(config: OnlineAIConfig): boolean {
  return !IS_STATIC_HOSTING && isOfficialFlashConfig(config);
}

export function hasOnlineCredentials(config: OnlineAIConfig): boolean {
  return config.credentialSource === 'server' ? canUseServerCredential(config) : Boolean(config.apiKey.trim());
}

export function isOnlineAIEnabled(config: OnlineAIConfig): boolean {
  return config.enabled && hasOnlineCredentials(config);
}

/** 页面无需额外的服务商按钮，按实际接口识别配置类型；旧预设仍兼容。 */
export function getProviderPresetForURL(baseURL: string): Exclude<AIProviderPresetId, 'demo'> {
  try {
    const hostname = new URL(normalizeBaseURL(baseURL)).hostname.toLowerCase();
    if (hostname === 'api.deepseek.com') return 'deepseek';
    if (hostname === 'ark.cn-beijing.volces.com') return 'volcengine_deepseek';
    if (hostname === 'opencode.ai') return 'opencode_vision';
  } catch {
    // 正在编辑的不完整 URL 暂按手动接口处理，不改变输入内容。
  }
  return 'custom';
}

/** 接口/模型/能力变化后必须重新授权；绝不把旧接口的 Key 带到新接口。 */
export function updateOnlineAIConfig(current: OnlineAIConfig, patch: Partial<OnlineAIConfig>): OnlineAIConfig {
  const next = { ...current, ...patch };
  const baseChanged = normalizeBaseURL(next.baseURL) !== normalizeBaseURL(current.baseURL);
  if (baseChanged || next.model !== current.model || next.providerMode !== current.providerMode) {
    next.imageUploadConsented = false;
  }
  if (baseChanged) {
    next.apiKey = patch.apiKey ?? '';
    next.credentialSource = patch.credentialSource ?? 'session';
    next.providerPreset = patch.providerPreset ?? getProviderPresetForURL(next.baseURL);
  }
  if (patch.apiKey?.trim()) next.credentialSource = 'session';
  if (next.credentialSource === 'server' && !canUseServerCredential(next)) next.credentialSource = 'session';
  return next;
}

export function getAIRequestTarget(config: OnlineAIConfig): { endpoint: string; headers: Record<string, string> } {
  if (config.credentialSource === 'server') {
    if (IS_STATIC_HOSTING) throw new Error('GitHub Pages 不提供内置密钥网关，请填写自备 API Key 或通过本机服务使用默认连接。');
    if (!canUseServerCredential(config)) throw new Error('内置密钥仅用于官方 deepseek-flash；其他接口或模型请使用自备 API Key。');
    return {
      endpoint: `${import.meta.env.BASE_URL}${AI_GATEWAY_PATH}`,
      headers: {
        'Content-Type': 'application/json',
        ...(config.imageUploadConsented ? { 'X-Chem-Image-Consent': 'true' } : {}),
      },
    };
  }
  return {
    endpoint: normalizeEndpoint(config.baseURL),
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.apiKey.trim()}` },
  };
}

/** Flash 默认开启思考；识物任务显式关闭，以降低延迟并避免小输出预算被推理占满。 */
export function getModelRequestOptions(config: OnlineAIConfig): Record<string, unknown> {
  return isOfficialFlashConfig(config) ? { thinking: { type: 'disabled' } } : {};
}

export function getActiveProviderDisplayName(config: OnlineAIConfig): string {
  if (!isOnlineAIEnabled(config)) {
    return '演示模式';
  }
  const provider = getProviderPresetForURL(config.baseURL);
  if (provider === 'volcengine_deepseek') {
    return `火山方舟 (${config.model || 'deepseek-v3'})`;
  }
  if (provider === 'deepseek') {
    return config.model === DEEPSEEK_FLASH_MODEL
      ? `${DEEPSEEK_FLASH_LABEL} (${DEEPSEEK_FLASH_MODEL})`
      : `DeepSeek (${config.model || DEEPSEEK_FLASH_MODEL})`;
  }
  if (provider === 'opencode_vision') {
    return `多模态识图 (${config.model || 'gpt-4o-mini'})`;
  }
  return `在线模型 (${config.model || 'custom'})`;
}

export interface ImportedConfigResult {
  config: OnlineAIConfig;
  extractedFields: string[];
  error?: string;
}

/**
 * 智能批量导入解析器：
 * 支持一键粘贴：
 * 1) JSON 对象（{"apiKey":"...","baseURL":"...","model":"..."}）
 * 2) .env 环境变量（DEEPSEEK_API_KEY=... / OPENAI_API_KEY=... / ARK_API_KEY=... / BASE_URL=... / MODEL=...）
 * 3) curl 命令片段（提取 URL 与 Authorization: Bearer <key>）
 * 4) 纯 API Key 字符串（如 sk-... 或 UUID 格式 xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx）
 */
export function parseImportedAIConfig(
  rawText: string,
  current: OnlineAIConfig
): ImportedConfigResult {
  const text = rawText.trim();
  if (!text) {
    return {
      config: current,
      extractedFields: [],
      error: '粘贴内容为空，请粘贴 API Key、.env 配置行、JSON 或 curl 命令。',
    };
  }

  let extractedKey = '';
  let extractedBaseURL = '';
  let extractedModel = '';
  let extractedMode: OnlineProviderMode | null = null;
  const extractedFields: string[] = [];

  if (text.startsWith('{') && text.endsWith('}')) {
    try {
      const obj = JSON.parse(text) as Record<string, unknown>;
      const keyVal = obj.apiKey ?? obj.api_key ?? obj.key ?? obj.token;
      const urlVal = obj.baseURL ?? obj.base_url ?? obj.endpoint ?? obj.url;
      const modelVal = obj.model ?? obj.modelName ?? obj.model_name;
      const modeVal = obj.providerMode ?? obj.mode;

      if (typeof keyVal === 'string' && keyVal.trim()) {
        extractedKey = keyVal.trim();
        extractedFields.push('API Key');
      }
      if (typeof urlVal === 'string' && urlVal.trim()) {
        extractedBaseURL = normalizeBaseURL(urlVal);
        extractedFields.push('接口地址');
      }
      if (typeof modelVal === 'string' && modelVal.trim()) {
        extractedModel = modelVal.trim();
        extractedFields.push('模型名称');
      }
      if (modeVal === 'vision' || modeVal === 'text_assist') {
        extractedMode = modeVal;
      }
    } catch {
      return {
        config: current,
        extractedFields: [],
        error: 'JSON 格式解析失败，请检查括号与引号是否完整，或改用 KEY=VALUE / 纯密钥粘贴。',
      };
    }
  } else {
    const urlMatch = text.match(/https?:\/\/[^\s"'`\\]+/i);
    if (urlMatch) {
      extractedBaseURL = normalizeBaseURL(urlMatch[0]);
      extractedFields.push('接口地址');
    }

    const bearerMatch = text.match(/Authorization:\s*Bearer\s+([A-Za-z0-9._-]+)/i);
    if (bearerMatch && bearerMatch[1]) {
      extractedKey = bearerMatch[1].trim();
      extractedFields.push('API Key');
    }

    const lines = text.split(/\r?\n/);
    for (const line of lines) {
      const trimmedLine = line.trim().replace(/^export\s+/i, '');
      const kvMatch = trimmedLine.match(/^([A-Za-z0-9_]+)\s*=\s*(.+)$/);
      if (!kvMatch) continue;
      const k = kvMatch[1].toUpperCase();
      const v = kvMatch[2].trim().replace(/^['"]|['"]$/g, '').trim();
      if (!v) continue;

      if (!extractedKey && (k.includes('API_KEY') || k === 'KEY' || k === 'TOKEN')) {
        extractedKey = v;
        extractedFields.push('API Key');
      } else if (!extractedBaseURL && (k.includes('BASE_URL') || k.includes('ENDPOINT') || k === 'URL')) {
        extractedBaseURL = normalizeBaseURL(v);
        extractedFields.push('接口地址');
      } else if (!extractedModel && k.includes('MODEL')) {
        extractedModel = v;
        extractedFields.push('模型名称');
      }
    }

    if (!extractedModel) {
      const jsonModelMatch = text.match(/"model"\s*:\s*"([^"]+)"/);
      if (jsonModelMatch && jsonModelMatch[1]) {
        extractedModel = jsonModelMatch[1].trim();
        extractedFields.push('模型名称');
      }
    }

    if (!extractedKey && /^[A-Za-z0-9][A-Za-z0-9._-]{15,}$/.test(text.replace(/^['"]|['"]$/g, ''))) {
      extractedKey = text.replace(/^['"]|['"]$/g, '').trim();
      extractedFields.push('API Key');
    }
  }

  if (extractedFields.length === 0) {
    return {
      config: current,
      extractedFields: [],
      error: '未能从粘贴内容中识别出 API Key 或接口地址，请检查格式后重试。',
    };
  }

  let nextPreset: AIProviderPresetId = current.providerPreset === 'demo' ? 'deepseek' : current.providerPreset;
  let nextBaseURL = extractedBaseURL || current.baseURL;
  let nextModel = extractedModel || current.model;
  let nextMode: OnlineProviderMode = extractedMode ?? current.providerMode;

  const lowerUrl = nextBaseURL.toLowerCase();
  const lowerModel = nextModel.toLowerCase();

  if (lowerUrl.includes('volces.com')) {
    nextPreset = 'volcengine_deepseek';
    nextMode = extractedMode ?? 'text_assist';
    if (!extractedModel && !current.baseURL.includes('volces.com')) {
      nextModel = 'deepseek-v3-250324';
    }
  } else if (/^https:\/\/api\.deepseek\.com(?:\/|$)/.test(lowerUrl)) {
    nextPreset = 'deepseek';
    if (!extractedModel) nextModel = DEEPSEEK_FLASH_MODEL;
    nextMode = extractedMode ?? (nextModel === DEEPSEEK_FLASH_MODEL || nextModel.includes('vision') ? 'vision' : 'text_assist');
    if (!extractedBaseURL) nextBaseURL = DEEPSEEK_BASE_URL;
  } else if (lowerUrl.includes('opencode.ai')) {
    nextPreset = 'opencode_vision';
    nextMode = extractedMode ?? 'vision';
  } else if (extractedBaseURL) {
    nextPreset = 'custom';
    nextMode = extractedMode ?? (lowerModel.includes('4o') || lowerModel.includes('vl') || lowerModel.includes('gemini') || lowerModel === DEEPSEEK_FLASH_MODEL ? 'vision' : current.providerMode);
  }

  const nextConfig = updateOnlineAIConfig(current, {
    enabled: true,
    providerPreset: nextPreset,
    providerMode: nextMode,
    baseURL: normalizeBaseURL(nextBaseURL),
    model: nextModel,
    ...(extractedKey ? { apiKey: extractedKey, credentialSource: 'session' as const } : {}),
  });
  nextConfig.enabled = hasOnlineCredentials(nextConfig);

  return {
    config: nextConfig,
    extractedFields,
  };
}

export interface ConnectionTestOutcome {
  ok: boolean;
  latencyMs: number;
  message: string;
}

/**
 * 主动探测 OpenAI 兼容接口连通性，并给出清晰的中文错误诊断
 */
export async function testAIConnection(
  config: OnlineAIConfig,
  fetchImpl: typeof fetch = fetch
): Promise<ConnectionTestOutcome> {
  if (!hasOnlineCredentials(config)) {
    return {
      ok: false,
      latencyMs: 0,
      message: '请先输入 API Key 后再测试连接。',
    };
  }

  const { endpoint, headers } = getAIRequestTarget(config);
  const modelName = config.model.trim() || DEEPSEEK_FLASH_MODEL;
  const isReasoner = modelName.toLowerCase().includes('reasoner') || modelName.toLowerCase().includes('r1');

  const payload: Record<string, unknown> = {
    model: modelName,
    messages: [{ role: 'user', content: 'Reply with OK' }],
    max_tokens: isReasoner ? 256 : 64,
    ...getModelRequestOptions(config),
  };
  if (!isReasoner) {
    payload.temperature = 0;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AI_REQUEST_TIMEOUT_MS);
  const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();

  try {
    const resp = await fetchImpl(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    const elapsed = Math.max(
      1,
      Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0)
    );

    if (!resp.ok) {
      let detailHint = `HTTP ${resp.status}`;
      if (resp.status === 401) {
        detailHint =
          'HTTP 401 鉴权失败：API Key 无效、已过期，或与接口地址不匹配；请在连接设置中核对 baseURL 与自备 Key。';
      } else if (resp.status === 402) {
        detailHint = 'HTTP 402 账户余额不足：当前 API Key 所在账号额度已耗尽，请充值或更换 Key。';
      } else if (resp.status === 404) {
        detailHint =
          config.credentialSource === 'server'
            ? 'HTTP 404 内置网关不可用。请通过本机 npm run dev/preview 打开；GitHub Pages 纯静态站点需切换自备 API Key。'
            : 'HTTP 404 接口路径或模型名称不存在：请核对 baseURL（如 /v1 或 /api/v3）及模型名（如 deepseek-flash 或接入点 ID ep-...）。';
      } else if (resp.status === 503 && config.credentialSource === 'server') {
        detailHint = 'HTTP 503 本机尚未配置默认 Key，请设置 .env.local 的 DEEPSEEK_API_KEY 并重启服务，或切换自备 Key。';
      } else if (resp.status === 429) {
        detailHint = 'HTTP 429 请求限流：当前接口并发或频率超限，请稍后再试。';
      }
      return {
        ok: false,
        latencyMs: elapsed,
        message: `连接测试未通过（${detailHint}）。即使暂未连通，学习流程仍会自动降级到本地词库匹配。`,
      };
    }

    const data = await resp.json() as { choices?: { message?: { content?: unknown } }[] };
    if (typeof data.choices?.[0]?.message?.content !== 'string' || !data.choices[0].message.content.trim()) {
      return { ok: false, latencyMs: elapsed, message: '接口虽返回成功状态，但没有有效模型回复，请检查接口地址和模型。' };
    }
    return {
      ok: true,
      latencyMs: elapsed,
      message: `连接成功（耗时 ${elapsed} ms）！${modelName} 已返回有效回复。${config.credentialSource === 'server' ? '默认 Key 仅由本机服务端读取，不发送到浏览器。' : '自备 Key 仅保存在当前标签页 sessionStorage 中。'}文字连通性测试不代替图片识别验收。`,
    };
  } catch (err) {
    const elapsed = Math.max(
      1,
      Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0)
    );
    const isAbort = err instanceof Error && err.name === 'AbortError';
    const reason = isAbort
      ? '请求超时（超过 70 秒未响应）'
      : err instanceof Error
      ? `网络或浏览器跨域（CORS）限制（${err.message}）`
      : '网络请求异常';
    return {
      ok: false,
      latencyMs: elapsed,
      message: `连接测试未通过（${reason}）。若在纯前端网页中遇到第三方 API 跨域拦截，识别时会自动平滑降级到本地词库。`,
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 默认 Key 只由服务端读取 .env.local，前端配置中始终为空。
 * 自备 Key 仅存当前标签页 sessionStorage，不写入 localStorage、IndexedDB 或构建变量。
 */
export function loadOnlineAIConfig(): OnlineAIConfig {
  try {
    if (typeof window === 'undefined' || !window.sessionStorage) {
      return { ...DEFAULT_ONLINE_AI_CONFIG };
    }
    const raw = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
    const legacyRaw = raw ? null : window.sessionStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw && !legacyRaw) return { ...DEFAULT_ONLINE_AI_CONFIG };
    const parsed = JSON.parse(raw ?? legacyRaw!) as Partial<OnlineAIConfig>;
    if (legacyRaw && !parsed.apiKey && parsed.providerPreset !== 'demo') return { ...DEFAULT_ONLINE_AI_CONFIG };
    const validPresets: AIProviderPresetId[] = [
      'demo',
      'deepseek',
      'volcengine_deepseek',
      'opencode_vision',
      'custom',
    ];
    const preset: AIProviderPresetId =
      parsed.providerPreset && validPresets.includes(parsed.providerPreset)
        ? parsed.providerPreset
        : 'deepseek';

    const config: OnlineAIConfig = {
      enabled: Boolean(parsed.enabled),
      providerPreset: preset,
      providerMode: parsed.providerMode === 'vision' ? 'vision' : 'text_assist',
      baseURL:
        typeof parsed.baseURL === 'string' && parsed.baseURL.trim()
          ? normalizeBaseURL(parsed.baseURL)
          : DEFAULT_ONLINE_AI_CONFIG.baseURL,
      model:
        typeof parsed.model === 'string' && parsed.model.trim()
          ? parsed.model.trim()
          : DEFAULT_ONLINE_AI_CONFIG.model,
      credentialSource: parsed.credentialSource === 'server' ? 'server' : 'session',
      apiKey: typeof parsed.apiKey === 'string' ? parsed.apiKey : '',
      imageUploadConsented: !legacyRaw && Boolean(parsed.imageUploadConsented),
    };
    if (legacyRaw && preset === 'deepseek') {
      config.model = DEEPSEEK_FLASH_MODEL;
      config.providerMode = 'vision';
    }
    if (config.credentialSource === 'server') config.apiKey = '';
    if (config.credentialSource === 'server' && !canUseServerCredential(config)) config.credentialSource = 'session';
    return config;
  } catch {
    return { ...DEFAULT_ONLINE_AI_CONFIG };
  }
}

export function saveOnlineAIConfig(config: OnlineAIConfig): void {
  try {
    if (typeof window === 'undefined' || !window.sessionStorage) return;
    const normalized: OnlineAIConfig = {
      ...config,
      baseURL: normalizeBaseURL(config.baseURL),
      model: config.model.trim() || DEFAULT_ONLINE_AI_CONFIG.model,
      apiKey: config.credentialSource === 'server' ? '' : config.apiKey.trim(),
    };
    window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(normalized));
  } catch {
    // Ignore storage quota errors in restricted sandboxes
  }
}

export function clearOnlineAIConfig(): void {
  try {
    if (typeof window === 'undefined' || !window.sessionStorage) return;
    window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
    window.sessionStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch {
    // Ignore
  }
}
