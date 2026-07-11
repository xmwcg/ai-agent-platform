import { Router, Request, Response } from 'express';
import { ModelConfig } from '../models/ModelConfig';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { enforceQuota, quotaIncrement } from '../middleware/subscription';
import { aiModelManager } from '../config/ai-models';
import { reloadCustomProviders } from '../gateway/ai-gateway.service';
import { sendError } from '../lib/http-error';

const router = Router();

/** 配置变更后刷新网关的第三方模型注册表 */
async function syncGateway(): Promise<void> {
  try {
    await reloadCustomProviders();
  } catch {
    /* 非致命：下次启动或手动刷新会重新加载 */
  }
}

/** 列表：当前用户配置的模型 */
router.get('/', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    // 安全：绝不把 apiKey 明文回传前端，改为返回是否已配置 + 尾部掩码
    const list = await ModelConfig.find({ createdBy: req.user!.id }).sort({ pinned: -1, createdAt: -1 }).lean();
    const masked = list.map((c: any) => {
      const key: string = c.apiKey || '';
      const { apiKey, ...rest } = c;
      return {
        ...rest,
        hasApiKey: !!key,
        apiKeyMask: key ? `****${key.slice(-4)}` : '',
      };
    });
    res.json({ success: true, data: masked });
  } catch (err) {
    sendError(res, err);
  }
});

/** 公开：平台启用的模型（供其他模块选择） */
router.get('/available', async (req: Request, res: Response) => {
  try {
    const list = await ModelConfig.find({ enabled: true }).select('-apiKey').lean();
    res.json({ success: true, data: list });
  } catch (err) {
    sendError(res, err);
  }
});

/** 新增模型配置（受 model_config 配额限制） */
router.post('/', requireAuth, enforceQuota('model_config'), async (req: AuthRequest, res: Response) => {
  try {
    const { name, provider, baseURL, apiKey, models, defaultModel, description } = req.body;
    if (!name || !provider || !baseURL || !apiKey || !defaultModel) {
      return res.status(400).json({ success: false, error: '缺少必填字段' });
    }
    const cfg = await ModelConfig.create({
      name,
      provider,
      baseURL,
      apiKey,
      models: models || [defaultModel],
      defaultModel,
      description,
      createdBy: req.user!.id,
      isDefault: false,
    });
    await quotaIncrement(req.user!.id, 'model_config');
    void syncGateway();
    const { apiKey: _omit, ...safe } = cfg.toObject();
    res.json({ success: true, data: safe });
  } catch (err) {
    sendError(res, err);
  }
});

/** 更新 */
router.put('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    // 安全：字段白名单，禁止越权覆盖 createdBy / isDefault 等敏感字段
    const ALLOWED = ['name', 'provider', 'baseURL', 'models', 'defaultModel', 'enabled', 'description', 'pinned'] as const;
    const update: Record<string, unknown> = {};
    for (const k of ALLOWED) {
      if (k in req.body) update[k] = (req.body as Record<string, unknown>)[k];
    }
    // apiKey 只有在传入真实新值（非空、非掩码）时才覆盖，避免前端回填掩码把 key 洗掉
    const nextKey = req.body?.apiKey;
    if (typeof nextKey === 'string' && nextKey.trim() && !nextKey.includes('****')) {
      update.apiKey = nextKey.trim();
    }
    const cfg = await ModelConfig.findOneAndUpdate(
      { _id: req.params.id, createdBy: req.user!.id },
      update,
      { new: true }
    ).select('-apiKey');
    if (!cfg) return res.status(404).json({ success: false, error: '配置不存在' });
    void syncGateway();
    res.json({ success: true, data: cfg });
  } catch (err) {
    sendError(res, err);
  }
});

/** 删除 */
router.delete('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const cfg = await ModelConfig.findOneAndDelete({ _id: req.params.id, createdBy: req.user!.id });
    if (!cfg) return res.status(404).json({ success: false, error: '配置不存在' });
    void syncGateway();
    res.json({ success: true });
  } catch (err) {
    sendError(res, err);
  }
});

/** 设置为默认 */
router.post('/:id/set-default', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    await ModelConfig.updateMany({ createdBy: req.user!.id }, { isDefault: false });
    await ModelConfig.findOneAndUpdate(
      { _id: req.params.id, createdBy: req.user!.id },
      { isDefault: true }
    );
    void syncGateway();
    res.json({ success: true });
  } catch (err) {
    sendError(res, err);
  }
});

/** 测试连接（真实调用厂商 models.list 校验可达性，验证第三方模型接入闭环） */
router.post('/:id/test', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const cfg = await ModelConfig.findOne({ _id: req.params.id, createdBy: req.user!.id });
    if (!cfg) return res.status(404).json({ success: false, error: '配置不存在' });
    // 允许前端在「测试连接」时指定具体模型（复用统一选择器的值）
    const targetModel: string = req.body?.model || cfg.defaultModel;
    if (!cfg.apiKey || !cfg.baseURL) {
      return res.json({ success: true, data: { connected: false, provider: cfg.provider, model: targetModel, error: '缺少 apiKey 或 baseURL' } });
    }
    const client = new (require('openai')).default({ apiKey: cfg.apiKey, baseURL: cfg.baseURL });
    // 指定模型时直接做最小对话校验（最精确，能验证该模型可达）；否则先试 models.list
    if (targetModel && targetModel !== cfg.defaultModel) {
      try {
        await client.chat.completions.create({
          model: targetModel,
          messages: [{ role: 'user', content: 'ping' }],
          max_tokens: 4,
        });
        return res.json({ success: true, data: { connected: true, provider: cfg.provider, model: targetModel } });
      } catch (e2: any) {
        return res.json({ success: true, data: { connected: false, provider: cfg.provider, model: targetModel, error: e2?.message || '连接失败' } });
      }
    }
    try {
      await client.models.list();
      res.json({ success: true, data: { connected: true, provider: cfg.provider, model: targetModel } });
    } catch (e: any) {
      // 部分厂商不支持 models.list，退而尝试一次最小对话校验
      try {
        await client.chat.completions.create({
          model: targetModel,
          messages: [{ role: 'user', content: 'ping' }],
          max_tokens: 4,
        });
        res.json({ success: true, data: { connected: true, provider: cfg.provider, model: targetModel } });
      } catch (e2: any) {
        res.json({ success: true, data: { connected: false, provider: cfg.provider, model: targetModel, error: e2?.message || '连接失败' } });
      }
    }
  } catch (err) {
    sendError(res, err);
  }
});

/** 平台内置 provider 信息（只读参考） */
router.get('/providers/builtin', (req: Request, res: Response) => {
  res.json({ success: true, data: aiModelManager.getEnabledProviders() });
});

export default router;
