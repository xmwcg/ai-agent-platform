"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * 知识图谱路由
 *
 * GET /api/knowledge-graph
 *   - 返回知识图谱（节点 + 边），供前端力导向图渲染。
 *   - 支持团队隔离：传入 teamId 时仅返回「该团队文档 + 公开文档」，且要求当前用户是团队成员（viewer+）。
 *   - 查询参数：
 *       teamId?             团队 ID（团队资源级隔离）
 *       includeTags?       'false' 时不生成标签节点（默认 true）
 *       includeCategories? 'false' 时不生成分类节点（默认 true）
 *       minSharedTags?     doc-doc 共现边最小共享标签数（默认 1）
 *       limit?             文档取样上限（默认 500，最大 2000）
 */
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const Team_1 = require("../models/Team");
const resourceAccess_1 = require("../middleware/resourceAccess");
const knowledge_graph_service_1 = require("../services/knowledge-graph.service");
const http_error_1 = require("../lib/http-error");
const router = (0, express_1.Router)();
router.get('/', auth_1.optionalAuth, async (req, res) => {
    try {
        const teamId = req.query.teamId;
        const includeTags = req.query.includeTags !== 'false';
        const includeCategories = req.query.includeCategories !== 'false';
        const minSharedTags = Math.max(1, parseInt(req.query.minSharedTags) || 1);
        const limit = Math.min(2000, Math.max(1, parseInt(req.query.limit) || 500));
        // 团队隔离：指定 teamId 时需是该团队成员（viewer+）
        if (teamId) {
            if (!/^[a-fA-F0-9]{24}$/.test(teamId)) {
                return res.status(400).json({ success: false, error: 'teamId 不是合法的团队 ID' });
            }
            if (!req.user?.id) {
                return res.status(401).json({ success: false, error: '请先登录以查看团队知识图谱' });
            }
            const team = await Team_1.Team.findById(teamId).lean();
            if (!team)
                return res.status(404).json({ success: false, error: '团队不存在' });
            const member = team.members?.find((m) => m.userId === req.user.id);
            if (!member || !(0, resourceAccess_1.canAccessResource)({ userId: req.user.id, memberRole: member.role, minRole: 'viewer' })) {
                return res.status(403).json({ success: false, error: '你不是该团队成员，无法查看其知识图谱' });
            }
        }
        const graph = await (0, knowledge_graph_service_1.buildKnowledgeGraph)({ teamId, includeTags, includeCategories, minSharedTags, limit });
        res.json({ success: true, data: graph });
    }
    catch (err) {
        (0, http_error_1.sendError)(res, err);
    }
});
exports.default = router;
//# sourceMappingURL=knowledge-graph.js.map