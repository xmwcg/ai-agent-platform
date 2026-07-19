/**
 * 轻量结构化日志（L3+）
 *
 * 零新增依赖，封装 console，统一输出：`<ISO时间> [LEVEL] <module> <message>`。
 * 兼容既有 jest setup（`jest.spyOn(console, ...)` 仍可静音）。
 * 生产环境可在此扩展为 JSON 行或接入日志系统，调用方无需改动。
 * 自动对 meta 中的敏感信息做掩码（手机号/邮箱/Token/API Key），防止日志泄露。
 */
export declare const logger: {
    info(module: string, message: string, meta?: unknown): void;
    warn(module: string, message: string, meta?: unknown): void;
    error(module: string, message: string, meta?: unknown): void;
    debug(module: string, message: string, meta?: unknown): void;
};
export default logger;
//# sourceMappingURL=logger.d.ts.map