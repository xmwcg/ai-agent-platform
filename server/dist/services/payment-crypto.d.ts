/** Stripe 风格验签：HMAC-SHA256 over `${t}.${rawBody}`，与 Webhook Secret 比较 */
export declare function verifyStripeSignature(rawBody: string, header: string, secret: string): {
    valid: boolean;
    timestamp?: number;
};
/** 微信支付 v3 回调报文解密（AES-256-GCM，APIv3 密钥） */
export declare function decryptWeChatResource(ciphertext: string, nonce: string, associatedData: string, apiV3Key: string): Record<string, unknown>;
/** 微信支付回调签名验证（RSA-SHA256 over `${timestamp}\n${nonce}\n${body}\n`，用平台证书公钥） */
export declare function verifyWeChatSignature(timestamp: string, nonce: string, body: string, signature: string, publicKeyPem: string): boolean;
/** 将裸 base64 密钥补全为 PEM 格式（兼容用户直接粘贴支付宝控制台的无头密钥） */
export declare function normalizeAlipayPem(key: string, type: 'PRIVATE' | 'PUBLIC'): string;
/** 支付宝要求北京时间（UTC+8）格式 yyyy-MM-dd HH:mm:ss */
export declare function alipayBeijingTimestamp(now?: number): string;
/** 支付宝请求签名：按 key 升序拼接 `k=v&k=v`（排除 sign 与空值），RSA-SHA256 → base64 */
export declare function alipaySign(params: Record<string, string>, privateKeyPem: string): string;
/** 支付宝异步通知验签：排除 sign / sign_type，按 key 升序拼接后用支付宝公钥验证 */
export declare function alipayVerify(params: Record<string, string>, publicKeyPem: string): boolean;
//# sourceMappingURL=payment-crypto.d.ts.map