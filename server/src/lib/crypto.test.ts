import { encryptSecret, decryptSecret, keyFromHex, isEncrypted } from './crypto';

const NEW_HEX = 'a'.repeat(64); // 32 字节
const OLD_HEX = 'b'.repeat(64);

describe('crypto — AES-256-GCM 与双密钥轮换', () => {
  afterEach(() => {
    delete process.env.ENCRYPTION_KEY;
    delete process.env.ENCRYPTION_KEY_PREV;
    delete process.env.OLD_ENCRYPTION_KEY;
  });

  it('默认使用 ENCRYPTION_KEY 加密并解密', () => {
    process.env.ENCRYPTION_KEY = NEW_HEX;
    const enc = encryptSecret('sk-secret-value');
    expect(isEncrypted(enc)).toBe(true);
    expect(enc.startsWith('enc::v1:')).toBe(true);
    expect(decryptSecret(enc)).toBe('sk-secret-value');
  });

  it('显式 key 加密、显式 key 解密；错误密钥解密失败', () => {
    const oldKey = keyFromHex(OLD_HEX);
    const newKey = keyFromHex(NEW_HEX);
    const enc = encryptSecret('sk-legacy', { key: oldKey });
    expect(decryptSecret(enc, { key: oldKey })).toBe('sk-legacy');
    expect(() => decryptSecret(enc, { key: newKey })).toThrow();
  });

  it('解密自动回退历史密钥 ENCRYPTION_KEY_PREV', () => {
    process.env.ENCRYPTION_KEY = NEW_HEX;
    process.env.ENCRYPTION_KEY_PREV = OLD_HEX;
    const oldKey = keyFromHex(OLD_HEX);
    const newKey = keyFromHex(NEW_HEX);

    const oldEnc = encryptSecret('legacy', { key: oldKey });
    // 当前密钥(new) 解不开，应回退到 prev(old) 成功
    expect(decryptSecret(oldEnc)).toBe('legacy');

    const newEnc = encryptSecret('fresh', { key: newKey });
    // 新密钥加密的也能直接解开
    expect(decryptSecret(newEnc)).toBe('fresh');
  });

  it('兼容 OLD_ENCRYPTION_KEY 作为历史密钥别名', () => {
    process.env.ENCRYPTION_KEY = NEW_HEX;
    process.env.OLD_ENCRYPTION_KEY = OLD_HEX;
    const oldKey = keyFromHex(OLD_HEX);
    const oldEnc = encryptSecret('legacy2', { key: oldKey });
    expect(decryptSecret(oldEnc)).toBe('legacy2');
  });

  it('明文兼容：无前缀原样返回', () => {
    expect(decryptSecret('plain-text-key')).toBe('plain-text-key');
  });

  it('空值原样返回', () => {
    expect(encryptSecret('')).toBe('');
    expect(decryptSecret('')).toBe('');
  });

  it('ENCRYPTION_KEY 缺失时加密抛错', () => {
    expect(() => encryptSecret('x')).toThrow(/ENCRYPTION_KEY/);
  });
});
