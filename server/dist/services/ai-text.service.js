"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateText = generateText;
const ai_models_1 = require("../config/ai-models");
const cloudbase_ai_service_1 = require("./cloudbase-ai.service");
const logger_1 = require("../lib/logger");
/**
 * 统一的真实文本生成入口：
 * 1) 优先使用平台已配置的第三方模型 Provider（用户自带 Key 或平台 Key）；
 * 2) 若未配置或调用失败，自动回退到 CloudBase 免费云函数（hy3-preview），
 *    保证始终产出真实内容、绝不返回模拟/假数据。
 */
async function generateText(opts) {
    const { system, user, temperature = 0.7, maxTokens } = opts;
    const messages = [];
    if (system)
        messages.push({ role: 'system', content: system });
    messages.push({ role: 'user', content: user });
    const provider = opts.provider || ai_models_1.aiModelManager.getDefaultProvider()?.name.toLowerCase();
    if (provider && provider !== 'mock') {
        try {
            const cfg = ai_models_1.aiModelManager.getProvider(provider);
            if (cfg && cfg.apiKey && cfg.apiKey !== 'mock-key') {
                const client = (0, ai_models_1.createAIClient)(provider);
                const completion = await client.chat.completions.create({
                    model: opts.model || cfg.defaultModel,
                    messages,
                    temperature,
                    ...(maxTokens ? { max_tokens: maxTokens } : {}),
                });
                const text = completion.choices[0]?.message?.content?.trim() || '';
                if (text)
                    return { text, provider, model: opts.model || cfg.defaultModel };
            }
        }
        catch (err) {
            logger_1.logger.warn('ai-text', `provider ${provider} 调用失败，回退免费云函数: ${err?.message}`);
        }
    }
    // 回退到 CloudBase 免费云函数（消耗小程序成长计划免费额度）
    const text = await (0, cloudbase_ai_service_1.callCloudbaseChat)(messages, 'hy3-preview');
    return { text, provider: 'cloudbase-free', model: 'hy3-preview' };
}
//# sourceMappingURL=ai-text.service.js.map