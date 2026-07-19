/**
 * 启动期环境变量校验。
 *
 * 生产环境采用 fail-closed：任何 Mock 开关、基础设施、真实 AI、远程
 * Sandbox 或微信支付凭据缺失时均拒绝启动。测试环境保留固定测试配置。
 */
type EnvLike = Record<string, string | undefined>;
/** 返回生产配置问题，便于启动校验、CI 静态门禁和单元测试复用。 */
export declare function collectStartupEnvErrors(env?: EnvLike): string[];
export declare function assertStartupEnv(env?: EnvLike): void;
export declare function validateStartupEnv(env?: EnvLike): void;
export {};
//# sourceMappingURL=env-check.d.ts.map