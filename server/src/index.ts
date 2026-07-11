import express, { Express, Request, Response, NextFunction } from 'express';
import path from 'path';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import { apiLimiter } from './middleware/rate-limit';
import { buildCorsOptions } from './middleware/cors-config';
import { buildHelmetOptions } from './middleware/security-headers';

// 导入数据库配置
import { connectMongoDB, redisClient, checkDatabaseHealth } from './config/database';
import { validateStartupEnv } from './config/env-check';

// 导入路由
import aiRoutes from './routes/ai';
import knowledgeRoutes from './routes/knowledge';
import ragRoutes from './routes/rag';
import ragPipelineRoutes from './routes/rag-pipeline';
import courseRoutes from './routes/courses';
import codeExplanationRoutes from './routes/code-explanation';
import authRoutes from './routes/auth';
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
import { mcpService } from './services/mcp.service';
import { sendError } from './lib/http-error';
import { logger } from './lib/logger';

// 加载环境变量
dotenv.config();

// 启动期安全校验：弱 JWT_SECRET / 缺失关键变量则拒绝启动（test 环境豁免）
validateStartupEnv();

const app: Express = express();
const PORT = process.env.PORT || 3000;

// 应用位于反代（nginx）之后，需信任 X-Forwarded-* 头；否则 express-rate-limit
// 收到 X-Forwarded-For 会抛错，导致走域名访问的所有受限流路由返回 500。
app.set('trust proxy', 1);

// 中间件
app.use(cors(buildCorsOptions(process.env.CLIENT_URL)));
app.use(helmet(buildHelmetOptions(process.env.NODE_ENV)));
app.use(compression());

// ⚠️ Webhook 路由必须获取原始请求体做 HMAC 验签，放在 express.json() 之前
// 支付网关（Stripe/微信）签名是对原始字节流计算的，JSON 二次序列化会破坏签名
app.use('/api/billing/webhook', express.raw({ type: 'application/json' }));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(morgan('dev'));

// 限流（全局 API）
app.use('/api/', apiLimiter);

// 连接数据库
connectMongoDB().catch(err => {
  logger.error('index', `Failed to connect to MongoDB: ${err}`);
  logger.warn('index', 'Server will continue without database (mock mode)');
  // process.exit(1); // 注释掉，让服务器继续运行
});

// 启动时加载已持久化的 MCP 服务器配置
mcpService.loadFromDB().catch(err => {
  logger.warn('index', `MCP config load skipped: ${err.message}`);
});

// 启动时加载用户配置的第三方模型（接入第三方模型 API 闭环）
import { reloadCustomProviders } from './gateway/ai-gateway.service';
reloadCustomProviders().catch(err => {
  logger.warn('index', `自定义模型加载跳过：${err.message}`);
});

// 启动异步任务队列 Worker（媒体生成 / 文件转换等长任务后台处理）
import { mediaWorker } from './services/queue.service';
mediaWorker.start().catch(err => {
  logger.warn('index', `任务队列 Worker 启动失败: ${err.message}`);
});

// 注册路由
app.use('/api/auth', authRoutes);
app.use('/api/compare', compareRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/knowledge', knowledgeRoutes);
app.use('/api/rag', ragRoutes);
app.use('/api/rag', ragPipelineRoutes); // RAG Pipeline（上传/导入/批量处理）
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
app.use('/api/agent', agentRoutes);
app.use('/api/gateway', aiGatewayRoutes);
app.use('/api/knowledge-graph', knowledgeGraphRoutes);
app.use('/api/sandbox', sandboxRoutes);
app.use('/api/xhs', xhsRoutes);
app.use('/api/mcp', mcpRoutes);
app.use('/api/text2img', text2imgRoutes);
app.use('/api/media-keys', mediaByokRoutes); // 媒体生成 BYOK（用户自带 Key）管理

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
app.get('/api/health', async (req: Request, res: Response) => {
  const health = await checkDatabaseHealth();
  res.json({
    status: 'healthy',
    mongodb: health.mongodb ? 'connected' : 'disconnected',
    redis: health.redis ? 'connected' : 'disconnected',
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
  logger.error('index', `Unhandled error: ${err.stack || err.message}`);
  sendError(res, err);
});

// 启动服务器
app.listen(PORT, () => {
  logger.info('index', `Server running on http://localhost:${PORT}`, { env: process.env.NODE_ENV || 'development' });
});

export default app;
