"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.codeExplainSkill = void 0;
const ai_text_service_1 = require("../../services/ai-text.service");
const LEVEL_PROMPTS = {
    brief: '用 2-3 句话说明代码用途、输入和输出。',
    detailed: '详细说明代码用途、关键流程、复杂度、潜在缺陷和改进建议。',
    teaching: '面向初学者逐步讲解，并列出关键概念和一个练习建议。',
};
/** 代码解释技能：直接调用真实文本生成服务，不返回入口提示或回显输入。 */
exports.codeExplainSkill = {
    manifest: {
        id: 'code-explain',
        name: '代码解释',
        description: '支持多种编程语言和三档粒度的真实 AI 代码解释。',
        division: 'engineering',
        color: '#fa8c16',
        coreMission: '把任意代码段准确翻译成人话，并指出风险与改进方向。',
        criticalRules: ['代码与语言必填', '调用真实 AI Provider', '不得把输入回显冒充解释结果'],
        successMetrics: ['解释结果非空', 'Provider 与模型可追踪'],
        userStory: '作为开发者，我希望把任意代码段翻译成人话并获得改进建议。',
        acceptanceCriteria: ['指定语言与粒度', '输出真实模型生成的解释和 Provider 信息'],
        quotaResource: 'code_explain',
        minRole: 'none',
        requireAuth: false,
        marketable: true,
    },
    async invoke(ctx) {
        const { code, language, level = 'detailed', context, provider, model } = ctx.input || {};
        if (typeof code !== 'string' || !code.trim() || typeof language !== 'string' || !language.trim()) {
            return { ok: false, status: 400, code: 'CODE_EXPLAIN_INPUT_INVALID', error: '代码解释需要非空 code 与 language' };
        }
        if (!LEVEL_PROMPTS[level]) {
            return { ok: false, status: 400, code: 'CODE_EXPLAIN_LEVEL_INVALID', error: 'level 仅支持 brief/detailed/teaching' };
        }
        try {
            const result = await (0, ai_text_service_1.generateText)({
                system: '你是严谨的高级软件工程师。只基于用户提供的代码作答，不虚构运行结果。',
                user: `语言：${language}
要求：${LEVEL_PROMPTS[level]}${context ? `
上下文：${context}` : ''}

代码：
\`\`\`${language}
${code.trim()}
\`\`\``,
                provider: typeof provider === 'string' ? provider : undefined,
                model: typeof model === 'string' ? model.trim() || undefined : undefined,
                temperature: 0.3,
                maxTokens: 2000,
            });
            if (!result.text?.trim())
                throw new Error('代码解释 Provider 返回空内容');
            return { ok: true, data: { explanation: result.text, language, level, provider: result.provider, model: result.model } };
        }
        catch (error) {
            return {
                ok: false,
                status: error?.statusCode || error?.status || 503,
                code: error?.code || 'CODE_EXPLAIN_PROVIDER_UNAVAILABLE',
                error: error?.message || '代码解释 Provider 暂时不可用',
            };
        }
    },
};
//# sourceMappingURL=code-explain.skill.js.map