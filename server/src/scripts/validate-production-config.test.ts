import crypto from 'crypto';
import tls from 'tls';
import { validateProductionCredentials } from './validate-production-config';

function rsaRootCertificate(): string {
  const certificate = tls.rootCertificates.find((pem) => {
    try {
      return new crypto.X509Certificate(pem).publicKey.asymmetricKeyType === 'rsa';
    } catch {
      return false;
    }
  });
  if (!certificate) throw new Error('Node.js trust store 中没有可用 RSA 测试证书');
  return certificate;
}

function validProductionEnv(): NodeJS.ProcessEnv {
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
    SANDBOX_REMOTE_URL: 'https://sandbox.internal.example',
    SANDBOX_REMOTE_TOKEN: 'sandbox-token',
    MONGODB_URI: 'mongodb+srv://example.invalid/aibak',
    REDIS_URL: 'rediss://example.invalid:6380',
    PUBLIC_BASE_URL: 'https://aibak.site',
    JWT_SECRET: 'j'.repeat(64),
    ENCRYPTION_KEY: 'a'.repeat(64),
    DEEPSEEK_API_KEY: 'real-provider-test-key',
    NOTIFY_CHANNEL: 'disabled',
    WECHAT_MCH_ID: '1900000001',
    WECHAT_APP_ID: 'wx-test-app-id',
    WECHAT_API_V3_KEY: 'k'.repeat(32),
    WECHAT_CERT_SERIAL: 'TEST-SERIAL',
    WECHAT_PRIVATE_KEY: privateKey,
    WECHAT_PLATFORM_CERT: rsaRootCertificate(),
  };
}

describe('production configuration static validator', () => {
  it('accepts managed URLs, RSA merchant key and X.509 platform certificate', () => {
    expect(() => validateProductionCredentials(validProductionEnv())).not.toThrow();
  });

  it('rejects non-MongoDB database protocol', () => {
    const env = validProductionEnv();
    env.MONGODB_URI = 'https://database.example';
    expect(() => validateProductionCredentials(env)).toThrow(/MONGODB_URI 必须使用/);
  });

  it('rejects non-TLS public and remote sandbox URLs', () => {
    const env = validProductionEnv();
    env.SANDBOX_REMOTE_URL = 'http://sandbox.internal.example';
    expect(() => validateProductionCredentials(env)).toThrow(/SANDBOX_REMOTE_URL 必须是有效的 HTTPS 地址/);
  });

  it('rejects a non-RSA merchant private key', () => {
    const env = validProductionEnv();
    const { privateKey } = crypto.generateKeyPairSync('ec', {
      namedCurve: 'prime256v1',
      privateKeyEncoding: { format: 'pem', type: 'pkcs8' },
      publicKeyEncoding: { format: 'pem', type: 'spki' },
    });
    env.WECHAT_PRIVATE_KEY = privateKey;
    expect(() => validateProductionCredentials(env)).toThrow(/RSA 商户私钥/);
  });

  it('rejects a public key in place of the required X.509 platform certificate', () => {
    const env = validProductionEnv();
    const { publicKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      privateKeyEncoding: { format: 'pem', type: 'pkcs8' },
      publicKeyEncoding: { format: 'pem', type: 'spki' },
    });
    env.WECHAT_PLATFORM_CERT = publicKey;
    expect(() => validateProductionCredentials(env)).toThrow();
  });
});
