import { Router, Response } from 'express';
import { optionalAuth, AuthRequest } from '../middleware/auth';
import { KnowledgeDocument } from '../models/KnowledgeDocument';
import { Course } from '../models/Course';
import { UserSkill } from '../models/UserSkill';
import { Workflow } from '../models/Workflow';
import { ModelEvent } from '../models/ModelEvent';
import { Team } from '../models/Team';
import { PROVIDER_CATALOG } from '../config/provider-catalog';
import { sendError } from '../lib/http-error';

const router = Router();
const ALLOWED_TYPES = new Set(['knowledge', 'course', 'skill', 'workflow', 'provider', 'model_event']);

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function score(title: string, query: string): number {
  const source = title.toLowerCase();
  const needle = query.toLowerCase();
  if (source === needle) return 100;
  if (source.startsWith(needle)) return 85;
  if (source.includes(needle)) return 70;
  return 45;
}

router.get('/', optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const q = String(req.query.q || '').trim();
    if (q.length < 2 || q.length > 80) {
      return res.status(400).json({ success: false, error: '搜索词长度必须为 2–80 个字符' });
    }
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 20);
    const requested = String(req.query.types || '')
      .split(',').map((item) => item.trim()).filter((item) => ALLOWED_TYPES.has(item));
    const types = requested.length ? new Set(requested) : ALLOWED_TYPES;
    const pattern = new RegExp(escapeRegex(q), 'i');
    const userId = req.user?.id;
    const teams = userId
      ? await Team.find({ $or: [{ ownerId: userId }, { 'members.userId': userId }] }).select('_id').lean()
      : [];
    const teamIds = teams.map((team: any) => String(team._id));

    const tasks: Promise<any[]>[] = [];
    if (types.has('knowledge')) {
      const access: any[] = [{ isPublic: true }];
      if (userId) access.push({ author: userId }, { teamId: { $in: teamIds } });
      tasks.push(KnowledgeDocument.find({
        $and: [
          { $or: access },
          { $or: [{ title: pattern }, { summary: pattern }, { tags: pattern }, { categories: pattern }] },
        ],
      }).select('title summary tags isPublic author teamId requiredPlan creditsCost price').limit(limit).lean()
        .then((rows) => rows.map((row: any) => {
          const owned = userId && (String(row.author) === userId || teamIds.includes(String(row.teamId || '')));
          const locked = !owned && ((row.requiredPlan && row.requiredPlan !== 'free') || Number(row.creditsCost) > 0 || Number(row.price) > 0);
          return {
            id: String(row._id), type: 'knowledge', title: row.title,
            summary: row.summary || undefined, path: `/knowledge/${row._id}`, group: '知识内容',
            access: locked ? 'locked' : (owned ? 'authorized' : 'public'), score: score(row.title, q),
          };
        })));
    }
    if (types.has('course')) {
      tasks.push(Course.find({ isPublished: true, $or: [{ title: pattern }, { description: pattern }, { tags: pattern }, { category: pattern }] })
        .select('title description').limit(limit).lean()
        .then((rows) => rows.map((row: any) => ({
          id: String(row._id), type: 'course', title: row.title, summary: row.description,
          path: `/courses/${row._id}`, group: '课程', access: 'public', score: score(row.title, q),
        }))));
    }
    if (types.has('skill')) {
      const access: any[] = [{ isPublic: true }];
      if (userId) access.push({ owner: userId });
      tasks.push(UserSkill.find({ $and: [{ $or: access }, { $or: [{ name: pattern }, { description: pattern }, { tags: pattern }] }] })
        .select('name description isPublic owner skillId').limit(limit).lean()
        .then((rows) => rows.map((row: any) => ({
          id: String(row._id), type: 'skill', title: row.name, summary: row.description,
          path: '/skills', group: '技能', access: row.isPublic ? 'public' : 'authorized', score: score(row.name, q),
        }))));
    }
    if (types.has('workflow')) {
      const access: any[] = [{ isPublic: true, isPublished: true }];
      if (userId) access.push({ owner: userId });
      tasks.push(Workflow.find({ $and: [{ $or: access }, { $or: [{ name: pattern }, { description: pattern }, { tags: pattern }, { category: pattern }] }] })
        .select('name description isPublic owner').limit(limit).lean()
        .then((rows) => rows.map((row: any) => ({
          id: String(row._id), type: 'workflow', title: row.name, summary: row.description,
          path: `/workflow/${row._id}`, group: '工作流', access: row.isPublic ? 'public' : 'authorized', score: score(row.name, q),
        }))));
    }
    if (types.has('model_event')) {
      tasks.push(ModelEvent.find({ $or: [{ modelName: pattern }, { description: pattern }, { provider: pattern }] })
        .select('modelName description').limit(limit).lean()
        .then((rows) => rows.map((row: any) => ({
          id: String(row._id), type: 'model_event', title: row.modelName, summary: row.description,
          path: '/calendar', group: '模型日历', access: 'public', score: score(row.modelName, q),
        }))));
    }
    if (types.has('provider')) {
      const providerRows = PROVIDER_CATALOG.filter((provider) => [
        provider.name, provider.id, provider.category, ...provider.capabilities,
        ...provider.recommendedModels, ...provider.protocols.map((protocol) => protocol.name),
      ].some((value) => String(value).toLowerCase().includes(q.toLowerCase())))
        .map((provider) => ({
          id: provider.id, type: 'provider', title: provider.name,
          summary: `${provider.protocols.map((item) => item.name).join(' / ')} · ${provider.endpoints.map((item) => item.region).join(' / ')}`,
          path: `/query-center?provider=${encodeURIComponent(provider.id)}`,
          group: '厂商与文档', access: 'public', score: score(provider.name, q),
          matchedKeywords: provider.recommendedModels.filter((model) => model.toLowerCase().includes(q.toLowerCase())),
        }));
      tasks.push(Promise.resolve(providerRows));
    }

    const results = (await Promise.all(tasks)).flat()
      .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title, 'zh-CN'))
      .slice(0, limit);
    res.json({ success: true, data: results, meta: { query: q, limit, authenticated: Boolean(userId) } });
  } catch (error) {
    sendError(res, error);
  }
});

export default router;
