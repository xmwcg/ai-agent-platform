import mongoose, { Connection } from 'mongoose';
import Redis from 'ioredis';
import dotenv from 'dotenv';
import { logger } from '../lib/logger';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/ai-agent-platform';
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// MongoDB 连接（可选）
export const connectMongoDB = async (): Promise<Connection> => {
  if (!process.env.MONGODB_URI || process.env.MOCK_MODE === 'true') {
    logger.warn('database', 'MongoDB connection skipped (MOCK_MODE or no URI)');
    return mongoose.connection;
  }

  try {
    await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 3000 });
    logger.info('database', 'MongoDB connected successfully', { uri: MONGODB_URI.replace(/\/\/.*@/, '//<credentials>@') });

    mongoose.connection.on('error', (err) => {
      logger.error('database', 'MongoDB connection error', err);
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('database', 'MongoDB disconnected, trying to reconnect...');
    });

    return mongoose.connection;
  } catch (error: any) {
    logger.error('database', `Failed to connect to MongoDB: ${error.message}`);
    logger.warn('database', 'Server will continue without MongoDB (mock mode)');
    return mongoose.connection; // 不崩溃，继续运行
  }
};

// Redis 连接（带内存降级：连接失败时自动切换到 Map 实现，保证无 Redis 环境可运行）
class MemoryRedis {
  private store = new Map<string, string>();
  private expirations = new Map<string, number>();
  status = 'ready';
  async ping(): Promise<string> { return 'PONG'; }
  async get(key: string): Promise<string | null> {
    this.cleanup(key);
    return this.store.has(key) ? (this.store.get(key) as string) : null;
  }
  async set(key: string, val: string): Promise<'OK'> {
    this.store.set(key, val);
    this.expirations.delete(key);
    return 'OK';
  }
  async setex(key: string, ttl: number, val: string): Promise<'OK'> {
    this.store.set(key, val);
    this.expirations.set(key, Date.now() + ttl * 1000);
    return 'OK';
  }
  async incr(key: string): Promise<number> {
    return this.incrby(key, 1);
  }
  async incrby(key: string, by: number): Promise<number> {
    this.cleanup(key);
    const cur = Number(this.store.get(key) || 0);
    const next = cur + by;
    this.store.set(key, String(next));
    return next;
  }
  async expire(key: string, ttl: number): Promise<number> {
    this.expirations.set(key, Date.now() + ttl * 1000);
    return 1;
  }
  async del(key: string): Promise<number> {
    this.store.delete(key);
    this.expirations.delete(key);
    return 1;
  }
  keys(pattern: string): string[] {
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    return Array.from(this.store.keys()).filter((k) => regex.test(k));
  }
  // Queue 操作（兼容 ioredis 接口）
  async lpush(key: string, ...values: string[]): Promise<number> {
    const arr = this._getList(key);
    // LPUSH 头部插入
    for (const v of values.reverse()) {
      arr.unshift(v);
    }
    this._saveList(key, arr);
    return arr.length;
  }
  async brpop(key: string, timeout: number): Promise<[string, string] | null> {
    const arr = this._getList(key);
    if (arr.length > 0) {
      const val = arr.pop()!;
      this._saveList(key, arr);
      return [key, val];
    }
    // 简易阻塞模拟（MemoryRedis 场景下快速轮询，不真阻塞）
    const deadline = Date.now() + timeout * 1000;
    while (Date.now() < deadline) {
      await new Promise(r => setTimeout(r, 200));
      const arr2 = this._getList(key);
      if (arr2.length > 0) {
        const val = arr2.pop()!;
        this._saveList(key, arr2);
        return [key, val];
      }
    }
    return null; // 超时
  }
  async llen(key: string): Promise<number> {
    return this._getList(key).length;
  }
  /** 建立连接（MemoryRedis 不需要，兼容使用） */
  async connect(): Promise<void> { /* noop */ }
  /** 断开连接（MemoryRedis 不需要，兼容使用） */
  async quit(): Promise<void> { /* noop */ }
  /** 事件监听（内存版不支持） */
  on(_event: string, _cb: Function): void { /* noop */ }
  // 内部辅助
  private _getList(key: string): string[] {
    try {
      return JSON.parse(this.store.get(key) || '[]');
    } catch {
      return [];
    }
  }
  private _saveList(key: string, arr: string[]): void {
    this.store.set(key, JSON.stringify(arr));
  }
  private cleanup(key: string) {
    const exp = this.expirations.get(key);
    if (exp && Date.now() > exp) { this.store.delete(key); this.expirations.delete(key); }
  }
}

const memoryRedis = new MemoryRedis();

// 真实 Redis 客户端
// lazyConnect + 自动重连；启用 TCP keepalive 及时探测并回收僵死（半开）连接，
// 这是此前「连接僵死但 status 仍为 ready、ping 卡死」的根因所在。
const realRedis = new Redis(REDIS_URL, {
  lazyConnect: true,
  connectTimeout: 5000,
  maxRetriesPerRequest: 3, // 命令快速失败，避免无限重试挂起
  retryStrategy: (times: number) => {
    const delay = Math.min(times * 200, 3000);
    logger.warn('redis', `连接断开，重连中（第 ${times} 次，delay ${delay}ms）`);
    return delay; // 始终重试，不放弃
  },
  keepAlive: 30, // 30s TCP keepalive，及时探测并回收僵死（半开）连接
  enableReadyCheck: true,
  noDelay: true,
});

realRedis.on('error', (err: any) => {
  logger.warn('redis', `连接错误: ${err?.message || err}`);
});
realRedis.on('end', () => {
  logger.warn('redis', '连接已断开，retryStrategy 将持续重连');
});

// 主动发起连接（不阻塞启动；失败由 retryStrategy 兜底重连）
(realRedis as any).connect?.()
  ?.catch?.((err: any) => logger.warn('redis', `初始连接失败，将持续重连: ${err?.message || err}`));

function isRedisReady(): boolean {
  return (realRedis as any).status === 'ready';
}

/**
 * Redis 代理：
 * - 真实连接可用时透传真实 Redis；
 * - 断开时自动降级内存版（配额/限流仍可用）；
 * - 一旦真实连接恢复（status 变 ready），后续调用自动切回真实 Redis。
 *
 * 取代原「10s 后永久替换为 MemoryRedis」逻辑——该逻辑会导致连接一旦错过
 * 启动窗口就永久走内存、且无法恢复，也无法区分「真不可用」与「僵死」。
 */
const redisClient: any = new Proxy({}, {
  get(_target, prop: string | symbol) {
    if (typeof prop === 'symbol') {
      return (realRedis as any)[prop];
    }
    const backend = isRedisReady() ? realRedis : memoryRedis;
    const value = (backend as any)[prop];
    if (typeof value === 'function') {
      return (...args: any[]) => value.apply(backend, args);
    }
    return value;
  },
});

export { redisClient, realRedis };

// 健康检查
/**
 * 给可能挂起的 Promise 加超时：避免底层连接僵死（如 Redis 半开 socket、
 * MongoDB 卡住）时，健康检查/自检无限等待，导致 /api/health 永不返回、
 * Docker 健康检查误判 unhealthy、部署门禁卡死。
 */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`${label} health check timeout after ${ms}ms`)),
      ms
    );
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      }
    );
  });
}

export const checkDatabaseHealth = async (): Promise<{ mongodb: boolean; redis: boolean }> => {
  const result = {
    mongodb: false,
    redis: false
  };
  
  // Check MongoDB（带超时，连接僵死时不会无限挂起）
  try {
    if (mongoose.connection.readyState === 1 && mongoose.connection.db) {
      await withTimeout(mongoose.connection.db.admin().ping() as Promise<unknown>, 1500, 'mongodb');
    }
    result.mongodb = mongoose.connection.readyState === 1;
  } catch (error) {
    console.error('❌ MongoDB health check failed:', error);
  }
  
  // Check Redis（带超时保护）
  // 仅对真实连接做 ping；若真实连接僵死（ping 超时），强制断开触发重连，
  // 避免半开连接一直卡住、健康检查误报且无法自愈。
  try {
    if (isRedisReady()) {
      await withTimeout(realRedis.ping() as Promise<string>, 1500, 'redis');
      result.redis = true;
    } else {
      result.redis = false;
    }
  } catch (error) {
    logger.error('database', 'Redis health ping 超时（可能僵死），强制断开以触发重连', error as any);
    try { (realRedis as any).disconnect?.(); } catch { /* ignore */ }
    try { (realRedis as any).connect?.().catch?.(() => {}); } catch { /* ignore */ }
    result.redis = false;
  }
  
  return result;
};

// 优雅关闭
export const closeDatabases = async (): Promise<void> => {
  try {
    await mongoose.disconnect();
    console.log('✅ MongoDB disconnected');
    
    await redisClient.quit();
    console.log('✅ Redis disconnected');
  } catch (error) {
    console.error('❌ Error closing databases:', error);
  }
};

// 进程信号处理
process.on('SIGINT', async () => {
  console.log('\n⚠️  Received SIGINT, closing databases...');
  await closeDatabases();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n⚠️  Received SIGTERM, closing databases...');
  await closeDatabases();
  process.exit(0);
});

export default {
  connectMongoDB,
  redisClient,
  checkDatabaseHealth,
  closeDatabases
};
