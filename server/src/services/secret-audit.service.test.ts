jest.mock('../models/SecretAuditLog');

import { SecretAuditLog } from '../models/SecretAuditLog';
import { logSecretAudit, checkTestAbuse } from './secret-audit.service';

describe('secret-audit 密钥审计服务', () => {
  beforeEach(() => {
    (SecretAuditLog.create as jest.Mock).mockReset();
  });

  it('logSecretAudit 异步写入且字段正确', async () => {
    (SecretAuditLog.create as jest.Mock).mockResolvedValue({});
    await expect(
      logSecretAudit({
        ownerId: 'u1',
        actorId: 'u1',
        targetId: 't1',
        action: 'secret_created',
        ip: '1.2.3.4',
      })
    ).resolves.toBeUndefined();

    expect(SecretAuditLog.create).toHaveBeenCalledTimes(1);
    const arg = (SecretAuditLog.create as jest.Mock).mock.calls[0][0];
    expect(arg.action).toBe('secret_created');
    expect(arg.ownerId).toBe('u1');
    expect(arg.alert).toBe(false);
  });

  it('写入失败时仍不抛错（不阻塞主流程）', async () => {
    (SecretAuditLog.create as jest.Mock).mockRejectedValue(new Error('db down'));
    await expect(
      logSecretAudit({ ownerId: 'u', actorId: 'u', targetId: 't', action: 'secret_test' })
    ).resolves.toBeUndefined();
  });

  it('checkTestAbuse 高频触发告警', () => {
    let alert = false;
    for (let i = 0; i < 25; i++) {
      alert = checkTestAbuse('actorX', '1.2.3.4');
    }
    expect(alert).toBe(true);
  });

  it('checkTestAbuse 正常频率不告警', () => {
    expect(checkTestAbuse('actorY', '1.2.3.4')).toBe(false);
    expect(checkTestAbuse('actorZ', '1.2.3.4')).toBe(false);
  });
});
