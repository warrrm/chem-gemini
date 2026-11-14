/** DeepSeek V4.1 Flash 的官方 API ID（不是 deepseek-v4.1-flash）。 */
export const DEEPSEEK_FLASH_MODEL = 'deepseek-flash';
export const DEEPSEEK_BASE_URL = 'https://api.deepseek.com/v1';
export const DEEPSEEK_FLASH_LABEL = 'DeepSeek V4.1 Flash';
export const AI_GATEWAY_PATH = 'api/ai/chat/completions';
export const AI_REQUEST_TIMEOUT_MS = 70000;

/** 仅为公开部署标记，不含密钥；Node 侧导入时 import.meta.env 可不存在。 */
export const IS_STATIC_HOSTING = import.meta.env?.VITE_AI_DEPLOYMENT === 'static';
