import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  applyProviderPreset,
  clearOnlineAIConfig,
  DEFAULT_ONLINE_AI_CONFIG,
  getAIRequestTarget,
  getActiveProviderDisplayName,
  getProviderPresetForURL,
  hasOnlineCredentials,
  isOnlineAIEnabled,
  loadOnlineAIConfig,
  parseImportedAIConfig,
  saveOnlineAIConfig,
  testAIConnection,
  updateOnlineAIConfig,
} from '../src/modules/recognition/aiConfig';
import { LLMTextAssistProvider, sanitizeModelRecognitionJSON, VisionProvider } from '../src/modules/recognition';
import { OnlineAIConfig } from '../src/types/chemistry';

const visionConfig = (): OnlineAIConfig => ({ ...DEFAULT_ONLINE_AI_CONFIG, imageUploadConsented: true });
const completion = (content: string) => new Response(JSON.stringify({ choices: [{ message: { content } }] }), {
  headers: { 'Content-Type': 'application/json' },
});

afterEach(() => vi.unstubAllGlobals());

describe('DeepSeek V4.1 Flash defaults and credential isolation', () => {
  it('defaults to enabled native vision without a browser-side key', () => {
    expect(loadOnlineAIConfig()).toEqual(DEFAULT_ONLINE_AI_CONFIG);
    expect(isOnlineAIEnabled(DEFAULT_ONLINE_AI_CONFIG)).toBe(true);
    expect(DEFAULT_ONLINE_AI_CONFIG.model).toBe('deepseek-flash');
    expect(DEFAULT_ONLINE_AI_CONFIG.providerMode).toBe('vision');
    expect(DEFAULT_ONLINE_AI_CONFIG.apiKey).toBe('');
    expect(DEFAULT_ONLINE_AI_CONFIG.imageUploadConsented).toBe(false);
  });

  it('uses a same-origin gateway, never an Authorization header, for the default credential', () => {
    const target = getAIRequestTarget(visionConfig());
    expect(target.endpoint).toMatch(/\/api\/ai\/chat\/completions$/);
    expect(target.headers.Authorization).toBeUndefined();
    expect(target.headers['X-Chem-Image-Consent']).toBe('true');
  });

  it('blocks reuse of the server credential with an arbitrary URL or model', () => {
    const config = { ...visionConfig(), baseURL: 'https://example.invalid/v1' };
    expect(hasOnlineCredentials(config)).toBe(false);
    expect(() => getAIRequestTarget(config)).toThrow('内置密钥仅用于');
    expect(hasOnlineCredentials({ ...visionConfig(), model: 'gpt-4o-mini' })).toBe(false);
  });

  it('clears the old key and consent when switching provider endpoints', () => {
    const ownKey: OnlineAIConfig = { ...visionConfig(), credentialSource: 'session', apiKey: 'dummy-old-provider-key' };
    const next = applyProviderPreset(ownKey, 'opencode_vision');
    expect(next.credentialSource).toBe('session');
    expect(next.apiKey).toBe('');
    expect(next.imageUploadConsented).toBe(false);
    expect(isOnlineAIEnabled(next)).toBe(false);
  });

  it('infers provider types from actual endpoint hosts without requiring preset buttons', () => {
    for (const [url, preset] of [
      ['https://api.deepseek.com', 'deepseek'],
      ['https://ark.cn-beijing.volces.com/api/v3', 'volcengine_deepseek'],
      ['https://opencode.ai/zen/v1', 'opencode_vision'],
      ['https://example.invalid/v1', 'custom'],
      ['https://api.deepseek.com.example.invalid/v1', 'custom'],
      ['https://', 'custom'],
    ] as const) {
      expect(getProviderPresetForURL(url)).toBe(preset);
    }
  });

  it('keeps manually edited endpoints, provider labels and credentials consistent', () => {
    const ownKey: OnlineAIConfig = { ...visionConfig(), credentialSource: 'session', apiKey: 'dummy-old-key' };
    const changed = updateOnlineAIConfig(ownKey, { baseURL: 'https://example.invalid/v1' });
    expect(changed.providerPreset).toBe('custom');
    expect(changed.apiKey).toBe('');
    expect(changed.imageUploadConsented).toBe(false);
    const ready = updateOnlineAIConfig(changed, { apiKey: 'dummy-replacement-key' });
    expect(getActiveProviderDisplayName(ready)).toBe('在线模型 (deepseek-flash)');
    expect(getActiveProviderDisplayName({
      ...ready, providerPreset: 'deepseek', baseURL: 'https://api.deepseek.com.example.invalid/v1',
    })).toBe('在线模型 (deepseek-flash)');
    expect(getAIRequestTarget(ready).endpoint).toBe('https://example.invalid/v1/chat/completions');
    const restored = updateOnlineAIConfig(ready, { baseURL: 'https://api.deepseek.com/v1' });
    expect(restored.providerPreset).toBe('deepseek');
    expect(restored.apiKey).toBe('');
    expect(restored.credentialSource).toBe('session');
  });

  it('resets consent when changing the model or capability', () => {
    expect(updateOnlineAIConfig(visionConfig(), { model: 'another-model' }).imageUploadConsented).toBe(false);
    expect(updateOnlineAIConfig(visionConfig(), { providerMode: 'text_assist' }).imageUploadConsented).toBe(false);
  });

  it('supports a custom API and explicitly supplied replacement key', () => {
    const next = parseImportedAIConfig(JSON.stringify({
      baseURL: 'https://example.invalid/v1/chat/completions', model: 'custom-vision-model',
      apiKey: 'dummy-replacement-key', providerMode: 'vision',
    }), visionConfig()).config;
    expect(next.providerPreset).toBe('custom');
    expect(next.credentialSource).toBe('session');
    expect(next.imageUploadConsented).toBe(false);
    expect(getAIRequestTarget(next)).toEqual({
      endpoint: 'https://example.invalid/v1/chat/completions',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer dummy-replacement-key' },
    });
  });

  it('does not mistake a URL for an API key', () => {
    const result = parseImportedAIConfig('https://example.invalid/v1', DEFAULT_ONLINE_AI_CONFIG);
    expect(result.extractedFields).toEqual(['接口地址']);
    expect(result.config.apiKey).toBe('');
    expect(result.config.enabled).toBe(false);
  });

  it('imports a DeepSeek key without downgrading Flash to a text-only preset', () => {
    const result = parseImportedAIConfig('sk-dummy-imported-key-never-real', DEFAULT_ONLINE_AI_CONFIG);
    expect(result.config.model).toBe('deepseek-flash');
    expect(result.config.providerMode).toBe('vision');
    expect(result.config.credentialSource).toBe('session');
  });

  it('supports JSON, env and curl imports', () => {
    for (const input of [
      '{"apiKey":"dummy-new-key","baseURL":"https://api.deepseek.com/v1","model":"deepseek-flash"}',
      'DEEPSEEK_API_KEY=dummy-new-key\nBASE_URL=https://api.deepseek.com/v1\nMODEL=deepseek-flash',
      'curl https://api.deepseek.com/v1/chat/completions -H "Authorization: Bearer dummy-new-key" -d \'{"model":"deepseek-flash"}\'',
    ]) {
      const result = parseImportedAIConfig(input, DEFAULT_ONLINE_AI_CONFIG);
      expect(result.error).toBeUndefined();
      expect(result.config.apiKey).toBe('dummy-new-key');
      expect(result.config.providerMode).toBe('vision');
    }
  });
});

describe('Native vision requests and fallback', () => {
  it('sends image_url + deepseek-flash through the default gateway with thinking disabled', async () => {
    const mockFetch = vi.fn<typeof fetch>(async () => completion('{"status":"ok","candidates":[{"substanceId":"naoh"}]}'));
    const result = await new VisionProvider(visionConfig(), mockFetch).recognize({ image: new Blob(['image'], { type: 'image/png' }) });
    expect(result.candidates).toEqual([{ substanceId: 'naoh' }]);
    const [url, init] = mockFetch.mock.calls[0];
    const body = JSON.parse(String(init?.body));
    expect(String(url)).toMatch(/\/api\/ai\/chat\/completions$/);
    expect(body.model).toBe('deepseek-flash');
    expect(body.thinking).toEqual({ type: 'disabled' });
    expect(body.response_format).toEqual({ type: 'json_object' });
    expect(body.messages[1].content[1].image_url.url).toMatch(/^data:image\/png;base64,/);
    expect((init?.headers as Record<string, string>).Authorization).toBeUndefined();
  });

  it('never uploads an image without consent, even if the provider is called directly', async () => {
    const mockFetch = vi.fn<typeof fetch>();
    const result = await new VisionProvider(DEFAULT_ONLINE_AI_CONFIG, mockFetch).recognize({ image: new Blob(['image']) });
    expect(mockFetch).not.toHaveBeenCalled();
    expect(result.status).toBe('ambiguous');
    expect(result.message).toContain('本次未上传');
  });

  it('uses the same gateway for optional text assistance without requiring a browser key', async () => {
    const mockFetch = vi.fn<typeof fetch>(async () => completion('{"status":"ok","candidates":[{"substanceId":"naoh"}]}'));
    const result = await new LLMTextAssistProvider(DEFAULT_ONLINE_AI_CONFIG, mockFetch).recognize({ text: '烧碱' });
    expect(result.candidates[0].substanceId).toBe('naoh');
    expect(String(mockFetch.mock.calls[0][0])).toMatch(/\/api\/ai\/chat\/completions$/);
  });

  it('falls back on gateway failure without claiming DeepSeek cannot see images', async () => {
    const mockFetch = vi.fn<typeof fetch>(async () => new Response('{}', { status: 503 }));
    const result = await new VisionProvider(visionConfig(), mockFetch).recognize({ image: new Blob(['image']) });
    expect(result.providerUsed).toBe('local_text');
    expect(result.fallbackNotice).toContain('HTTP 503');
    expect(result.fallbackNotice).not.toContain('不支持直接传图');
  });

  it('connection tests require a real non-empty model reply, not just HTTP 200', async () => {
    const fetchEmpty: typeof fetch = async () => new Response('{}');
    const fetchOK: typeof fetch = async () => completion('OK');
    expect((await testAIConnection(DEFAULT_ONLINE_AI_CONFIG, fetchEmpty)).ok).toBe(false);
    expect((await testAIConnection(DEFAULT_ONLINE_AI_CONFIG, fetchOK)).ok).toBe(true);
  });
});

describe('Recognition output safety', () => {
  it('keeps a single recognized object as a candidate', () => {
    const result = sanitizeModelRecognitionJSON(JSON.stringify({
      status: 'ok', objects: [{ label: 'Fe', bbox: [10, 20, 30, 40], substanceId: 'fe' }],
    }), 'vision');
    expect(result.status).toBe('ok');
    expect(result.candidates).toEqual([{ substanceId: 'fe' }]);
  });

  it('uses local names, strips generated formulas and bounds hotspots inside the image', () => {
    const result = sanitizeModelRecognitionJSON(JSON.stringify({ status: 'ok', objects: [
      { label: 'NaOH（强腐蚀性）', bbox: [95, 99, 100, 100], substanceId: 'naoh' },
      { label: 'NaOH 烧杯', bbox: [10, 20, 30, 40], isApparatus: true },
    ] }), 'vision');
    expect(result.objects?.[0].label).toBe('氢氧化钠（烧碱/火碱/苛性钠）');
    expect(result.objects?.[1].label).toBe('烧杯');
    expect(result.objects?.[0].bbox).toEqual([92, 92, 8, 8]);
  });

  it('does not turn an unknown or ambiguous status into a successful multi-object result', () => {
    expect(sanitizeModelRecognitionJSON('{"status":"network_error"}', 'vision').status).toBe('ambiguous');
    expect(sanitizeModelRecognitionJSON(JSON.stringify({ status: 'ambiguous', objects: [
      { bbox: [0, 0, 20, 20], substanceId: 'naoh' }, { bbox: [30, 0, 20, 20], substanceId: 'fe' },
    ] }), 'vision').status).toBe('ambiguous');
  });
});

describe('Session config persistence and migration', () => {
  function setupStorage() {
    const data = new Map<string, string>();
    vi.stubGlobal('window', { sessionStorage: {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => data.set(key, value),
      removeItem: (key: string) => data.delete(key),
    } });
    return data;
  }

  it('persists server mode without storing any default key', () => {
    const storage = setupStorage();
    saveOnlineAIConfig({ ...visionConfig(), apiKey: 'should-never-be-stored-in-server-mode' });
    expect([...storage.values()].join('')).not.toContain('should-never');
    expect(loadOnlineAIConfig().credentialSource).toBe('server');
    expect(loadOnlineAIConfig().apiKey).toBe('');
    clearOnlineAIConfig();
    expect(storage.size).toBe(0);
  });

  it('never reads, overwrites or clears P1 credentials and consent on the shared Pages origin', () => {
    const storage = setupStorage();
    const p1Keys = ['chem_gemini_p1_online_config_v1', 'chem_gemini_p1_online_config_v2'];
    const seeded = JSON.stringify({ ...visionConfig(), credentialSource: 'session', apiKey: 'dummy-p1-only', imageUploadConsented: true });
    for (const key of p1Keys) storage.set(key, seeded);
    expect(loadOnlineAIConfig()).toEqual(DEFAULT_ONLINE_AI_CONFIG);
    saveOnlineAIConfig({ ...visionConfig(), credentialSource: 'session', apiKey: 'dummy-p0-only' });
    expect(loadOnlineAIConfig().apiKey).toBe('dummy-p0-only');
    for (const key of p1Keys) expect(storage.get(key)).toBe(seeded);
    clearOnlineAIConfig();
    expect([...storage.keys()]).toEqual(p1Keys);
    for (const key of p1Keys) expect(storage.get(key)).toBe(seeded);
  });

  it('migrates old DeepSeek settings to vision and resets old image consent', () => {
    const storage = setupStorage();
    storage.set('chem_gemini_p0_online_config_v1', JSON.stringify({
      enabled: true, providerPreset: 'deepseek', providerMode: 'text_assist',
      baseURL: 'https://api.deepseek.com/v1', model: 'deepseek-chat', apiKey: 'dummy-legacy-key', imageUploadConsented: true,
    }));
    const loaded = loadOnlineAIConfig();
    expect(loaded.model).toBe('deepseek-flash');
    expect(loaded.providerMode).toBe('vision');
    expect(loaded.apiKey).toBe('dummy-legacy-key');
    expect(loaded.credentialSource).toBe('session');
    expect(loaded.imageUploadConsented).toBe(false);
  });

  it('falls back to safe defaults on corrupt stored JSON', () => {
    const storage = setupStorage();
    storage.set('chem_gemini_p0_online_config_v2', 'invalid-json');
    expect(loadOnlineAIConfig()).toEqual(DEFAULT_ONLINE_AI_CONFIG);
  });
});
