"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.translateSkill = void 0;
const translation_service_1 = require("../../services/translation.service");
/** 多语种翻译技能：调用真实翻译服务，生产环境不返回模拟内容。 */
exports.translateSkill = {
    manifest: {
        id: 'translate',
        name: '智能翻译',
        description: '多语种互译，支持源语言识别、目标语言和真实 AI Provider。',
        division: 'productivity',
        color: '#52c41a',
        coreMission: '在任意语种间准确传递语义。',
        criticalRules: ['目标语种必填', '调用真实翻译服务', 'Provider 失败时明确失败'],
        successMetrics: ['翻译结果非空', 'Provider 与模型可追踪'],
        userStory: '作为用户，我希望在任意语种间准确传递语义，并保留专有名词。',
        acceptanceCriteria: ['目标语种必填', '返回真实 Provider 生成的翻译结果'],
        quotaResource: 'translate',
        minRole: 'none',
        requireAuth: false,
        marketable: true,
    },
    async invoke(ctx) {
        const { text, targetLang, sourceLang = 'auto', provider, model } = ctx.input || {};
        if (typeof text !== 'string' || !text.trim() || typeof targetLang !== 'string' || !targetLang.trim()) {
            return { ok: false, status: 400, code: 'TRANSLATE_INPUT_INVALID', error: '翻译需要非空 text 与 targetLang' };
        }
        try {
            const result = await translation_service_1.translationService.translate(text.trim(), targetLang.trim(), typeof sourceLang === 'string' ? sourceLang.trim() || 'auto' : 'auto', typeof provider === 'string' ? provider : undefined, typeof model === 'string' ? model.trim() || undefined : undefined);
            return { ok: true, data: result };
        }
        catch (error) {
            return {
                ok: false,
                status: error?.statusCode || error?.status || 503,
                code: error?.code || 'TRANSLATION_PROVIDER_UNAVAILABLE',
                error: error?.message || '翻译 Provider 暂时不可用',
            };
        }
    },
};
//# sourceMappingURL=translate.skill.js.map