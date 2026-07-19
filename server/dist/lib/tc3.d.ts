export interface TC3SignOptions {
    secretId: string;
    secretKey: string;
    service: string;
    host: string;
    action: string;
    version: string;
    region: string;
    payload: string;
    timestamp: number;
}
export interface TC3SignResult {
    authorization: string;
    timestamp: number;
}
export declare function sha256Hex(s: string): string;
export declare function hmacHex(key: string | Buffer, data: string): string;
/**
 * 腾讯云 API 3.0 签名（TC3-HMAC-SHA256）。
 * 返回 Authorization 头与所用时间戳，幂等可测：相同输入得到相同签名。
 */
export declare function signTencentTC3(opts: TC3SignOptions): TC3SignResult;
//# sourceMappingURL=tc3.d.ts.map