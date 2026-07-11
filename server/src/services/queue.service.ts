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
import { redisClient } from '../config/database';
import { logger } from '../lib/logger';
import { EventEmitter } from 'events';

// ─── 常量 ───
const QUEUE_PREFIX = 'jobq:';
const JOBS_PREFIX = 'jobq:jobs:';
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_RETRY_DELAY_MS = 5000;

// ─── 类型 ───
export interface Job<T = any> {
  id: string;
  name: string;
  data: T;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  progress: number; // 0-100
  result?: any;
  error?: string;
  attempts: number;
  maxRetries: number;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
}

export interface JobHandler<T = any> {
  (data: T, job: Job<T>): Promise<any>;
}

// ─── Queue ───
export class JobQueue {
  public name: string;
  private queueKey: string;

  constructor(name: string) {
    this.name = name;
    this.queueKey = `${QUEUE_PREFIX}${name}`;
  }

  /** 提交任务到队列，返回 jobId */
  async add<T = any>(jobName: string, data: T, options?: { maxRetries?: number }): Promise<string> {
    const id = `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const job: Job<T> = {
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
      logger.info('queue', `[${this.name}] 任务入队: ${id} (${jobName})`);
      return id;
    } catch (e: any) {
      logger.error('queue', `[${this.name}] 入队失败: ${e.message}`);
      throw e;
    }
  }

  /** 获取任务详情 */
  async getJob(id: string): Promise<Job | null> {
    try {
      const raw = await redisClient.get(`${JOBS_PREFIX}${id}`);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  /** 获取队列长度 */
  async length(): Promise<number> {
    try {
      return await redisClient.llen(this.queueKey);
    } catch {
      return 0;
    }
  }

  /** 清空队列 */
  async clear(): Promise<void> {
    try {
      await redisClient.del(this.queueKey);
    } catch { /* 忽略 */ }
  }
}

// ─── Worker ───
export interface WorkerOptions {
  /** 最多同时处理的任务数 */
  concurrency?: number;
  /** 轮询超时（秒），BRPOP 阻塞等待 */
  pollTimeout?: number;
}

export class JobWorker extends EventEmitter {
  private queue: JobQueue;
  private handlers = new Map<string, JobHandler>();
  private running = false;
  private concurrency: number;
  private pollTimeout: number;
  private activeJobs = 0;

  constructor(queue: JobQueue, options: WorkerOptions = {}) {
    super();
    this.queue = queue;
    this.concurrency = options.concurrency ?? 1;
    this.pollTimeout = options.pollTimeout ?? 5;
  }

  /** 注册任务处理器 */
  register(name: string, handler: JobHandler): this {
    this.handlers.set(name, handler);
    return this;
  }

  /** 启动 Worker */
  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;
    logger.info('queue', `[${this.queue.name}] Worker 启动 (concurrency=${this.concurrency})`);
    // 启动多个并发消费循环
    for (let i = 0; i < this.concurrency; i++) {
      this.consume().catch(e => logger.error('queue', `Worker 消费异常: ${e.message}`));
    }
  }

  /** 停止 Worker */
  async stop(): Promise<void> {
    this.running = false;
    logger.info('queue', `[${this.queue.name}] Worker 停止`);
  }

  /** 核心消费循环 */
  private async consume(): Promise<void> {
    while (this.running) {
      try {
        // BRPOP 阻塞等待新任务（无任务时阻塞 pollTimeout 秒）
        const queueKey = `${QUEUE_PREFIX}${this.queue.name}`;
        const result = await redisClient.brpop(queueKey, this.pollTimeout);
        if (!result) continue; // 超时无任务

        const [, jobId] = result;
        this.activeJobs++;
        this.processJob(jobId).finally(() => { this.activeJobs--; });
      } catch (e: any) {
        if (this.running) {
          logger.error('queue', `Worker 消费错: ${e.message}`);
          await this.sleep(1000);
        }
      }
    }
  }

  /** 处理单个任务 */
  private async processJob(jobId: string): Promise<void> {
    const job = await this.queue.getJob(jobId);
    if (!job || job.status === 'completed') return;

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
      logger.info('queue', `[${this.queue.name}] 任务完成: ${jobId} (${job.name})`);
    } catch (error: any) {
      if (job.attempts < job.maxRetries) {
        // 重试：重新入队
        job.status = 'queued';
        job.error = error.message;
        await this.saveJob(job);
        logger.warn('queue', `[${this.queue.name}] 任务重试 (${job.attempts}/${job.maxRetries}): ${jobId}`);
        await this.sleep(DEFAULT_RETRY_DELAY_MS);
        try { await redisClient.lpush(`${QUEUE_PREFIX}${this.queue.name}`, jobId); } catch { /* ignore */ }
        this.emit('job:retrying', job);
      } else {
        await this.failJob(job, error.message);
      }
    }
  }

  private async failJob(job: Job, error: string): Promise<void> {
    job.status = 'failed';
    job.error = error;
    job.completedAt = Date.now();
    await this.saveJob(job);
    this.emit('job:failed', job);
    logger.error('queue', `[${this.queue.name}] 任务最终失败: ${job.id}: ${error}`);
  }

  private async saveJob(job: Job): Promise<void> {
    try {
      await redisClient.set(
        `${JOBS_PREFIX}${job.id}`,
        JSON.stringify(job),
        'EX',
        86400 * 7
      );
    } catch { /* 忽略持久化失败 */ }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ─── 全局单例 ───
export const mediaQueue = new JobQueue('media-gen');
export const mediaWorker = new JobWorker(mediaQueue, { concurrency: 2 });
