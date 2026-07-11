/**
 * 技能路由（agency-agents 名册的可发现入口 + 用户技能/外部市场扩展）
 * ----------------------------------------------------------------
 *  GET /api/skills                 列出全部内置技能（含 manifest）
 *  GET /api/skills/market          列出可上架开放 API 市场的技能
 *  GET /api/skills/mine            列出当前用户上传/安装的技能（需登录）
 *  GET /api/skills/catalog         外部技能市场「精选目录」（公开）
 *  POST /api/skills/import         导入声明式技能包（JSON，需登录）
 *  POST /api/skills/catalog/:id/install  一键安装外部目录条目（需登录）
 *  GET /api/skills/export/:id      导出技能为 JSON 包（?download=1 下载）
 *  GET /api/skills/:id             技能详情（内置或用户技能）
 *  POST /api/skills/:id/invoke     调用技能（经配额网关 + 团队 RBAC 守卫）
 *  DELETE /api/skills/:id          删除自己的用户技能（需登录）
 */
import { Router } from 'express';
import { listSkills, listMarketableSkills, getSkill } from '../skills/registry';
import { enforceQuota } from '../middleware/subscription';
import { optionalAuth, requireAuth, type AuthRequest } from '../middleware/auth';
import type { QuotaResource } from '../config/billing';
import { UserSkill } from '../models/UserSkill';
import { mcpService } from '../services/mcp.service';
import { workflowEngine } from '../services/workflow-engine.service';
import { route } from '../gateway/ai-gateway.service';
import { getCatalog, getCatalogEntry } from '../skills/external-market';
import { sanitizeSkillId, type SkillPackage } from '../skills/package-types';

const router = Router();

// ── 工具函数 ────────────────────────────────────────────

/** 把 {{var}} 占位符用调用入参替换；无模板时退化为取常见字段 */
function render(tpl: string | undefined, input: Record<string, any>): string {
  if (!tpl) {
    const v = input?.text ?? input?.input ?? input?.query ?? input?.message;
    if (v !== undefined) return String(v);
    return typeof input === 'object' ? JSON.stringify(input) : String(input ?? '');
  }
  return tpl.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) => {
    const v = input?.[key];
    return v === undefined ? '' : typeof v === 'string' ? v : JSON.stringify(v);
  });
}

/** 渲染 MCP 工具入参模板（仅对字符串值做占位符替换） */
function renderArgs(tpl: Record<string, any> | undefined, input: Record<string, any>): Record<string, any> {
  if (!tpl) return { ...input };
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(tpl)) {
    out[k] = typeof v === 'string' ? render(v, input) : v;
  }
  return out;
}

/** 用户技能 → 前端 manifest（附带 kind/source 标记） */
function toManifest(us: any) {
  return {
    id: us.skillId,
    name: us.name,
    description: us.description,
    division: us.division,
    color: us.color,
    coreMission: us.coreMission,
    criticalRules: us.criticalRules,
    successMetrics: us.successMetrics,
    minRole: us.minRole,
    requireAuth: us.requireAuth,
    marketable: us.marketable,
    kind: us.kind,
    source: 'user',
    tags: us.tags || [],
  };
}

/** 执行用户技能（prompt 走 AI 网关 / mcp 委托 MCP 服务 / workflow 委托工作流引擎） */
async function runUserSkill(
  us: any,
  ctx: { userId?: string; input: Record<string, any> }
): Promise<{ ok: boolean; data?: any; error?: string }> {
  if (us.kind === 'prompt') {
    const userMsg = render(us.prompt?.userTemplate, ctx.input);
    const r = await route({
      messages: [
        { role: 'system', content: us.prompt?.system || '' },
        { role: 'user', content: userMsg },
      ],
      maxTokens: us.prompt?.maxTokens ?? 800,
      temperature: us.prompt?.temperature ?? 0.5,
    });
    return { ok: true, data: { reply: r.reply } };
  }
  if (us.kind === 'mcp') {
    const srv = mcpService.getServer(us.mcp.serverId);
    if (!srv) return { ok: false, error: `引用的 MCP 服务器不存在：${us.mcp.serverId}` };
    if (srv.status !== 'connected') {
      try {
        await mcpService.connect(us.mcp.serverId);
      } catch (e: any) {
        return { ok: false, error: `MCP 连接失败：${e.message}` };
      }
    }
    const args = renderArgs(us.mcp.argsTemplate, ctx.input);
    const res = await mcpService.callTool(us.mcp.serverId, us.mcp.tool, args);
    return { ok: true, data: res };
  }
  if (us.kind === 'workflow') {
    const result = await workflowEngine.execute(us.workflow.workflowId, ctx.input, ctx.userId);
    return { ok: true, data: result };
  }
  return { ok: false, error: '未知技能类型' };
}

/** 配额中间件包裹为 Promise（超限时写入响应并 headersSent，便于提前返回） */
function guardQuota(q: QuotaResource, req: AuthRequest, res: any): Promise<void> {
  return new Promise<void>((resolve) => enforceQuota(q)(req, res, () => resolve()));
}

// ── 路由（注意顺序：固定路径须位于 /:id 之前） ──────────

router.get('/', (_req, res) => {
  res.json({
    ok: true,
    count: listSkills().length,
    divisions: Array.from(new Set(listSkills().map((s) => s.manifest.division))),
    skills: listSkills().map((s) => s.manifest),
  });
});

router.get('/market', (_req, res) => {
  res.json({ ok: true, skills: listMarketableSkills().map((s) => s.manifest) });
});

// 当前用户上传/安装的技能
router.get('/mine', requireAuth, async (req: AuthRequest, res) => {
  const list = await UserSkill.find({ owner: req.user!.id });
  res.json({ ok: true, skills: list.map(toManifest) });
});

// 外部技能市场精选目录（公开）
router.get('/catalog', (_req, res) => {
  const catalog = getCatalog().map((e) => ({
    id: e.id,
    name: e.name,
    source: e.source,
    kind: e.kind,
    category: e.category,
    description: e.description,
    officialUrl: e.officialUrl,
    installHint: e.installHint,
  }));
  res.json({ ok: true, catalog });
});

// 导入声明式技能包
router.post('/import', requireAuth, async (req: AuthRequest, res) => {
  try {
    const b = req.body;
    let pkgs: SkillPackage[] = [];
    if (Array.isArray(b)) pkgs = b;
    else if (Array.isArray(b?.skills)) pkgs = b.skills;
    else if (Array.isArray(b?.packages)) pkgs = b.packages;
    else if (b && b.manifest) pkgs = [b];

    if (pkgs.length === 0) {
      return res.status(400).json({ ok: false, error: '未识别到技能包（需要 { schema, manifest } 对象或数组）' });
    }

    const imported: { id: string; name: string }[] = [];
    for (const pkg of pkgs) {
      const m = pkg?.manifest;
      if (!m?.id || !m?.name) {
        return res.status(400).json({ ok: false, error: '技能包缺少 manifest.id 或 manifest.name' });
      }
      const skillId = sanitizeSkillId(m.id);
      await UserSkill.updateOne(
        { skillId, owner: req.user!.id },
        {
          skillId,
          owner: req.user!.id,
          name: m.name,
          description: m.description || '',
          division: m.division || 'productivity',
          color: m.color || '#6366f1',
          coreMission: m.coreMission || '',
          criticalRules: m.criticalRules || [],
          successMetrics: m.successMetrics || [],
          minRole: m.minRole || 'none',
          requireAuth: m.requireAuth ?? true,
          marketable: m.marketable ?? false,
          tags: m.tags || [],
          isPublic: m.isPublic ?? false,
          kind: pkg.kind || 'prompt',
          prompt: pkg.prompt,
          mcp: pkg.mcp,
          workflow: pkg.workflow,
        },
        { upsert: true }
      );
      imported.push({ id: skillId, name: m.name });
    }
    res.json({ ok: true, imported: imported.length, skills: imported });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// 一键安装外部目录条目
router.post('/catalog/:id/install', requireAuth, async (req: AuthRequest, res) => {
  const entry = getCatalogEntry(req.params.id);
  if (!entry) return res.status(404).json({ ok: false, error: '目录条目不存在' });
  try {
    if (entry.kind === 'link') {
      return res.json({ ok: true, type: 'link', message: '已打开外部市场链接', url: entry.officialUrl });
    }
    if (entry.kind === 'mcp' && entry.mcpConfig) {
      await mcpService.registerServer(entry.mcpConfig);
      return res.json({
        ok: true,
        type: 'mcp',
        message: `已安装 MCP 服务器：${entry.name}`,
        data: entry.mcpConfig,
        hint: entry.installHint,
      });
    }
    if (entry.kind === 'skill' && entry.skillPackage) {
      const pkg = entry.skillPackage;
      pkg.manifest.id = sanitizeSkillId(pkg.manifest.id);
      const m = pkg.manifest;
      await UserSkill.updateOne(
        { skillId: pkg.manifest.id, owner: req.user!.id },
        {
          skillId: pkg.manifest.id,
          owner: req.user!.id,
          name: m.name,
          description: m.description || '',
          division: m.division || 'productivity',
          color: m.color || '#6366f1',
          coreMission: m.coreMission || '',
          criticalRules: m.criticalRules || [],
          successMetrics: m.successMetrics || [],
          minRole: m.minRole || 'none',
          requireAuth: m.requireAuth ?? true,
          marketable: m.marketable ?? false,
          tags: m.tags || [],
          isPublic: m.isPublic ?? false,
          kind: pkg.kind || 'prompt',
          prompt: pkg.prompt,
          mcp: pkg.mcp,
          workflow: pkg.workflow,
        },
        { upsert: true }
      );
      return res.json({ ok: true, type: 'skill', message: `已安装技能：${entry.name}`, id: pkg.manifest.id });
    }
    return res.status(400).json({ ok: false, error: '该条目暂不支持一键安装' });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// 导出技能为 JSON 包
router.get('/export/:id', optionalAuth, async (req: AuthRequest, res) => {
  const id = req.params.id;
  let pkg: any = null;

  const builtin = getSkill(id);
  if (builtin) {
    const m = builtin.manifest;
    pkg = { schema: 'reasonix.skill/1.0', manifest: { ...m }, kind: 'prompt' };
  } else {
    const us = await UserSkill.findOne({ skillId: id });
    if (!us) return res.status(404).json({ ok: false, error: '技能不存在' });
    if (!us.isPublic && (!req.user || req.user.id !== us.owner)) {
      return res.status(403).json({ ok: false, error: '无权限导出该技能' });
    }
    pkg = {
      schema: 'reasonix.skill/1.0',
      manifest: {
        id: us.skillId,
        name: us.name,
        description: us.description,
        division: us.division,
        color: us.color,
        coreMission: us.coreMission,
        criticalRules: us.criticalRules,
        successMetrics: us.successMetrics,
        minRole: us.minRole,
        requireAuth: us.requireAuth,
        marketable: us.marketable,
        tags: us.tags,
        isPublic: us.isPublic,
      },
      kind: us.kind,
      prompt: us.prompt,
      mcp: us.mcp,
      workflow: us.workflow,
    };
  }

  if (req.query.download === '1') {
    res.setHeader('Content-Disposition', `attachment; filename="${id}.json"`);
    res.setHeader('Content-Type', 'application/json');
    return res.send(JSON.stringify(pkg, null, 2));
  }
  res.json({ ok: true, package: pkg });
});

// 技能详情（内置或用户技能）
router.get('/:id', async (req, res) => {
  const builtin = getSkill(req.params.id);
  if (builtin) return res.json({ ok: true, skill: builtin.manifest });
  const us = await UserSkill.findOne({ skillId: req.params.id });
  if (!us) return res.status(404).json({ ok: false, error: '技能不存在' });
  res.json({
    ok: true,
    skill: toManifest(us),
    detail: { kind: us.kind, prompt: us.prompt, mcp: us.mcp, workflow: us.workflow },
  });
});

// 调用技能
router.post('/:id/invoke', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const builtin = getSkill(req.params.id);
    if (builtin) {
      if (builtin.manifest.requireAuth && !req.user) {
        return res.status(401).json({ ok: false, error: '该技能需要登录' });
      }
      if (builtin.manifest.quotaResource) {
        await guardQuota(builtin.manifest.quotaResource as QuotaResource, req, res);
        if (res.headersSent) return;
      }
      const result = await builtin.invoke({
        userId: req.user?.id,
        teamId: req.body?.teamId,
        role: req.body?.role,
        input: req.body || {},
      });
      return res.json({ ok: true, result });
    }

    const us = await UserSkill.findOne({ skillId: req.params.id });
    if (!us) return res.status(404).json({ ok: false, error: '技能不存在' });
    if (us.requireAuth && !req.user) {
      return res.status(401).json({ ok: false, error: '该技能需要登录' });
    }

    if (us.kind === 'prompt') {
      await guardQuota('ai_chat', req, res);
      if (res.headersSent) return;
    } else if (us.kind === 'mcp') {
      await guardQuota('mcp_call', req, res);
      if (res.headersSent) return;
    }

    const result = await runUserSkill(us, { userId: req.user?.id, input: req.body || {} });
    res.json({ ok: true, result });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// 删除自己的用户技能
router.delete('/:id', requireAuth, async (req: AuthRequest, res) => {
  const us = await UserSkill.findOne({ skillId: req.params.id });
  if (!us) return res.status(404).json({ ok: false, error: '技能不存在或不可删除（内置技能不可删除）' });
  if (us.owner !== req.user!.id) return res.status(403).json({ ok: false, error: '只能删除自己上传的技能' });
  await UserSkill.deleteOne({ skillId: req.params.id });
  res.json({ ok: true, message: '已删除' });
});

export default router;
