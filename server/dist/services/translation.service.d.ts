import { type AIProvider } from '../config/ai-models';
export interface TranslateResult {
    sourceText: string;
    translatedText: string;
    sourceLang: string;
    targetLang: string;
    provider: string;
    model: string;
}
/** 翻译服务 */
declare class TranslationService {
    translate(text: string, targetLang: string, sourceLang?: string, provider?: AIProvider, model?: string): Promise<TranslateResult>;
    getSupportedLanguages(): {
        code: string;
        name: string;
    }[];
}
export declare const translationService: TranslationService;
export {};
//# sourceMappingURL=translation.service.d.ts.map