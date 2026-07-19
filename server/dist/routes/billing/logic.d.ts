import { PaymentProvider, BillingPeriod } from '../../models/Order';
import { PlanId } from '../../config/billing';
import { ValidationSchema } from '../../lib/validation';
export declare const createOrderSchema: ValidationSchema;
/** 高熵、按创建时间大致可排序的全局订单号。 */
export declare function genOrderNo(): string;
export declare function resolvePaymentProvider(input?: PaymentProvider): PaymentProvider;
/** 激活订阅：套餐、有效期、免费额度批次和积分流水在同一事务中提交。 */
export declare function activateSubscription(userId: string, plan: PlanId, period: BillingPeriod, orderNo?: string): Promise<void>;
/** 积分包支付成功后充值，额度批次、余额缓存和流水同事务且按订单幂等。 */
export declare function grantCreditsPack(userId: string, packageId: string, orderNo: string): Promise<number>;
//# sourceMappingURL=logic.d.ts.map