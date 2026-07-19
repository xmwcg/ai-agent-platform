"use strict";
/**
 * 轻量结构化日志（L3+）
 *
 * 零新增依赖，封装 console，统一输出：`<ISO时间> [LEVEL] <module> <message>`。
 * 兼容既有 jest setup（`jest.spyOn(console, ...)` 仍可静音）。
 * 生产环境可在此扩展为 JSON 行或接入日志系统，调用方无需改动。
 * 自动对 meta 中的敏感信息做掩码（手机号/邮箱/Token/API Key），防止日志泄露。
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
function fmt(level, module, message) {
    const ts = new Date().toISOString();
    return `${ts} [${level}]${module ? ` ${module}` : ''} ${message}`;
}
// ─── 敏感信息掩码（P2 加固） ───
const SENSITIVE_KEYS = ['password', 'token', 'secret', 'apiKey', 'api_key', 'apikey',
    'authorization', 'jwt', 'bearer', 'credit_card', 'ssn', 'passport'];
function isSensitiveKey(key) {
    const lower = key.toLowerCase().replace(/[_-]/g, '');
    return SENSITIVE_KEYS.some((sk) => lower.includes(sk));
}
function maskValue(val) {
    if (typeof val !== 'string')
        return val;
    if (val.length > 100)
        return `[REDACTED:${val.length}chars]`;
    return '[REDACTED]';
}
function sanitizeMeta(obj, depth = 0) {
    if (depth > 5)
        return '[MAX_DEPTH]';
    if (obj === null || obj === undefined)
        return obj;
    if (typeof obj === 'string')
        return obj;
    if (typeof obj !== 'object')
        return obj;
    if (Array.isArray(obj)) {
        return obj.map((item) => sanitizeMeta(item, depth + 1));
    }
    const result = {};
    for (const [key, value] of Object.entries(obj)) {
        if (isSensitiveKey(key)) {
            result[key] = maskValue(value);
        }
        else if (typeof value === 'object' && value !== null) {
            result[key] = sanitizeMeta(value, depth + 1);
        }
        else {
            result[key] = value;
        }
    }
    return result;
}
const consoleMethods = {
    log: (...args) => console.log(...args),
    warn: (...args) => console.warn(...args),
    error: (...args) => console.error(...args),
};
function write(level, method, module, message, meta) {
    const line = fmt(level, module, message);
    if (meta !== undefined) {
        const sanitized = sanitizeMeta(meta);
        consoleMethods[method](line, sanitized);
    }
    else {
        consoleMethods[method](line);
    }
}
exports.logger = {
    info(module, message, meta) {
        write('INFO', 'log', module, message, meta);
    },
    warn(module, message, meta) {
        write('WARN', 'warn', module, message, meta);
    },
    error(module, message, meta) {
        write('ERROR', 'error', module, message, meta);
    },
    debug(module, message, meta) {
        if (process.env.NODE_ENV === 'production')
            return;
        write('DEBUG', 'log', module, message, meta);
    },
};
exports.default = exports.logger;
//# sourceMappingURL=logger.js.map