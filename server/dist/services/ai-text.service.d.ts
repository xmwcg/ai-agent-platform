import { type AIProvider } from '../config/ai-models';
export interface GenerateTextOptions {
    system?: string;
    user: string;
    provider?: AIProvider;
    model?: string;
    temperature?: number;
    maxTokens?: number;
}
/**
 * 统一的真实文本生成入口：
 * 1) 优先使用平台已配置的第三方模型 Provider（用户自带 Key 或平台 Key）；
 * 2) 若未配置或调用失败，自动回退到 CloudBase 免费云函数（hy3-preview），
 *    保证始终产出真实内容、绝不返回模拟/假数据。
 */
export declare function generateText(opts: GenerateTextOptions): Promise<{
    text: string;
    provider: string;
    model: string;
}>;
//# sourceMappingURL=ai-text.service.d.ts.map