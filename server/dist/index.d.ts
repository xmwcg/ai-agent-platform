import { Express } from 'express';
import type { Server } from 'http';
declare const app: Express;
export interface BootstrapDependencies {
    validateEnv: () => void;
    connectMongo: () => Promise<unknown>;
    connectRedis: () => Promise<unknown>;
    loadMcp: () => Promise<unknown>;
    reloadProviders: () => Promise<unknown>;
    startMediaWorker: () => Promise<unknown>;
    startOutboxWorker: () => void;
    seedRelay: () => Promise<unknown>;
    seedKnowledge: () => Promise<unknown>;
    startHttpServer: () => Server;
}
export interface BootstrapOptions {
    listen?: boolean;
    /** 仅用于启动顺序测试；生产运行使用默认真实依赖。 */
    dependencies?: Partial<BootstrapDependencies>;
}
/**
 * 启动顺序门禁：配置、MongoDB、Redis 全部成功后才启动 Worker 和 HTTP 监听。
 * 生产依赖失败会向上抛错，由容器退出并触发部署回滚，而不是降级 Mock。
 */
export declare function bootstrap(options?: BootstrapOptions): Promise<Server | undefined>;
export default app;
//# sourceMappingURL=index.d.ts.map