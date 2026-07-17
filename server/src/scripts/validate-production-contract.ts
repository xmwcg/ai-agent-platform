/**
 * CI-only production configuration contract check.
 *
 * It generates ephemeral, non-routable fixture values and verifies that the
 * production validator accepts the expected URL, key and certificate shapes.
 * Real production credentials never need to enter build/test stages.
 */
import crypto from 'crypto';
import tls from 'tls';
import { validateProductionCredentials } from './validate-production-config';

function rsaFixtureCertificate(): string {
  const certificate = tls.rootCertificates.find((pem) => {
    try {
      return new crypto.X509Certificate(pem).publicKey.asymmetricKeyType === 'rsa';
    } catch {
      return false;
    }
  });
  if (!certificate) {
    throw new Error('Node.js trust store 中没有可用的 RSA 契约测试证书');
  }
  return certificate;
}

export function createStaticProductionContractEnv(): NodeJS.ProcessEnv {
  const { privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    privateKeyEncoding: { format: 'pem', type: 'pkcs8' },
    publicKeyEncoding: { format: 'pem', type: 'spki' },
  });

  return {
    NODE_ENV: 'production',
    ENABLE_MOCK_MODE: 'false',
    MOCK_MODE: 'false',
    DEFAULT_PAY_PROVIDER: 'wechat',
    SANDBOX_MODE: 'remote',
    SANDBOX_REMOTE_URL: 'https://sandbox.aibak.invalid',
    SANDBOX_REMOTE_TOKEN: 'ci-contract-placeholder-not-a-production-token',
    MONGODB_URI: 'mongodb+srv://ci-contract:placeholder@mongodb.aibak.invalid/aibak',
    REDIS_URL: 'rediss://ci-contract:placeholder@redis.aibak.invalid:6380',
    PUBLIC_BASE_URL: 'https://www.aibak.invalid',
    JWT_SECRET: 'ci-contract-jwt-placeholder-'.padEnd(64, 'x'),
    ENCRYPTION_KEY: 'a'.repeat(64),
    DEEPSEEK_API_KEY: 'ci-contract-placeholder-not-a-production-api-key',
    NOTIFY_CHANNEL: 'disabled',
    WECHAT_MCH_ID: '1900000001',
    WECHAT_APP_ID: 'wx-ci-contract-app-id',
    WECHAT_API_V3_KEY: 'k'.repeat(32),
    WECHAT_CERT_SERIAL: 'CI-CONTRACT-SERIAL',
    WECHAT_PRIVATE_KEY: privateKey,
    WECHAT_PLATFORM_CERT: rsaFixtureCertificate(),
  };
}

export function validateStaticProductionContract(): void {
  validateProductionCredentials(createStaticProductionContractEnv());
}

if (require.main === module) {
  try {
    validateStaticProductionContract();
    console.log(JSON.stringify({
      success: true,
      environment: 'ci-static-contract',
      productionSecretsUsed: false,
      mockMode: false,
      paymentProvider: 'wechat',
      sandboxMode: 'remote',
      checks: [
        'startup-environment-contract',
        'managed-database-url-contract',
        'managed-redis-url-contract',
        'https-public-url-contract',
        'https-remote-sandbox-contract',
        'wechat-rsa-private-key-contract',
        'wechat-platform-certificate-contract',
      ],
    }));
  } catch (error) {
    console.error(`生产配置契约校验失败：${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}
