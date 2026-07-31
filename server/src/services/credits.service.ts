/** 积分服务存根 — 桥接 payment/billing 到生产 User 模型 */
import { User } from "../models/User";
export async function addCredits(userId: string, amount: number): Promise<number> {
  const user = await User.findById(userId);
  if (!user) throw new Error("用户不存在");
  user.credits = (user.credits ?? 0) + amount;
  await user.save();
  return user.credits;
}
