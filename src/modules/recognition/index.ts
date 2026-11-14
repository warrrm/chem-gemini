import { DEMO_SAMPLES } from '../../data/samples';
import { RecognitionProvider, RecognitionResult } from '../../types/chemistry';
import { searchSubstancesByName } from '../knowledge';

/**
 * P0 默认演示模式识别器：
 * - 仅对内置样例返回预设结果
 * - 用户上传的任意图片不做内容分析，严格返回提示让用户手动选择或搜索
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
        };
      }

      if (sample.recognitionStatus === 'out_of_scope') {
        return {
          status: 'out_of_scope',
          candidates: [],
          message: sample.statusMessage ?? '暂不在当前学习范围内',
        };
      }

      if (sample.recognitionStatus === 'ambiguous') {
        return {
          status: 'ambiguous',
          candidates: [],
          message: sample.statusMessage ?? '仅凭图片无法确定，请补充标签或名称',
        };
      }

      return {
        status: 'ok',
        candidates: sample.candidates.map((c) => ({ substanceId: c.substanceId })),
        objects: sample.hotspots,
        message: sample.statusMessage,
      };
    }

    if (input.text && input.text.trim()) {
      const matcher = new LocalTextMatcher();
      return matcher.recognize({ text: input.text });
    }

    // 用户自行上传或拍摄的任意图片：演示模式绝不假装识别成功
    return {
      status: 'unreadable',
      candidates: [],
      message: '演示模式不会分析你的图片，请从下方选择或搜索要学习的物质',
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
      };
    }

    const outcome = searchSubstancesByName(query);
    if (outcome.type === 'out_of_scope') {
      return {
        status: 'out_of_scope',
        candidates: [],
        outOfScopeName: outcome.outOfScope?.name,
        message: `暂不在当前学习范围内${outcome.outOfScope ? `：${outcome.outOfScope.reason}` : ''}`,
      };
    }

    if (outcome.type === 'matched' && outcome.substances.length > 0) {
      return {
        status: 'ok',
        candidates: outcome.substances.map((s) => ({ substanceId: s.id })),
      };
    }

    return {
      status: 'ambiguous',
      candidates: [],
      message: `未在当前初中化学知识库中找到“${query}”，请尝试输入常见标准名称或俗称。`,
    };
  }
}

export const demoProvider = new DemoProvider();
export const localTextMatcher = new LocalTextMatcher();
