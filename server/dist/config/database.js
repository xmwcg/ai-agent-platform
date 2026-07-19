"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.closeDatabases = exports.checkDatabaseHealth = exports.realRedis = exports.redisClient = exports.connectMongoDB = void 0;
exports.connectRedis = connectRedis;
exports.isUsingMemoryRedis = isUsingMemoryRedis;
exports.getQueueRedis = getQueueRedis;
const mongoose_1 = __importDefault(require("mongoose"));
const ioredis_1 = __importDefault(require("ioredis"));
const dotenv_1 = __importDefault(require("dotenv"));
const logger_1 = require("../lib/logger");
dotenv_1.default.config();
const isProduction = () => process.env.NODE_ENV === 'production';
const mongoUri = () => process.env.MONGODB_URI || 'mongodb://localhost:27017/ai-agent-platform';
const redisUrl = () => process.env.REDIS_URL || 'redis://localhost:6379';
let mongoListenersRegistered = false;
// MongoDB 连接：生产环境必须成功，开发/测试可显式跳过。
const connectMongoDB = async () => {
    if (!process.env.MONGODB_URI || process.env.MOCK_MODE === 'true') {
        if (isProduction()) {
            throw new Error('生产环境必须配置并连接 MONGODB_URI，且 MOCK_MODE 不得启用');
        }
        logger_1.logger.warn('database', 'MongoDB connection skipped outside production');
        return mongoose_1.default.connection;
    }
    const uri = mongoUri();
    try {
        await mongoose_1.default.connect(uri, { serverSelectionTimeoutMS: 5000 });
        logger_1.logger.info('database', 'MongoDB connected successfully', { uri: uri.replace(/\/\/.*@/, '//<credentials>@') });
        if (!mongoListenersRegistered) {
            mongoListenersRegistered = true;
            mongoose_1.default.connection.on('error', (err) => {
                logger_1.logger.error('database', 'MongoDB connection error', err);
            });
            mongoose_1.default.connection.on('disconnected', () => {
                logger_1.logger.error('database', 'MongoDB disconnected');
            });
        }
        return mongoose_1.default.connection;
    }
    catch (error) {
        logger_1.logger.error('database', `Failed to connect to MongoDB: ${error.message}`);
        if (isProduction())
            throw error;
        logger_1.logger.warn('database', 'MongoDB unavailable outside production; continuing for local/test use');
        return mongoose_1.default.connection;
    }
};
exports.connectMongoDB = connectMongoDB;
// Redis 连接：生产环境必须使用真实 Redis；仅开发/测试允许进程内存替身。
class MemoryRedis {
    constructor() {
        this.store = new Map();
        this.expirations = new Map();
        this.status = 'ready';
    }
    async ping() { return 'PONG'; }
    async get(key) {
        this.cleanup(key);
        return this.store.has(key) ? this.store.get(key) : null;
    }
    async set(key, val) {
        this.store.set(key, val);
        this.expirations.delete(key);
        return 'OK';
    }
    async setex(key, ttl, val) {
        this.store.set(key, val);
        this.expirations.set(key, Date.now() + ttl * 1000);
        return 'OK';
    }
    async incr(key) {
        return this.incrby(key, 1);
    }
    async incrby(key, by) {
        this.cleanup(key);
        const cur = Number(this.store.get(key) || 0);
        const next = cur + by;
        this.store.set(key, String(next));
        return next;
    }
    async expire(key, ttl) {
        this.expirations.set(key, Date.now() + ttl * 1000);
        return 1;
    }
    async del(key) {
        this.store.delete(key);
        this.expirations.delete(key);
        return 1;
    }
    keys(pattern) {
        const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
        return Array.from(this.store.keys()).filter((k) => regex.test(k));
    }
    // Queue 操作（兼容 ioredis 接口）
    async lpush(key, ...values) {
        const arr = this._getList(key);
        // LPUSH 头部插入
        for (const v of values.reverse()) {
            arr.unshift(v);
        }
        this._saveList(key, arr);
        return arr.length;
    }
    async brpop(key, timeout) {
        const arr = this._getList(key);
        if (arr.length > 0) {
            const val = arr.pop();
            this._saveList(key, arr);
            return [key, val];
        }
        // 简易阻塞模拟（MemoryRedis 场景下快速轮询，不真阻塞）
        const deadline = Date.now() + timeout * 1000;
        while (Date.now() < deadline) {
            await new Promise(r => setTimeout(r, 200));
            const arr2 = this._getList(key);
            if (arr2.length > 0) {
                const val = arr2.pop();
                this._saveList(key, arr2);
                return [key, val];
            }
        }
        return null; // 超时
    }
    async llen(key) {
        return this._getList(key).length;
    }
    /** 建立连接（MemoryRedis 不需要，兼容使用） */
    async connect() { }
    /** 断开连接（MemoryRedis 不需要，兼容使用） */
    async quit() { }
    /** 事件监听（内存版不支持） */
    on(_event, _cb) { }
    // 内部辅助
    _getList(key) {
        try {
            return JSON.parse(this.store.get(key) || '[]');
        }
        catch {
            return [];
        }
    }
    _saveList(key, arr) {
        this.store.set(key, JSON.stringify(arr));
    }
    cleanup(key) {
        const exp = this.expirations.get(key);
        if (exp && Date.now() > exp) {
            this.store.delete(key);
            this.expirations.delete(key);
        }
    }
}
const memoryRedis = new MemoryRedis();
// 真实 Redis 客户端。仅由 connectRedis() 在启动门禁中主动连接。
const realRedis = new ioredis_1.default(redisUrl(), {
    lazyConnect: true,
    connectTimeout: 5000,
    maxRetriesPerRequest: 3,
    retryStrategy: (times) => {
        const delay = Math.min(times * 200, 3000);
        logger_1.logger.warn('redis', `连接断开，重连中（第 ${times} 次，delay ${delay}ms）`);
        return delay;
    },
    keepAlive: 30,
    enableReadyCheck: true,
    noDelay: true,
});
exports.realRedis = realRedis;
realRedis.on('error', (err) => {
    logger_1.logger.warn('redis', `连接错误: ${err?.message || err}`);
});
realRedis.on('end', () => {
    logger_1.logger.error('redis', '连接已断开');
});
realRedis.on('ready', () => {
    logger_1.logger.info('redis', 'Redis connected');
});
let useMemoryRedis = !isProduction();
async function connectRedis() {
    if (!process.env.REDIS_URL || process.env.MOCK_MODE === 'true') {
        if (isProduction()) {
            throw new Error('生产环境必须配置并连接 REDIS_URL，且 MOCK_MODE 不得启用');
        }
        useMemoryRedis = true;
        logger_1.logger.warn('redis', 'Redis connection skipped outside production; using MemoryRedis');
        return memoryRedis;
    }
    try {
        // 仅在未连接态（wait/lazy 初始、end 已断开）触发 connect；
        // connecting/ready 态再调用 connect() 会抛 "already connecting/connected"。
        const status = realRedis.status;
        if (status === 'wait' || status === 'end') {
            await realRedis.connect();
        }
        const pong = await withTimeout(realRedis.ping(), 5000, 'redis startup');
        if (pong !== 'PONG')
            throw new Error(`unexpected Redis ping response: ${pong}`);
        useMemoryRedis = false;
        return realRedis;
    }
    catch (error) {
        logger_1.logger.error('redis', `Failed to connect to Redis: ${error?.message || error}`);
        if (isProduction())
            throw error;
        useMemoryRedis = true;
        logger_1.logger.warn('redis', 'Redis unavailable outside production; using MemoryRedis');
        return memoryRedis;
    }
}
function isUsingMemoryRedis() {
    return useMemoryRedis;
}
function isRedisReady() {
    return realRedis.status === 'ready';
}
async function probeRedisHealth() {
    if (useMemoryRedis)
        return !isProduction();
    // 1) 主连接就绪则直接 ping；记录主连接是否成功响应（用于自愈判定）
    let mainOk = false;
    if (isRedisReady()) {
        try {
            mainOk = (await withTimeout(realRedis.ping(), 1500, 'redis')) === 'PONG';
            if (mainOk)
                return true;
        }
        catch {
            // 主连接 ping 失败，落到独立探测 + 自愈
        }
    }
    // 2) 独立探测连接（每次新建），真实反映 Redis 可用性，不受主连接僵死影响。
    //    主连接可能因偶发网络抖动（如 DNS EAI_AGAIN、TCP 半开）而卡死，
    //    此时 status 仍为 'ready'（ESTABLISHED 但命令挂起），不应让 /api/health
    //    永久误判 disconnected（进而被 Docker 标记为 unhealthy）。
    let probeOk = false;
    try {
        const probe = new ioredis_1.default(redisUrl(), {
            lazyConnect: true,
            connectTimeout: 1500,
            maxRetriesPerRequest: 1,
            retryStrategy: () => null, // 探测不重连，一次性判定
            enableReadyCheck: false,
        });
        const pong = await withTimeout(probe.ping(), 1500, 'redis-probe');
        probe.disconnect();
        probeOk = pong === 'PONG';
    }
    catch {
        probeOk = false;
    }
    // 3) Redis 实际可用但主连接僵死时，主动断开并重建主连接实现自愈。
    //    ⚠️ 关键修正：仅当主连接「确实未就绪」(status 不是 'ready'，即已 end/wait/
    //    连接失败) 才拆连接重建；若 status 仍为 'ready' 只是单次 ping 超时（网络抖动），
    //    「绝不」硬拆健康连接——否则每轮探测都把正常连接断开重建，导致队列 brpop 在
    //    断连窗口反复刷 "Connection is closed"。半开连接交由 ioredis keepAlive +
    //    命令超时自行检测并重连。
    const mainStatus = realRedis.status;
    if (probeOk && !mainOk && mainStatus !== 'ready') {
        logger_1.logger.warn('redis', `主连接状态 ${mainStatus} 异常但探测可达，触发自愈重建`);
        realRedis.disconnect?.();
        realRedis.connect?.().catch(() => { });
    }
    return probeOk;
}
/**
 * Redis 代理：生产环境永远指向真实 Redis，绝不降级到进程内存；
 * 开发/测试在 connectRedis 未连接或失败时可使用 MemoryRedis。
 */
const redisClient = new Proxy({}, {
    get(_target, prop) {
        const backend = isProduction() || (!useMemoryRedis && isRedisReady()) ? realRedis : memoryRedis;
        const value = backend[prop];
        if (typeof value === 'function') {
            return (...args) => value.apply(backend, args);
        }
        return value;
    },
});
exports.redisClient = redisClient;
// 队列专用独立 Redis 连接：避免 /api/health 自愈逻辑对 realRedis 执行
// disconnect()/reconnect() 时，正在阻塞 BRPOP 的 Worker 被踢出而每秒报错
// （"Connection is closed"）。队列使用独立实例，自愈的断开/重连互不干扰。
let queueRedisInstance = null;
function getQueueRedis() {
    // 非生产且使用内存 Redis：直接复用（无网络抖动问题）
    if (!isProduction())
        return useMemoryRedis ? memoryRedis : realRedis;
    if (!queueRedisInstance) {
        queueRedisInstance = new ioredis_1.default(redisUrl(), {
            lazyConnect: true,
            connectTimeout: 5000,
            maxRetriesPerRequest: 3,
            retryStrategy: (times) => Math.min(times * 200, 3000),
            keepAlive: 30,
            enableReadyCheck: true,
            noDelay: true,
        });
        queueRedisInstance.on('error', (err) => logger_1.logger.warn('redis', `queue redis 错误: ${err?.message || err}`));
        queueRedisInstance.connect?.().catch(() => { });
    }
    return queueRedisInstance;
}
// 健康检查
/**
 * 给可能挂起的 Promise 加超时：避免底层连接僵死（如 Redis 半开 socket、
 * MongoDB 卡住）时，健康检查/自检无限等待，导致 /api/health 永不返回、
 * Docker 健康检查误判 unhealthy、部署门禁卡死。
 */
function withTimeout(promise, ms, label) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`${label} health check timeout after ${ms}ms`)), ms);
        promise.then((v) => {
            clearTimeout(timer);
            resolve(v);
        }, (e) => {
            clearTimeout(timer);
            reject(e);
        });
    });
}
const checkDatabaseHealth = async () => {
    const result = {
        mongodb: false,
        redis: false
    };
    // Check MongoDB（带超时，连接僵死时不会无限挂起）
    try {
        if (mongoose_1.default.connection.readyState === 1 && mongoose_1.default.connection.db) {
            await withTimeout(mongoose_1.default.connection.db.admin().ping(), 1500, 'mongodb');
        }
        result.mongodb = mongoose_1.default.connection.readyState === 1;
    }
    catch (error) {
        console.error('❌ MongoDB health check failed:', error);
    }
    // Check Redis：用独立探测连接（每次新建），真实反映 Redis 可用性，
    // 不受主连接僵死影响；主连接自身由 retryStrategy + keepalive 自愈。
    try {
        result.redis = await probeRedisHealth();
    }
    catch (error) {
        logger_1.logger.error('database', 'Redis health check failed', error);
        result.redis = false;
    }
    return result;
};
exports.checkDatabaseHealth = checkDatabaseHealth;
// 优雅关闭
const closeDatabases = async () => {
    try {
        await mongoose_1.default.disconnect();
        console.log('✅ MongoDB disconnected');
        if (realRedis.status !== 'wait' && realRedis.status !== 'end') {
            await realRedis.quit();
        }
        console.log('✅ Redis disconnected');
    }
    catch (error) {
        console.error('❌ Error closing databases:', error);
    }
};
exports.closeDatabases = closeDatabases;
// 进程信号处理
process.on('SIGINT', async () => {
    console.log('\n⚠️  Received SIGINT, closing databases...');
    await (0, exports.closeDatabases)();
    process.exit(0);
});
process.on('SIGTERM', async () => {
    console.log('\n⚠️  Received SIGTERM, closing databases...');
    await (0, exports.closeDatabases)();
    process.exit(0);
});
exports.default = {
    connectMongoDB: exports.connectMongoDB,
    connectRedis,
    redisClient,
    checkDatabaseHealth: exports.checkDatabaseHealth,
    closeDatabases: exports.closeDatabases
};
//# sourceMappingURL=database.js.map