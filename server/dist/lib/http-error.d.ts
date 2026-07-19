import { Response } from 'express';
/**
 * 统一业务错误：对外暴露安全信息，内部细节仅服务端记录。
 */
export declare class AppError extends Error {
    statusCode: number;
    code: string;
    /** 可安全返回给客户端的信息（不含堆栈 / 内部路径 / 密钥等） */
    safeMessage: string;
    constructor(statusCode: number, safeMessage: string, code?: string, internalDetail?: string);
}
/**
 * 统一错误响应：避免把内部 err.message（可能含 DB 连接串 / 路径 / 密钥）泄露到生产环境。
 * 生产环境也必须在日志中记录真实错误，否则排查无从下手。
 */
export declare function sendError(res: Response, error: unknown): void;
//# sourceMappingURL=http-error.d.ts.map