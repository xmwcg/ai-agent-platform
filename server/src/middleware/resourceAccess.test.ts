import { canAccessResource } from './resourceAccess';

describe('资源级访问控制（团队 RBAC 下沉）纯函数', () => {
  it('资源直接归属用户 → 允许', () => {
    expect(canAccessResource({ userId: 'u1', ownerId: 'u1' })).toBe(true);
    expect(canAccessResource({ userId: 'u1', author: 'u1' })).toBe(true);
  });

  it('非归属且无团队 → 拒绝', () => {
    expect(canAccessResource({ userId: 'u2', ownerId: 'u1' })).toBe(false);
    expect(canAccessResource({ userId: 'u2', author: 'u1' })).toBe(false);
  });

  it('无 userId → 拒绝', () => {
    expect(canAccessResource({ userId: undefined, ownerId: 'u1', memberRole: 'admin' })).toBe(false);
  });

  it('团队成员按角色判定（viewer 默认可读，member 可写）', () => {
    expect(canAccessResource({ userId: 'u2', ownerId: 'u1', memberRole: 'viewer' })).toBe(true);
    expect(canAccessResource({ userId: 'u2', ownerId: 'u1', memberRole: 'viewer', minRole: 'member' })).toBe(false);
    expect(canAccessResource({ userId: 'u2', ownerId: 'u1', memberRole: 'member', minRole: 'member' })).toBe(true);
    expect(canAccessResource({ userId: 'u2', ownerId: 'u1', memberRole: 'admin', minRole: 'member' })).toBe(true);
    expect(canAccessResource({ userId: 'u2', ownerId: 'u1', memberRole: 'owner', minRole: 'admin' })).toBe(true);
  });

  it('未知角色 → 拒绝', () => {
    expect(canAccessResource({ userId: 'u2', ownerId: 'u1', memberRole: 'stranger' as any })).toBe(false);
  });
});
