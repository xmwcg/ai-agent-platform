/** 从 hex 字符串构造密钥 Buffer（供外部脚本显式传入双密钥）。 */
export declare function keyFromHex(hex: string): Buffer;
export interface CryptoOpts {
    /** 显式指定密钥（用于轮换脚本）。不传则使用当前 ENCRYPTION_KEY。 */
    key?: Buffer;
}
/** 加密明文。空值原样返回，避免把空串写成密文。 */
export declare function encryptSecret(plaintext: string, opts?: CryptoOpts): string;
/**
 * 解密密文。
 *   - 无前缀的明文（迁移期老数据）原样返回。
 *   - 未显式指定密钥且当前密钥解密失败，则尝试历史密钥 ENCRYPTION_KEY_PREV。
 *   - 显式指定 key 时只使用该密钥（不回退），便于轮换脚本确定性解密。
 */
export declare function decryptSecret(payload: string, opts?: CryptoOpts): string;
/** 是否密文（用于判断是否需要解密）。 */
export declare function isEncrypted(payload: string): boolean;
//# sourceMappingURL=crypto.d.ts.map