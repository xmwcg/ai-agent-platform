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
    /** 字符串必须匹配的正则（字符串类型时生效） */
    pattern?: string;
    /** 只能取这些值之一 */
    oneOf?: readonly string[];
};
export type ValidationSchema = Record<string, FieldRule>;
/** 是否为「有内容的字符串」 */
export declare function isNonEmptyString(v: unknown): v is string;
/** 是否为字符串数组 */
export declare function isStringArray(v: unknown): v is string[];
/** 是否为合法 email */
export declare function isEmail(v: unknown): boolean;
/** 是否为合法 ObjectId（24 位十六进制） */
export declare function isObjectId(v: unknown): boolean;
export interface ValidationResult {
    valid: boolean;
    errors: string[];
}
/** 校验一个对象是否符合 schema，返回首个字段起的全部错误 */
export declare function validateObject(body: Record<string, unknown>, schema: ValidationSchema): ValidationResult;
/**
 * 生成 Express 校验中间件：校验失败统一返回 400（经由 sendError）。
 * 只校验声明的字段，未声明的字段原样放行（渐进式加固，不动存量逻辑）。
 */
export declare function validate(schema: ValidationSchema): (req: Request, res: Response, next: NextFunction) => void;
//# sourceMappingURL=validation.d.ts.map