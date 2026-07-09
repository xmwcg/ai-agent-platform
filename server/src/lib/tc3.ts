/**
 * 腾讯云 API 3.0 签名（TC3-HMAC-SHA256）—— 公共签名库
 *
 * 此前该算法在 `services/media-gen.service.ts` 与 `gateway/ai-gateway.service.ts`
 * 各有一份复制实现（L8）。现抽到此处共用，保证：
 *   - 一致性：混元「媒体生成」与「大模型对话」走完全相同的签名逻辑；
 *   - 可单测：纯函数，相同输入得到相同签名（幂等）。
 */
import crypto from 'crypto';

export interface TC3SignOptions {
  secretId: string;
  secretKey: string;
  service: string; // 如 'hunyuan'
  host: string; // 如 'hunyuan.tencentcloudapi.com'
  action: string; // 如 'ChatCompletions' / 'SubmitVideoGenerationJob'
  version: string; // 如 '2023-09-01'
  region: string; // 如 'ap-guangzhou'
  payload: string; // JSON 字符串
  timestamp: number; // 秒级
}

export interface TC3SignResult {
  authorization: string;
  timestamp: number;
}

export function sha256Hex(s: string): string {
  return crypto.createHash('sha256').update(s, 'utf8').digest('hex');
}

export function hmacHex(key: string | Buffer, data: string): string {
  return crypto.createHmac('sha256', key).update(data, 'utf8').digest('hex');
}

/**
 * 腾讯云 API 3.0 签名（TC3-HMAC-SHA256）。
 * 返回 Authorization 头与所用时间戳，幂等可测：相同输入得到相同签名。
 */
export function signTencentTC3(opts: TC3SignOptions): TC3SignResult {
  const { secretId, secretKey, service, host, action, version, region, payload, timestamp } = opts;
  const date = new Date(timestamp * 1000).toISOString().slice(0, 10); // YYYY-MM-DD
  const hashedPayload = sha256Hex(payload);
  const canonicalHeaders = `content-type:application/json; charset=utf-8\nhost:${host}\n`;
  const signedHeaders = 'content-type;host';
  const canonicalRequest = `POST\n/\n\n${canonicalHeaders}\n${signedHeaders}\n${hashedPayload}`;
  const credentialScope = `${date}/${service}/tc3_request`;
  const hashedCanonical = sha256Hex(canonicalRequest);
  const stringToSign = `TC3-HMAC-SHA256\n${timestamp}\n${credentialScope}\n${hashedCanonical}`;
  const secretDate = hmacHex('TC3' + secretKey, date);
  const secretService = hmacHex(secretDate, service);
  const secretSigning = hmacHex(secretService, 'tc3_request');
  const signature = hmacHex(secretSigning, stringToSign);
  const authorization = `TC3-HMAC-SHA256 Credential=${secretId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
  return { authorization, timestamp };
}
