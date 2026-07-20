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
import { Router, Request, Response } from 'express';
import { AuthRequest, optionalAuth } from '../middleware/auth';
import { Team } from '../models/Team';
import { canAccessResource } from '../middleware/resourceAccess';
import { buildKnowledgeGraph } from '../services/knowledge-graph.service';
import { sendError } from '../lib/http-error';

const router = Router();

router.get('/', optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const teamId = req.query.teamId as string | undefined;
    const includeTags = req.query.includeTags !== 'false';
    const includeCategories = req.query.includeCategories !== 'false';
    const minSharedTags = Math.max(1, parseInt(req.query.minSharedTags as string) || 1);
    const limit = Math.min(2000, Math.max(1, parseInt(req.query.limit as string) || 0));

    // 团队隔离：指定 teamId 时需是该团队成员（viewer+）
    if (teamId) {
      if (!/^[a-fA-F0-9]{24}$/.test(teamId)) {
        return res.status(400).json({ success: false, error: 'teamId 不是合法的团队 ID' });
      }
      if (!req.user?.id) {
        return res.status(401).json({ success: false, error: '请先登录以查看团队知识图谱' });
      }
      const team = await Team.findById(teamId).lean();
      if (!team) return res.status(404).json({ success: false, error: '团队不存在' });
      const member = (team.members as any[])?.find((m) => m.userId === req.user!.id);
      if (!member || !canAccessResource({ userId: req.user.id, memberRole: member.role, minRole: 'viewer' })) {
        return res.status(403).json({ success: false, error: '你不是该团队成员，无法查看其知识图谱' });
      }
    }

    const graph = await buildKnowledgeGraph({ teamId, includeTags, includeCategories, minSharedTags, limit });
    res.json({ success: true, data: graph });
  } catch (err) {
    sendError(res, err);
  }
});

export default router;
