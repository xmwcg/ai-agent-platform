"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppError = void 0;
exports.sendError = sendError;
const logger_1 = require("./logger");
/**
 * 统一业务错误：对外暴露安全信息，内部细节仅服务端记录。
 */
class AppError extends Error {
    constructor(statusCode, safeMessage, code = 'APP_ERROR', internalDetail) {
        super(internalDetail || safeMessage);
        this.name = 'AppError';
        this.statusCode = statusCode;
        this.code = code;
        this.safeMessage = safeMessage;
        if (Error.captureStackTrace)
            Error.captureStackTrace(this, AppError);
    }
}
exports.AppError = AppError;
/** 是否应把内部错误详情透传给客户端（仅开发/测试环境） */
function shouldExposeDetail() {
    const env = process.env.NODE_ENV;
    return env === 'development' || env === 'test';
}
/**
 * 统一错误响应：避免把内部 err.message（可能含 DB 连接串 / 路径 / 密钥）泄露到生产环境。
 * 生产环境也必须在日志中记录真实错误，否则排查无从下手。
 */
function sendError(res, error) {
    if (error instanceof AppError) {
        if (error.statusCode >= 500) {
            logger_1.logger.error('http-error', `AppError(${error.code}) ${error.message}`);
        }
        else {
            logger_1.logger.warn('http-error', `AppError(${error.code}) ${error.safeMessage}`);
        }
        res.status(error.statusCode).json({
            success: false,
            error: shouldExposeDetail() ? error.safeMessage : error.safeMessage,
            code: error.code,
        });
        return;
    }
    const err = error instanceof Error ? error : new Error(String(error));
    logger_1.logger.error('http-error', `未知错误 [${err.name}]: ${err.message}`);
    const exposed = shouldExposeDetail() ? err.message : '服务器内部错误，请稍后重试';
    res.status(500).json({
        success: false,
        error: exposed,
        code: 'INTERNAL_ERROR',
    });
}
//# sourceMappingURL=http-error.js.map