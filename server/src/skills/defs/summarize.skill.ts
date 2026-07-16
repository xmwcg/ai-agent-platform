import type { Skill } from '../types';
import { route } from '../../gateway/ai-gateway.service';

/**
 * 智能摘要技能（agency-agents: productivity division）
 * 把长文本/文档提炼为结构化要点摘要，复用统一 AI 网关（route）。
 * 支持指定摘要长度（brief/detailed）与输出语种；生产环境无真实 Provider 时明确失败。
 */
export const summarizeSkill: Skill = {
  manifest: {
    id: 'summarize',
    name: '智能摘要',
    description: '把长文本/文档提炼为结构化要点摘要，支持长度与语种控制，复用统一 AI 网关。',
    division: 'productivity',
    color: '#13c2c2',
    coreMission: '把冗长内容压缩为可快速消费的结构化要点。',
    criticalRules: [
      '必须走统一 AI 网关（route），不直接调用厂商 SDK',
      '输出结构：summary（一段概述）+ bullets（要点数组）',
      '无可用真实 provider 时明确失败并提示配置真实厂商',
    ],
    successMetrics: ['摘要覆盖率', '要点可读性'],
    quotaResource: 'ai_chat',
    minRole: 'none',
    requireAuth: false,
    marketable: true,
    userStory: '作为用户，我希望把长文快速提炼为要点，从而节省阅读时间。',
    acceptanceCriteria: ['输入 text 后返回 summary 与 bullets', '支持 length 与 lang 参数', '生产环境不返回 Mock 摘要'],
    qualityCriteria: ['摘要不歪曲原意', '要点不冗余'],
    references: ['agency-agents skill protocol', 'ai-gateway route()'],
  },
  async invoke(ctx) {
    const { text, length = 'brief', lang = 'zh' } = ctx.input || {};
    if (!text || typeof text !== 'string') {
      return { ok: false, error: 'summarize 需要 text（待摘要文本）' };
    }

    let summary = '';
    let bullets: string[] = [];
    try {
      const r = await route({
        messages: [
          {
            role: 'system',
            content:
              '你是文本摘要专家。严格只输出 JSON：{ "summary": "一段概述", "bullets": ["要点1","要点2",...] }。不要多余解释。',
          },
          {
            role: 'user',
            content: `请把以下内容摘要为${length === 'detailed' ? '详细' : '简明'}要点，输出语种：${lang}。\n\n${text.slice(0, 4000)}`,
          },
        ],
        maxTokens: 800,
        temperature: 0.2,
      });
      const raw = r.reply;
      const start = raw.indexOf('{');
      const end = raw.lastIndexOf('}');
      const parsed = start >= 0 && end > start ? JSON.parse(raw.slice(start, end + 1)) : null;
      summary = parsed?.summary || raw;
      bullets = Array.isArray(parsed?.bullets) ? parsed.bullets : [];
    } catch (e: any) {
      return { ok: false, error: `摘要生成失败：${e.message}（请确认已配置真实厂商 Key）` };
    }

    return { ok: true, data: { summary, bullets, length, lang } };
  },
};
