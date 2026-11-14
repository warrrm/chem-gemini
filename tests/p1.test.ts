import { describe, expect, it } from 'vitest';
import { searchSubstancesByName } from '../src/modules/knowledge';
import {
  LLMTextAssistProvider,
  sanitizeModelRecognitionJSON,
  VisionProvider,
} from '../src/modules/recognition';
import {
  applyProviderPreset,
  DEFAULT_ONLINE_AI_CONFIG,
  getActiveProviderDisplayName,
} from '../src/modules/recognition/aiConfig';
import {
  INITIAL_LEARNING_STATE,
  isStepUnlocked,
  learningReducer,
} from '../src/state/learningMachine';
import { OnlineAIConfig } from '../src/types/chemistry';

const MOCK_VISION_CONFIG: OnlineAIConfig = {
  enabled: true,
  providerPreset: 'opencode_vision',
  providerMode: 'vision',
  baseURL: 'https://opencode.ai/zen/v1',
  model: 'gpt-4o-mini',
  credentialSource: 'session',
  apiKey: 'sk-test-dummy-key-never-real',
  imageUploadConsented: true,
};

const MOCK_DEEPSEEK_CONFIG: OnlineAIConfig = {
  enabled: true,
  providerPreset: 'deepseek',
  providerMode: 'text_assist',
  baseURL: 'https://api.deepseek.com/v1',
  model: 'deepseek-flash',
  credentialSource: 'session',
  apiKey: 'sk-deepseek-dummy-key-never-real',
  imageUploadConsented: false,
};

describe('P1 DeepSeek & Provider Presets Configuration', () => {
  it('applies DeepSeek V4.1 Flash preset with native vision and server-side credentials', () => {
    const next = applyProviderPreset(DEFAULT_ONLINE_AI_CONFIG, 'deepseek');
    expect(next.enabled).toBe(true);
    expect(next.providerPreset).toBe('deepseek');
    expect(next.providerMode).toBe('vision');
    expect(next.baseURL).toBe('https://api.deepseek.com/v1');
    expect(next.model).toBe('deepseek-flash');
    expect(next.credentialSource).toBe('server');
    expect(next.apiKey).toBe('');
  });

  it('formats active provider display name accurately for Demo vs DeepSeek', () => {
    expect(getActiveProviderDisplayName(applyProviderPreset(DEFAULT_ONLINE_AI_CONFIG, 'demo'))).toBe('演示模式');
    expect(getActiveProviderDisplayName(MOCK_DEEPSEEK_CONFIG)).toBe('DeepSeek V4.1 Flash (deepseek-flash)');
  });
});

describe('P1 Recognition JSON Sanitizer & Whitelist Guard', () => {
  it('accepts valid substanceIds present in knowledge base and strips unknown/fabricated IDs', () => {
    const raw = JSON.stringify({
      status: 'ok',
      candidates: [
        { substanceId: 'naoh' },
        { substanceId: 'fabricated_unknown_chemical_xyz' },
        { substanceId: 'caoh2' },
      ],
    });
    const res = sanitizeModelRecognitionJSON(raw, 'vision');
    expect(res.status).toBe('ok');
    expect(res.candidates).toEqual([{ substanceId: 'naoh' }, { substanceId: 'caoh2' }]);
  });

  it('converts ok response with zero valid whitelist IDs into ambiguous', () => {
    const raw = '```json\n{"status":"ok","candidates":[{"substanceId":"fake_id"}]}\n```';
    const res = sanitizeModelRecognitionJSON(raw, 'llm_text_assist');
    expect(res.status).toBe('ambiguous');
    expect(res.candidates).toEqual([]);
  });

  it('parses multi-object hotspots and marks apparatus vs valid substances', () => {
    const raw = JSON.stringify({
      status: 'ok',
      objects: [
        { label: '铁钉', bbox: [10, 40, 20, 30], isApparatus: false, substanceId: 'fe' },
        { label: '烧杯', bbox: [70, 30, 20, 50], isApparatus: true },
      ],
    });
    const res = sanitizeModelRecognitionJSON(raw, 'vision');
    expect(res.objects).toHaveLength(2);
    expect(res.objects?.[0].substanceId).toBe('fe');
    expect(res.objects?.[1].isApparatus).toBe(true);
  });
});

describe('P1 DeepSeek LLMTextAssistProvider & VisionProvider Execution and Fallback', () => {
  it('calls DeepSeek /chat/completions with json_object and maps colloquial description to whitelist substanceId', async () => {
    let capturedUrl = '';
    let capturedBody: Record<string, unknown> = {};

    const mockDeepSeekFetch: typeof fetch = async (input, init) => {
      capturedUrl = String(input);
      capturedBody = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>;
      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  status: 'ok',
                  candidates: [{ substanceId: 'naoh' }],
                }),
              },
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    };

    const provider = new LLMTextAssistProvider(MOCK_DEEPSEEK_CONFIG, mockDeepSeekFetch);
    const res = await provider.recognize({ text: '白色片状固体，常用于炉具清洁剂去油污' });

    expect(capturedUrl).toBe('https://api.deepseek.com/v1/chat/completions');
    expect(capturedBody.model).toBe('deepseek-flash');
    expect(capturedBody.response_format).toEqual({ type: 'json_object' });
    expect(res.status).toBe('ok');
    expect(res.candidates).toEqual([{ substanceId: 'naoh' }]);
    expect(res.fallbackNotice).toContain('DeepSeek V4.1 Flash (deepseek-flash)');
  });

  it('falls back gracefully to LocalTextMatcher when DeepSeek HTTP request fails', async () => {
    const failingFetch: typeof fetch = async () => {
      throw new Error('Network unreachable / CORS blocked');
    };
    const provider = new LLMTextAssistProvider(MOCK_DEEPSEEK_CONFIG, failingFetch);
    const res = await provider.recognize({ text: '烧碱' });
    expect(res.status).toBe('ok');
    expect(res.candidates[0].substanceId).toBe('naoh');
    expect(res.fallbackNotice).toContain('已自动降级为本地词库匹配');
  });

  it('falls back gracefully to manual search when VisionProvider HTTP returns 401/429', async () => {
    const unauthorizedFetch: typeof fetch = async () =>
      new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    const provider = new VisionProvider(MOCK_VISION_CONFIG, unauthorizedFetch);
    const fakeBlob = new Blob(['fake-image-bytes'], { type: 'image/png' });
    const res = await provider.recognize({ image: fakeBlob });
    expect(res.status).toBe('ambiguous');
    expect(res.providerUsed).toBe('local_text');
    expect(res.fallbackNotice).toContain('HTTP 401');
  });
});

describe('P1 Teacher Mode Force Unlock & Isolation', () => {
  it('does not allow TEACHER_FORCE_UNLOCK when teacherMode.enabled is false', () => {
    let state = learningReducer(INITIAL_LEARNING_STATE, {
      type: 'CONFIRM_SUBSTANCE',
      substanceId: 'limestone',
    });
    state = learningReducer(state, {
      type: 'TEACHER_FORCE_UNLOCK',
      substanceId: 'limestone',
    });
    expect(isStepUnlocked(state, 4)).toBe(false);
  });

  it('unlocks steps 4-6 immediately when teacherMode.enabled is true', () => {
    let state = learningReducer(INITIAL_LEARNING_STATE, {
      type: 'UPDATE_TEACHER_MODE',
      patch: { enabled: true },
    });
    state = learningReducer(state, {
      type: 'CONFIRM_SUBSTANCE',
      substanceId: 'limestone',
    });
    state = learningReducer(state, {
      type: 'TEACHER_FORCE_UNLOCK',
      substanceId: 'limestone',
    });
    expect(state.currentStep).toBe(4);
    expect(isStepUnlocked(state, 4)).toBe(true);
    expect(isStepUnlocked(state, 5)).toBe(true);
    expect(isStepUnlocked(state, 6)).toBe(true);
  });
});

describe('Knowledge Text Search Priority & Out-of-Scope Guard', () => {
  it('matches in-scope water when searching 水 instead of false-matching 乙酰水杨酸', () => {
    const res = searchSubstancesByName('水');
    expect(res.type).toBe('matched');
    expect(res.substances[0]?.id).toBe('h2o');
  });

  it('flags out-of-scope substances like 苯酚 or 乙酰水杨酸 accurately', () => {
    const resPhenol = searchSubstancesByName('苯酚');
    expect(resPhenol.type).toBe('out_of_scope');
    const resAspirin = searchSubstancesByName('阿司匹林');
    expect(resAspirin.type).toBe('out_of_scope');
  });
});
