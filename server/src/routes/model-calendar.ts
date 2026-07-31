import { Router, Request, Response } from 'express';
import { ModelEvent, ModelEventType } from '../models/ModelEvent';
import { AuthRequest, requireAuth } from '../middleware/auth';
import { sendError } from '../lib/http-error';

const router = Router();

/** 种子数据：主流厂商模型发布/更新动态（首次访问时幂等写入） */
type SeedModelEvent = {
  modelName: string;
  vendor: string;
  releaseDate: string;
  type: ModelEventType;
  description?: string;
  highlights: string[];
  source: 'seed';
};

export const SEED_MODEL_EVENTS: SeedModelEvent[] = [
  {
    modelName: 'GPT-4o',
    vendor: 'OpenAI',
    releaseDate: '2024-05-13',
    type: 'release',
    description: 'OpenAI 发布 GPT-4o，支持文本、图像、音频多模态理解。',
    highlights: ['多模态输入', '128K 上下文', '更快的推理速度'],
    source: 'seed',
  },
  {
    modelName: 'Claude 3.5 Sonnet',
    vendor: 'Anthropic',
    releaseDate: '2024-06-20',
    type: 'release',
    description: 'Anthropic 发布 Claude 3.5 Sonnet，推理能力大幅提升。',
    highlights: ['Sonnet 级别价格', 'Opus 级别性能', '200K 上下文'],
    source: 'seed',
  },
  {
    modelName: 'DeepSeek V3',
    vendor: 'DeepSeek',
    releaseDate: '2024-12-26',
    type: 'release',
    description: 'DeepSeek 发布 V3 模型，671B MoE 架构，性价比极高。',
    highlights: ['671B MoE', '128K 上下文', '价格仅为 GPT-4o 的 1/50'],
    source: 'seed',
  },
  {
    modelName: '混元 Pro',
    vendor: '腾讯',
    releaseDate: '2024-09-01',
    type: 'update',
    description: '混元 Pro 更新，中文理解能力大幅提升。',
    highlights: ['中文优化', '多模态支持', 'API 稳定性提升'],
    source: 'seed',
  },
  {
    modelName: 'Qwen2.5-Max',
    vendor: '阿里云',
    releaseDate: '2024-09-19',
    type: 'release',
    description: '阿里云发布 Qwen2.5-Max，中文能力全面升级。',
    highlights: ['7B~72B 全系列', '中文基准测试第一', '工具调用优化'],
    source: 'seed',
  },
  {
    modelName: 'GPT-4.1',
    vendor: 'OpenAI',
    releaseDate: '2025-01-15',
    type: 'release',
    description: 'OpenAI 发布 GPT-4.1，进一步扩展上下文长度。',
    highlights: ['2M+ 上下文', '更强推理能力', '工具调用增强'],
    source: 'seed',
  },
  {
    modelName: 'DeepSeek R1',
    vendor: 'DeepSeek',
    releaseDate: '2025-01-20',
    type: 'release',
    description: 'DeepSeek R1 正式发布，开源推理模型新标杆。',
    highlights: ['强化学习训练', '数学推理 SOTA', '完全开源'],
    source: 'seed',
  },
];

/** 幂等写入种子数据（仅当集合为空时） */
async function ensureSeed(): Promise<void> {
  const count = await ModelEvent.estimatedDocumentCount();
  if (count === 0) {
    await ModelEvent.insertMany(SEED_MODEL_EVENTS);
  }
}

// 列表（公开）；支持 vendor / type / from / to 过滤
router.get('/', async (req: Request, res: Response) => {
  try {
    await ensureSeed();
    const { vendor, type, from, to } = req.query;
    const filter: Record<string, any> = {};
    if (vendor) filter.vendor = String(vendor);
    if (type) filter.type = String(type);
    if (from || to) {
      filter.releaseDate = {};
      if (from) filter.releaseDate.$gte = String(from);
      if (to) filter.releaseDate.$lte = String(to);
    }
    const events = await ModelEvent.find(filter).sort({ releaseDate: 1 }).lean();
    const vendors = await ModelEvent.distinct('vendor');
    res.json({ success: true, data: events, vendors });
  } catch (err) {
    sendError(res, err);
  }
});

// 详情
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const e = await ModelEvent.findById(req.params.id).lean();
    if (!e) return res.status(404).json({ success: false, error: '事件不存在' });
    res.json({ success: true, data: e });
  } catch (err) {
    sendError(res, err);
  }
});

// 用户提交关注的模型动态（需登录）
router.post('/', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { modelName, vendor, releaseDate, type, description, highlights } = req.body;
    if (!modelName || !vendor || !releaseDate) {
      return res.status(400).json({
        success: false,
        error: 'modelName、vendor、releaseDate 为必填项',
      });
    }
    const eventType: ModelEventType = (type as ModelEventType) || 'release';
    const created = await ModelEvent.create({
      modelName,
      vendor,
      releaseDate,
      type: eventType,
      description,
      highlights: Array.isArray(highlights) ? highlights : [],
      source: 'user',
      createdBy: req.user!.id,
    });
    res.json({ success: true, data: created });
  } catch (err) {
    sendError(res, err);
  }
});

export default router;
