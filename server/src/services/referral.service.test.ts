import * as referral from './referral.service';
import { Commission } from '../models/Referral';
import { User } from '../models/User';
import { Withdrawal } from '../models/Withdrawal';
import mongoose from 'mongoose';

// 分销/佣金是商业核心，且逻辑含余额校验、佣金计算等易错分支。
// 通过 jest.mock 隔离 4 个模型 + spyOn mongoose.startSession 提供假事务，
// 锁定结算与提现的关键行为，避免后续重构破坏资金安全。
jest.mock('../models/Referral', () => ({
  Referral: { find: jest.fn(), findOne: jest.fn(), create: jest.fn(), findByIdAndUpdate: jest.fn(), countDocuments: jest.fn(), aggregate: jest.fn() },
  Commission: { create: jest.fn(), updateMany: jest.fn(), find: jest.fn(), aggregate: jest.fn(), countDocuments: jest.fn() },
}));
jest.mock('../models/User', () => ({ User: { findById: jest.fn(), findByIdAndUpdate: jest.fn(), findOne: jest.fn() } }));
jest.mock('../models/CreditsTransaction', () => ({ CreditsTransaction: { create: jest.fn() } }));
jest.mock('../models/Withdrawal', () => ({ Withdrawal: { create: jest.fn() } }));

const fakeSession = {
  startTransaction: jest.fn(),
  commitTransaction: jest.fn().mockResolvedValue(undefined),
  abortTransaction: jest.fn().mockResolvedValue(undefined),
  endSession: jest.fn(),
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(mongoose, 'startSession').mockResolvedValue(fakeSession as any);
});

describe('referral.service · 佣金与提现（商业核心逻辑）', () => {
  describe('settleCommissions', () => {
    it('将 pending 佣金结算为 settled 并返回修改数', async () => {
      (Commission.updateMany as jest.Mock).mockResolvedValue({ modifiedCount: 3 });
      const n = await referral.settleCommissions('507f1f77bcf86cd799439011');
      expect(n).toBe(3);
      expect(Commission.updateMany).toHaveBeenCalledWith(
        { userId: '507f1f77bcf86cd799439011', status: 'pending' },
        { status: 'settled', settledAt: expect.any(Date) }
      );
    });
  });

  describe('requestWithdrawal', () => {
    it('低于最低提现额（¥50）直接抛错，且不查用户', async () => {
      await expect(referral.requestWithdrawal('507f1f77bcf86cd799439011', 10, 'wechat')).rejects.toThrow(/最低/);
      expect(User.findById).not.toHaveBeenCalled();
    });

    it('成功路径：校验余额→锁定佣金→生成提现单', async () => {
      // getReferralStats 内部多次聚合，统一返回 settledCommission=10000 分
      (Commission.aggregate as jest.Mock).mockResolvedValue([{ total: 10000 }]);
      (User.findById as jest.Mock).mockResolvedValue({ _id: '507f1f77bcf86cd799439011', commissionWithdrawn: 0 });
      (Commission.find as jest.Mock).mockReturnValue({
        sort: jest.fn().mockReturnValue({
          session: jest.fn().mockResolvedValue([{ _id: 'c1', commissionAmount: 5000 }]),
        }),
      });
      (Commission.updateMany as jest.Mock).mockResolvedValue({});
      (User.findByIdAndUpdate as jest.Mock).mockResolvedValue({});
      (Withdrawal.create as jest.Mock).mockResolvedValue([{ _id: 'wd1' }]);

      const res = await referral.requestWithdrawal('507f1f77bcf86cd799439011', 50, 'wechat', 'acct');
      expect(res.withdrawalId).toBe('wd1');
      expect(res.amountCents).toBe(5000);
      expect(res.availableCents).toBe(5000); // 10000 - 5000
      expect(Withdrawal.create).toHaveBeenCalled();
      expect(fakeSession.commitTransaction).toHaveBeenCalled();
    });

    it('可提现余额不足时抛错', async () => {
      (Commission.aggregate as jest.Mock).mockResolvedValue([{ total: 100 }]); // settled 仅 100 分
      (User.findById as jest.Mock).mockResolvedValue({ _id: '507f1f77bcf86cd799439011', commissionWithdrawn: 0 });
      await expect(referral.requestWithdrawal('507f1f77bcf86cd799439011', 50, 'wechat')).rejects.toThrow(/可提现余额不足/);
    });
  });
});
