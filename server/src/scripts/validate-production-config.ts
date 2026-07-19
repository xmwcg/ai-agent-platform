/**
 * CNB / 运维侧生产配置静态门禁。
 *
 * 只输出通过/失败项名称，不打印任何密钥、证书或连接串明文。
 */
import crypto from 'crypto';
import dotenv from 'dotenv';
import { assertStartupEnv } from '../config/env-check';

function normalizePem(value: string): string {
  if (!value) return "";
  let cleaned = value.trim();
  if ((cleaned.startsWith("\"") && cleaned.endsWith("\"")) || (cleaned.startsWith("'") && cleaned.endsWith("'"))) {
    cleaned = cleaned.slice(1, -1);
  }
  cleaned = cleaned.replace(/\\n/g, "\n");
  return cleaned.trim();
}

function assertProtocol(name: string, value: string, protocols: string[]): void {
  let protocol = '';
  try {
    protocol = new URL(value).protocol;
  } catch {
    throw new Error(`${name} 不是有效 URL`);
  }
  if (!protocols.includes(protocol)) {
    throw new Error(`${name} 必须使用 ${protocols.join(' 或 ')}`);
  }
}

export function validateProductionCredentials(env: NodeJS.ProcessEnv = process.env): void {
  assertStartupEnv(env);

  assertProtocol('MONGODB_URI', env.MONGODB_URI!, ['mongodb:', 'mongodb+srv:']);
  assertProtocol('REDIS_URL', env.REDIS_URL!, ['redis:', 'rediss:']);
  assertProtocol('PUBLIC_BASE_URL', env.PUBLIC_BASE_URL!, ['https:']);
  assertProtocol('SANDBOX_REMOTE_URL', env.SANDBOX_REMOTE_URL!, ['https:', 'http:']);

  const privateKey = crypto.createPrivateKey(normalizePem(env.WECHAT_PRIVATE_KEY!));
  if (privateKey.asymmetricKeyType !== 'rsa') {
    throw new Error('WECHAT_PRIVATE_KEY 必须是 RSA 商户私钥');
  }

  const platformCertificate = new crypto.X509Certificate(
    normalizePem(env.WECHAT_PLATFORM_CERT!)
  );
  if (!platformCertificate.serialNumber) {
    throw new Error('WECHAT_PLATFORM_CERT 缺少可识别的证书序列号');
  }
  if (platformCertificate.publicKey.asymmetricKeyType !== 'rsa') {
    throw new Error('WECHAT_PLATFORM_CERT 必须包含 RSA 公钥');
  }
}

if (require.main === module) {
  try {
    dotenv.config({ path: process.env.PRODUCTION_ENV_FILE || '.env' });
    validateProductionCredentials();
    console.log(JSON.stringify({
      success: true,
      environment: 'production',
      mockMode: false,
      paymentProvider: 'wechat',
      sandboxMode: 'remote',
      checks: [
        'startup-environment',
        'managed-database-url',
        'managed-redis-url',
        'https-public-url',
        'https-remote-sandbox',
        'wechat-rsa-private-key',
        'wechat-platform-certificate',
      ],
    }));
  } catch (error) {
    console.error(`生产配置静态校验失败：${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}
