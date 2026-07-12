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

let redisClient: any;
try {
  redisClient = new Redis(REDIS_URL, {
    retryStrategy: (times: number) => {
      const delay = Math.min(times * 50, 2000);
      console.log(`🔄 Redis reconnecting... attempt ${times}, delay ${delay}ms`);
      return delay;
    },
    maxRetriesPerRequest: 3,
    lazyConnect: true,
    enableOfflineQueue: false, // 连接断开时命令立即报错（由各调用方 catch 降级），不无限挂起
    connectTimeout: 5000,
    keepAlive: 5000, // TCP keepalive 5s 初始延迟（避免 30s 会导致健康检查 15s 轮询让 socket 永不空闲）
    noDelay: true,
  });
  // 若 10s 内未连上则降级为内存版（给 Redis 充足的启动时间）
  const fallbackTimer = setTimeout(() => {
    if (redisClient.status !== 'ready') {
      console.warn('⚠️  Redis 不可用（10s 超时），已降级为内存模式（配额/限流仍可用）');
      redisClient = new MemoryRedis() as any;
    }
  }, 10000);
  redisClient.on('ready', () => { clearTimeout(fallbackTimer); console.log('✅ Redis connected'); });
  redisClient.on('error', (err: any) => { console.warn(`Redis 连接错误: ${err?.message || err}`); });
  redisClient.connect().catch((err: any) => { console.warn(`Redis connect 失败: ${err?.message || err}`); });
} catch {
  redisClient = new MemoryRedis() as any;
}

export { redisClient };

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
  
  // Check Redis（带超时 + 半开连接自动重连）
  // 半开连接下 status 仍是 'ready' 但 ping 挂死 → 不能依赖 status 门控
  try {
    const isReady = redisClient && redisClient.status === 'ready';
    if (isReady) {
      await withTimeout(Promise.resolve(redisClient.ping()), 1500, 'redis');
    }
    result.redis = isReady;
  } catch (error) {
    console.error('❌ Redis health check failed:', error);
    result.redis = false;
    // 半开连接自动重连：ping 超时说明底层 socket 已死，主动断开并重连
    try {
      if (redisClient && typeof redisClient.disconnect === 'function') {
        redisClient.disconnect();
      }
      if (redisClient && typeof redisClient.connect === 'function') {
        redisClient.connect().catch(() => {});
      }
    } catch { /* 重连失败不影响主流程 */ }
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
