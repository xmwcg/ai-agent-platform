"use strict";
/**
 * 工作流路由
 * CRUD + 执行 + 发布，对标 Langflow/Dify 的工作流管理
 */
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const Workflow_1 = require("../models/Workflow");
const workflow_engine_service_1 = require("../services/workflow-engine.service");
const auth_1 = require("../middleware/auth");
const subscription_1 = require("../middleware/subscription");
const http_error_1 = require("../lib/http-error");
const router = (0, express_1.Router)();
// ─── 根路由：返回工作流能力和入口 ───
router.get('/capabilities', (_req, res) => {
    res.json({
        success: true,
        data: {
            capabilities: [
                { type: 'workflow_list', label: '我的工作流', path: '/api/workflows', desc: '查看已创建的工作流' },
                { type: 'node_types', label: '节点类型', path: '/api/workflows/node-types', desc: '查看可用节点类型' },
                { type: 'create', label: '创建工作流', path: '/api/wf', desc: '创建新的工作流' },
                { type: 'import', label: '导入工作流包', path: '/api/workflows/import', desc: '导入Agent工具流包' },
            ],
        },
    });
});
// ── 获取可用节点类型 ──────────────────────────────────
router.get('/node-types', (_req, res) => {
    res.json({ success: true, data: Workflow_1.NODE_TYPES });
});
// ── 工作流导入/导出（Agent 工具流包） ────────────────
/** 导入工作流包：单个对象 / 数组 / { workflows: [] } */
router.post('/import', auth_1.requireAuth, async (req, res) => {
    try {
        const b = req.body;
        let items = [];
        if (Array.isArray(b))
            items = b;
        else if (Array.isArray(b?.workflows))
            items = b.workflows;
        else if (b && b.name)
            items = [b];
        if (items.length === 0) {
            return res.status(400).json({ success: false, error: '未识别到工作流包（需要 { name, nodes, edges } 或数组）' });
        }
        const created = [];
        for (const it of items) {
            if (!it.name)
                return res.status(400).json({ success: false, error: '工作流缺少 name' });
            const wf = await Workflow_1.Workflow.create({
                name: it.name,
                description: it.description || '',
                nodes: it.nodes || [],
                edges: it.edges || [],
                owner: req.user.id,
                isPublic: false,
                tags: it.tags || [],
                category: it.category || '通用',
            });
            created.push(String(wf._id));
        }
        res.status(201).json({ success: true, imported: created.length, ids: created });
    }
    catch (err) {
        (0, http_error_1.sendError)(res, err);
    }
});
// ── 工作流 CRUD ──────────────────────────────────────
/** 兼容 /list 别名（避免被 /:id 匹配为 ObjectId） */
router.get('/list', auth_1.requireAuth, async (req, res) => {
    try {
        const { category, page = 1, limit = 20 } = req.query;
        const filter = { owner: req.user.id };
        if (category)
            filter.category = category;
        const total = await Workflow_1.Workflow.countDocuments(filter);
        const items = await Workflow_1.Workflow.find(filter)
            .sort({ updatedAt: -1 })
            .skip((Number(page) - 1) * Number(limit))
            .limit(Number(limit))
            .select('-nodes.__v')
            .lean();
        res.json({ success: true, data: { items, total, page: Number(page), limit: Number(limit) } });
    }
    catch (err) {
        (0, http_error_1.sendError)(res, err);
    }
});
/** 获取当前用户的工作流列表 */
router.get('/', auth_1.requireAuth, async (req, res) => {
    try {
        const { category, isPublic: isPublicStr, page = 1, limit = 20 } = req.query;
        const filter = { owner: req.user.id };
        if (category)
            filter.category = category;
        if (isPublicStr === 'true')
            filter.isPublic = true;
        const workflows = await Workflow_1.Workflow.find(filter)
            .select('-nodes -edges') // 列表不返回节点详情
            .sort({ updatedAt: -1 })
            .skip((+page - 1) * +limit)
            .limit(+limit);
        const total = await Workflow_1.Workflow.countDocuments(filter);
        res.json({
            success: true,
            data: workflows,
            pagination: { page: +page, limit: +limit, total },
        });
    }
    catch (err) {
        (0, http_error_1.sendError)(res, err);
    }
});
/** 公开工作流（模板市场） */
router.get('/public', async (req, res) => {
    try {
        const { category, page = 1, limit = 20 } = req.query;
        const filter = { isPublic: true };
        if (category)
            filter.category = category;
        const workflows = await Workflow_1.Workflow.find(filter)
            .select('-nodes -edges')
            .sort({ runCount: -1, updatedAt: -1 })
            .skip((+page - 1) * +limit)
            .limit(+limit);
        const total = await Workflow_1.Workflow.countDocuments(filter);
        res.json({ success: true, data: workflows, pagination: { page: +page, limit: +limit, total } });
    }
    catch (err) {
        (0, http_error_1.sendError)(res, err);
    }
});
/** 导出单个工作流为包（Agent 工具流包） */
router.get('/:id/export', auth_1.optionalAuth, async (req, res) => {
    try {
        const wf = await Workflow_1.Workflow.findById(req.params.id);
        if (!wf)
            return res.status(404).json({ success: false, error: 'Workflow not found' });
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
    }
    catch (err) {
        (0, http_error_1.sendError)(res, err);
    }
});
/** 获取单个工作流详情（含节点/连线） */
router.get('/:id', auth_1.optionalAuth, async (req, res) => {
    try {
        const workflow = await Workflow_1.Workflow.findById(req.params.id);
        if (!workflow)
            return res.status(404).json({ error: 'Workflow not found' });
        res.json({ success: true, data: workflow });
    }
    catch (err) {
        (0, http_error_1.sendError)(res, err);
    }
});
/** 创建新工作流 */
router.post('/', auth_1.requireAuth, (0, subscription_1.enforceQuota)('rag_upload'), async (req, res) => {
    try {
        const { name, description, nodes, edges, tags, category, isPublic, teamId } = req.body;
        const workflow = await Workflow_1.Workflow.create({
            name: name || '未命名工作流',
            description,
            nodes: nodes || [],
            edges: edges || [],
            owner: req.user.id,
            teamId,
            isPublic: isPublic || false,
            tags: tags || [],
            category: category || '通用',
        });
        if (req.user?.id)
            await (0, subscription_1.quotaIncrement)(req.user.id, 'rag_upload');
        res.status(201).json({ success: true, data: workflow });
    }
    catch (err) {
        (0, http_error_1.sendError)(res, err);
    }
});
/** 更新工作流 */
router.put('/:id', auth_1.requireAuth, async (req, res) => {
    try {
        const workflow = await Workflow_1.Workflow.findById(req.params.id);
        if (!workflow)
            return res.status(404).json({ error: 'Workflow not found' });
        if (workflow.owner !== req.user.id)
            return res.status(403).json({ error: 'Unauthorized' });
        const { name, description, nodes, edges, tags, category, isPublic } = req.body;
        if (name !== undefined)
            workflow.name = name;
        if (description !== undefined)
            workflow.description = description;
        if (nodes !== undefined)
            workflow.nodes = nodes;
        if (edges !== undefined)
            workflow.edges = edges;
        if (tags !== undefined)
            workflow.tags = tags;
        if (category !== undefined)
            workflow.category = category;
        if (isPublic !== undefined)
            workflow.isPublic = isPublic;
        workflow.version += 1;
        await workflow.save();
        res.json({ success: true, data: workflow });
    }
    catch (err) {
        (0, http_error_1.sendError)(res, err);
    }
});
/** 删除工作流 */
router.delete('/:id', auth_1.requireAuth, async (req, res) => {
    try {
        const workflow = await Workflow_1.Workflow.findById(req.params.id);
        if (!workflow)
            return res.status(404).json({ error: 'Workflow not found' });
        if (workflow.owner !== req.user.id)
            return res.status(403).json({ error: 'Unauthorized' });
        await Workflow_1.Workflow.findByIdAndDelete(req.params.id);
        await Workflow_1.WorkflowRun.deleteMany({ workflowId: req.params.id });
        res.json({ success: true, message: 'Workflow deleted' });
    }
    catch (err) {
        (0, http_error_1.sendError)(res, err);
    }
});
/** 复制工作流 */
router.post('/:id/clone', auth_1.requireAuth, async (req, res) => {
    try {
        const source = await Workflow_1.Workflow.findById(req.params.id);
        if (!source)
            return res.status(404).json({ error: 'Workflow not found' });
        const clone = await Workflow_1.Workflow.create({
            name: `${source.name} (副本)`,
            description: source.description,
            nodes: source.nodes,
            edges: source.edges,
            owner: req.user.id,
            tags: source.tags,
            category: source.category,
            isPublic: false,
        });
        res.status(201).json({ success: true, data: clone });
    }
    catch (err) {
        (0, http_error_1.sendError)(res, err);
    }
});
// ── 执行与发布 ──────────────────────────────────────
/** 执行工作流（调试模式） */
router.post('/:id/execute', auth_1.requireAuth, (0, subscription_1.enforceQuota)('ai_chat'), async (req, res) => {
    try {
        const result = await workflow_engine_service_1.workflowEngine.execute(req.params.id, req.body.input || { userInput: req.body.userInput || '' }, req.user.id);
        if (req.user?.id)
            await (0, subscription_1.quotaIncrement)(req.user.id, 'ai_chat');
        res.json({ success: true, data: result });
    }
    catch (err) {
        (0, http_error_1.sendError)(res, err);
    }
});
/** 发布工作流为 API */
router.post('/:id/publish', auth_1.requireAuth, async (req, res) => {
    try {
        const result = await workflow_engine_service_1.workflowEngine.publishWorkflow(req.params.id);
        res.json({ success: true, data: result });
    }
    catch (err) {
        (0, http_error_1.sendError)(res, err);
    }
});
/** 取消发布 */
router.post('/:id/unpublish', auth_1.requireAuth, async (req, res) => {
    try {
        await workflow_engine_service_1.workflowEngine.unpublishWorkflow(req.params.id);
        res.json({ success: true, message: 'Unpublished' });
    }
    catch (err) {
        (0, http_error_1.sendError)(res, err);
    }
});
// ── 执行记录 ────────────────────────────────────────
router.get('/:id/runs', auth_1.requireAuth, async (req, res) => {
    try {
        const runs = await Workflow_1.WorkflowRun.find({ workflowId: req.params.id })
            .select('-nodeExecutions')
            .sort({ createdAt: -1 })
            .limit(20);
        res.json({ success: true, data: runs });
    }
    catch (err) {
        (0, http_error_1.sendError)(res, err);
    }
});
router.get('/:id/runs/:runId', auth_1.requireAuth, async (req, res) => {
    try {
        const run = await Workflow_1.WorkflowRun.findById(req.params.runId);
        if (!run)
            return res.status(404).json({ error: 'Run not found' });
        res.json({ success: true, data: run });
    }
    catch (err) {
        (0, http_error_1.sendError)(res, err);
    }
});
// ── 公开执行端点（发布后可通过 API Key 调用） ──────
router.post('/run/:id', async (req, res) => {
    try {
        const workflow = await Workflow_1.Workflow.findById(req.params.id);
        if (!workflow)
            return res.status(404).json({ error: 'Workflow not found' });
        if (!workflow.isPublished)
            return res.status(403).json({ error: 'Workflow not published' });
        // 验证 API Key（可选）
        const apiKey = req.headers['x-api-key'] || req.query.apiKey;
        if (workflow.apiKey && apiKey !== workflow.apiKey) {
            return res.status(401).json({ error: 'Invalid API key' });
        }
        const result = await workflow_engine_service_1.workflowEngine.execute(workflow, req.body.input || req.body, req.body.userId);
        res.json({ success: true, data: result });
    }
    catch (err) {
        (0, http_error_1.sendError)(res, err);
    }
});
exports.default = router;
//# sourceMappingURL=workflows.js.map