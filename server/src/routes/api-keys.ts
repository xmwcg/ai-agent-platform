/**
 * NexMind 开放 API Key 自服务路由
 * 用户可以自行创建、查看、吊销自己的 API Key
 */

import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { AuthRequest } from '../middleware/auth';
import { ApiKey, IApiKey } from '../models/ApiKey';
import { generateApiKey, hashKey } from '../services/apikey.service';
import { logger } from '../lib/logger';

const router = Router();

// 列出当前用户的所有 API Key
router.get('/', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const keys = await ApiKey.find({ ownerId: req.user!.id, status: 'active' })
      .select('-keyHash')
      .sort({ createdAt: -1 });
    res.json({ success: true, data: keys.map((k) => ({
      id: k._id,
      name: k.name,
      prefix: k.prefix,
      scopes: k.scopes,
      quotaDaily: k.quotaDaily,
      usedToday: k.usedToday,
      creditsEnabled: k.creditsEnabled,
      createdAt: k.createdAt,
      status: k.status,
    })) });
  } catch (e: any) {
    logger.error('api-keys', 'list keys failed', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

// 创建新的 API Key（仅在创建时返回一次明文！）
router.post('/', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { name, scopes, quotaDaily } = req.body || {};
    if (!name) {
      return res.status(400).json({ success: false, error: '请提供 key 名称' });
    }

    // 限制每个用户最多 10 个 active key
    const activeCount = await ApiKey.countDocuments({ ownerId: req.user!.id, status: 'active' });
    if (activeCount >= 10) {
      return res.status(400).json({ success: false, error: '每个用户最多 10 个 API Key，请先吊销不用的 key' });
    }

    const { plain, prefix, hash } = generateApiKey();
    const key = new ApiKey({
      ownerId: req.user!.id,
      name: name.trim().slice(0, 50),
      keyHash: hash,
      prefix: prefix,
      status: 'active',
      quotaDaily: Math.min(Math.max(1, quotaDaily || 1000), 100000),
      scopes: scopes || ['chat'],
      creditsEnabled: false,
    });
    await key.save();

    res.status(201).json({
      success: true,
      data: {
        id: key._id,
        name: key.name,
        prefix: key.prefix,
        apiKey: plain, // 仅此一次！
        scopes: key.scopes,
        quotaDaily: key.quotaDaily,
        createdAt: key.createdAt,
      },
      warning: '请立即复制保存 API Key，此后再也无法查看明文',
    });
  } catch (e: any) {
    logger.error('api-keys', 'create key failed', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

// 吊销 API Key
router.delete('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const key = await ApiKey.findOne({ _id: req.params.id, ownerId: req.user!.id });
    if (!key) {
      return res.status(404).json({ success: false, error: 'Key 不存在或无权操作' });
    }
    key.status = 'revoked';
    await key.save();
    res.json({ success: true, message: 'API Key 已吊销' });
  } catch (e: any) {
    logger.error('api-keys', 'revoke key failed', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

export default router;
