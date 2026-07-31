import { signTencentTC3 } from '../lib/tc3';

const base = {
  secretId: 'AKIDexample',
  secretKey: 'secretkey',
  service: 'hunyuan',
  host: 'hunyuan.tencentcloudapi.com',
  action: 'SubmitVideoGenerationJob',
  version: '2023-09-01',
  region: 'ap-guangzhou',
  payload: '{"Prompt":"test"}',
  timestamp: 1700000000,
};

describe('腾讯云 TC3-HMAC-SHA256 签名', () => {
  it('生成标准 Authorization 头', () => {
    const { authorization } = signTencentTC3(base);
    expect(authorization.startsWith('TC3-HMAC-SHA256 Credential=AKIDexample/')).toBe(true);
    expect(authorization).toContain('SignedHeaders=content-type;host');
    expect(authorization).toMatch(/Signature=[0-9a-f]{64}/);
  });

  it('相同输入幂等', () => {
    expect(signTencentTC3(base).authorization).toBe(signTencentTC3(base).authorization);
  });

  it('不同密钥得到不同签名', () => {
    const a = signTencentTC3({ ...base, secretKey: 'a' }).authorization;
    const b = signTencentTC3({ ...base, secretKey: 'b' }).authorization;
    expect(a).not.toBe(b);
  });

  it('签名与 action 无关（action 是请求头，不在签名头内，符合腾讯云规范）', () => {
    const a = signTencentTC3(base).authorization;
    const b = signTencentTC3({ ...base, action: 'DescribeVideoGenerationJob' }).authorization;
    expect(a).toBe(b);
  });

  it('不同 payload 得到不同签名', () => {
    const a = signTencentTC3(base).authorization;
    const b = signTencentTC3({ ...base, payload: '{"Prompt":"different"}' }).authorization;
    expect(a).not.toBe(b);
  });
});
