import type { Skill } from '../types';
import { mediaGenService } from '../../services/media-gen.service';

/**
 * 媒体生成技能（agency-agents: media division）
 * 文生图 / 图生图 / 文生视频 / 图生视频，多厂商抽象 + 异步轮询。
 * 生产环境只使用已配置的真实厂商；Mock 仅供开发和测试显式启用。
 */
export const mediaSkill: Skill = {
  manifest: {
    id: 'media-gen',
    name: '媒体生成',
    description: '文生图 / 图生视频 / 文生视频，多真实厂商抽象与异步任务轮询。',
    division: 'media',
    color: '#eb2f96',
    coreMission: '把一句话变成可交付的视觉素材，屏蔽厂商 API 差异与异步复杂度。',
    criticalRules: [
      '生产环境只允许已配置的真实媒体厂商',
      '视频/图像生成是异步的，统一返回 taskId 供轮询',
      '混元提交/查询均走 TC3 签名',
    ],
    successMetrics: ['真实厂商任务可通过 taskId 取到结果', '厂商不可用时明确失败且不伪造任务'],
    userStory: '作为创作者，我希望用一句话生成视觉素材，而不必关心厂商差异与异步轮询。',
    acceptanceCriteria: [
      '生产环境禁止 Mock Provider',
      '异步任务统一返回 taskId 供轮询',
      '混元提交/查询走 TC3 签名',
    ],
    quotaResource: 'media_gen',
    minRole: 'none',
    requireAuth: false,
    marketable: true,
  },
  async invoke(ctx) {
    const { type, prompt, imageBase64, provider, duration, style } = ctx.input || {};
    if (typeof type !== 'string' || typeof prompt !== 'string' || !prompt.trim()) {
      return { ok: false, status: 400, code: 'MEDIA_INPUT_INVALID', error: '媒体生成需要 type 与非空 prompt' };
    }
    try {
      const result = await mediaGenService.generate({
        type,
        prompt: prompt.trim(),
        ...(imageBase64 ? { imageBase64 } : {}),
        ...(provider ? { provider } : {}),
        ...(duration ? { duration } : {}),
        ...(style ? { style } : {}),
      } as any);
      return { ok: true, data: result };
    } catch (error: any) {
      return {
        ok: false,
        status: error?.statusCode || error?.status || 503,
        code: error?.code || 'MEDIA_PROVIDER_UNAVAILABLE',
        error: error?.message || '媒体生成 Provider 暂时不可用',
      };
    }
  },
};
