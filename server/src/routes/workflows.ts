/**
 * 工作流路由
 * CRUD + 执行 + 发布，对标 Langflow/Dify 的工作流管理
 */

import { Router, Response } from 'express';
import { Workflow, WorkflowRun, NODE_TYPES } from '../models/Workflow';
import { workflowEngine } from '../services/workflow-engine.service';
import { requireAuth, optionalAuth, AuthRequest } from '../middleware/auth';
import { enforceQuota, quotaIncrement } from '../middleware/subscription';
import { sendError } from '../lib/http-error';
import { logger } from '../lib/logger';

const router = Router();

// ── 获取可用节点类型 ──────────────────────────────────

router.get('/node-types', (_req, res: Response) => {
  res.json({ success: true, data: NODE_TYPES });
});

// ── 工作流导入/导出（Agent 工具流包） ────────────────

/** 导入工作流包：单个对象 / 数组 / { workflows: [] } */
router.post('/import', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const b = req.body;
    let items: any[] = [];
    if (Array.isArray(b)) items = b;
    else if (Array.isArray(b?.workflows)) items = b.workflows;
    else if (b && b.name) items = [b];

    if (items.length === 0) {
      return res.status(400).json({ success: false, error: '未识别到工作流包（需要 { name, nodes, edges } 或数组）' });
    }
    const created: string[] = [];
    for (const it of items) {
      if (!it.name) return res.status(400).json({ success: false, error: '工作流缺少 name' });
      const wf = await Workflow.create({
        name: it.name,
        description: it.description || '',
        nodes: it.nodes || [],
        edges: it.edges || [],
        owner: req.user!.id,
        isPublic: false,
        tags: it.tags || [],
        category: it.category || '通用',
      });
      created.push(String(wf._id));
    }
    res.status(201).json({ success: true, imported: created.length, ids: created });
  } catch (err) { sendError(res, err); }
});

// ── 工作流 CRUD ──────────────────────────────────────

/** 获取当前用户的工作流列表 */
router.get('/', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { category, isPublic: isPublicStr, page = 1, limit = 20 } = req.query;
    const filter: any = { owner: req.user!.id };
    if (category) filter.category = category;
    if (isPublicStr === 'true') filter.isPublic = true;

    const workflows = await Workflow.find(filter)
      .select('-nodes -edges') // 列表不返回节点详情
      .sort({ updatedAt: -1 })
      .skip((+page - 1) * +limit)
      .limit(+limit);

    const total = await Workflow.countDocuments(filter);

    res.json({
      success: true,
      data: workflows,
      pagination: { page: +page, limit: +limit, total },
    });
  } catch (err) { sendError(res, err); }
});

/** 公开工作流（模板市场） */
router.get('/public', async (req, res: Response) => {
  try {
    const { category, page = 1, limit = 20 } = req.query;
    const filter: any = { isPublic: true };
    if (category) filter.category = category;

    const workflows = await Workflow.find(filter)
      .select('-nodes -edges')
      .sort({ runCount: -1, updatedAt: -1 })
      .skip((+page - 1) * +limit)
      .limit(+limit);

    const total = await Workflow.countDocuments(filter);

    res.json({ success: true, data: workflows, pagination: { page: +page, limit: +limit, total } });
  } catch (err) { sendError(res, err); }
});

/** 导出单个工作流为包（Agent 工具流包） */
router.get('/:id/export', optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const wf = await Workflow.findById(req.params.id);
    if (!wf) return res.status(404).json({ success: false, error: 'Workflow not found' });
    if (wf.isPublic !== true && (!req.user || String(wf.owner) !== req.user.id)) {
      return res.status(403).json({ success: false, error: '无权限导出该工作流' });
    }
    const pkg = {
      schema: 'reasonix.workflow/1.0',
      name: wf.name,
      description: wf.description,
      category: wf.category,
      tags: wf.tags,
      nodes: wf.nodes,
      edges: wf.edges,
    };
    if (req.query.download === '1') {
      res.setHeader('Content-Disposition', `attachment; filename="workflow-${wf._id}.json"`);
      res.setHeader('Content-Type', 'application/json');
      return res.send(JSON.stringify(pkg, null, 2));
    }
    res.json({ success: true, data: pkg });
  } catch (err) { sendError(res, err); }
});

/** 获取单个工作流详情（含节点/连线） */
router.get('/:id', optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const workflow = await Workflow.findById(req.params.id);
    if (!workflow) return res.status(404).json({ error: 'Workflow not found' });
    res.json({ success: true, data: workflow });
  } catch (err) { sendError(res, err); }
});

/** 创建新工作流 */
router.post('/', requireAuth, enforceQuota('rag_upload'), async (req: AuthRequest, res: Response) => {
  try {
    const { name, description, nodes, edges, tags, category, isPublic, teamId } = req.body;

    const workflow = await Workflow.create({
      name: name || '未命名工作流',
      description,
      nodes: nodes || [],
      edges: edges || [],
      owner: req.user!.id,
      teamId,
      isPublic: isPublic || false,
      tags: tags || [],
      category: category || '通用',
    });

    if (req.user?.id) await quotaIncrement(req.user.id, 'rag_upload');

    res.status(201).json({ success: true, data: workflow });
  } catch (err) { sendError(res, err); }
});

/** 更新工作流 */
router.put('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const workflow = await Workflow.findById(req.params.id);
    if (!workflow) return res.status(404).json({ error: 'Workflow not found' });
    if (workflow.owner !== req.user!.id) return res.status(403).json({ error: 'Unauthorized' });

    const { name, description, nodes, edges, tags, category, isPublic } = req.body;
    if (name !== undefined) workflow.name = name;
    if (description !== undefined) workflow.description = description;
    if (nodes !== undefined) workflow.nodes = nodes;
    if (edges !== undefined) workflow.edges = edges;
    if (tags !== undefined) workflow.tags = tags;
    if (category !== undefined) workflow.category = category;
    if (isPublic !== undefined) workflow.isPublic = isPublic;
    workflow.version += 1;

    await workflow.save();
    res.json({ success: true, data: workflow });
  } catch (err) { sendError(res, err); }
});

/** 删除工作流 */
router.delete('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const workflow = await Workflow.findById(req.params.id);
    if (!workflow) return res.status(404).json({ error: 'Workflow not found' });
    if (workflow.owner !== req.user!.id) return res.status(403).json({ error: 'Unauthorized' });

    await Workflow.findByIdAndDelete(req.params.id);
    await WorkflowRun.deleteMany({ workflowId: req.params.id });

    res.json({ success: true, message: 'Workflow deleted' });
  } catch (err) { sendError(res, err); }
});

/** 复制工作流 */
router.post('/:id/clone', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const source = await Workflow.findById(req.params.id);
    if (!source) return res.status(404).json({ error: 'Workflow not found' });

    const clone = await Workflow.create({
      name: `${source.name} (副本)`,
      description: source.description,
      nodes: source.nodes,
      edges: source.edges,
      owner: req.user!.id,
      tags: source.tags,
      category: source.category,
      isPublic: false,
    });

    res.status(201).json({ success: true, data: clone });
  } catch (err) { sendError(res, err); }
});

// ── 执行与发布 ──────────────────────────────────────

/** 执行工作流（调试模式） */
router.post('/:id/execute', requireAuth, enforceQuota('ai_chat'), async (req: AuthRequest, res: Response) => {
  try {
    const result = await workflowEngine.execute(
      req.params.id,
      req.body.input || { userInput: req.body.userInput || '' },
      req.user!.id
    );

    if (req.user?.id) await quotaIncrement(req.user.id, 'ai_chat');

    res.json({ success: true, data: result });
  } catch (err) { sendError(res, err); }
});

/** 发布工作流为 API */
router.post('/:id/publish', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const result = await workflowEngine.publishWorkflow(req.params.id);
    res.json({ success: true, data: result });
  } catch (err) { sendError(res, err); }
});

/** 取消发布 */
router.post('/:id/unpublish', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    await workflowEngine.unpublishWorkflow(req.params.id);
    res.json({ success: true, message: 'Unpublished' });
  } catch (err) { sendError(res, err); }
});

// ── 执行记录 ────────────────────────────────────────

router.get('/:id/runs', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const runs = await WorkflowRun.find({ workflowId: req.params.id })
      .select('-nodeExecutions')
      .sort({ createdAt: -1 })
      .limit(20);

    res.json({ success: true, data: runs });
  } catch (err) { sendError(res, err); }
});

router.get('/:id/runs/:runId', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const run = await WorkflowRun.findById(req.params.runId);
    if (!run) return res.status(404).json({ error: 'Run not found' });
    res.json({ success: true, data: run });
  } catch (err) { sendError(res, err); }
});

// ── 公开执行端点（发布后可通过 API Key 调用） ──────

router.post('/run/:id', async (req: AuthRequest, res: Response) => {
  try {
    const workflow = await Workflow.findById(req.params.id);
    if (!workflow) return res.status(404).json({ error: 'Workflow not found' });
    if (!workflow.isPublished) return res.status(403).json({ error: 'Workflow not published' });

    // 验证 API Key（可选）
    const apiKey = req.headers['x-api-key'] || req.query.apiKey;
    if (workflow.apiKey && apiKey !== workflow.apiKey) {
      return res.status(401).json({ error: 'Invalid API key' });
    }

    const result = await workflowEngine.execute(workflow, req.body.input || req.body, req.body.userId);
    res.json({ success: true, data: result });
  } catch (err) { sendError(res, err); }
});

export default router;
