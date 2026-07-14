/**
 * 鉴权 Token 安全单测（纯函数：generateToken / verifyToken）
 * 锁定 JWT 签发与校验的核心安全行为：正常往返、篡改拒绝、非法值拒绝。
 */
import { generateToken, verifyToken } from './auth';

const PAYLOAD = { id: 'user-123', email: 'a@b.com', role: 'user' };

describe('JWT 鉴权 Token', () => {
  it('generateToken 签发的 Token 可被 verifyToken 还原', () => {
    const token = generateToken(PAYLOAD);
    expect(typeof token).toBe('string');
    const decoded = verifyToken(token);
    expect(decoded).not.toBeNull();
    expect(decoded!.id).toBe(PAYLOAD.id);
    expect(decoded!.email).toBe(PAYLOAD.email);
    expect(decoded!.role).toBe(PAYLOAD.role);
  });

  it('篡改 Token（尾部追加字符）被拒绝，返回 null', () => {
    const token = generateToken(PAYLOAD);
    expect(verifyToken(token + 'x')).toBeNull();
  });

  it('非法 Token（非 JWT 字符串）返回 null', () => {
    expect(verifyToken('not-a-jwt')).toBeNull();
  });

  it('空 Token 返回 null（不抛异常）', () => {
    expect(verifyToken('')).toBeNull();
  });

  it('不同 payload 签发的 Token 不可互通', () => {
    const t1 = generateToken(PAYLOAD);
    const t2 = generateToken({ id: 'other', email: 'c@d.com', role: 'admin' });
    expect(verifyToken(t1)).not.toEqual(verifyToken(t2));
    expect(verifyToken(t2)!.role).toBe('admin');
  });
});
