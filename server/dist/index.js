"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.bootstrap = bootstrap;
const express_1 = __importDefault(require("express"));
const path_1 = __importDefault(require("path"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const helmet_1 = __importDefault(require("helmet"));
const morgan_1 = __importDefault(require("morgan"));
const compression_1 = __importDefault(require("compression"));
const rate_limit_1 = require("./middleware/rate-limit");
const cors_config_1 = require("./middleware/cors-config");
const security_headers_1 = require("./middleware/security-headers");
// 导入数据库配置
const database_1 = require("./config/database");
const env_check_1 = require("./config/env-check");
const RelayChannel_1 = require("./models/RelayChannel");
const crypto_1 = require("./lib/crypto");
const seedKnowledge_1 = require("./scripts/seedKnowledge");
// 导入路由
const ai_1 = __importDefault(require("./routes/ai"));
const knowledge_1 = __importDefault(require("./routes/knowledge"));
const rag_1 = __importDefault(require("./routes/rag"));
const rag_pipeline_1 = __importDefault(require("./routes/rag-pipeline"));
const courses_1 = __importDefault(require("./routes/courses"));
const code_explanation_1 = __importDefault(require("./routes/code-explanation"));
const auth_1 = __importDefault(require("./routes/auth"));
const auth_session_1 = __importDefault(require("./routes/auth-session"));
const auth_mfa_1 = __importDefault(require("./routes/auth-mfa"));
const auth_verify_1 = __importDefault(require("./routes/auth-verify"));
const auth_password_1 = __importDefault(require("./routes/auth-password"));
const admin_security_1 = __importDefault(require("./routes/admin-security"));
const mcp_1 = __importDefault(require("./routes/mcp"));
const compare_1 = __importDefault(require("./routes/compare"));
const project_grade_1 = __importDefault(require("./routes/project-grade"));
const text2img_1 = __importDefault(require("./routes/text2img"));
const media_byok_1 = __importDefault(require("./routes/media-byok"));
const billing_1 = __importDefault(require("./routes/billing"));
const model_calendar_1 = __importDefault(require("./routes/model-calendar"));
const learning_path_1 = __importDefault(require("./routes/learning-path"));
const model_config_1 = __importDefault(require("./routes/model-config"));
const customer_service_1 = __importDefault(require("./routes/customer-service"));
const tools_1 = __importDefault(require("./routes/tools"));
const team_1 = __importDefault(require("./routes/team"));
const marketplace_1 = __importDefault(require("./routes/marketplace"));
const diagnostics_1 = __importDefault(require("./routes/diagnostics"));
const quickstart_1 = __importDefault(require("./routes/quickstart"));
const skills_1 = __importDefault(require("./routes/skills"));
const workflows_1 = __importDefault(require("./routes/workflows"));
const agent_1 = __importDefault(require("./routes/agent"));
const ai_gateway_1 = __importDefault(require("./routes/ai-gateway"));
const knowledge_graph_1 = __importDefault(require("./routes/knowledge-graph"));
const sandbox_1 = __importDefault(require("./routes/sandbox"));
const xhs_1 = __importDefault(require("./routes/xhs"));
const account_1 = __importDefault(require("./routes/account"));
const referral_1 = __importDefault(require("./routes/referral"));
const points_1 = __importDefault(require("./routes/points"));
const marketplace_revenue_1 = __importDefault(require("./routes/marketplace-revenue"));
const ops_1 = __importDefault(require("./routes/ops"));
const relay_1 = __importDefault(require("./routes/relay"));
const aibak_chat_1 = __importDefault(require("./routes/aibak-chat"));
const search_1 = __importDefault(require("./routes/search"));
const query_center_1 = __importDefault(require("./routes/query-center"));
const marketing_1 = __importDefault(require("./routes/marketing"));
const mcp_service_1 = require("./services/mcp.service");
const http_error_1 = require("./lib/http-error");
const logger_1 = require("./lib/logger");
const apm_1 = require("./middleware/apm");
const prometheus_1 = require("./lib/prometheus");
const requireAdmin_1 = require("./middleware/requireAdmin");
const request_id_1 = require("./middleware/request-id");
const ai_gateway_service_1 = require("./gateway/ai-gateway.service");
const reconciliation_service_1 = require("./services/reconciliation.service");
const queue_service_1 = require("./services/queue.service");
const outbox_worker_1 = require("./services/outbox-worker");
const backup_service_1 = require("./services/backup.service");
const apm_2 = require("./middleware/apm");
const dashboard_service_1 = require("./services/dashboard.service");
// ─── 进程级崩溃兜底（稳定性基线，适配 0→1→100 扩容）───
// 未捕获异常：记录后退出，交由 Docker restart / healthcheck 自动拉起，避免僵尸进程。
process.on('uncaughtException', (err) => {
    logger_1.logger.error('index', `💥 未捕获异常，进程退出（容器将自动重启）: ${err?.stack || err?.message}`);
    process.exit(1);
});
// 未处理的 Promise 拒绝：仅记录，不退出，避免单次异常拖垮整站。
process.on('unhandledRejection', (reason) => {
    logger_1.logger.error('index', `⚠ 未处理的 Promise 拒绝: ${reason instanceof Error ? reason.stack : String(reason)}`);
});
// 加载环境变量
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
// 应用位于反代（nginx）之后，需信任 X-Forwarded-* 头；否则 express-rate-limit
// 收到 X-Forwarded-For 会抛错，导致走域名访问的所有受限流路由返回 500。
app.set('trust proxy', 1);
// 中间件
const clientUrl = process.env.CLIENT_URL;
const corsMode = !clientUrl && process.env.NODE_ENV !== 'production'
    ? '开发模式放行全部来源（未配置 CLIENT_URL）'
    : `白名单: ${(0, cors_config_1.parseAllowedOrigins)(clientUrl).join(', ')}`;
logger_1.logger.info('index', `CORS 配置 → ${corsMode}`);
app.use((0, cors_1.default)((0, cors_config_1.buildCorsOptions)(clientUrl)));
app.use((0, helmet_1.default)((0, security_headers_1.buildHelmetOptions)(process.env.NODE_ENV)));
app.use((0, compression_1.default)());
// ⚠️ Webhook 路由必须获取原始请求体做 HMAC 验签，放在 express.json() 之前
// 支付网关（Stripe/微信）签名是对原始字节流计算的，JSON 二次序列化会破坏签名
app.use('/api/billing/webhook', express_1.default.raw({ type: 'application/json' }));
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
app.use((0, morgan_1.default)('dev'));
// 强制所有 JSON 响应使用 UTF-8 编码，解决中文乱码问题
app.use((_req, res, next) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    next();
});
// 请求关联 ID（可观测性：跨日志串联一次请求），须在 apm 之前注册
app.use(request_id_1.requestIdMiddleware);
// APM 性能监控（请求耗时/错误率/慢查询）
app.use(apm_1.apmMiddleware);
// ─── 健康检查 + APM 指标（位于所有中间件之后、路由之前）───
app.get('/health', (_req, res) => res.json({
    status: 'ok',
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    timestamp: new Date().toISOString(),
}));
app.get('/health/vitals', apm_1.vitalsHandler);
// Prometheus 指标端点（管理员可抓取，供 Grafana 告警 / 看板接入）
app.get('/api/metrics', requireAdmin_1.requireAdmin, (_req, res) => {
    res.setHeader('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
    res.send((0, prometheus_1.renderPrometheusMetrics)((0, apm_1.collectApmMetrics)()));
});
// 限流（全局 API）
app.use('/api/', rate_limit_1.apiLimiter);
// 注册路由
app.use('/api/auth', auth_1.default);
app.use('/api/auth', auth_session_1.default);
app.use('/api/auth', auth_mfa_1.default);
app.use('/api/auth', auth_verify_1.default);
app.use('/api/auth', auth_password_1.default);
app.use('/api', admin_security_1.default);
app.use('/api/compare', compare_1.default);
app.use('/api/project-grade', project_grade_1.default);
app.use('/api/ai', (0, rate_limit_1.aiLimiter)(), ai_1.default); // AI 端点：按用户级别限流
app.use('/api/aibak', (0, rate_limit_1.aiLimiter)(), aibak_chat_1.default); // CloudBase 免费 AI：同样限流
app.use('/api/knowledge', knowledge_1.default);
app.use('/api/search', search_1.default);
app.use('/api/query-center', query_center_1.default);
app.use('/api/rag', rag_1.default);
app.use('/api/rag', rag_pipeline_1.default);
app.use('/api/courses', courses_1.default);
app.use('/api/code', code_explanation_1.default);
app.use('/api/billing', billing_1.default);
app.use('/api/marketing', marketing_1.default);
app.use('/api/model-calendar', model_calendar_1.default);
app.use('/api/learning-path', learning_path_1.default);
app.use('/api/model-config', model_config_1.default);
app.use('/api/customer-service', customer_service_1.default);
app.use('/api/cs', customer_service_1.default); // 公开客服前缀（embedCode 调用）
app.use('/api/tools', tools_1.default);
app.use('/api/team', team_1.default);
app.use('/api/marketplace', marketplace_1.default);
app.use('/api/diagnostics', diagnostics_1.default);
app.use('/api/quickstart', quickstart_1.default);
app.use('/api/skills', skills_1.default);
app.use('/api/wf', workflows_1.default);
app.use('/api/workflows', workflows_1.default);
app.use('/api/agent', agent_1.default);
app.use('/api/gateway', ai_gateway_1.default);
app.use('/api/knowledge-graph', knowledge_graph_1.default);
app.use('/api/sandbox', sandbox_1.default);
app.use('/api/xhs', xhs_1.default);
app.use('/api/mcp', mcp_1.default);
app.use('/api/text2img', text2img_1.default);
app.use('/api/media-keys', media_byok_1.default); // 媒体生成 BYOK（用户自带 Key）管理
app.use('/api/referral', referral_1.default); // 推荐/分销体系
app.use('/api/points', points_1.default); // 积分签到/任务体系
app.use('/api/marketplace-revenue', marketplace_revenue_1.default); // 市场收益/提现
app.use('/api/ops', ops_1.default); // 运营看板 / 北极星指标
app.use('/api/relay', relay_1.default); // 中转站：整合进平台的模型聚合网关
app.use('/api', account_1.default); // 账户管理 / 数据导出 / 账号注销 / 协议同意
app.use('/api/account', account_1.default); // 同时挂载在 /api/account 前缀
// 静态资源：对象存储（OSS）落盘的图片/视频由 /generated 对外提供
// 与 lib/object-storage.ts 的 LOCAL_STORAGE_DIR 保持一致（默认 server/uploads/generated）
app.use('/generated', express_1.default.static(process.env.OSS_LOCAL_DIR || path_1.default.join(__dirname, '..', 'uploads', 'generated')));
// 基础路由
app.get('/', (req, res) => {
    res.json({
        message: 'AI Agent Platform API Server',
        version: '0.1.0',
        status: 'running',
        timestamp: new Date().toISOString()
    });
});
// 健康检查
app.get('/api/health', async (_req, res) => {
    const health = await (0, database_1.checkDatabaseHealth)();
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
// ---- Forward-compatibility aliases for frontend ----
app.get("/api/creative-workshop", (_req, res) => {
    res.json({ ok: true, name: "creative-workshop", status: "active" });
});
app.get("/api/plugins", (_req, res) => {
    res.json({ ok: true, name: "plugins", status: "active", plugins: [] });
});
app.get("/api/code-explanation", (_req, res) => {
    res.json({ ok: true, name: "code-explanation", status: "active" });
});
app.get("/api/relay/channels", (_req, res) => {
    res.json({ ok: true, name: "relay-channels", channels: [], total: 0 });
});
// ---- end aliases ----
// 404 处理
app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
});
// 错误处理
app.use((err, req, res, next) => {
    const rid = req.requestId;
    logger_1.logger.error('index', `Unhandled error${rid ? ` [${rid}]` : ''}: ${err.stack || err.message}`);
    (0, http_error_1.sendError)(res, err);
});
/**
 * 每日对账定时器
 * 每天凌晨 2:00 (UTC+8) 自动触发前一天的对账
 * 使用 setInterval 轮询实现，无需额外依赖
 */
function scheduleDailyReconciliation() {
    const RUN_HOUR_UTC8 = 2;
    const CHECK_INTERVAL_MS = 60000; // 每分钟检查一次
    const getNextRunMs = () => {
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
        if (now.getHours() !== RUN_HOUR_UTC8)
            return;
        const todayStr = now.toISOString().slice(0, 10);
        if (lastRunDate === todayStr)
            return;
        lastRunDate = todayStr;
        logger_1.logger.info('reconciliation-cron', `开始每日自动对账（日期: ${todayStr}）`);
        try {
            const result = await reconciliation_service_1.ReconciliationService.triggerReconciliation();
            logger_1.logger.info('reconciliation-cron', `对账完成: batchId=${result.batchId} status=${result.status} matched=${result.matchedOrders} unmatched=${result.unmatchedOrders}`);
        }
        catch (err) {
            logger_1.logger.error('reconciliation-cron', `对账失败: ${err.message || String(err)}`);
        }
    };
    // 初始延迟到下一个 2:00
    const initialDelay = getNextRunMs();
    logger_1.logger.info('reconciliation-cron', `每日对账定时器已注册，首次将在 ${Math.round(initialDelay / 3600000)} 小时后触发`);
    const timer = setInterval(runIfNeeded, CHECK_INTERVAL_MS);
    // 允许进程退出（不阻止关闭）
    timer.unref();
    return timer;
}
/**
 * 中转站默认上游渠道播种（幂等、多渠道）：
 * 遍历内置厂商清单，仅当对应环境变量存在、且数据库中尚无同名渠道时，
 * 自动创建该上游渠道，使中转站开箱即用、开箱即有多厂商路由。
 * 已存在同名渠道时不重复创建，避免覆盖运营人员的配置。
 */
async function seedDefaultRelayChannels() {
    const candidates = [
        {
            name: 'DeepSeek 默认渠道（自动播种）',
            envKey: 'DEEPSEEK_API_KEY',
            provider: 'deepseek',
            baseURL: 'https://api.deepseek.com/v1',
            models: ['deepseek-v4-flash', 'deepseek-v4-pro'],
        },
        {
            name: 'OpenAI 默认渠道（自动播种）',
            envKey: 'OPENAI_API_KEY',
            provider: 'openai',
            baseURL: 'https://api.openai.com/v1',
            models: ['gpt-4o', 'gpt-4o-mini', 'gpt-3.5-turbo'],
        },
        {
            name: '通义千问 默认渠道（自动播种）',
            envKey: 'DASHSCOPE_API_KEY',
            provider: 'dashscope',
            baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
            models: ['qwen-plus', 'qwen-max', 'qwen-turbo', 'qwen-long'],
        },
        {
            name: '腾讯混元 默认渠道（自动播种）',
            envKey: 'HUNYUAN_API_KEY',
            provider: 'hunyuan',
            baseURL: 'https://api.hunyuan.cloud.tencent.com/v1',
            models: ['hunyuan-pro', 'hunyuan-standard', 'hunyuan-lite'],
        },
        {
            name: 'Kimi 默认渠道（自动播种）',
            envKey: 'MOONSHOT_API_KEY',
            provider: 'moonshot',
            baseURL: 'https://api.moonshot.cn/v1',
            models: ['moonshot-v1-8k', 'moonshot-v1-32k', 'moonshot-v1-128k'],
        },
        {
            name: 'Gemini 默认渠道（自动播种）',
            envKey: 'GEMINI_API_KEY',
            provider: 'gemini',
            baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai',
            models: ['gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-pro'],
        },
    ];
    let seeded = 0;
    let refreshed = 0;
    for (const c of candidates) {
        const apiKey = process.env[c.envKey];
        if (!apiKey)
            continue; // 未配置该厂商 Key，跳过
        const exists = await RelayChannel_1.RelayChannel.findOne({ name: c.name });
        if (exists) {
            // 幂等：同名渠道已存在则不重复创建。
            // 仅对 DeepSeek 在库内刷新 models 为真实的 v4 系列（用户要求），不覆盖运营人员其它配置
            if (c.provider === 'deepseek') {
                await RelayChannel_1.RelayChannel.updateOne({ _id: exists._id }, { $set: { models: c.models } });
                refreshed++;
                logger_1.logger.info('index', `已刷新中转站渠道 models（v4 系列）：${c.name}`);
            }
            continue;
        }
        await RelayChannel_1.RelayChannel.create({
            name: c.name,
            provider: c.provider,
            baseURL: c.baseURL,
            apiKey: (0, crypto_1.encryptSecret)(apiKey),
            models: c.models,
            authMode: 'bearer',
            weight: 1,
            enabled: true,
        });
        seeded++;
        logger_1.logger.info('index', `已自动播种中转站渠道：${c.name}`);
    }
    if (seeded === 0 && refreshed === 0) {
        logger_1.logger.warn('index', '未检测到任何上游厂商 API Key，跳过中转站渠道播种');
    }
    else {
        logger_1.logger.info('index', `中转站播种完成，新增 ${seeded} 个、刷新 ${refreshed} 个上游渠道`);
    }
}
function defaultBootstrapDependencies() {
    return {
        validateEnv: env_check_1.validateStartupEnv,
        connectMongo: database_1.connectMongoDB,
        connectRedis: database_1.connectRedis,
        loadMcp: () => mcp_service_1.mcpService.loadFromDB(),
        reloadProviders: ai_gateway_service_1.reloadCustomProviders,
        startMediaWorker: () => queue_service_1.mediaWorker.start(),
        startOutboxWorker: () => outbox_worker_1.OutboxWorker.start(),
        seedRelay: seedDefaultRelayChannels,
        seedKnowledge: seedKnowledge_1.seedKnowledgeSamples,
        startHttpServer: () => {
            // 仅在真实监听 HTTP 时启动长期调度任务；listen=false 的启动门禁不会遗留定时器。
            scheduleDailyReconciliation();
            (0, backup_service_1.startBackupScheduler)();
            (0, dashboard_service_1.startDashboardCollection)();
            (0, apm_2.startApmPersistence)();
            return app.listen(PORT, () => {
                logger_1.logger.info('index', `Server running on http://localhost:${PORT}`, {
                    env: process.env.NODE_ENV || 'development',
                    revision: process.env.APP_COMMIT_SHA || 'unknown',
                });
            });
        },
    };
}
async function startManagedDependency(label, action) {
    try {
        await action();
    }
    catch (error) {
        if (process.env.NODE_ENV === 'production')
            throw error;
        logger_1.logger.warn('index', `${label} 启动失败，非生产环境继续运行: ${error instanceof Error ? error.message : String(error)}`);
    }
}
/**
 * 启动顺序门禁：配置、MongoDB、Redis 全部成功后才启动 Worker 和 HTTP 监听。
 * 生产依赖失败会向上抛错，由容器退出并触发部署回滚，而不是降级 Mock。
 */
async function bootstrap(options = {}) {
    const dependencies = { ...defaultBootstrapDependencies(), ...options.dependencies };
    dependencies.validateEnv();
    await dependencies.connectMongo();
    await dependencies.connectRedis();
    await startManagedDependency('MCP 配置', dependencies.loadMcp);
    await startManagedDependency('自定义 AI Provider', dependencies.reloadProviders);
    await startManagedDependency('媒体任务 Worker', dependencies.startMediaWorker);
    await startManagedDependency('Outbox Worker', async () => { dependencies.startOutboxWorker(); });
    await startManagedDependency('中转站默认渠道', dependencies.seedRelay);
    await startManagedDependency('知识库示例文档', dependencies.seedKnowledge);
    if (options.listen === false)
        return undefined;
    return dependencies.startHttpServer();
}
if (require.main === module) {
    bootstrap().catch((error) => {
        logger_1.logger.error('index', `生产启动失败，进程退出: ${error instanceof Error ? error.stack || error.message : String(error)}`);
        process.exit(1);
    });
}
exports.default = app;
//# sourceMappingURL=index.js.map