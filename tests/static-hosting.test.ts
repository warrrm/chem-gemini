import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

beforeEach(() => { vi.stubEnv('VITE_AI_DEPLOYMENT', 'static'); vi.resetModules(); });
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.resetModules(); });

describe('GitHub Pages credential boundary', () => {
  it('defaults to an empty user-supplied key while keeping the official Flash model', async () => {
    const { DEFAULT_ONLINE_AI_CONFIG: config, isOnlineAIEnabled } = await import('../src/modules/recognition/aiConfig');
    expect(config.credentialSource).toBe('session');
    expect(config.apiKey).toBe('');
    expect(config.model).toBe('deepseek-flash');
    expect(config.providerMode).toBe('vision');
    expect(isOnlineAIEnabled(config)).toBe(false);
  });

  it('rejects a forged server mode but still disables thinking for a user-supplied Flash key', async () => {
    const api = await import('../src/modules/recognition/aiConfig');
    const config = { ...api.DEFAULT_ONLINE_AI_CONFIG, credentialSource: 'server' as const };
    expect(api.canUseServerCredential(config)).toBe(false);
    expect(() => api.getAIRequestTarget(config)).toThrow('GitHub Pages');
    expect(api.getModelRequestOptions(config)).toEqual({ thinking: { type: 'disabled' } });
  });

  it('downgrades stale saved server credentials instead of pretending a gateway exists', async () => {
    vi.stubGlobal('window', { sessionStorage: { getItem: () => JSON.stringify({
      enabled: true, providerPreset: 'deepseek', providerMode: 'vision', credentialSource: 'server',
      baseURL: 'https://api.deepseek.com/v1', model: 'deepseek-flash', apiKey: 'must-not-be-reused',
    }) } });
    const api = await import('../src/modules/recognition/aiConfig');
    const loaded = api.loadOnlineAIConfig();
    expect(loaded.credentialSource).toBe('session');
    expect(loaded.apiKey).toBe('');
    expect(api.hasOnlineCredentials(loaded)).toBe(false);
  });

  it('never re-enables server credentials when applying the DeepSeek preset on Pages', async () => {
    const api = await import('../src/modules/recognition/aiConfig');
    expect(api.applyProviderPreset(api.DEFAULT_ONLINE_AI_CONFIG, 'deepseek').credentialSource).toBe('session');
  });
});
