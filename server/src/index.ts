import express, { Express, Request, Response, NextFunction } from 'express';
import type { Server } from 'http';
import path from 'path';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import { apiLimiter, aiLimiter } from './middleware/rate-limit';
import { buildCorsOptions, parseAllowedOrigins } from './middleware/cors-config';
import { buildHelmetOptions } from './middleware/security-headers';

// 导入数据库配置
import { connectMongoDB, connectRedis, checkDatabaseHealth } from './config/database';
import { validateStartupEnv } from './config/env-check';

// 导入路由
import aiRoutes from './routes/ai';
import knowledgeRoutes from './routes/knowledge';
import ragRoutes from './routes/rag';
import ragPipelineRoutes from './routes/rag-pipeline';
import courseRoutes from './routes/courses';
import codeExplanationRoutes from './routes/code-explanation';
import authRoutes from './routes/auth';
import authSessionRoutes from './routes/auth-session';
import authMfaRoutes from './routes/auth-mfa';
import authVerifyRoutes from './routes/auth-verify';
import authPasswordRoutes from './routes/auth-password';
import adminSecurityRoutes from './routes/admin-security';
import mcpRoutes from './routes/mcp';
import compareRoutes from './routes/compare';
import text2imgRoutes from './routes/text2img';
import mediaByokRoutes from './routes/media-byok';
import billingRoutes from './routes/billing';
import modelCalendarRoutes from './routes/model-calendar';
import learningPathRoutes from './routes/learning-path';
import modelConfigRoutes from './routes/model-config';
import customerServiceRoutes from './routes/customer-service';
import toolsRoutes from './routes/tools';
import teamRoutes from './routes/team';
import marketplaceRoutes from './routes/marketplace';
import diagnosticsRoutes from './routes/diagnostics';
import quickstartRoutes from './routes/quickstart';
import skillsRoutes from './routes/skills';
import workflowRoutes from './routes/workflows';
import agentRoutes from './routes/agent';
import aiGatewayRoutes from './routes/ai-gateway';
import knowledgeGraphRoutes from './routes/knowledge-graph';
import sandboxRoutes from './routes/sandbox';
import xhsRoutes from './routes/xhs';
import accountRoutes from './routes/account';
import referralRoutes from './routes/referral';
import pointsRoutes from './routes/points';
import marketplaceRevenueRoutes from './routes/marketplace-revenue';
import opsRoutes from './routes/ops';
import relayRoutes from './routes/relay';
import aibakChatRoutes from './routes/aibak-chat';
import searchRoutes from './routes/search';
import queryCenterRoutes from './routes/query-center';
import { mcpService } from './services/mcp.service';
import { sendError } from './lib/http-error';
import { logger } from './lib/logger';
import { apmMiddleware, vitalsHandler, collectApmMetrics } from './middleware/apm';
import { renderPrometheusMetrics } from './lib/prometheus';
import { requireAdmin } from './middleware/requireAdmin';
import { requestIdMiddleware } from './middleware/request-id';
import { reloadCustomProviders } from './gateway/ai-gateway.service';
import { ReconciliationService } from './services/reconciliation.service';
import { mediaWorker } from './services/queue.service';
import { OutboxWorker } from './services/outbox-worker';

import { startBackupScheduler } from "./services/backup.service";
import { startApmPersistence } from "./middleware/apm";
import { startDashboardCollection } from "./services/dashboard.service";
// ─── 进程级崩溃兜底（稳定性基线，适配 0→1→100 扩容）───
// 未捕获异常：记录后退出，交由 Docker restart / healthcheck 自动拉起，避免僵尸进程。
process.on('uncaughtException', (err: Error) => {
  logger.error('index', `💥 未捕获异常，进程退出（容器将自动重启）: ${err?.stack || err?.message}`);
  process.exit(1);
});
// 未处理的 Promise 拒绝：仅记录，不退出，避免单次异常拖垮整站。
process.on('unhandledRejection', (reason: unknown) => {
  logger.error('index', `⚠ 未处理的 Promise 拒绝: ${reason instanceof Error ? reason.stack : String(reason)}`);
});

// 加载环境变量
dotenv.config();

const app: Express = express();
const PORT = process.env.PORT || 3000;

// 应用位于反代（nginx）之后，需信任 X-Forwarded-* 头；否则 express-rate-limit
// 收到 X-Forwarded-For 会抛错，导致走域名访问的所有受限流路由返回 500。
app.set('trust proxy', 1);

// 中间件
const clientUrl = process.env.CLIENT_URL;
const corsMode =
  !clientUrl && process.env.NODE_ENV !== 'production'
    ? '开发模式放行全部来源（未配置 CLIENT_URL）'
    : `白名单: ${parseAllowedOrigins(clientUrl).join(', ')}`;
logger.info('index', `CORS 配置 → ${corsMode}`);
app.use(cors(buildCorsOptions(clientUrl)));
app.use(helmet(buildHelmetOptions(process.env.NODE_ENV)));
app.use(compression());

// ⚠️ Webhook 路由必须获取原始请求体做 HMAC 验签，放在 express.json() 之前
// 支付网关（Stripe/微信）签名是对原始字节流计算的，JSON 二次序列化会破坏签名
app.use('/api/billing/webhook', express.raw({ type: 'application/json' }));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(morgan('dev'));

// 强制所有 JSON 响应使用 UTF-8 编码，解决中文乱码问题
app.use((_req: Request, res: Response, next: NextFunction) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  next();
});

// 请求关联 ID（可观测性：跨日志串联一次请求），须在 apm 之前注册
app.use(requestIdMiddleware);

// APM 性能监控（请求耗时/错误率/慢查询）
app.use(apmMiddleware);

// ─── 健康检查 + APM 指标（位于所有中间件之后、路由之前）───
app.get('/health', (_req, res) => res.json({
  status: 'ok',
  uptime: process.uptime(),
  memory: process.memoryUsage(),
  timestamp: new Date().toISOString(),
}));
app.get('/health/vitals', vitalsHandler);

// Prometheus 指标端点（管理员可抓取，供 Grafana 告警 / 看板接入）
app.get('/api/metrics', requireAdmin, (_req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
  res.send(renderPrometheusMetrics(collectApmMetrics()));
});

// 限流（全局 API）
app.use('/api/', apiLimiter);

// 注册路由
app.use('/api/auth', authRoutes);
app.use('/api/auth', authSessionRoutes);
app.use('/api/auth', authMfaRoutes);
app.use('/api/auth', authVerifyRoutes);
app.use('/api/auth', authPasswordRoutes);
app.use('/api', adminSecurityRoutes);
app.use('/api/compare', compareRoutes);
app.use('/api/ai', aiLimiter(), aiRoutes);           // AI 端点：按用户级别限流
app.use('/api/aibak', aiLimiter(), aibakChatRoutes);  // CloudBase 免费 AI：同样限流
app.use('/api/knowledge', knowledgeRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/query-center', queryCenterRoutes);
app.use('/api/rag', ragRoutes);
app.use('/api/rag', ragPipelineRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/code', codeExplanationRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/model-calendar', modelCalendarRoutes);
app.use('/api/learning-path', learningPathRoutes);
app.use('/api/model-config', modelConfigRoutes);
app.use('/api/customer-service', customerServiceRoutes);
app.use('/api/cs', customerServiceRoutes); // 公开客服前缀（embedCode 调用）
app.use('/api/tools', toolsRoutes);
app.use('/api/team', teamRoutes);
app.use('/api/marketplace', marketplaceRoutes);
app.use('/api/diagnostics', diagnosticsRoutes);
app.use('/api/quickstart', quickstartRoutes);
app.use('/api/skills', skillsRoutes);
app.use('/api/wf', workflowRoutes);
app.use('/api/workflows', workflowRoutes);
app.use('/api/agent', agentRoutes);
app.use('/api/gateway', aiGatewayRoutes);
app.use('/api/knowledge-graph', knowledgeGraphRoutes);
app.use('/api/sandbox', sandboxRoutes);
app.use('/api/xhs', xhsRoutes);
app.use('/api/mcp', mcpRoutes);
app.use('/api/text2img', text2imgRoutes);
app.use('/api/media-keys', mediaByokRoutes); // 媒体生成 BYOK（用户自带 Key）管理
app.use('/api/referral', referralRoutes);            // 推荐/分销体系
app.use('/api/points', pointsRoutes);                // 积分签到/任务体系
app.use('/api/marketplace', marketplaceRevenueRoutes); // 市场收益/提现
app.use('/api/ops', opsRoutes);                         // 运营看板 / 北极星指标
app.use('/api/relay', relayRoutes);                     // 中转站：整合进平台的模型聚合网关
app.use('/api', accountRoutes);                         // 账户管理 / 数据导出 / 账号注销 / 协议同意

// 静态资源：对象存储（OSS）落盘的图片/视频由 /generated 对外提供
// 与 lib/object-storage.ts 的 LOCAL_STORAGE_DIR 保持一致（默认 server/uploads/generated）
app.use('/generated', express.static(process.env.OSS_LOCAL_DIR || path.join(__dirname, '..', 'uploads', 'generated')));

// 基础路由
app.get('/', (req: Request, res: Response) => {
  res.json({
    message: 'AI Agent Platform API Server',
    version: '0.1.0',
    status: 'running',
    timestamp: new Date().toISOString()
  });
});

// 健康检查
app.get('/api/health', async (_req: Request, res: Response) => {
  const health = await checkDatabaseHealth();
  const healthy = health.mongodb && health.redis;
  res.status(healthy ? 200 : 503).json({
    status: healthy ? 'healthy' : 'unhealthy',
    mongodb: health.mongodb ? 'connected' : 'disconnected',
    redis: health.redis ? 'connected' : 'disconnected',
    revision: process.env.APP_COMMIT_SHA || 'unknown',
    serverImageDigest: process.env.SERVER_IMAGE_DIGEST || 'unknown',
    clientImageDigest: process.env.CLIENT_IMAGE_DIGEST || 'unknown',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// 404 处理
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: 'Route not found' });
});

// 错误处理
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  const rid = (req as Request & { requestId?: string }).requestId;
  logger.error('index', `Unhandled error${rid ? ` [${rid}]` : ''}: ${err.stack || err.message}`);
  sendError(res, err);
});

export interface BootstrapDependencies {
  validateEnv: () => void;
  connectMongo: () => Promise<unknown>;
  connectRedis: () => Promise<unknown>;
  loadMcp: () => Promise<unknown>;
  reloadProviders: () => Promise<unknown>;
  startMediaWorker: () => Promise<unknown>;
  startOutboxWorker: () => void;
  startHttpServer: () => Server;
}

export interface BootstrapOptions {
  listen?: boolean;
  /** 仅用于启动顺序测试；生产运行使用默认真实依赖。 */
  dependencies?: Partial<BootstrapDependencies>;
}


/**
 * 每日对账定时器
 * 每天凌晨 2:00 (UTC+8) 自动触发前一天的对账
 * 使用 setInterval 轮询实现，无需额外依赖
 */
function scheduleDailyReconciliation(): NodeJS.Timeout {
  const RUN_HOUR_UTC8 = 2;
  const CHECK_INTERVAL_MS = 60_000; // 每分钟检查一次

  const getNextRunMs = (): number => {
    const now = new Date();
    const runTime = new Date(now);
    runTime.setHours(RUN_HOUR_UTC8, 0, 0, 0);
    if (runTime <= now) {
      runTime.setDate(runTime.getDate() + 1);
    }
    return runTime.getTime() - now.getTime();
  };

  let lastRunDate = '';

  const runIfNeeded = async () => {
    const now = new Date();
    // 只在 2:00~2:05 这个窗口触发，防止多次执行
    if (now.getHours() !== RUN_HOUR_UTC8) return;

    const todayStr = now.toISOString().slice(0, 10);
    if (lastRunDate === todayStr) return;

    lastRunDate = todayStr;
    logger.info('reconciliation-cron', `开始每日自动对账（日期: ${todayStr}）`);

    try {
      const result = await ReconciliationService.triggerReconciliation();
      logger.info('reconciliation-cron', `对账完成: batchId=${result.batchId} status=${result.status} matched=${result.matchedOrders} unmatched=${result.unmatchedOrders}`);
    } catch (err: any) {
      logger.error('reconciliation-cron', `对账失败: ${err.message || String(err)}`);
    }
  };

  // 初始延迟到下一个 2:00
  const initialDelay = getNextRunMs();
  logger.info('reconciliation-cron', `每日对账定时器已注册，首次将在 ${Math.round(initialDelay / 3600000)} 小时后触发`);

  const timer = setInterval(runIfNeeded, CHECK_INTERVAL_MS);
  // 允许进程退出（不阻止关闭）
  timer.unref();
  return timer;
}
function defaultBootstrapDependencies(): BootstrapDependencies {
  return {
    validateEnv: validateStartupEnv,
    connectMongo: connectMongoDB,
    connectRedis,
    loadMcp: () => mcpService.loadFromDB(),
    reloadProviders: reloadCustomProviders,
    startMediaWorker: () => mediaWorker.start(),
    startOutboxWorker: () => OutboxWorker.start(),
    startHttpServer: () => {
      // 启动备份调度和运营指标采集
      startBackupScheduler();
      startDashboardCollection();
  startApmPersistence();
      return app.listen(PORT, () => {
        logger.info('index', `Server running on http://localhost:${PORT}`, {
          env: process.env.NODE_ENV || 'development',
          revision: process.env.APP_COMMIT_SHA || 'unknown',
        });
      });
    },
  };
}


async function startManagedDependency(label: string, action: () => Promise<unknown>): Promise<void> {
  try {
    await action();
  } catch (error) {
    if (process.env.NODE_ENV === 'production') throw error;
    logger.warn('index', `${label} 启动失败，非生产环境继续运行: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * 启动顺序门禁：配置、MongoDB、Redis 全部成功后才启动 Worker 和 HTTP 监听。
 * 生产依赖失败会向上抛错，由容器退出并触发部署回滚，而不是降级 Mock。
 */
export async function bootstrap(options: BootstrapOptions = {}): Promise<Server | undefined> {
  const dependencies = { ...defaultBootstrapDependencies(), ...options.dependencies };

  dependencies.validateEnv();
  await dependencies.connectMongo();
  await dependencies.connectRedis();

  await startManagedDependency('MCP 配置', dependencies.loadMcp);
  await startManagedDependency('自定义 AI Provider', dependencies.reloadProviders);
  await startManagedDependency('媒体任务 Worker', dependencies.startMediaWorker);
  await startManagedDependency('Outbox Worker', async () => { dependencies.startOutboxWorker(); });

  // 每日对账定时器（每天凌晨 2:00 UTC+8）
  scheduleDailyReconciliation();

  if (options.listen === false) return undefined;
  return dependencies.startHttpServer();
}

if (require.main === module) {
  bootstrap().catch((error) => {
    logger.error('index', `生产启动失败，进程退出: ${error instanceof Error ? error.stack || error.message : String(error)}`);
    process.exit(1);
  });
}

export default app;





