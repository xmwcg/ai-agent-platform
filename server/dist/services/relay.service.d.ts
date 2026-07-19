/** 中转站统一错误 */
export declare class RelayError extends Error {
    status: number;
    constructor(message: string, status?: number);
}
/** 令牌只存哈希，明文仅在发放时返回一次 */
export declare function hashToken(token: string): string;
export declare function generateToken(): string;
/** 核心：把金网通的 OpenAI 兼容请求转发到上游，并记账 */
export declare function proxyChatCompletions(token: string, body: any): Promise<any>;
/** OpenAI 兼容：列出所有启用渠道的模型 */
export declare function listModels(token: string): Promise<string[]>;
export declare function getAdminPasswordHash(): Promise<string | null>;
export declare function setAdminPassword(pwd: string): Promise<void>;
/** 校验中转站管理员密码；若从未设置，则把本次密码作为初始密码并返回 true */
export declare function verifyAdminLogin(pwd: string): Promise<boolean>;
//# sourceMappingURL=relay.service.d.ts.map