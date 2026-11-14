import { DEMO_SAMPLES } from '../../data/samples';
import { ALL_SUBSTANCES, OUT_OF_SCOPE_SUBSTANCES, SUBSTANCE_BY_ID } from '../../data/substances';
import {
  OnlineAIConfig,
  RecognitionProvider,
  RecognitionResult,
  SampleHotspot,
} from '../../types/chemistry';
import { searchSubstancesByName } from '../knowledge';
import { getActiveProviderDisplayName } from './aiConfig';

/**
 * 构建知识库白名单目录（仅向大模型传递 id 与 name/aliases，且只允许模型返回已知 ID）
 */
export function buildKnowledgeCatalogSummary(): {
  inScope: { id: string; name: string; aliases: string[] }[];
  outOfScope: { id: string; name: string }[];
} {
  return {
    inScope: ALL_SUBSTANCES.map((s) => ({
      id: s.id,
      name: s.name,
      aliases: s.aliases,
    })),
    outOfScope: OUT_OF_SCOPE_SUBSTANCES.map((o) => ({
      id: o.id,
      name: o.name,
    })),
  };
}

/**
 * 安全解析并过滤模型返回的 JSON：
 * - 严格校验 candidate substanceId 必须存在于本地知识库 SUBSTANCE_BY_ID 中，否则丢弃（硬性约束 #1 & 第 6 节）
 * - 绝不信任模型生成的任何化学式、方程式或自然语言科普文本
 */
export function sanitizeModelRecognitionJSON(
  rawText: string,
  providerUsed: 'llm_text_assist' | 'vision'
): RecognitionResult {
  const cleaned = rawText
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start >= 0 && end > start) {
      parsed = JSON.parse(cleaned.slice(start, end + 1));
    } else {
      throw new Error('模型返回格式非合法 JSON');
    }
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('模型返回结构无效');
  }

  const obj = parsed as Record<string, unknown>;
  const rawStatus = typeof obj.status === 'string' ? obj.status : 'ambiguous';

  if (rawStatus === 'out_of_scope') {
    const outId = typeof obj.outOfScopeId === 'string' ? obj.outOfScopeId : '';
    const knownOut = OUT_OF_SCOPE_SUBSTANCES.find((o) => o.id === outId);
    return {
      status: 'out_of_scope',
      candidates: [],
      outOfScopeName: knownOut?.name,
      message: knownOut
        ? `暂不在当前学习范围内：${knownOut.reason}`
        : '暂不在当前学习范围内（该物质超出初中化学课程标准）。',
      providerUsed,
    };
  }

  const rawCandidates = Array.isArray(obj.candidates) ? obj.candidates : [];
  const validCandidateIds: string[] = [];
  for (const item of rawCandidates) {
    const cid =
      typeof item === 'string'
        ? item
        : item && typeof item === 'object' && typeof (item as { substanceId?: unknown }).substanceId === 'string'
        ? (item as { substanceId: string }).substanceId
        : null;
    if (cid && SUBSTANCE_BY_ID.has(cid) && !validCandidateIds.includes(cid)) {
      validCandidateIds.push(cid);
    }
  }

  const validObjects: SampleHotspot[] = [];
  if (Array.isArray(obj.objects)) {
    obj.objects.forEach((rawObj, idx) => {
      if (!rawObj || typeof rawObj !== 'object') return;
      const o = rawObj as Record<string, unknown>;
      const bboxRaw = Array.isArray(o.bbox) ? o.bbox : null;
      if (!bboxRaw || bboxRaw.length !== 4 || bboxRaw.some((n) => typeof n !== 'number')) return;
      const clampedBbox: [number, number, number, number] = [
        Math.max(0, Math.min(90, bboxRaw[0] as number)),
        Math.max(0, Math.min(90, bboxRaw[1] as number)),
        Math.max(8, Math.min(100, bboxRaw[2] as number)),
        Math.max(8, Math.min(100, bboxRaw[3] as number)),
      ];
      const isApparatus = Boolean(o.isApparatus);
      const subId = typeof o.substanceId === 'string' && SUBSTANCE_BY_ID.has(o.substanceId) ? o.substanceId : undefined;
      const label =
        typeof o.label === 'string' && o.label.trim()
          ? o.label.trim().slice(0, 20)
          : subId
          ? SUBSTANCE_BY_ID.get(subId)!.name
          : '实验仪器';

      if (isApparatus) {
        validObjects.push({
          id: `ai_obj_${idx}`,
          label,
          bbox: clampedBbox,
          isApparatus: true,
          apparatusMessage: `${label}是实验仪器，不是化学物质，请点选化学试剂或材料。`,
        });
      } else if (subId) {
        validObjects.push({
          id: `ai_obj_${idx}`,
          label,
          bbox: clampedBbox,
          substanceId: subId,
        });
      }
    });
  }

  if (validObjects.length > 1) {
    return {
      status: 'ok',
      candidates: [],
      objects: validObjects,
      providerUsed,
    };
  }

  if (rawStatus === 'ambiguous' || (rawStatus === 'ok' && validCandidateIds.length === 0)) {
    return {
      status: 'ambiguous',
      candidates: [],
      message: '仅凭当前信息无法唯一确定，请补充更明确的标签文字或物质名称',
      providerUsed,
    };
  }

  return {
    status: 'ok',
    candidates: validCandidateIds.slice(0, 4).map((id) => ({ substanceId: id })),
    providerUsed,
  };
}

async function blobToResizedDataUrl(blob: Blob): Promise<string> {
  if (typeof document === 'undefined' || typeof Image === 'undefined') {
    const buf = await blob.arrayBuffer();
    const bytes = new Uint8Array(buf);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const b64 = btoa(binary);
    return `data:${blob.type || 'image/png'};base64,${b64}`;
  }

  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      try {
        const maxDim = 1024;
        let w = img.naturalWidth || 512;
        let h = img.naturalHeight || 512;
        if (w > maxDim || h > maxDim) {
          if (w >= h) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          } else {
            w = Math.round((w * maxDim) / h);
            h = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          URL.revokeObjectURL(url);
          reject(new Error('Canvas context unavailable'));
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        URL.revokeObjectURL(url);
        resolve(dataUrl);
      } catch (err) {
        URL.revokeObjectURL(url);
        reject(err);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('图片解码失败'));
    };
    img.src = url;
  });
}

export function normalizeEndpoint(baseURL: string): string {
  const trimmed = baseURL.trim().replace(/\/+$/, '');
  if (trimmed.endsWith('/chat/completions')) return trimmed;
  return `${trimmed}/chat/completions`;
}

/**
 * P0 默认演示模式识别器
 */
export class DemoProvider implements RecognitionProvider {
  public readonly id = 'demo';

  async recognize(input: { image?: Blob; text?: string; sampleId?: string }): Promise<RecognitionResult> {
    if (input.sampleId) {
      const sample = DEMO_SAMPLES.find((s) => s.id === input.sampleId);
      if (!sample) {
        return {
          status: 'unreadable',
          candidates: [],
          message: '未找到对应的演示样例，请重新选择或手动搜索物质。',
          providerUsed: 'demo',
        };
      }

      if (sample.recognitionStatus === 'out_of_scope') {
        return {
          status: 'out_of_scope',
          candidates: [],
          message: sample.statusMessage ?? '暂不在当前学习范围内',
          providerUsed: 'demo',
        };
      }

      if (sample.recognitionStatus === 'ambiguous') {
        return {
          status: 'ambiguous',
          candidates: [],
          message: sample.statusMessage ?? '仅凭图片无法确定，请补充标签或名称',
          providerUsed: 'demo',
        };
      }

      return {
        status: 'ok',
        candidates: sample.candidates.map((c) => ({ substanceId: c.substanceId })),
        objects: sample.hotspots,
        message: sample.statusMessage,
        providerUsed: 'demo',
      };
    }

    if (input.text && input.text.trim()) {
      const matcher = new LocalTextMatcher();
      return matcher.recognize({ text: input.text });
    }

    return {
      status: 'unreadable',
      candidates: [],
      message: '演示模式不会分析你的图片，请从下方选择或搜索要学习的物质',
      providerUsed: 'demo',
    };
  }
}

/**
 * P0 本地文本名称/别名/俗称模糊匹配器
 */
export class LocalTextMatcher implements RecognitionProvider {
  public readonly id = 'local_text';

  async recognize(input: { image?: Blob; text?: string }): Promise<RecognitionResult> {
    const query = input.text?.trim() ?? '';
    if (!query) {
      return {
        status: 'ambiguous',
        candidates: [],
        message: '请输入物质名称或常见俗称后再搜索。',
        providerUsed: 'local_text',
      };
    }

    const outcome = searchSubstancesByName(query);
    if (outcome.type === 'out_of_scope') {
      return {
        status: 'out_of_scope',
        candidates: [],
        outOfScopeName: outcome.outOfScope?.name,
        message: `暂不在当前学习范围内${outcome.outOfScope ? `：${outcome.outOfScope.reason}` : ''}`,
        providerUsed: 'local_text',
      };
    }

    if (outcome.type === 'matched' && outcome.substances.length > 0) {
      return {
        status: 'ok',
        candidates: outcome.substances.map((s) => ({ substanceId: s.id })),
        providerUsed: 'local_text',
      };
    }

    return {
      status: 'ambiguous',
      candidates: [],
      message: `未在当前初中化学知识库中找到“${query}”，请尝试输入常见标准名称或俗称。`,
      providerUsed: 'local_text',
    };
  }
}

/**
 * P1 文本辅助映射器（LLMTextAssist — 完美适配 DeepSeek deepseek-chat / deepseek-reasoner）：
 * - 不能看图，仅把用户输入的标签文字、俗称、外观或用途描述映射到知识库白名单 substanceId
 * - 当用户填写了 API Key 且启用在线模式时，真实发起请求调用 DeepSeek / 兼容接口
 * - 任何失败一律自动降级到 LocalTextMatcher，绝不白屏
 */
export class LLMTextAssistProvider implements RecognitionProvider {
  public readonly id = 'llm_text_assist';
  private readonly config: OnlineAIConfig;
  private readonly fetchImpl: typeof fetch;

  constructor(config: OnlineAIConfig, fetchImpl: typeof fetch = fetch) {
    this.config = config;
    this.fetchImpl = fetchImpl;
  }

  async recognize(input: { image?: Blob; text?: string }): Promise<RecognitionResult> {
    const query = input.text?.trim() ?? '';
    const providerLabel = getActiveProviderDisplayName(this.config);

    if (!query) {
      return {
        status: 'ambiguous',
        candidates: [],
        message: `当前已启用 ${providerLabel}（文本辅助模式，不上传图片），请输入标签文字、俗称或物质外观描述。`,
        providerUsed: 'llm_text_assist',
      };
    }

    const localFirst = await localTextMatcher.recognize({ text: query });
    if (localFirst.status === 'out_of_scope') {
      return localFirst;
    }

    if (!this.config.apiKey.trim()) {
      return {
        ...localFirst,
        fallbackNotice: '未填写 API Key，已自动使用本地词库匹配。',
      };
    }

    const catalog = buildKnowledgeCatalogSummary();
    const systemPrompt = [
      '你是初中化学识物小课堂的物质 ID 智能映射助手。',
      '你的唯一任务是根据用户输入的试剂标签文字、俗称、外观特征或用途描述，从下方知识库白名单中匹配最相关的 1～3 个 substanceId。',
      '规则：',
      '1. 如果描述过于模糊（例如仅说“无色透明液体”或“白色粉末”，没有标签或特征性质），必须返回 {"status":"ambiguous","candidates":[]}，绝不能瞎猜。',
      '2. 如果描述的是已知超纲物质（如苯酚、苯、阿司匹林、聚乙烯），返回 {"status":"out_of_scope","candidates":[],"outOfScopeId":"..."}。',
      '3. 严禁编造不在列表中的 ID，严禁输出任何化学式、方程式或解释文字，只返回纯 JSON 对象：',
      '{"status":"ok"|"ambiguous"|"out_of_scope","candidates":[{"substanceId":"..."}],"outOfScopeId":"..."}',
      `知识库范围内物质白名单：${JSON.stringify(catalog.inScope)}`,
      `已知超纲物质名单：${JSON.stringify(catalog.outOfScope)}`,
    ].join('\n');

    const modelName = this.config.model.trim() || 'deepseek-chat';
    const isReasoner = modelName.toLowerCase().includes('reasoner');

    const payload: Record<string, unknown> = {
      model: modelName,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `用户输入描述/标签文字：${query}` },
      ],
    };

    if (!isReasoner) {
      payload.temperature = 0.1;
      payload.response_format = { type: 'json_object' };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);

    try {
      const resp = await this.fetchImpl(normalizeEndpoint(this.config.baseURL), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.apiKey.trim()}`,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}`);
      }

      const data = (await resp.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      const content = data.choices?.[0]?.message?.content ?? '';
      const sanitized = sanitizeModelRecognitionJSON(content, 'llm_text_assist');

      if (sanitized.status === 'ok' && sanitized.candidates.length > 0) {
        return {
          ...sanitized,
          fallbackNotice: `已通过 ${providerLabel} 完成智能识别映射（仅展示物质名称，不剧透化学式）。`,
        };
      }

      if (sanitized.status === 'ambiguous' && localFirst.status === 'ok') {
        return {
          ...localFirst,
          providerUsed: 'llm_text_assist',
          fallbackNotice: `已结合 ${providerLabel} 与本地词库匹配到以下物质。`,
        };
      }

      return {
        ...sanitized,
        fallbackNotice:
          sanitized.status === 'ambiguous'
            ? `${providerLabel} 判断当前描述信息不足，请补充更具体的标签或俗称。`
            : undefined,
      };
    } catch (err) {
      const errDetail = err instanceof Error ? err.message : '请求异常';
      return {
        ...localFirst,
        fallbackNotice: `${providerLabel} 调用失败（${errDetail}），已自动降级为本地词库匹配。`,
      };
    } finally {
      clearTimeout(timer);
    }
  }
}

/**
 * P1 多模态识图 Provider（VisionProvider）
 */
export class VisionProvider implements RecognitionProvider {
  public readonly id = 'vision';
  private readonly config: OnlineAIConfig;
  private readonly fetchImpl: typeof fetch;

  constructor(config: OnlineAIConfig, fetchImpl: typeof fetch = fetch) {
    this.config = config;
    this.fetchImpl = fetchImpl;
  }

  async recognize(input: { image?: Blob; text?: string }): Promise<RecognitionResult> {
    if (input.text && !input.image) {
      const textAssist = new LLMTextAssistProvider(this.config, this.fetchImpl);
      return textAssist.recognize({ text: input.text });
    }

    if (!input.image) {
      return {
        status: 'unreadable',
        candidates: [],
        message: '未检测到可识别的图片，请重新拍照或上传图片。',
        providerUsed: 'vision',
      };
    }

    if (!this.config.apiKey.trim()) {
      return {
        status: 'ambiguous',
        candidates: [],
        message: '尚未填写 API Key，已降级为本地模式，请在下方手动输入或搜索物质名称。',
        providerUsed: 'local_text',
        fallbackNotice: '未检测到 API Key，已降级为本地手动选择模式。',
      };
    }

    const catalog = buildKnowledgeCatalogSummary();
    const systemPrompt = [
      '你是初中化学教学识物辅助系统，负责识别照片中的常见化学试剂、矿石或实验用品，并映射到下方知识库白名单 ID。',
      '必须遵守以下规则：',
      '1. 如果图片是无标签的澄清无色液体或无标签白色粉末，且没有明确特征能唯一确定物质，必须返回 {"status":"ambiguous","candidates":[]}，绝不能瞎猜！',
      '2. 如果图片中的物质明显属于超纲名单（如苯酚、苯、阿司匹林、聚乙烯等），返回 {"status":"out_of_scope","candidates":[],"outOfScopeId":"..."}。',
      '3. 如果图中同时出现多个明显物体（含实验仪器如烧杯），可在 objects 中返回各自归一化百分比边界框 [x,y,w,h]（0-100），仪器标记 "isApparatus":true。',
      '4. 只能返回纯 JSON，严禁输出任何化学式、方程式或额外文字：',
      '{"status":"ok"|"ambiguous"|"out_of_scope","candidates":[{"substanceId":"..."}],"objects":[{"label":"...","bbox":[10,20,30,40],"isApparatus":false,"substanceId":"..."}],"outOfScopeId":"..."}',
      `知识库范围内物质白名单：${JSON.stringify(catalog.inScope)}`,
      `已知超纲物质名单：${JSON.stringify(catalog.outOfScope)}`,
    ].join('\n');

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 25000);

    try {
      const imageDataUrl = await blobToResizedDataUrl(input.image);
      const resp = await this.fetchImpl(normalizeEndpoint(this.config.baseURL), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.apiKey.trim()}`,
        },
        body: JSON.stringify({
          model: this.config.model.trim() || 'gpt-4o-mini',
          temperature: 0.1,
          messages: [
            { role: 'system', content: systemPrompt },
            {
              role: 'user',
              content: [
                { type: 'text', text: '请识别这张图片中的初中化学学习对象，仅返回 JSON。' },
                { type: 'image_url', image_url: { url: imageDataUrl } },
              ],
            },
          ],
        }),
        signal: controller.signal,
      });

      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}`);
      }

      const data = (await resp.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      const content = data.choices?.[0]?.message?.content ?? '';
      return sanitizeModelRecognitionJSON(content, 'vision');
    } catch (err) {
      const errDetail = err instanceof Error ? err.message : '网络或接口异常';
      const deepseekTip =
        this.config.baseURL.includes('deepseek') || this.config.model.includes('deepseek')
          ? '（提示：DeepSeek 官方接口为纯文本模型，不支持直接传图，请切换为「DeepSeek 官方模型（文本辅助）」并在下方输入标签文字或描述）'
          : '';
      return {
        status: 'ambiguous',
        candidates: [],
        message: `在线识图服务暂不可用，已自动切换为本地手动搜索模式，请直接输入或选择物质名称继续学习。`,
        providerUsed: 'local_text',
        fallbackNotice: `在线识图失败（${errDetail}）${deepseekTip}，已平滑降级到本地搜索。`,
      };
    } finally {
      clearTimeout(timer);
    }
  }
}

export const demoProvider = new DemoProvider();
export const localTextMatcher = new LocalTextMatcher();
