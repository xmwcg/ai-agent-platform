"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isNonEmptyString = isNonEmptyString;
exports.isStringArray = isStringArray;
exports.isEmail = isEmail;
exports.isObjectId = isObjectId;
exports.validateObject = validateObject;
exports.validate = validate;
const OBJECT_ID_RE = /^[a-fA-F0-9]{24}$/;
// 轻量 email 校验（RFC 5322 简化），避免引入重依赖
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** 是否为「有内容的字符串」 */
function isNonEmptyString(v) {
    return typeof v === 'string' && v.trim().length > 0;
}
/** 是否为字符串数组 */
function isStringArray(v) {
    return Array.isArray(v) && v.every((x) => typeof x === 'string');
}
/** 是否为合法 email */
function isEmail(v) {
    return typeof v === 'string' && EMAIL_RE.test(v.trim());
}
/** 是否为合法 ObjectId（24 位十六进制） */
function isObjectId(v) {
    return typeof v === 'string' && OBJECT_ID_RE.test(v);
}
function checkField(value, rule, path) {
    const present = value !== undefined && value !== null;
    if (!present) {
        return rule.required ? `${path} 为必填项` : null;
    }
    switch (rule.type) {
        case 'string':
            if (typeof value !== 'string')
                return `${path} 必须为字符串`;
            if (rule.isEmail && !isEmail(value))
                return `${path} 邮箱格式不正确`;
            if (rule.isObjectId && !isObjectId(value))
                return `${path} 不是合法的 ID`;
            if (rule.pattern && !new RegExp(rule.pattern).test(value))
                return `${path} 格式不正确`;
            if (rule.minLength !== undefined && value.trim().length < rule.minLength)
                return `${path} 长度至少 ${rule.minLength} 个字符`;
            if (rule.maxLength !== undefined && value.length > rule.maxLength)
                return `${path} 长度不能超过 ${rule.maxLength} 个字符`;
            break;
        case 'stringArray':
            if (!isStringArray(value))
                return `${path} 必须为字符串数组`;
            if (rule.minLength !== undefined && value.length < rule.minLength)
                return `${path} 至少包含 ${rule.minLength} 个元素`;
            break;
        case 'boolean':
            if (typeof value !== 'boolean')
                return `${path} 必须为布尔值`;
            break;
        case 'number':
            if (typeof value !== 'number' || Number.isNaN(value))
                return `${path} 必须为数字`;
            break;
        case 'object':
            if (typeof value !== 'object' || Array.isArray(value))
                return `${path} 必须为对象`;
            break;
        default:
            break;
    }
    if (rule.oneOf && !rule.oneOf.includes(value)) {
        return `${path} 只能取 ${rule.oneOf.join(' / ')} 之一`;
    }
    return null;
}
/** 校验一个对象是否符合 schema，返回首个字段起的全部错误 */
function validateObject(body, schema) {
    const errors = [];
    for (const [field, rule] of Object.entries(schema)) {
        const msg = checkField(body[field], rule, field);
        if (msg)
            errors.push(msg);
    }
    return { valid: errors.length === 0, errors };
}
/**
 * 生成 Express 校验中间件：校验失败统一返回 400（经由 sendError）。
 * 只校验声明的字段，未声明的字段原样放行（渐进式加固，不动存量逻辑）。
 */
function validate(schema) {
    return (req, res, next) => {
        const result = validateObject((req.body ?? {}), schema);
        if (!result.valid) {
            // 使用 AppError 的 400 + 安全文案；错误内容本身由校验生成，可安全返回
            res.status(400).json({
                success: false,
                error: result.errors.join('；'),
                code: 'VALIDATION_ERROR',
            });
            return;
        }
        next();
    };
}
//# sourceMappingURL=validation.js.map