// server/src/routes/ops.ts
//
// Operations dashboard API.
// Style mirrors server/src/routes/marketplace-revenue.ts:
//   router.use(requireAuth); try/catch + sendError; { success: true, data }.
//
// Mount in server/src/index.ts (alongside the other route registrations):
//   import opsRoutes from './routes/ops';
//   app.use('/api/ops', opsRoutes);
//
// Routes:
//   GET /api/ops/snapshot   -> full dashboard (admin only)
//   GET /api/ops/public     -> anonymous subset for marketing page (no auth)

import { Router, Response } from 'express';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { requireAdmin } from '../middleware/requireAdmin';
import { sendError } from '../lib/http-error';
import { getOpsSnapshot, getPublicMetrics } from '../services/ops.service';
import { getConversionFunnel } from '../services/conversion-funnel.service';
import { checkDatabaseHealth } from '../config/database';
import { User } from '../models/User';
import { ApiUsageLog } from '../models/ApiUsageLog';
import { AIUsageLog } from '../models/AIUsageLog';
import { collectApmMetrics, getLatencyPercentiles, getSuccessRatePercent, getToday5xxCount } from '../middleware/apm';

const router = Router();

// ───────────── API 状态 ─────────────
router.get('/', (_req, res) => { res.json({ ok: true, name: 'ops' }); });

/**
 * GET /api/ops/snapshot
 * Full operations dashboard — admin only.
 */
router.get('/snapshot', requireAuth, requireAdmin, async (_req: AuthRequest, res: Response) => {
  try {
    const data = await getOpsSnapshot();
    res.json({ success: true, data });
  } catch (error: any) {
    sendError(res, error);
  }
});

/**
 * GET /api/ops/public
 * Anonymous, safe-for-public subset (marketing page). No admin required.
 */
router.get('/public', async (_req: AuthRequest, res: Response) => {
  try {
    const data = await getPublicMetrics();
    res.json({ success: true, data });
  } catch (error: any) {
    sendError(res, error);
  }
});

/**
 * GET /api/ops/public-status
 * 公开状态页专用的安全摘要：只返回平台基础可用性，不暴露内部主机、端口、仓库或密钥。
 */
router.get('/public-status', async (_req: AuthRequest, res: Response) => {
  const startedAt = Date.now();
  try {
    const health = await checkDatabaseHealth();
    const healthy = health.mongodb && health.redis;
    const latencyMs = Date.now() - startedAt;
    const checkedAt = new Date().toISOString();
    const target = process.env.PUBLIC_STATUS_ROUTE_TARGET === 'cloud' ? 'cloud' : 'local';

    res.json({
      success: true,
      data: {
        service: { status: healthy ? 'operational' : 'degraded', label: healthy ? 'NexMind 平台运行正常' : 'NexMind 平台部分异常' },
        availability: { healthy, label: healthy ? '核心服务可用' : '核心依赖需要关注' },
        route: { target, label: target === 'cloud' ? '云端生产入口' : '本地生产入口' },
        nodes: {
          local: target === 'local' && healthy ? 'operational' : 'unknown',
          cloud: target === 'cloud' && healthy ? 'operational' : 'unknown',
        },
        modules: [
          { id: 'api', name: 'API 网关', status: healthy ? 'operational' : 'degraded', latencyMs },
          { id: 'mongodb', name: 'MongoDB', status: health.mongodb ? 'operational' : 'degraded' },
          { id: 'redis', name: 'Redis', status: health.redis ? 'operational' : 'degraded' },
        ],
        incidents: healthy ? [] : [{ time: checkedAt, message: '核心依赖健康检查未全部通过，请稍后重试或联系支持。' }],
        checkedAt,
        refreshAfterSeconds: 15,
        dataSource: 'NexMind 同源公开状态接口',
        brand: { name: 'NexMind by AIbak', subtitle: 'Your AI Nexus. Build Smarter.' },
      },
    });
  } catch (error: any) {
    sendError(res, error);
  }
});

/**
 * GET /api/ops/funnel
 * Conversion funnel — admin only.
 */
router.get('/funnel', requireAuth, requireAdmin, async (req: any, res: Response) => {
  try {
    const days = parseInt(String(req.query.days || '30'), 10) || 30;
    const data = await getConversionFunnel(Math.min(days, 365));
    res.json({ success: true, data });
  } catch (error: any) {
    sendError(res, error);
  }
});


/**
 * GET /api/ops/my-stats
 * 用户个人仪表板：项目统计、报告历史、使用额度
 */
router.get('/my-stats', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { Order } = await import('../models/Order');
    const { ProjectGradeProject } = await import('../models/ProjectGradeProject');
    const { ProjectGradeReport } = await import('../models/ProjectGradeReport');
    const { User } = await import('../models/User');

    const userId = req.user!.id;

    // 并行查询用户数据
    const [user, orders, projects, reports] = await Promise.all([
      User.findById(userId).select('name email plan membershipExpiresAt credits createdAt').lean(),
      Order.find({ userId }).sort({ createdAt: -1 }).limit(20).lean(),
      ProjectGradeProject.find({ ownerId: userId }).sort({ updatedAt: -1 }).lean(),
      ProjectGradeReport.find({ ownerId: userId }).sort({ publishedAt: -1 }).limit(10).lean(),
    ]);

    // 项目统计
    const projectStats = {
      total: projects.length,
      active: projects.filter((p: any) => p.status === 'active').length,
      archived: projects.filter((p: any) => p.status === 'archived').length,
      averageScore: projects.length > 0
        ? Math.round(projects.reduce((sum: number, p: any) => sum + (p.latestScore || 0), 0) / projects.length)
        : 0,
    };

    // 报告统计
    const reportStats = {
      total: reports.length,
      published: reports.filter((r: any) => r.publishedAt).length,
      avgScore: reports.length > 0
        ? (reports.reduce((sum: number, r: any) => sum + (r.externalScore || 0), 0) / reports.length).toFixed(1)
        : '0.0',
      latestVerdict: reports.length > 0 ? reports[0] : null,
    };

    // 订单统计
    const orderStats = {
      total: orders.length,
      paidOrders: orders.filter((o: any) => o.paymentStatus === 'paid' || o.status === 'paid').length,
      totalSpentYuan: orders
        .filter((o: any) => o.paymentStatus === 'paid')
        .reduce((sum: number, o: any) => sum + (o.amount || 0), 0) / 100,
    };

    // 会员信息
    const membership = user ? {
      plan: user.plan || 'free',
      expiresAt: user.membershipExpiresAt || null,
      credits: user.credits || 0,
      memberSince: user.createdAt,
    } : null;

    res.json({
      success: true,
      data: { membership, projectStats, reportStats, orderStats, recentReports: reports.slice(0, 5), recentProjects: projects.slice(0, 5) },
    });
  } catch (error: any) {
    sendError(res, error);
  }
});

export default router;

// ============================================================
// Dashboard 全域监控 API
// ============================================================
import os from 'os';
import { aiModelManager } from '../config/ai-models';
import { evaluateDiskAlert, getSystemDiskUsage } from '../lib/disk-usage';

router.get('/dashboard', requireAuth, async (_req: AuthRequest, res: Response) => {
  try {
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [ops, publicMetrics, dependencyHealth, aiUsageFacet, memberSummary, planBreakdown, apiRequests24h] = await Promise.all([
      getOpsSnapshot().catch(() => null),
      getPublicMetrics().catch(() => null),
      checkDatabaseHealth().catch(() => ({ mongodb: false, redis: false })),
      AIUsageLog.aggregate([
        { $match: { createdAt: { $gte: since24h } } },
        { $facet: {
          summary: [{ $group: { _id: null, requests: { $sum: 1 }, promptTokens: { $sum: '$promptTokens' }, completionTokens: { $sum: '$completionTokens' }, totalTokens: { $sum: '$totalTokens' }, creditsDeducted: { $sum: '$creditsDeducted' }, costFen: { $sum: '$costFen' }, fallbackRequests: { $sum: { $cond: ['$fallback', 1, 0] } } } }],
          byProvider: [{ $group: { _id: { provider: '$provider', modelId: '$modelId' }, requests: { $sum: 1 }, totalTokens: { $sum: '$totalTokens' } } }, { $sort: { requests: -1 } }, { $limit: 20 }],
          byTool: [{ $match: { toolId: { $exists: true, $ne: null } } }, { $group: { _id: '$toolId', requests: { $sum: 1 }, totalTokens: { $sum: '$totalTokens' }, creditsDeducted: { $sum: '$creditsDeducted' } } }, { $sort: { requests: -1 } }, { $limit: 30 }],
        } },
      ]).catch(() => [{ summary: [], byProvider: [], byTool: [] }]),
      User.aggregate([{ $group: { _id: null, totalUsers: { $sum: 1 }, paidUsers: { $sum: { $cond: [{ $in: ['$plan', ['pro', 'max', 'team']] }, 1, 0] } }, creditsBalance: { $sum: { $ifNull: ['$credits', 0] } } } }]).catch(() => []),
      User.aggregate([{ $group: { _id: '$plan', count: { $sum: 1 } } }, { $sort: { count: -1 } }]).catch(() => []),
      ApiUsageLog.countDocuments({ timestamp: { $gte: since24h } }).catch(() => 0),
    ]);

    // 系统资源
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const cpuLoad = os.loadavg()[0] || 0;
    const uptime = Math.floor(os.uptime());
    const disk = (() => {
      try {
        return getSystemDiskUsage('/');
      } catch {
        return null;
      }
    })();

    // AI 模型状态：以运行时已启用 provider 为准，避免大屏展示不存在或已禁用的模型。
    const enabledProviders = aiModelManager.getEnabledProviders();
    const providers = enabledProviders.map((provider) => provider.name);
    const modelCount = enabledProviders.reduce((total, provider) => total + provider.models.length, 0);

    // 服务状态：只展示已验证的后端/依赖；代理和 Tunnel 未在本进程内探测时明确标记未知。
    const services = {
      backend: { status: 'healthy', port: 3000 },
      mongodb: { status: dependencyHealth.mongodb ? 'healthy' : 'degraded', port: null },
      redis: { status: dependencyHealth.redis ? 'healthy' : 'degraded', port: null },
      proxy: { status: 'unknown', port: null },
      tunnel: { status: 'unknown', port: null },
    };

    // 告警（自动化检测）
    const alerts: Array<{ level: 'critical' | 'warning' | 'info'; message: string; fix?: string }> = [];
    if (cpuLoad > 2) alerts.push({ level: 'warning', message: `CPU 负载偏高: ${cpuLoad.toFixed(1)}`, fix: '检查是否有异常进程占用 CPU' });
    if (freeMem / totalMem < 0.1) alerts.push({ level: 'warning', message: `内存不足: ${Math.round(freeMem / 1024 / 1024)}MB 可用`, fix: '重启 node 进程释放内存' });
    const diskAlert = disk ? evaluateDiskAlert(disk) : null;
    if (diskAlert) alerts.push(diskAlert);
    if (!ops) alerts.push({ level: 'warning', message: '运营快照获取失败', fix: '重新拉取运营指标' });
    if (!dependencyHealth.mongodb) alerts.push({ level: 'critical', message: 'MongoDB 健康检查失败', fix: '检查数据库连接与凭据' });
    if (!dependencyHealth.redis) alerts.push({ level: 'critical', message: 'Redis 健康检查失败', fix: '检查 Redis 连接与队列状态' });
    if (enabledProviders.length === 0) alerts.push({ level: 'critical', message: '没有已启用的真实模型 provider', fix: '检查生产模型配置' });

    const aiUsage = aiUsageFacet[0] || { summary: [], byProvider: [], byTool: [] };
    const usageSummary = aiUsage.summary[0] || { requests: 0, promptTokens: 0, completionTokens: 0, totalTokens: 0, creditsDeducted: 0, costFen: 0, fallbackRequests: 0 };
    const members = memberSummary[0] || { totalUsers: 0, paidUsers: 0, creditsBalance: 0 };
    const apm = collectApmMetrics();
    const percentiles = getLatencyPercentiles();

    res.json({
      success: true,
      data: {
        system: {
          cpu: Math.round(cpuLoad * 100) / 100,
          memory: { total: Math.round(totalMem / 1024 / 1024), free: Math.round(freeMem / 1024 / 1024), usedPercent: Math.round((1 - freeMem / totalMem) * 100) },
          disk,
          uptime,
          platform: os.platform(),
          hostname: os.hostname(),
        },
        services,
        models: { count: modelCount, providers },
        ops: ops || {},
        public: publicMetrics || {},
        usage: {
          period: '24h',
          requests: Number(usageSummary.requests || 0),
          promptTokens: Number(usageSummary.promptTokens || 0),
          completionTokens: Number(usageSummary.completionTokens || 0),
          totalTokens: Number(usageSummary.totalTokens || 0),
          creditsDeducted: Number(usageSummary.creditsDeducted || 0),
          costFen: Number(usageSummary.costFen || 0),
          fallbackRequests: Number(usageSummary.fallbackRequests || 0),
          byProvider: aiUsage.byProvider.map((item: any) => ({ provider: item._id?.provider || 'unknown', model: item._id?.modelId || 'unknown', requests: item.requests, totalTokens: item.totalTokens })),
          byTool: aiUsage.byTool.map((item: any) => ({ toolId: item._id, requests: item.requests, totalTokens: item.totalTokens, creditsDeducted: item.creditsDeducted })),
        },
        members: {
          totalUsers: Number(members.totalUsers || 0),
          paidUsers: Number(members.paidUsers || 0),
          freeUsers: Math.max(0, Number(members.totalUsers || 0) - Number(members.paidUsers || 0)),
          creditsBalance: Number(members.creditsBalance || 0),
          planBreakdown: planBreakdown.map((item: any) => ({ plan: item._id || 'free', count: item.count })),
        },
        traffic: {
          aiRequests24h: Number(usageSummary.requests || 0),
          apiRequests24h: Number(apiRequests24h || 0),
          processRequests: apm.requests,
          successRate: getSuccessRatePercent(),
          p95Ms: percentiles.p95,
          p99Ms: percentiles.p99,
          errors5xxToday: getToday5xxCount(),
        },
        topology: {
          nodes: [
            { id: 'user', label: '用户访问', status: 'healthy' },
            { id: 'frontend', label: 'NexMind 前端', status: 'healthy' },
            { id: 'api', label: 'API 网关', status: 'healthy' },
            { id: 'models', label: '模型池', status: enabledProviders.length ? 'healthy' : 'degraded' },
            { id: 'mongodb', label: 'MongoDB', status: dependencyHealth.mongodb ? 'healthy' : 'degraded' },
            { id: 'redis', label: 'Redis', status: dependencyHealth.redis ? 'healthy' : 'degraded' },
            { id: 'cloud', label: '云端备用节点', status: 'unknown' },
          ],
          edges: [
            ['user', 'frontend'], ['frontend', 'api'], ['api', 'models'], ['api', 'mongodb'], ['api', 'redis'], ['api', 'cloud'],
          ],
        },
        alerts,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    sendError(res, error);
  }
});
