import type { IncomingMessage, ServerResponse } from 'node:http';
import { AI_GATEWAY_PATH, DEEPSEEK_BASE_URL, DEEPSEEK_FLASH_MODEL } from '../src/modules/recognition/defaults';

const MAX_BODY_BYTES = 4 * 1024 * 1024;
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);
const LOOPBACK_ADDRESSES = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

type GatewayOptions = {
  apiKey: string;
  basePath?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
};

class GatewayError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
  }
}

function json(res: ServerResponse, status: number, body: unknown): void {
  if (res.destroyed || res.writableEnded) return;
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

/** 不记录请求、图片、上游响应或密钥。此网关仅供本机开发/预览，不是公开 API 服务。 */
export function createDeepSeekGateway({
  apiKey,
  basePath = '/chem-gemini/',
  fetchImpl = fetch,
  timeoutMs = 60000,
}: GatewayOptions) {
  let activeRequests = 0;
  let recentRequests: number[] = [];
  const paths = new Set([`/${AI_GATEWAY_PATH}`, `${basePath}${AI_GATEWAY_PATH}`]);
  const statusPaths = new Set(['/api/ai/status', `${basePath}api/ai/status`]);

  async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const host = req.headers.host ?? '';
    let expectedOrigin: string;
    try {
      const url = new URL(`http://${host}`);
      if (!LOOPBACK_HOSTS.has(url.hostname)) throw new Error('Invalid host');
      expectedOrigin = url.origin;
    } catch {
      throw new GatewayError(403, '默认密钥网关仅允许本机访问。');
    }
    if (!LOOPBACK_ADDRESSES.has(req.socket.remoteAddress ?? '')) {
      throw new GatewayError(403, '默认密钥网关不接受远程访问。');
    }
    if ((req.headers.origin && req.headers.origin !== expectedOrigin) || req.headers['sec-fetch-site'] === 'cross-site') {
      throw new GatewayError(403, '不允许跨站调用默认密钥网关。');
    }

    const pathname = new URL(req.url ?? '/', expectedOrigin).pathname;
    if (statusPaths.has(pathname) && req.method === 'GET') {
      json(res, 200, { configured: Boolean(apiKey.trim()), model: DEEPSEEK_FLASH_MODEL });
      return;
    }
    if (!paths.has(pathname) || req.method !== 'POST') {
      throw new GatewayError(405, '请使用 POST 调用识别接口。');
    }
    if (!apiKey.trim()) {
      throw new GatewayError(503, '未配置默认 Key，请在本机 .env.local 中设置 DEEPSEEK_API_KEY 并重启服务，或在页面使用自备 API。');
    }
    if (!req.headers['content-type']?.toLowerCase().startsWith('application/json')) {
      throw new GatewayError(415, '仅支持 application/json 请求。');
    }
    if (Number(req.headers['content-length'] ?? 0) > MAX_BODY_BYTES) {
      throw new GatewayError(413, '图片请求过大，请压缩后重试（请求上限 4 MiB）。');
    }
    recentRequests = recentRequests.filter((time) => Date.now() - time < 60000);
    if (activeRequests >= 2 || recentRequests.length >= 20) {
      throw new GatewayError(429, '本机识别请求过于频繁，请稍后重试。');
    }

    activeRequests++;
    try {
      const chunks: Buffer[] = [];
      let bytes = 0;
      for await (const chunk of req) {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        bytes += buffer.length;
        if (bytes > MAX_BODY_BYTES) throw new GatewayError(413, '图片请求过大，请压缩后重试。');
        chunks.push(buffer);
      }
      let body: Record<string, unknown>;
      try {
        const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Invalid body');
        body = parsed as Record<string, unknown>;
      } catch {
        throw new GatewayError(400, '请求不是有效的 JSON 对象。');
      }
      if (body.model !== DEEPSEEK_FLASH_MODEL) {
        throw new GatewayError(400, `内置密钥仅用于 ${DEEPSEEK_FLASH_MODEL}，其他模型请使用自备 API。`);
      }
      if (!Array.isArray(body.messages) || body.messages.length < 1 || body.messages.length > 4) {
        throw new GatewayError(400, '消息数量不合法。');
      }
      let imageCount = 0;
      const messages = body.messages.map((message: unknown) => {
        if (!message || typeof message !== 'object') throw new GatewayError(400, '消息格式不合法。');
        const { role, content } = message as Record<string, unknown>;
        if (role !== 'system' && role !== 'user') throw new GatewayError(400, '仅支持 system/user 消息。');
        if (typeof content === 'string' && content.length <= 40000) return { role, content };
        if (!Array.isArray(content) || content.length > 3) throw new GatewayError(400, '消息内容不合法。');
        const parts = content.map((part: unknown) => {
          if (!part || typeof part !== 'object') throw new GatewayError(400, '内容块不合法。');
          const block = part as Record<string, unknown>;
          if (block.type === 'text' && typeof block.text === 'string' && block.text.length <= 40000) {
            return { type: 'text', text: block.text };
          }
          const image = block.image_url as { url?: unknown } | undefined;
          if (role === 'user' && block.type === 'image_url' && typeof image?.url === 'string' &&
            /^data:image\/(jpeg|png|webp|gif);base64,[A-Za-z0-9+/]+={0,2}$/.test(image.url)) {
            imageCount++;
            return { type: 'image_url', image_url: { url: image.url } };
          }
          throw new GatewayError(400, '仅支持文本及本地图片数据，不允许外部图片 URL 或工具调用。');
        });
        return { role, content: parts };
      });
      if (imageCount > 1) throw new GatewayError(400, '每次只能识别一张图片。');
      if (imageCount && req.headers['x-chem-image-consent'] !== 'true') {
        throw new GatewayError(403, '发送图片前必须确认第三方传输授权。');
      }
      recentRequests.push(Date.now());
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const onClose = () => { if (!res.writableEnded) controller.abort(); };
      res.once('close', onClose);
      try {
        const upstream = await fetchImpl(`${DEEPSEEK_BASE_URL}/chat/completions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey.trim()}` },
          body: JSON.stringify({
            model: DEEPSEEK_FLASH_MODEL,
            messages,
            thinking: { type: 'disabled' },
            max_tokens: 2048,
            temperature: 0.1,
            stream: false,
            ...(body.response_format && typeof body.response_format === 'object' &&
              (body.response_format as { type?: string }).type === 'json_object'
              ? { response_format: { type: 'json_object' } } : {}),
          }),
          signal: controller.signal,
        });
        if (!upstream.ok) {
          // 不转发上游原始错误内容，避免意外回显凭据或敏感输入。
          throw new GatewayError(upstream.status, `DeepSeek 接口返回 HTTP ${upstream.status}，请检查密钥、余额、模型权限或稍后重试。`);
        }
        const data = await upstream.json() as { choices?: { message?: { content?: unknown } }[] };
        const content = data.choices?.[0]?.message?.content;
        if (typeof content !== 'string' || !content.trim()) throw new GatewayError(502, 'DeepSeek 未返回有效内容。');
        json(res, 200, { model: DEEPSEEK_FLASH_MODEL, choices: [{ message: { role: 'assistant', content } }] });
      } catch (error) {
        if (controller.signal.aborted) throw new GatewayError(504, 'DeepSeek 识别请求超时或已取消，请重试或使用本地搜索。');
        throw error;
      } finally {
        clearTimeout(timer);
        res.off('close', onClose);
      }
    } finally {
      activeRequests--;
    }
  }

  return (req: IncomingMessage, res: ServerResponse, next: () => void): void => {
    const pathname = new URL(req.url ?? '/', 'http://localhost').pathname;
    if (!paths.has(pathname) && !statusPaths.has(pathname)) { next(); return; }
    void handle(req, res).catch((error: unknown) => {
      json(res, error instanceof GatewayError ? error.status : 502, {
        error: { message: error instanceof GatewayError ? error.message : '无法连接 DeepSeek，请检查网络后重试。' },
      });
    });
  };
}
