import type { Skill } from '../types';
import { route } from '../../gateway/ai-gateway.service';

/**
 * 视频生产流水线技能（借鉴 Open-Montage 的 agent-first pipeline 范式）
 * 阶段：research → script → assets(generate) → compose
 * 与本项目衔接点：
 *   - script 阶段走统一 AI 网关（route，可命中 DeepSeek/混元等）；
 *   - assets/generate 阶段复用 media-gen 服务（混元/可灵/即梦/Mock）；
 *   - compose 阶段调用 MoneyPrinterTurbo（外部视频工厂：文案→素材→配音→字幕→成片）。
 * 说明：OpenMontage 本身无 API，此处取其「pipeline 编排」理念落地为可调用技能。
 */
export const videoPipelineSkill: Skill = {
  manifest: {
    id: 'video-pipeline',
    name: '视频生产流水线',
    description:
      '从主题到成片的端到端视频生产：调研 → 脚本 → 素材生成 → 合成。串联 AI 网关与 MoneyPrinterTurbo 视频工厂。',
    division: 'media',
    color: '#f5222d',
    coreMission: '把一句话主题，自动化生产为带配音字幕的高清短视频。',
    criticalRules: [
      '脚本阶段必须走统一 AI 网关（route），不直接调用厂商 SDK',
      '合成阶段优先 MoneyPrinterTurbo（外部视频工厂），补齐成片能力',
      '每个阶段产物可被单独查看（便于人工 checkpoint）',
    ],
    successMetrics: ['脚本质量', '成片可播放', '阶段可追溯'],
    userStory: '作为创作者，我希望从一句话主题自动生产带配音字幕的高清短视频。',
    acceptanceCriteria: [
      '脚本阶段走统一 AI 网关',
      '合成阶段优先 MoneyPrinterTurbo',
      '各阶段产物可单独查看（checkpoint）',
    ],
    quotaResource: 'media_gen',
    minRole: 'none',
    requireAuth: false,
    marketable: true,
  },
  async invoke(ctx) {
    const { topic, duration, style, compose = true } = ctx.input || {};
    if (!topic) return { ok: false, error: '视频流水线需要 topic（主题）' };

    // 阶段1：research（占位：真实环境可接联网/RAG）
    const research = `围绕「${topic}」的受众画像与核心卖点调研（占位，可接 RAG/联网）。`;

    // 阶段2：script（走统一 AI 网关）
    let script = '';
    try {
      const r = await route({
        messages: [
          { role: 'system', content: '你是短视频脚本专家，输出 30 秒短视频口播脚本，含画面提示。' },
          { role: 'user', content: `主题：${topic}${duration ? `，时长约 ${duration} 秒` : ''}` },
        ],
        maxTokens: 600,
      });
      script = r.reply;
    } catch (e: any) {
      script = `[脚本生成失败：${e.message}]`;
    }

    // 阶段3：assets/generate（复用媒体生成，文生视频预览帧）
    // 阶段4：compose（MoneyPrinterTurbo 整片）
    let composeResult: any = null;
    if (compose) {
      try {
        const { mediaGenService } = await import('../../services/media-gen.service');
        const gen = await mediaGenService.generate({
          type: 'text2video',
          prompt: topic,
          provider: 'moneyprinterturbo',
          ...(duration ? { duration } : {}),
          ...(style ? { style } : {}),
        } as any);
        composeResult = gen;
      } catch (e: any) {
        composeResult = { error: e.message };
      }
    }

    return {
      ok: true,
      data: {
        stages: {
          research,
          script,
          compose: composeResult,
        },
        next: composeResult?.taskId
          ? `轮询 /api/tools/media/task/moneyprinterturbo/${composeResult.taskId} 获取成片`
          : '未触发合成',
      },
    };
  },
};
