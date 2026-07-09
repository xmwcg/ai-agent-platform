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
  });
  // 若 1.5s 内未连上则降级为内存版
  const fallbackTimer = setTimeout(() => {
    if (redisClient.status !== 'ready') {
      console.warn('⚠️  Redis 不可用，已降级为内存模式（配额/限流仍可用）');
      redisClient = new MemoryRedis() as any;
    }
  }, 1500);
  redisClient.on('ready', () => { clearTimeout(fallbackTimer); console.log('✅ Redis connected'); });
  redisClient.on('error', () => { /* 静默，等待 fallback */ });
  redisClient.connect().catch(() => { /* 等待 fallback */ });
} catch {
  redisClient = new MemoryRedis() as any;
}

export { redisClient };

// 健康检查
export const checkDatabaseHealth = async (): Promise<{ mongodb: boolean; redis: boolean }> => {
  const result = {
    mongodb: false,
    redis: false
  };
  
  // Check MongoDB
  try {
    if (mongoose.connection.db) {
      await mongoose.connection.db.admin().ping();
    }
    result.mongodb = mongoose.connection.readyState === 1;
  } catch (error) {
    console.error('❌ MongoDB health check failed:', error);
  }
  
  // Check Redis
  try {
    await redisClient.ping();
    result.redis = redisClient.status === 'ready';
  } catch (error) {
    console.error('❌ Redis health check failed:', error);
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
