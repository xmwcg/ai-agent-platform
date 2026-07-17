import { KnowledgeDocument } from '../models/KnowledgeDocument';
import { deductCredits } from '../services/credit-ledger.service';
import { logger } from '../lib/logger';

const PLAN_RANK: Record<string, number> = { free: 0, pro: 1, max: 2 };

export type KbAccessVerdict =
  | { level: 'full'; deduct?: number }
  | { level: 'preview'; freePreviewPages?: number; creditsCost?: number; requiredPlan?: string }
  | { level: 'plan_locked'; requiredPlan: string; creditsCost?: number; price?: number }
  | { level: 'credit_locked'; creditsNeeded: number; creditsHave: number; freePreviewPages?: number };

/** 每页估算字符数，用于 freePreviewPages 试看截断 */
const CHARS_PER_PAGE = 600;

function previewOf(content: string, pages = 1): string {
  const cut = Math.max(1, pages) * CHARS_PER_PAGE;
  if (content.length <= cut) return content;
  return content.slice(0, cut) + '\n\n— — 以下为付费内容，解锁后查看全文 — —';
}

/**
 * 纯函数：依据文档权限配置与用户状态，判定可访问级别。
 * 不修改数据库，便于在路由中先判读再决定是否扣减积分。
 */
export function resolveKbAccess(doc: any, user: any): KbAccessVerdict {
  const userPlan = user?.plan || 'free';
  const userCredits = user?.credits ?? 0;

  // 1) 会员等级门槛
  if (doc.requiredPlan && (PLAN_RANK[doc.requiredPlan] ?? 0) > (PLAN_RANK[userPlan] ?? 0)) {
    return { level: 'plan_locked', requiredPlan: doc.requiredPlan, creditsCost: doc.creditsCost, price: doc.price };
  }

  // 2) 已解锁（积分/付费），直接全文
  if (user?.id && Array.isArray(doc.unlockedBy) && doc.unlockedBy.some((id: unknown) => String(id) === String(user.id))) {
    return { level: 'full' };
  }

  // 3) 需消耗积分
  if (doc.creditsCost && doc.creditsCost > 0) {
    if (userCredits >= doc.creditsCost) {
      return { level: 'full', deduct: doc.creditsCost };
    }
    // 积分不足：若有试看则给试看，否则锁定
    if (doc.freePreviewPages && doc.freePreviewPages > 0) {
      return { level: 'credit_locked', creditsNeeded: doc.creditsCost, creditsHave: userCredits, freePreviewPages: doc.freePreviewPages };
    }
    return { level: 'credit_locked', creditsNeeded: doc.creditsCost, creditsHave: userCredits };
  }

  // 4) 免费文档
  if (doc.freePreviewPages && doc.freePreviewPages > 0) {
    return { level: 'preview', freePreviewPages: doc.freePreviewPages, creditsCost: doc.creditsCost, requiredPlan: doc.requiredPlan };
  }
  return { level: 'full' };
}

/**
 * 应用访问判定：按需扣减积分并记录解锁，返回可下发的正文。
 * 仅在 verdict.level === 'full' 且需要扣减时落库。
 */
export async function applyKbAccess(doc: any, user: any, verdict: KbAccessVerdict): Promise<{ content: string; deducted?: number }> {
  if (verdict.level !== 'full') {
    if (verdict.level === 'preview' || verdict.level === 'credit_locked') {
      const pages = (verdict as any).freePreviewPages || 1;
      return { content: previewOf(doc.content, pages) };
    }
    return { content: '' };
  }

  // 全文：如需扣积分则扣减并记录解锁，避免重复扣
  if (verdict.deduct && user?.id) {
    const documentId = String(doc._id);
    await deductCredits({
      userId: String(user.id),
      amount: verdict.deduct,
      idempotencyKey: `knowledge-unlock:${user.id}:${documentId}`,
      businessType: 'knowledge_unlock',
      businessId: documentId,
      resource: 'knowledge',
      transactionType: 'deduction',
      description: `解锁知识文档《${doc.title}》消耗 ${verdict.deduct} 积分`,
      auditReason: `用户解锁知识文档 ${documentId}`,
    });
    doc.unlockedBy = Array.isArray(doc.unlockedBy) ? [...doc.unlockedBy, user.id] : [user.id];
    await KnowledgeDocument.updateOne(
      { _id: doc._id },
      { $addToSet: { unlockedBy: user.id } }
    ).catch((error) => logger.error('kb-access', `记录解锁失败: ${error.message}`));
  }
  return { content: doc.content };
}
