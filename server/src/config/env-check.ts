/**
 * 启动期环境变量校验（L4）
 *
 * 目的：避免用弱占位 JWT_SECRET 直接上线（此前 .env 默认值为
 * `dev-secret-key-change-in-production`，任何人都可伪造 Token）。
 * - 测试环境（NODE_ENV==='test'）放行，不影响 CI 单测。
 * - 生产 / 开发环境若使用已知弱值或为空，则拒绝启动（exit 1）并打印明确指引。
 */

const WEAK_JWT_SECRETS = new Set([
  '',
  'dev-secret-key-change-in-production',
  'changeme',
  'secret',
  'test',
]);

export function validateStartupEnv(): void {
  // 测试环境不强制（以保持单测可在固定测试密钥下运行）
  if (process.env.NODE_ENV === 'test') return;

  const secret = process.env.JWT_SECRET || '';
  if (WEAK_JWT_SECRETS.has(secret.trim())) {
    const isProd = process.env.NODE_ENV === 'production';
    const msg =
      '⚠️/❌ JWT_SECRET 为弱占位值或为空，任何人可伪造 Token。\n' +
      '   请设置强随机密钥：JWT_SECRET=$(openssl rand -base64 48)\n' +
      (isProd ? '   生产环境拒绝启动。' : '   开发环境仅告警，应用继续运行。');
    if (isProd) {
      // eslint-disable-next-line no-console
      console.error(msg);
      process.exit(1);
    }
    // eslint-disable-next-line no-console
    console.warn(msg);
  }
}
