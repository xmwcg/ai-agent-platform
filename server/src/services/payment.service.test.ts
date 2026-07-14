import crypto from 'crypto';
import {
  verifyStripeSignature,
  normalizeAlipayPem,
  alipayBeijingTimestamp,
  verifyWeChatSignature,
  decryptWeChatResource,
} from './payment.service';

// 支付网关的验签/解密纯函数属于安全关键路径，且不依赖外部 SDK/DB，
// 适合作为回归护栏：锁定验签正确性，避免后续重构破坏支付回调安全。
describe('payment.service · 密码学/验签纯函数（安全关键，可单测）', () => {
  describe('verifyStripeSignature', () => {
    const secret = 'whsec_test_secret';
    it('合法签名返回 valid:true 且解析 timestamp', () => {
      const ts = '1700000000';
      const rawBody = '{"id":"evt_1"}';
      const expected = crypto.createHmac('sha256', secret).update(`${ts}.${rawBody}`).digest('hex');
      const header = `t=${ts},v1=${expected}`;
      const r = verifyStripeSignature(rawBody, header, secret);
      expect(r.valid).toBe(true);
      expect(r.timestamp).toBe(1700000000);
    });

    it('篡改 body 导致签名不符 → valid:false', () => {
      const ts = '1700000000';
      const rawBody = '{"id":"evt_1"}';
      const expected = crypto.createHmac('sha256', secret).update(`${ts}.${rawBody}`).digest('hex');
      const header = `t=${ts},v1=${expected}`;
      const r = verifyStripeSignature('{"id":"evt_2"}', header, secret);
      expect(r.valid).toBe(false);
    });

    it('header 缺少 t 或 v1 → valid:false', () => {
      expect(verifyStripeSignature('x', 'v1=abc', secret).valid).toBe(false);
      expect(verifyStripeSignature('x', 't=1', secret).valid).toBe(false);
    });
  });

  describe('normalizeAlipayPem', () => {
    it('裸 base64 私钥补全为合法 PEM', () => {
      const raw = 'MIIBVAIB'.repeat(24); // 伪 base64 片段
      const pem = normalizeAlipayPem(raw, 'PRIVATE');
      expect(pem).toContain('BEGIN PRIVATE KEY');
      expect(pem).toContain('END PRIVATE KEY');
      expect(pem.split('\n').length).toBeGreaterThan(3);
      expect(pem).toContain(raw.replace(/\s+/g, '').match(/.{1,64}/g)!.join('\n'));
    });

    it('已含 BEGIN 的 PEM 原样返回（不重复包装）', () => {
      const pem = '-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----';
      expect(normalizeAlipayPem(pem, 'PRIVATE')).toBe(pem);
    });
  });

  describe('alipayBeijingTimestamp', () => {
    it('固定 now 输出 UTC+8 北京时间（格式 yyyy-MM-dd HH:mm:ss）', () => {
      const now = Date.UTC(2026, 6, 15, 0, 0, 0); // 2026-07-15T00:00:00Z
      expect(alipayBeijingTimestamp(now)).toBe('2026-07-15 08:00:00');
    });
  });

  describe('verifyWeChatSignature', () => {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });
    const timestamp = '1700000000';
    const nonce = 'nonce123';
    const body = '{"id":"evt"}';
    const signature = crypto
      .createSign('RSA-SHA256')
      .update(`${timestamp}\n${nonce}\n${body}\n`)
      .sign(privateKey, 'base64');

    it('合法签名验证通过', () => {
      expect(verifyWeChatSignature(timestamp, nonce, body, signature, publicKey)).toBe(true);
    });

    it('篡改 body 验证失败', () => {
      expect(verifyWeChatSignature(timestamp, nonce, '{"id":"x"}', signature, publicKey)).toBe(false);
    });

    it('非法公钥 PEM 验证失败（不抛异常，返回 false）', () => {
      expect(verifyWeChatSignature(timestamp, nonce, body, signature, 'not-a-pem')).toBe(false);
    });
  });

  describe('decryptWeChatResource', () => {
    it('AES-256-GCM 往返解密还原原始 JSON', () => {
      const apiV3Key = crypto.randomBytes(16).toString('hex'); // 32 字符 ASCII，等价于 32 字节 utf8 key
      const nonce = crypto.randomBytes(12).toString('utf8');
      const aad = 'transaction';
      const plain = JSON.stringify({ id: 'txn_1', amount: 100, paid: true });
      const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(apiV3Key, 'utf8'), Buffer.from(nonce, 'utf8'));
      cipher.setAAD(Buffer.from(aad, 'utf8'));
      const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
      const tag = cipher.getAuthTag();
      const ciphertext = Buffer.concat([enc, tag]).toString('base64');
      const out = decryptWeChatResource(ciphertext, nonce, aad, apiV3Key);
      expect(out).toEqual(JSON.parse(plain));
    });
  });
});
