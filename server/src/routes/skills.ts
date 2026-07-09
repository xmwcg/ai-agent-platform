/**
 * 技能路由（agency-agents 名册的可发现入口）
 *   GET /api/skills           列出全部技能（含 manifest）
 *   GET /api/skills/market    列出可上架开放 API 市场的技能
 *   GET /api/skills/:id       技能详情
 *   POST /api/skills/:id/invoke  调用技能（经配额网关 + 团队 RBAC 守卫）
 */
import { Router } from 'express';
import { listSkills, listMarketableSkills, getSkill } from '../skills/registry';
import { enforceQuota } from '../middleware/subscription';
import { optionalAuth, type AuthRequest } from '../middleware/auth';
import type { QuotaResource } from '../config/billing';

const router = Router();

router.get('/', (req, res) => {
  res.json({
    ok: true,
    count: listSkills().length,
    divisions: Array.from(new Set(listSkills().map((s) => s.manifest.division))),
    skills: listSkills().map((s) => s.manifest),
  });
});

router.get('/market', (req, res) => {
  res.json({ ok: true, skills: listMarketableSkills().map((s) => s.manifest) });
});

router.get('/:id', (req, res) => {
  const skill = getSkill(req.params.id);
  if (!skill) return res.status(404).json({ ok: false, error: '技能不存在' });
  res.json({ ok: true, skill: skill.manifest });
});

router.post('/:id/invoke', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const skill = getSkill(req.params.id);
    if (!skill) return res.status(404).json({ ok: false, error: '技能不存在' });

    if (skill.manifest.requireAuth && !req.user) {
      return res.status(401).json({ ok: false, error: '该技能需要登录' });
    }

    // 配额网关（与现有资源限流打通）
    if (skill.manifest.quotaResource) {
      const qRes: QuotaResource = skill.manifest.quotaResource as QuotaResource;
      // 等待配额中间件真正完成（超限时已写入 402 响应并直接返回）
      await new Promise<void>((resolve) => enforceQuota(qRes)(req, res, () => resolve()));
      if (res.headersSent) return; // 已被 enforceQuota 写入 402 响应，拦截
    }

    const result = await skill.invoke({
      userId: req.user?.id,
      teamId: req.body?.teamId,
      role: req.body?.role,
      input: req.body || {},
    });
    res.json({ ok: true, result });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

export default router;
