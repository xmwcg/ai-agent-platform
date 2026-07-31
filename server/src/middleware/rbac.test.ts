import { hasTeamRole, ROLE_RANK } from './rbac';

describe('团队 RBAC 角色判定', () => {
  it('角色等级顺序正确', () => {
    expect(ROLE_RANK.owner).toBeGreaterThan(ROLE_RANK.admin);
    expect(ROLE_RANK.admin).toBeGreaterThan(ROLE_RANK.member);
    expect(ROLE_RANK.member).toBeGreaterThan(ROLE_RANK.viewer);
  });
  it('上级角色满足下级要求', () => {
    expect(hasTeamRole('owner', 'viewer')).toBe(true);
    expect(hasTeamRole('admin', 'member')).toBe(true);
    expect(hasTeamRole('member', 'member')).toBe(true);
  });
  it('下级角色不满足上级要求', () => {
    expect(hasTeamRole('viewer', 'member')).toBe(false);
    expect(hasTeamRole('member', 'admin')).toBe(false);
  });
  it('未加入团队不满足任何要求', () => {
    expect(hasTeamRole(undefined, 'viewer')).toBe(false);
  });
});
