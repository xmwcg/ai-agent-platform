import { aiModelManager, type AIProvider } from '../config/ai-models';
import { generateText } from './ai-text.service';

export interface TranslateResult {
  sourceText: string;
  translatedText: string;
  sourceLang: string;
  targetLang: string;
  provider: string;
  model: string;
}

const LANG_MAP: Record<string, string> = {
  auto: '自动检测',
  zh: '中文',
  en: '英语',
  ja: '日语',
  ko: '韩语',
  fr: '法语',
  de: '德语',
  es: '西班牙语',
  ru: '俄语',
};

/** 翻译服务 */
class TranslationService {
  async translate(
    text: string,
    targetLang: string,
    sourceLang = 'auto',
    provider?: AIProvider,
    model?: string
  ): Promise<TranslateResult> {
    if (!text?.trim()) throw new Error('翻译文本不能为空');

    const p = provider || (aiModelManager.getDefaultProvider()?.name.toLowerCase() as AIProvider | undefined) || 'openai';
    const m = model || aiModelManager.getProvider(p as AIProvider)?.defaultModel || 'gpt-4o';

    const sysPrompt = `你是一个专业翻译引擎。请将用户提供的文本翻译为${LANG_MAP[targetLang] || targetLang}。${
      sourceLang !== 'auto' ? `源语言为${LANG_MAP[sourceLang] || sourceLang}。` : '请自动检测源语言。'
    }只返回翻译结果，不要添加任何解释或引号。`;

    // 统一真实生成：第三方模型优先，未配置时回退 CloudBase 免费云函数，绝不返回 Mock 假数据
    const { text: translatedText, provider: usedProvider, model: usedModel } = await generateText({
      system: sysPrompt,
      user: text,
      provider: p as AIProvider,
      model: m,
      temperature: 0.3,
    });

    return {
      sourceText: text,
      translatedText,
      sourceLang: LANG_MAP[sourceLang] || sourceLang,
      targetLang: LANG_MAP[targetLang] || targetLang,
      provider: usedProvider,
      model: usedModel,
    };
  }

  getSupportedLanguages() {
    return Object.entries(LANG_MAP).map(([code, name]) => ({ code, name }));
  }
}

export const translationService = new TranslationService();
