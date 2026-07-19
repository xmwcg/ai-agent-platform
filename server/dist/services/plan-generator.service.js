"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.planGeneratorService = void 0;
const ai_models_1 = require("../config/ai-models");
const ai_text_service_1 = require("./ai-text.service");
const TYPE_PROMPTS = {
    business: '商业计划书/商业方案',
    marketing: '营销推广方案',
    technical: '技术方案/实施方案',
    education: '教育培训方案',
    general: '综合方案',
};
const LENGTH_GUIDE = {
    brief: '简洁版（约 800 字，包含核心要点）',
    detailed: '标准版（约 2000 字，包含分章节详细内容）',
    comprehensive: '完整版（约 4000 字，包含背景、目标、策略、执行步骤、预算、风险与评估）',
};
/** 方案生成服务 - 办公自动化核心能力（借鉴 GPT Researcher 思路） */
class PlanGeneratorService {
    async generate(params) {
        const { topic, type = 'general', audience, length = 'detailed', requirements } = params;
        if (!topic?.trim())
            throw new Error('方案主题不能为空');
        const p = ai_models_1.aiModelManager.getDefaultProvider()?.name.toLowerCase() || 'openai';
        const m = ai_models_1.aiModelManager.getProvider(p)?.defaultModel || 'gpt-4o';
        const sysPrompt = `你是一名资深方案策划专家。请为用户生成一份专业的${TYPE_PROMPTS[type] || '综合'}方案。
要求：
- 格式：Markdown
- 篇幅：${LENGTH_GUIDE[length]}
- 结构清晰，包含可执行的步骤与量化指标
- 语言专业、务实${audience ? `\n- 目标受众：${audience}` : ''}${requirements ? `\n- 额外要求：${requirements}` : ''}`;
        // 统一真实生成：第三方模型优先，未配置时回退 CloudBase 免费云函数，绝不返回 Mock 假数据
        const { text: content, provider: usedProvider, model: usedModel } = await (0, ai_text_service_1.generateText)({
            system: sysPrompt,
            user: `请生成关于「${topic}」的方案`,
            provider: p,
            model: m,
            temperature: 0.7,
            maxTokens: length === 'comprehensive' ? 4000 : 2000,
        });
        return {
            topic,
            type: TYPE_PROMPTS[type] || type,
            content,
            outline: this.extractOutline(content),
            provider: usedProvider,
            model: usedModel,
        };
    }
    extractOutline(md) {
        const lines = md.split('\n').filter((l) => /^#{1,3}\s/.test(l.trim()));
        return lines.slice(0, 10).map((l) => l.replace(/^#{1,3}\s/, '').trim());
    }
}
exports.planGeneratorService = new PlanGeneratorService();
//# sourceMappingURL=plan-generator.service.js.map