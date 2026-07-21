"use strict";
/**
 * 启动期环境变量校验。
 *
 * 生产环境采用 fail-closed：任何 Mock 开关、基础设施、真实 AI、远程
 * Sandbox 或微信支付凭据缺失时均拒绝启动。测试环境保留固定测试配置。
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.collectStartupEnvErrors = collectStartupEnvErrors;
exports.assertStartupEnv = assertStartupEnv;
exports.validateStartupEnv = validateStartupEnv;
const WEAK_JWT_SECRETS = new Set([
    '',
    'dev-secret-key-change-in-production',
    'changeme',
    'secret',
    'test',
]);
const AI_KEY_NAMES = [
    'OPENAI_API_KEY',
    'ANTHROPIC_API_KEY',
    'DEEPSEEK_API_KEY',
    'ZHIPU_API_KEY',
    'QWEN_API_KEY',
    'DASHSCOPE_API_KEY',
    'DOUBAO_API_KEY',
    'ARK_API_KEY',
    'AGNES_API_KEY',
    'CLOUDBASE_FREE_API_KEY',
];
const WECHAT_REQUIRED = [
    'WECHAT_MCH_ID',
    'WECHAT_APP_ID',
    'WECHAT_API_V3_KEY',
    'WECHAT_CERT_SERIAL',
    'WECHAT_PRIVATE_KEY',
    'WECHAT_PLATFORM_CERT',
];
function present(env, key) {
    return Boolean(env[key]?.trim());
}
function isHttpsUrl(value) {
    if (!value)
        return false;
    try {
        return new URL(value).protocol === 'https:';
    }
    catch {
        return false;
    }
}
/** 允许 HTTPS 或内部 HTTP（localhost、私有IP、Docker 网络）的 Sandbox URL */
function isValidSandboxUrl(value) {
    if (!value)
        return false;
    try {
        const url = new URL(value);
        if (url.protocol === 'https:')
            return true;
        if (url.protocol === 'http:') {
            const host = url.hostname;
            if (host === 'localhost' || host === '127.0.0.1' ||
                host.startsWith('172.') || host.startsWith('10.') ||
                host.startsWith('192.168.') || host === 'sandbox-executor' ||
                host.endsWith('.internal')) {
                return true;
            }
        }
        return false;
    }
    catch {
        return false;
    }
}
/** 返回生产配置问题，便于启动校验、CI 静态门禁和单元测试复用。 */
function collectStartupEnvErrors(env = process.env) {
    const errors = [];
    if (env.NODE_ENV !== 'production') {
        errors.push('NODE_ENV 必须为 production');
        return errors;
    }
    if (env.ENABLE_MOCK_MODE !== 'false') {
        errors.push('ENABLE_MOCK_MODE 必须显式设置为 false');
    }
    if (env.MOCK_MODE === 'true') {
        errors.push('MOCK_MODE 在生产环境不得为 true');
    }
    if (env.DEFAULT_PAY_PROVIDER !== 'wechat') {
        errors.push('DEFAULT_PAY_PROVIDER 必须为 wechat');
    }
    if (env.SANDBOX_MODE !== 'remote') {
        errors.push('SANDBOX_MODE 必须为 remote');
    }
    if (!isValidSandboxUrl(env.SANDBOX_REMOTE_URL)) {
        errors.push('SANDBOX_REMOTE_URL 必须是有效的 HTTPS 地址或内部 HTTP 地址');
    }
    if (!present(env, 'SANDBOX_REMOTE_TOKEN')) {
        errors.push('SANDBOX_REMOTE_TOKEN 未配置');
    }
    for (const key of ['MONGODB_URI', 'REDIS_URL', 'PUBLIC_BASE_URL']) {
        if (!present(env, key))
            errors.push(`${key} 未配置`);
    }
    if (present(env, 'PUBLIC_BASE_URL') && !isHttpsUrl(env.PUBLIC_BASE_URL)) {
        errors.push('PUBLIC_BASE_URL 必须是有效的 HTTPS 地址');
    }
    const jwt = env.JWT_SECRET?.trim() || '';
    if (WEAK_JWT_SECRETS.has(jwt) || jwt.length < 48) {
        errors.push('JWT_SECRET 必须是至少 48 个字符的强随机密钥');
    }
    const encryptionKey = env.ENCRYPTION_KEY?.trim() || '';
    if (!/^[a-fA-F0-9]{64}$/.test(encryptionKey)) {
        errors.push('ENCRYPTION_KEY 必须是 32 字节（64 位十六进制）密钥');
    }
    const hasRealAi = AI_KEY_NAMES.some((key) => present(env, key)) ||
        (present(env, 'HUNYUAN_SECRET_ID') && present(env, 'HUNYUAN_SECRET_KEY'));
    if (!hasRealAi) {
        errors.push('至少配置一个真实 AI Provider 凭据');
    }
    for (const key of WECHAT_REQUIRED) {
        if (!present(env, key))
            errors.push(`${key} 未配置`);
    }
    if (present(env, 'WECHAT_API_V3_KEY') && env.WECHAT_API_V3_KEY.trim().length !== 32) {
        errors.push('WECHAT_API_V3_KEY 必须为 32 个字符');
    }
    if (present(env, 'WECHAT_PRIVATE_KEY') && !env.WECHAT_PRIVATE_KEY.includes('BEGIN PRIVATE KEY')) {
        errors.push('WECHAT_PRIVATE_KEY 必须是 PEM 私钥');
    }
    if (present(env, 'WECHAT_PLATFORM_CERT') &&
        !env.WECHAT_PLATFORM_CERT.includes('BEGIN CERTIFICATE')) {
        errors.push('WECHAT_PLATFORM_CERT 必须是 PEM X.509 平台证书');
    }
    const notifyChannel = env.NOTIFY_CHANNEL?.trim().toLowerCase();
    if (!notifyChannel) {
        errors.push('NOTIFY_CHANNEL 必须显式设置为 disabled 或 wechat');
    }
    else if (!['disabled', 'wechat'].includes(notifyChannel)) {
        errors.push('生产环境 NOTIFY_CHANNEL 仅允许 disabled 或已真实接入的 wechat');
    }
    else if (notifyChannel === 'wechat') {
        for (const key of ['WECHAT_OPEN_APPID', 'WECHAT_OPEN_SECRET', 'WECHAT_NOTIFY_TEMPLATE_ID']) {
            if (!present(env, key))
                errors.push(`${key} 未配置`);
        }
    }
    return errors;
}
function assertStartupEnv(env = process.env) {
    const errors = collectStartupEnvErrors(env);
    if (errors.length > 0) {
        throw new Error(`生产启动配置校验失败：\n- ${errors.join('\n- ')}`);
    }
}
function validateStartupEnv(env = process.env) {
    if (env.NODE_ENV === 'test')
        return;
    if (env.NODE_ENV === 'production') {
        assertStartupEnv(env);
        return;
    }
    const secret = env.JWT_SECRET?.trim() || '';
    if (WEAK_JWT_SECRETS.has(secret) || secret.length < 48) {
        // eslint-disable-next-line no-console
        console.warn('⚠️ JWT_SECRET 为弱占位值或长度不足；开发环境继续运行，生产环境会拒绝启动。');
    }
}
//# sourceMappingURL=env-check.js.map