import { Connection } from 'mongoose';
import Redis from 'ioredis';
export declare const connectMongoDB: () => Promise<Connection>;
declare const realRedis: Redis;
export declare function connectRedis(): Promise<any>;
export declare function isUsingMemoryRedis(): boolean;
/**
 * Redis 代理：生产环境永远指向真实 Redis，绝不降级到进程内存；
 * 开发/测试在 connectRedis 未连接或失败时可使用 MemoryRedis。
 */
declare const redisClient: any;
export { redisClient, realRedis };
export declare function getQueueRedis(): any;
export declare const checkDatabaseHealth: () => Promise<{
    mongodb: boolean;
    redis: boolean;
}>;
export declare const closeDatabases: () => Promise<void>;
declare const _default: {
    connectMongoDB: () => Promise<Connection>;
    connectRedis: typeof connectRedis;
    redisClient: any;
    checkDatabaseHealth: () => Promise<{
        mongodb: boolean;
        redis: boolean;
    }>;
    closeDatabases: () => Promise<void>;
};
export default _default;
//# sourceMappingURL=database.d.ts.map