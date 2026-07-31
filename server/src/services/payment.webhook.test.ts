import crypto from 'crypto';
import {
  verifyStripeSignature,
  decryptWeChatResource,
  verifyWeChatSignature,
} from './payment.service';

describe('支付 Webhook 真实验签', () => {
  describe('Stripe HMAC-SHA256', () => {
    const secret = 'whsec_test_123';
    it('合法签名应验签通过', () => {
      const rawBody = JSON.stringify({ type: 'payment_intent.succeeded', id: 'pi_1' });
      const timestamp = '1700000000';
      const expected = crypto.createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex');
      const header = `t=${timestamp},v1=${expected}`;
      expect(verifyStripeSignature(rawBody, header, secret).valid).toBe(true);
    });
    it('篡改签名应失败', () => {
      const rawBody = JSON.stringify({ type: 'x' });
      const header = 't=1700000000,v1=deadbeef';
      expect(verifyStripeSignature(rawBody, header, secret).valid).toBe(false);
    });
    it('缺少字段应失败', () => {
      expect(verifyStripeSignature('{}', 'garbage', secret).valid).toBe(false);
    });
  });

  describe('微信 AES-256-GCM 解密', () => {
    it('加密后可正确解密回原文', () => {
      const apiV3Key = 'A'.repeat(32); // 32 字节密钥
      const nonce = crypto.randomBytes(12).toString('base64');
      const associated = 'transaction';
      const plaintext = JSON.stringify({ out_trade_no: 'ORDER_999', transaction_id: 'T_1' });

      const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(apiV3Key), Buffer.from(nonce));
      cipher.setAAD(Buffer.from(associated));
      const enc = Buffer.concat([cipher.update(plaintext), cipher.final()]);
      const tag = cipher.getAuthTag();
      const ciphertext = Buffer.concat([enc, tag]).toString('base64');

      const decrypted = decryptWeChatResource(ciphertext, nonce, associated, apiV3Key);
      expect(decrypted.out_trade_no).toBe('ORDER_999');
      expect(decrypted.transaction_id).toBe('T_1');
    });
    it('错误密钥应抛错', () => {
      const apiV3Key = 'A'.repeat(32);
      const badKey = 'B'.repeat(32);
      const nonce = crypto.randomBytes(12).toString('base64');
      const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(apiV3Key), Buffer.from(nonce));
      const enc = Buffer.concat([cipher.update('{}'), cipher.final()]);
      const ciphertext = Buffer.concat([enc, cipher.getAuthTag()]).toString('base64');
      expect(() => decryptWeChatResource(ciphertext, nonce, '', badKey)).toThrow();
    });
  });

  describe('微信 RSA-SHA256 签名', () => {
    it('用私钥签名、公钥验签应通过', () => {
      const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      });
      const ts = '1700000000';
      const nonce = 'abc';
      const body = '{"a":1}';
      const signer = crypto.createSign('RSA-SHA256');
      signer.update(`${ts}\n${nonce}\n${body}\n`);
      const signature = signer.sign(privateKey, 'base64');
      expect(verifyWeChatSignature(ts, nonce, body, signature, publicKey)).toBe(true);
      expect(verifyWeChatSignature(ts, nonce, body, 'invalid', publicKey)).toBe(false);
    });
  });
});
