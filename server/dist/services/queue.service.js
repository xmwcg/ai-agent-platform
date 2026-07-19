"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mediaWorker = exports.mediaQueue = exports.JobWorker = exports.JobQueue = void 0;
/**
 * 轻量级异步任务队列（基于 Redis Lists）
 * 零新依赖：复用现有 ioredis，兼顾低延迟和持久化。
 *
 * 用途：
 * - 媒体生成（文生图/视频）：异步提交，后台处理，前端轮询结果
 * - 文件转换（未来）：长任务异步化
 * - 邮件/通知等不阻塞请求的异步作业
 *
 * 架构：
 *   [Producer] → Redis List (LPUSH) → [Worker] (BRPOP) → executeJob → [Result DB]
 *
 * 生产级考虑：单 Worker 适合中小流量（< 1000 QPS 异步任务），大流量可水平扩展更多 Worker 实例。
 */
const database_1 = require("../config/database");
// 队列使用独立 Redis 连接，避免 /api/health 自愈逻辑对主连接执行
// disconnect() 时正在阻塞 BRPOP 的 Worker 被踢出（"Connection is closed"）。
const redisClient = (0, database_1.getQueueRedis)();
const logger_1 = require("../lib/logger");
const events_1 = require("events");
// ─── 常量 ───
const QUEUE_PREFIX = 'jobq:';
const JOBS_PREFIX = 'jobq:jobs:';
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_RETRY_DELAY_MS = 5000;
// ─── Queue ───
class JobQueue {
    constructor(name) {
        this.name = name;
        this.queueKey = `${QUEUE_PREFIX}${name}`;
    }
    /** 提交任务到队列，返回 jobId */
    async add(jobName, data, options) {
        const id = `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const job = {
            id,
            name: jobName,
            data,
            status: 'queued',
            progress: 0,
            attempts: 0,
            maxRetries: options?.maxRetries ?? DEFAULT_MAX_RETRIES,
            createdAt: Date.now(),
        };
        try {
            // 持久化 job 元数据
            await redisClient.set(`${JOBS_PREFIX}${id}`, JSON.stringify(job), 'EX', 86400 * 7); // 7 天 TTL
            // 入队
            await redisClient.lpush(this.queueKey, id);
            logger_1.logger.info('queue', `[${this.name}] 任务入队: ${id} (${jobName})`);
            return id;
        }
        catch (e) {
            logger_1.logger.error('queue', `[${this.name}] 入队失败: ${e.message}`);
            throw e;
        }
    }
    /** 获取任务详情 */
    async getJob(id) {
        try {
            const raw = await redisClient.get(`${JOBS_PREFIX}${id}`);
            return raw ? JSON.parse(raw) : null;
        }
        catch {
            return null;
        }
    }
    /** 获取队列长度 */
    async length() {
        try {
            return await redisClient.llen(this.queueKey);
        }
        catch {
            return 0;
        }
    }
    /** 清空队列 */
    async clear() {
        try {
            await redisClient.del(this.queueKey);
        }
        catch { /* 忽略 */ }
    }
}
exports.JobQueue = JobQueue;
class JobWorker extends events_1.EventEmitter {
    constructor(queue, options = {}) {
        super();
        this.handlers = new Map();
        this.running = false;
        this.activeJobs = 0;
        this.queue = queue;
        this.concurrency = options.concurrency ?? 1;
        this.pollTimeout = options.pollTimeout ?? 5;
    }
    /** 注册任务处理器 */
    register(name, handler) {
        this.handlers.set(name, handler);
        return this;
    }
    /** 启动 Worker */
    async start() {
        if (this.running)
            return;
        this.running = true;
        logger_1.logger.info('queue', `[${this.queue.name}] Worker 启动 (concurrency=${this.concurrency})`);
        // 启动多个并发消费循环
        for (let i = 0; i < this.concurrency; i++) {
            this.consume().catch(e => logger_1.logger.error('queue', `Worker 消费异常: ${e.message}`));
        }
    }
    /** 停止 Worker */
    async stop() {
        this.running = false;
        logger_1.logger.info('queue', `[${this.queue.name}] Worker 停止`);
    }
    /** 核心消费循环 */
    async consume() {
        while (this.running) {
            try {
                // BRPOP 阻塞等待新任务（无任务时阻塞 pollTimeout 秒）
                const queueKey = `${QUEUE_PREFIX}${this.queue.name}`;
                const result = await redisClient.brpop(queueKey, this.pollTimeout);
                if (!result)
                    continue; // 超时无任务
                const [, jobId] = result;
                this.activeJobs++;
                this.processJob(jobId).finally(() => { this.activeJobs--; });
            }
            catch (e) {
                if (this.running) {
                    logger_1.logger.error('queue', `Worker 消费错: ${e.message}`);
                    await this.sleep(1000);
                }
            }
        }
    }
    /** 处理单个任务 */
    async processJob(jobId) {
        const job = await this.queue.getJob(jobId);
        if (!job || job.status === 'completed')
            return;
        const handler = this.handlers.get(job.name);
        if (!handler) {
            await this.failJob(job, `未知任务类型: ${job.name}`);
            return;
        }
        // 更新状态
        job.status = 'processing';
        job.attempts++;
        job.startedAt = Date.now();
        await this.saveJob(job);
        this.emit('job:started', job);
        try {
            job.result = await handler(job.data, job);
            job.status = 'completed';
            job.progress = 100;
            job.completedAt = Date.now();
            await this.saveJob(job);
            this.emit('job:completed', job);
            logger_1.logger.info('queue', `[${this.queue.name}] 任务完成: ${jobId} (${job.name})`);
        }
        catch (error) {
            if (job.attempts < job.maxRetries) {
                // 重试：重新入队
                job.status = 'queued';
                job.error = error.message;
                await this.saveJob(job);
                logger_1.logger.warn('queue', `[${this.queue.name}] 任务重试 (${job.attempts}/${job.maxRetries}): ${jobId}`);
                await this.sleep(DEFAULT_RETRY_DELAY_MS);
                try {
                    await redisClient.lpush(`${QUEUE_PREFIX}${this.queue.name}`, jobId);
                }
                catch { /* ignore */ }
                this.emit('job:retrying', job);
            }
            else {
                await this.failJob(job, error.message);
            }
        }
    }
    async failJob(job, error) {
        job.status = 'failed';
        job.error = error;
        job.completedAt = Date.now();
        await this.saveJob(job);
        this.emit('job:failed', job);
        logger_1.logger.error('queue', `[${this.queue.name}] 任务最终失败: ${job.id}: ${error}`);
    }
    async saveJob(job) {
        try {
            await redisClient.set(`${JOBS_PREFIX}${job.id}`, JSON.stringify(job), 'EX', 86400 * 7);
        }
        catch { /* 忽略持久化失败 */ }
    }
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
exports.JobWorker = JobWorker;
// ─── 全局单例 ───
exports.mediaQueue = new JobQueue('media-gen');
exports.mediaWorker = new JobWorker(exports.mediaQueue, { concurrency: 2 });
//# sourceMappingURL=queue.service.js.map