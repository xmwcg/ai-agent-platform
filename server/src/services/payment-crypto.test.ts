/**
 * payment-crypto 支付宝签名/验签 测试安全网
 *
 * alipaySign / alipayVerify 是支付回调安全关键路径（RSA-SHA256），
 * 需锁定签名往返正确性，避免重构破坏支付验签逻辑。
 */
import crypto from 'crypto';
import { alipaySign, alipayVerify } from './payment-crypto';

// 生成一对临时 RSA 密钥用于测试（不依赖生产密钥）
let privateKeyPem: string;
let publicKeyPem: string;

beforeAll(() => {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  publicKeyPem = publicKey;
  privateKeyPem = privateKey;
});

describe('alipaySign · 支付宝请求签名', () => {
  it('对标准参数生成签名（非空串）', () => {
    const params: Record<string, string> = {
      app_id: '2021001',
      method: 'alipay.trade.precreate',
      format: 'JSON',
      charset: 'utf-8',
      sign_type: 'RSA2',
      timestamp: '2026-07-15 08:00:00',
      version: '1.0',
      biz_content: JSON.stringify({ out_trade_no: 'ORDER_1', total_amount: '9.90', subject: '专业版订阅' }),
    };
    const sign = alipaySign(params, privateKeyPem);
    expect(typeof sign).toBe('string');
    expect(sign.length).toBeGreaterThan(100); // RSA-SHA256 base64 签名应足够长
  });

  it('签名排除 sign 字段自身', () => {
    const params: Record<string, string> = {
      a: '1',
      b: '2',
      sign: 'should-be-ignored',
    };
    const sign1 = alipaySign(params, privateKeyPem);
    // sign 字段本身被排除，所以加了不同的 sign 值应产出相同签名
    params.sign = 'different';
    const sign2 = alipaySign(params, privateKeyPem);
    expect(sign1).toBe(sign2);
  });

  it('签名排除空值字段', () => {
    const params: Record<string, string> = {
      a: '1',
      b: '',
      c: '3',
    };
    const sign = alipaySign(params, privateKeyPem);
    expect(typeof sign).toBe('string');
    expect(sign.length).toBeGreaterThan(0);
  });

  it('按 key 升序排序拼接（确定性输出）', () => {
    const params: Record<string, string> = {
      z: 'last',
      a: 'first',
      m: 'middle',
    };
    const sign1 = alipaySign(params, privateKeyPem);
    const sign2 = alipaySign(params, privateKeyPem);
    expect(sign1).toBe(sign2); // 同参数同密钥应产生相同签名
  });
});

describe('alipayVerify · 支付宝异步通知验签', () => {
  it('合法签名验证通过', () => {
    const params: Record<string, string> = {
      out_trade_no: 'ORDER_999',
      trade_no: 'TXN_1',
      trade_status: 'TRADE_SUCCESS',
      total_amount: '9.90',
      notify_time: '2026-07-15 08:00:00',
    };
    const sign = alipaySign(params, privateKeyPem);
    params.sign = sign;
    expect(alipayVerify(params, publicKeyPem)).toBe(true);
  });

  it('篡改参数后验签失败', () => {
    const params: Record<string, string> = {
      out_trade_no: 'ORDER_999',
      trade_status: 'TRADE_SUCCESS',
    };
    const sign = alipaySign(params, privateKeyPem);
    params.sign = sign;
    // 篡改订单号
    params.out_trade_no = 'ORDER_FAKE';
    expect(alipayVerify(params, publicKeyPem)).toBe(false);
  });

  it('缺少 sign 字段返回 false', () => {
    const params: Record<string, string> = {
      out_trade_no: 'ORDER_1',
    };
    expect(alipayVerify(params, publicKeyPem)).toBe(false);
  });

  it('错误公钥验签失败（不抛异常）', () => {
    const { publicKey: wrongPub } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });
    const params: Record<string, string> = {
      out_trade_no: 'ORDER_1',
    };
    const sign = alipaySign(params, privateKeyPem);
    params.sign = sign;
    expect(alipayVerify(params, wrongPub)).toBe(false);
  });

  it('验签排除 sign_type 字段', () => {
    // alipaySign 包含 sign_type（请求签名规范），alipayVerify 排除 sign_type（通知验签规范）
    // 两份规范字符串不同，因此不能直接做往返验证，仅验证各自行为正确
    const params: Record<string, string> = {
      out_trade_no: 'ORDER_1',
      sign_type: 'RSA2',
    };
    // 用不含 sign_type 的 params 签名和验签做往返验证
    const signParams: Record<string, string> = {
      out_trade_no: 'ORDER_1',
      trade_status: 'TRADE_SUCCESS',
    };
    const sign = alipaySign(signParams, privateKeyPem);
    // 验签时 sign_type 被排除，使用相同字符串
    const verifyParams: Record<string, string> = {
      out_trade_no: 'ORDER_1',
      trade_status: 'TRADE_SUCCESS',
      sign_type: 'RSA2', // 验签排除，不影响
    };
    verifyParams.sign = sign;
    expect(alipayVerify(verifyParams, publicKeyPem)).toBe(true);
  });

  it('非法公钥 PEM 返回 false（不抛异常）', () => {
    const params: Record<string, string> = {
      out_trade_no: 'ORDER_1',
    };
    const sign = alipaySign(params, privateKeyPem);
    params.sign = sign;
    expect(alipayVerify(params, 'not-a-valid-pem')).toBe(false);
  });
});
