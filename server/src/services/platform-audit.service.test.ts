import { logPlatformAudit } from './platform-audit.service';

jest.mock('../models/PlatformAuditLog', () => ({
  PlatformAuditLog: { create: jest.fn().mockResolvedValue(undefined) },
}));

import { PlatformAuditLog } from '../models/PlatformAuditLog';

describe('logPlatformAudit', () => {
  beforeEach(() => {
    (PlatformAuditLog.create as jest.Mock).mockClear();
  });

  it('写入角色变更审计并携带 oldRole/newRole', () => {
    logPlatformAudit({
      actorId: 'admin1',
      action: 'user_role_changed',
      targetId: 'user1',
      detail: { oldRole: 'user', newRole: 'admin' },
    });
    expect(PlatformAuditLog.create).toHaveBeenCalledWith({
      actorId: 'admin1',
      action: 'user_role_changed',
      targetId: 'user1',
      detail: { oldRole: 'user', newRole: 'admin' },
    });
  });

  it('封禁 / 解封动作映射正确', () => {
    logPlatformAudit({ actorId: 'admin1', action: 'user_banned', targetId: 'user1', detail: { banned: true } });
    expect(PlatformAuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'user_banned', detail: { banned: true } })
    );
    logPlatformAudit({ actorId: 'admin1', action: 'user_unbanned', targetId: 'user1', detail: { banned: false } });
    expect(PlatformAuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'user_unbanned', detail: { banned: false } })
    );
  });

  it('写入失败不抛出（异步吞错，不阻塞主业务）', () => {
    (PlatformAuditLog.create as jest.Mock).mockRejectedValueOnce(new Error('db down'));
    expect(() =>
      logPlatformAudit({ actorId: 'admin1', action: 'user_unbanned', targetId: 'user1' })
    ).not.toThrow();
  });
});
