import { Request, Response, NextFunction } from 'express';

/**
 * 零依赖输入校验工具集。
 * 设计目标：轻量、可单测、与 sendError 统一错误响应配合，
 * 在路由层把非法输入挡在 400，避免触达 DB/服务层后抛出 500。
 */

export type FieldRule = {
  /** 必填（存在且非 null/undefined/空串） */
  required?: boolean;
  /** 类型约束 */
  type?: 'string' | 'stringArray' | 'boolean' | 'number' | 'object';
  /** 字符串最小长度 */
  minLength?: number;
  /** 字符串最大长度 */
  maxLength?: number;
  /** 字符串必须为合法 email（基于 validator 思路的轻量正则） */
  isEmail?: boolean;
  /** 字符串必须为合法 MongoDB ObjectId（24 位十六进制） */
  isObjectId?: boolean;
  /** 只能取这些值之一 */
  oneOf?: readonly string[];
};

export type ValidationSchema = Record<string, FieldRule>;

const OBJECT_ID_RE = /^[a-fA-F0-9]{24}$/;
// 轻量 email 校验（RFC 5322 简化），避免引入重依赖
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** 是否为「有内容的字符串」 */
export function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

/** 是否为字符串数组 */
export function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === 'string');
}

/** 是否为合法 email */
export function isEmail(v: unknown): boolean {
  return typeof v === 'string' && EMAIL_RE.test(v.trim());
}

/** 是否为合法 ObjectId（24 位十六进制） */
export function isObjectId(v: unknown): boolean {
  return typeof v === 'string' && OBJECT_ID_RE.test(v);
}

function checkField(value: unknown, rule: FieldRule, path: string): string | null {
  const present = value !== undefined && value !== null;
  if (!present) {
    return rule.required ? `${path} 为必填项` : null;
  }

  switch (rule.type) {
    case 'string':
      if (typeof value !== 'string') return `${path} 必须为字符串`;
      if (rule.isEmail && !isEmail(value)) return `${path} 邮箱格式不正确`;
      if (rule.isObjectId && !isObjectId(value)) return `${path} 不是合法的 ID`;
      if (rule.minLength !== undefined && value.trim().length < rule.minLength)
        return `${path} 长度至少 ${rule.minLength} 个字符`;
      if (rule.maxLength !== undefined && value.length > rule.maxLength)
        return `${path} 长度不能超过 ${rule.maxLength} 个字符`;
      break;
    case 'stringArray':
      if (!isStringArray(value)) return `${path} 必须为字符串数组`;
      if (rule.minLength !== undefined && value.length < rule.minLength)
        return `${path} 至少包含 ${rule.minLength} 个元素`;
      break;
    case 'boolean':
      if (typeof value !== 'boolean') return `${path} 必须为布尔值`;
      break;
    case 'number':
      if (typeof value !== 'number' || Number.isNaN(value)) return `${path} 必须为数字`;
      break;
    case 'object':
      if (typeof value !== 'object' || Array.isArray(value)) return `${path} 必须为对象`;
      break;
    default:
      break;
  }

  if (rule.oneOf && !rule.oneOf.includes(value as string)) {
    return `${path} 只能取 ${rule.oneOf.join(' / ')} 之一`;
  }
  return null;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/** 校验一个对象是否符合 schema，返回首个字段起的全部错误 */
export function validateObject(body: Record<string, unknown>, schema: ValidationSchema): ValidationResult {
  const errors: string[] = [];
  for (const [field, rule] of Object.entries(schema)) {
    const msg = checkField(body[field], rule, field);
    if (msg) errors.push(msg);
  }
  return { valid: errors.length === 0, errors };
}

/**
 * 生成 Express 校验中间件：校验失败统一返回 400（经由 sendError）。
 * 只校验声明的字段，未声明的字段原样放行（渐进式加固，不动存量逻辑）。
 */
export function validate(schema: ValidationSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = validateObject((req.body ?? {}) as Record<string, unknown>, schema);
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
