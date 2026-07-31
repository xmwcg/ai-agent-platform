/**
 * NexMind Flow — Platform 集成路由
 * 接入 JWT 认证 + 套餐配额 + 付费体系
 */

import { Router, Request, Response } from 'express';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { requirePlan } from '../middleware/subscription';
import { enforceQuota } from '../middleware/subscription';
import { runFlowSync, getUserFlowQuota } from '../services/flow-sync.service';
import { logger } from '../lib/logger';
import { sendError } from '../lib/http-error';
import path from 'path';
import fs from 'fs';
import { User } from '../models/User';

const router = Router();

// 查找可用源目录（用户的 AI 产物、知识库临时目录等）
function findAvailableSources(userId: string): string[] {
  const sources: string[] = [];
  // 知识库导出目录
  const kbExport = path.resolve(process.cwd(), '..', 'uploads', `kb-export-${userId}`);
  if (fs.existsSync(kbExport)) sources.push(fs.realpathSync(kbExport));
  // AI 对话导出
  const chatExport = path.resolve(process.cwd(), '..', 'uploads', `chat-export-${userId}`);
  if (fs.existsSync(chatExport)) sources.push(fs.realpathSync(chatExport));
  return sources;
}

export function isPathWithinRoot(candidate: string, root: string): boolean {
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

/**
 * 只允许同步当前用户由平台生成的导出目录及其子路径。
 * realpath 可阻止通过 .. 或目录联接/符号链接逃逸到任意服务器目录。
 */
export function resolveUserFlowSources(userId: string, requested?: unknown): string[] {
  const allowedRoots = findAvailableSources(userId);
  if (requested === undefined || requested === null || (Array.isArray(requested) && requested.length === 0)) {
    return allowedRoots;
  }
  if (!Array.isArray(requested) || requested.some((item) => typeof item !== 'string')) {
    throw new Error('sources 必须是路径字符串数组');
  }

  return requested.map((item) => {
    const resolved = path.resolve(item);
    if (!fs.existsSync(resolved)) {
      throw new Error('同步来源不存在或不可访问');
    }
    const real = fs.realpathSync(resolved);
    if (!allowedRoots.some((root) => isPathWithinRoot(real, root))) {
      throw new Error('同步来源超出当前用户允许目录');
    }
    return real;
  });
}

// ─── 查询用户 Flow 状态（公开）───
router.get('/status', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const quota = await getUserFlowQuota(req.user!.id);
    const sources = findAvailableSources(req.user!.id);
    const user = await User.findById(req.user!.id).select('flowSyncCount flowSyncDate').lean();
    const today = new Date().toDateString();
    const usedToday = user && (user as any).flowSyncDate === today
      ? Number((user as any).flowSyncCount || 0)
      : 0;
    res.json({
      success: true,
      data: {
        plan: quota.plan,
        canAutoSync: quota.canAutoSync,
        canMultiVault: quota.canMultiVault,
        dailyLimit: quota.dailyLimit,
        usedToday,
        remainingToday: Math.max(0, quota.dailyLimit - usedToday),
        availableSources: sources.length,
      },
    });
  } catch (e: any) {
    sendError(res, e);
  }
});

// ─── 手动触发同步（需登录）───
router.post('/sync', requireAuth, enforceQuota('flow_sync'), async (req: AuthRequest, res: Response) => {
  try {
    const { sources, project, title, summary, tags } = req.body || {};

    // 来源只能是平台为当前用户生成的导出目录，禁止读取任意服务器路径。
    const syncSources = resolveUserFlowSources(req.user!.id, sources);

    if (syncSources.length === 0) {
      return res.status(400).json({
        success: false,
        error: '没有可同步的内容。请先在 AI 对话或知识库中产生内容。',
      });
    }

    const result = await runFlowSync({
      userId: req.user!.id,
      sources: syncSources,
      project: project || '内容归档',
      title: title || 'NexMind Flow 自动同步',
      summary: summary || `由 ${req.user!.id} 触发的内容同步`,
      tags: tags || ['AI', '自动同步'],
    });

    if (result.quotaExceeded) {
      return res.status(402).json({ success: false, error: result.error, quotaExceeded: true });
    }

    if (!result.success) {
      return res.status(500).json({ success: false, error: result.error });
    }

    res.json({
      success: true,
      data: {
        status: result.status,
        category: result.category,
        copied: result.copied || 0,
        updated: result.updated || 0,
        index: result.index,
      },
    });
  } catch (e: any) {
    sendError(res, e);
  }
});

// ─── 预览同步（干运行）───
router.post('/preview', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { sources, project, title, summary, tags } = req.body || {};
    const syncSources = resolveUserFlowSources(req.user!.id, sources);

    if (syncSources.length === 0) {
      return res.json({ success: true, data: { category: null, files: 0, message: '没有可预览的内容' } });
    }

    // 干运行：只检查不实际同步
    const result = await runFlowSync({
      userId: req.user!.id,
      sources: syncSources,
      project: project || '预览',
      title: title || '预览同步',
      summary: summary || '',
      tags: tags || [],
      dryRun: true,
    });

    res.json({
      success: true,
      data: {
        category: result.category,
        files: result.copied || 0,
        status: result.status,
        project: result.project,
      },
    });
  } catch (e: any) {
    sendError(res, e);
  }
});

// ─── 自动同步配置（Pro 版专属）───
router.get('/auto-config', requireAuth, requirePlan('pro'), async (req: AuthRequest, res: Response) => {
  res.json({
    success: true,
    data: {
      enabled: true,
      interval: 'hourly',
      nextRun: new Date(Date.now() + 3600000).toISOString(),
      message: '自动同步已启用（Pro 套餐）',
    },
  });
});

// ─── AI 对话导出到 Obsidian ───
router.post('/export-chat', requireAuth, enforceQuota('flow_sync'), async (req: AuthRequest, res: Response) => {
  try {
    const { messages, title, tags } = req.body || {};

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'messages 数组必填且非空',
      });
    }

    // 将对话保存为 Markdown 文件到用户导出目录
    const exportDir = path.resolve(process.cwd(), '..', 'uploads', `chat-export-${req.user!.id}`);
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const fileName = `${timestamp}-对话导出.md`;
    const filePath = path.join(exportDir, fileName);

    // 生成 Markdown 内容
    const lines: string[] = [
      '---',
      `标题: "${title || 'AIbak 对话导出'}"`,
      `导出时间: "${new Date().toLocaleString('zh-CN')}"`,
      `消息数: ${messages.length}`,
      '---',
      '',
      `# ${title || 'AIbak 对话导出'}`,
      '',
    ];
    for (const msg of messages) {
      const roleLabel = msg.role === 'user' ? '👤 用户' : '🤖 AI';
      lines.push(`## ${roleLabel}`);
      lines.push('');
      lines.push(msg.content || '');
      lines.push('');
      lines.push('---');
      lines.push('');
    }

    fs.writeFileSync(filePath, lines.join('\n'), 'utf-8');
    logger.info('flow-export-chat', `对话已导出: ${filePath}`, { userId: req.user!.id, messageCount: messages.length });

    // 同步到 Obsidian
    const result = await runFlowSync({
      userId: req.user!.id,
      sources: [exportDir],
      project: title || 'AIbak 对话导出',
      title: title || 'AIbak 对话导出',
      summary: `AI 对话导出：${messages.length} 条消息`,
      tags: tags || ['AI对话', '导出', 'AibakChat'],
    });

    if (result.quotaExceeded) {
      return res.status(402).json({ success: false, error: result.error, quotaExceeded: true });
    }

    if (!result.success) {
      return res.status(500).json({ success: false, error: result.error });
    }

    res.json({
      success: true,
      data: {
        file: fileName,
        category: result.category,
        copied: result.copied || 0,
        index: result.index,
        message: '对话已导出并同步到 Obsidian 知识库',
      },
    });
  } catch (e: any) {
    sendError(res, e);
  }
});

// ─── 查询同步历史 ───
router.get('/history', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const historyDir = path.resolve(process.cwd(), '..', 'uploads', `chat-export-${req.user!.id}`);
    const exports: any[] = [];
    if (fs.existsSync(historyDir)) {
      const files = fs.readdirSync(historyDir)
        .filter(f => f.endsWith('.md'))
        .sort()
        .reverse()
        .slice(0, 20);
      for (const f of files) {
        const stat = fs.statSync(path.join(historyDir, f));
        exports.push({
          name: f,
          size: stat.size,
          createdAt: stat.birthtime.toISOString(),
        });
      }
    }
    res.json({ success: true, data: { exports, total: exports.length } });
  } catch (e: any) {
    sendError(res, e);
  }
});

export default router;
