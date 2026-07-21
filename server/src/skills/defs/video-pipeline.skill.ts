import { route } from '../../gateway/ai-gateway.service';
import { mediaGenService, ensureAgnesLoaded } from '../../services/media-gen.service';
import type { Skill } from '../types';

/** 视频类 Provider（不具备对话能力，不能用于调研/脚本/视觉提示词阶段） */
const VIDEO_PROVIDER_RE = /agnes|moneyprinterturbo|^mc_/i;

/**
 * 解析「对话阶段」使用的 Provider。
 * 前端「模型」选择器可能把 Agnes / MoneyPrinterTurbo 等视频模型选为默认模型，
 * 这些模型不具备对话能力，必须回退到 deepseek（已验证可用的对话 Provider），
 * 否则调研/脚本阶段会直接失败、整条流水线卡死。
 */
function resolveChatProvider(provider?: string): string {
  if (!provider) return 'deepseek';
  if (VIDEO_PROVIDER_RE.test(provider)) return 'deepseek';
  return provider;
}

/** 视觉提示词兜底：上游偶发空响应时，基于主题构造纯画面英文描述（符合视频模型内容策略）。 */
function buildFallbackVisualPrompt(topic: string, style?: string | number): string {
  const mood = String(style || 'cinematic commercial').trim();
  return `A bright, modern scene visually representing the idea: ${topic}. Smooth camera movement, soft natural light, clean composition, ${mood} style, no on-screen text, no logos, no people speaking.`;
}

interface ChatStageResult {
  content: string;
  provider?: string;
  model?: string;
}

/** 调用 AI 网关完成一个对话阶段；保留真实路由元数据，空响应时自动重试一次。 */
async function callChatStage(
  chatProvider: string | undefined,
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[],
  maxTokens: number,
  temperature: number,
): Promise<ChatStageResult> {
  const attempt = (t: number) =>
    route({ ...(chatProvider ? { provider: chatProvider as any } : {}), messages, maxTokens, temperature: t });
  let response = await attempt(temperature);
  let content = typeof response?.reply === 'string' ? response.reply.trim() : '';
  if (!content) {
    response = await attempt(0.7);
    content = typeof response?.reply === 'string' ? response.reply.trim() : '';
  }
  return {
    content,
    provider: response?.provider || chatProvider,
    model: response?.model,
  };
}

/**
 * 视频生产流水线技能：research → script → compose。
 * 所有阶段必须由真实 Provider 产出；任何关键阶段失败都会返回明确错误，绝不把错误文本包装成成功结果。
 */
export const videoPipelineSkill: Skill = {
  manifest: {
    id: 'video-pipeline',
    name: '视频生产流水线',
    description: '从主题到成片的端到端视频生产：真实调研 → 脚本 → Agnes 视频模型合成（回退 MoneyPrinterTurbo）。',
    division: 'media',
    color: '#f5222d',
    coreMission: '把一句话主题自动化生产为带配音字幕的高清短视频。',
    criticalRules: [
      '调研与脚本阶段必须走统一 AI 网关',
      '生产环境只使用真实 Provider，任何阶段失败必须终止流水线',
      '成片优先使用已配置的 Agnes 视频模型（agnes-video-v2.0），未配置时回退 MoneyPrinterTurbo',
    ],
    successMetrics: ['调研与脚本均来自真实模型', '成片任务可追踪', '阶段失败不返回伪成功'],
    userStory: '作为创作者，我希望从一句话主题自动生产带配音字幕的高清短视频。',
    acceptanceCriteria: [
      '调研和脚本阶段走统一 AI 网关',
      '成片阶段优先使用 Agnes 视频模型，回退 MoneyPrinterTurbo',
      '任一阶段失败返回非成功结果',
    ],
    quotaResource: 'media_gen',
    minRole: 'none',
    requireAuth: false,
    marketable: true,
  },
  async invoke(ctx) {
    const { topic, duration, style, compose = true, provider } = ctx.input || {};
    if (typeof topic !== 'string' || !topic.trim()) {
      return { ok: false, status: 400, code: 'VIDEO_TOPIC_REQUIRED', error: '视频流水线需要非空 topic（主题）' };
    }
    if (typeof compose !== 'boolean') {
      return { ok: false, status: 400, code: 'VIDEO_COMPOSE_INVALID', error: 'compose 必须是布尔值' };
    }

    const cleanTopic = topic.trim();
    // 对话阶段（调研/脚本/视觉提示词）必须用「对话型」Provider。
    // 用户在前端可能把 Agnes / MoneyPrinterTurbo 等视频模型选为「模型」，它们不能做对话，
    // 一旦检测到就回退到 deepseek（已验证可用），否则调研/脚本阶段会直接失败、整条流水线卡死。
    const chatProvider = resolveChatProvider(provider as string | undefined);
    try {
      const research = await callChatStage(chatProvider, [
        {
          role: 'system',
          content: '你是短视频内容调研员。基于用户主题给出目标受众、核心痛点、可信卖点、内容风险和三条可验证的创作依据。不得声称已联网，也不得编造来源。',
        },
        { role: 'user', content: `主题：${cleanTopic}` },
      ], 700, 0.3);
      if (!research.content) throw new Error('调研 Provider 返回空内容');

      const script = await callChatStage(chatProvider, [
        {
          role: 'system',
          content: '你是短视频脚本专家。根据给定调研结果输出完整口播脚本、分镜、字幕和画面提示，不得补写不存在的事实来源。',
        },
        {
          role: 'user',
          content: `主题：${cleanTopic}
目标时长：${duration || 30} 秒
风格：${style || '自然专业'}
调研结果：
${research.content}`,
        },
      ], 1200, 0.5);
      if (!script.content) throw new Error('脚本 Provider 返回空内容');

      // 视觉提示词：把脚本转成「纯画面、无品牌/口号/文案」的镜头化英文描述，专供视频模型。
      // 视频模型有内容策略过滤，直接喂整段带品牌名/slogan 的营销脚本会触发 content_policy_violation。
      let visualPrompt = '';
      if (compose) {
        const visualStage = await callChatStage(chatProvider, [
          {
            role: 'system',
            content:
              'You are a cinematography prompt writer for a text-to-video model. Convert the given script into ONE concise English shot description of the VISUALS only: subjects, actions, setting, lighting, camera movement, mood and style. Rules: describe only what the camera sees; NO brand names, NO logos, NO slogans, NO on-screen text/captions, NO marketing claims, NO people speaking words. Keep it under 60 words. Output the description only, no preamble.',
          },
          {
            role: 'user',
            content: `Topic: ${cleanTopic}\nStyle: ${style || 'cinematic commercial'}\nScript:\n${script.content}`,
          },
        ], 220, 0.4);
        visualPrompt = visualStage.content;
        // 兜底：上游偶发空响应时，基于主题构造纯画面描述，避免整条流水线失败
        if (!visualPrompt) visualPrompt = buildFallbackVisualPrompt(cleanTopic, style);
      }

      let composeResult: any = null;
      if (compose) {
        // 成片优先使用 Agnes 视频模型（agnes-video-v2.0），未配置时回退 MoneyPrinterTurbo
        // 先确保 Agnes 配置已从 DB 加载（容器重启后 cached 会被重置）
        const agnesReady = await ensureAgnesLoaded();
        const videoProvider = agnesReady ? 'agnes' : 'moneyprinterturbo';
        composeResult = await mediaGenService.generate({
          type: 'text2video',
          // Agnes 视频用纯画面视觉提示词；回退 MPT 时用完整脚本（MPT 需要文案生成配音字幕）
          prompt: videoProvider === 'agnes' ? visualPrompt : script.content,
          provider: videoProvider as any,
          ...(duration ? { duration } : {}),
          ...(style ? { style } : {}),
        } as any);
        if (!composeResult?.taskId && composeResult?.status !== 'completed') {
          throw new Error('视频合成服务未返回可追踪任务');
        }
      }

      return {
        ok: true,
        data: {
          stages: {
            research,
            script,
            ...(visualPrompt ? { visualPrompt } : {}),
            compose: composeResult,
          },
          next: compose
            ? `轮询 /api/tools/media/task/${composeResult.provider}/${composeResult.taskId} 获取成片`
            : '已按请求跳过合成阶段',
        },
      };
    } catch (error: any) {
      return {
        ok: false,
        status: error?.statusCode || error?.status || 503,
        code: error?.code || 'VIDEO_PIPELINE_UNAVAILABLE',
        error: error?.message || '视频生产流水线暂时不可用',
      };
    }
  },
};
