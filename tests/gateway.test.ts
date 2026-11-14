import { createServer, Server } from 'node:http';
import { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDeepSeekGateway } from '../server/deepseekGateway';

const servers: Server[] = [];
const DUMMY_SERVER_KEY = 'dummy-server-secret-never-real';
const requestBody = { model: 'deepseek-flash', messages: [{ role: 'user', content: 'Reply with OK' }] };

async function startGateway(fetchImpl: typeof fetch, apiKey = DUMMY_SERVER_KEY, timeoutMs = 1000) {
  const middleware = createDeepSeekGateway({ apiKey, fetchImpl, timeoutMs });
  const server = createServer((req, res) => middleware(req, res, () => { res.writeHead(404); res.end(); }));
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return {
    base,
    post: (body: unknown = requestBody, headers: Record<string, string> = {}) => fetch(`${base}/chem-gemini/api/ai/chat/completions`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body),
    }),
  };
}

const upstreamOK: typeof fetch = async () => new Response(JSON.stringify({ choices: [{ message: { content: 'OK' } }] }));

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve, reject) => {
    server.closeAllConnections();
    server.close((error) => error ? reject(error) : resolve());
  })));
});

describe('Local default-key gateway', () => {
  it('adds the key only upstream, fixes the model/URL and strips client forwarding controls', async () => {
    const mockFetch = vi.fn<typeof fetch>(upstreamOK);
    const gateway = await startGateway(mockFetch);
    const response = await gateway.post({ ...requestBody, baseURL: 'https://example.invalid', tools: [{ type: 'function' }], max_tokens: 999999 });
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    const [url, init] = mockFetch.mock.calls[0];
    const payload = JSON.parse(String(init?.body));
    expect(url).toBe('https://api.deepseek.com/v1/chat/completions');
    expect((init?.headers as Record<string, string>).Authorization).toBe(`Bearer ${DUMMY_SERVER_KEY}`);
    expect(payload.model).toBe('deepseek-flash');
    expect(payload.thinking).toEqual({ type: 'disabled' });
    expect(payload.max_tokens).toBe(2048);
    expect(payload.tools).toBeUndefined();
    expect(await response.text()).not.toContain(DUMMY_SERVER_KEY);
  });

  it('reports configuration status without revealing the key', async () => {
    const gateway = await startGateway(upstreamOK);
    const response = await fetch(`${gateway.base}/chem-gemini/api/ai/status`);
    expect(await response.json()).toEqual({ configured: true, model: 'deepseek-flash' });
  });

  it('fails clearly when the local server key is missing', async () => {
    const mockFetch = vi.fn<typeof fetch>(upstreamOK);
    const gateway = await startGateway(mockFetch, '');
    const response = await gateway.post();
    expect(response.status).toBe(503);
    expect(await response.text()).toContain('DEEPSEEK_API_KEY');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('rejects cross-origin and cross-site access', async () => {
    const mockFetch = vi.fn<typeof fetch>(upstreamOK);
    const gateway = await startGateway(mockFetch);
    expect((await gateway.post(requestBody, { Origin: 'https://evil.invalid' })).status).toBe(403);
    expect((await gateway.post(requestBody, { 'Sec-Fetch-Site': 'cross-site' })).status).toBe(403);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('rejects non-default models, external image URLs and invalid messages', async () => {
    const mockFetch = vi.fn<typeof fetch>(upstreamOK);
    const gateway = await startGateway(mockFetch);
    expect((await gateway.post({ ...requestBody, model: 'other-model' })).status).toBe(400);
    expect((await gateway.post({ model: 'deepseek-flash', messages: [] })).status).toBe(400);
    expect((await gateway.post({ model: 'deepseek-flash', messages: [{ role: 'user', content: [
      { type: 'image_url', image_url: { url: 'http://example.invalid/private-image' } },
    ] }] })).status).toBe(400);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('requires image consent and forwards approved inline image data', async () => {
    const mockFetch = vi.fn<typeof fetch>(upstreamOK);
    const gateway = await startGateway(mockFetch);
    const body = { model: 'deepseek-flash', messages: [{ role: 'user', content: [
      { type: 'text', text: '识别图片，仅返回 JSON' },
      { type: 'image_url', image_url: { url: 'data:image/png;base64,aW1hZ2U=' } },
    ] }], response_format: { type: 'json_object' } };
    expect((await gateway.post(body)).status).toBe(403);
    expect((await gateway.post(body, { 'X-Chem-Image-Consent': 'true' })).status).toBe(200);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const forwarded = JSON.parse(String(mockFetch.mock.calls[0][1]?.body));
    expect(forwarded.messages[0].content[1].image_url.url).toBe('data:image/png;base64,aW1hZ2U=');
    expect(forwarded.response_format).toEqual({ type: 'json_object' });
  });

  it('rejects oversized request bodies before forwarding', async () => {
    const mockFetch = vi.fn<typeof fetch>(upstreamOK);
    const gateway = await startGateway(mockFetch);
    const response = await gateway.post({ ...requestBody, padding: 'a'.repeat(4 * 1024 * 1024) });
    expect(response.status).toBe(413);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('rate-limits requests within the local process', async () => {
    const mockFetch = vi.fn<typeof fetch>(upstreamOK);
    const gateway = await startGateway(mockFetch);
    for (let i = 0; i < 20; i++) expect((await gateway.post()).status).toBe(200);
    expect((await gateway.post()).status).toBe(429);
    expect(mockFetch).toHaveBeenCalledTimes(20);
  });

  it('does not expose raw upstream error bodies or the default key', async () => {
    const mockFetch: typeof fetch = async () => new Response(JSON.stringify({ error: `bad key: ${DUMMY_SERVER_KEY}` }), { status: 401 });
    const gateway = await startGateway(mockFetch);
    const response = await gateway.post();
    expect(response.status).toBe(401);
    const text = await response.text();
    expect(text).toContain('HTTP 401');
    expect(text).not.toContain(DUMMY_SERVER_KEY);
  });

  it('cancels timed-out upstream requests', async () => {
    const mockFetch: typeof fetch = async (_url, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
    });
    const gateway = await startGateway(mockFetch, DUMMY_SERVER_KEY, 10);
    expect((await gateway.post()).status).toBe(504);
  });
});
