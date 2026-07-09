import { Router, Request, Response } from 'express';
import { KnowledgeDocument } from '../models/KnowledgeDocument';
import { Team } from '../models/Team';
import { AuthRequest, optionalAuth, requireAuth } from '../middleware/auth';
import { canAccessResource } from '../middleware/resourceAccess';
import { sendError } from '../lib/http-error';
import { TeamRole } from '../models/Team';

const router = Router();

/** 解析当前用户对某文档的访问（owner / 团队成员），用于读写守卫 */
async function resolveDocMemberRole(doc: any, userId?: string): Promise<TeamRole | null> {
  if (!userId || !doc.teamId) return null;
  const team = await Team.findById(doc.teamId).lean();
  if (!team) return null;
  const member = (team.members as any[]).find((m) => m.userId === userId);
  return (member?.role as TeamRole) || null;
}

// 创建知识文档（支持归属团队，团队资源级隔离）
router.post('/', optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { title, content, tags, categories, isPublic, teamId } = req.body;

    if (!title || !content) {
      return res.status(400).json({ error: 'Title and content are required' });
    }
    if (teamId && !/^[a-fA-F0-9]{24}$/.test(teamId)) {
      return res.status(400).json({ error: 'teamId 不是合法的团队 ID' });
    }
    if (!req.user?.id) {
      return res.status(401).json({ error: '请先登录后再创建文档' });
    }

    // 归属团队时校验：必须是该团队成员（>= member）
    if (teamId) {
      const team = await Team.findById(teamId).lean();
      const member = team?.members?.find((m: any) => m.userId === req.user!.id);
      if (!member || !canAccessResource({ userId: req.user.id, memberRole: member.role, minRole: 'member' })) {
        return res.status(403).json({ error: '你不是该团队成员，无法在此团队下创建文档' });
      }
    }

    const doc = new KnowledgeDocument({
      title,
      content,
      tags: tags || [],
      categories: categories || [],
      isPublic: isPublic !== undefined ? isPublic : true,
      author: req.user.id,
      teamId: teamId || undefined,
    });

    await doc.save();

    res.status(201).json({
      success: true,
      data: doc
    });
  } catch (error) {
    sendError(res, error);
  }
});

// 获取文档列表（支持分页、搜索、过滤）
router.get('/', async (req: Request, res: Response) => {
  try {
    const {
      page = '1',
      limit = '10',
      search,
      tags,
      categories,
      sortBy = 'createdAt',
      order = 'desc'
    } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    // 构建查询
    let query: any = {};

    // 全文搜索
    if (search) {
      query.$text = { $search: search };
    }

    // 标签过滤
    if (tags) {
      const tagArray = (tags as string).split(',').map(t => t.trim());
      query.tags = { $in: tagArray };
    }

    // 分类过滤
    if (categories) {
      const categoryArray = (categories as string).split(',').map(c => c.trim());
      query.categories = { $in: categoryArray };
    }

    // 排序
    const sort: any = {};
    sort[sortBy as string] = order === 'asc' ? 1 : -1;

    // 执行查询
    const [docs, total] = await Promise.all([
      KnowledgeDocument.find(query)
        .sort(sort)
        .skip(skip)
        .limit(limitNum)
        .populate('author', 'username')
        .select('-embedding -htmlContent'), // 不返回向量和 HTML
      KnowledgeDocument.countDocuments(query)
    ]);

    res.json({
      success: true,
      data: docs,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    sendError(res, error);
  }
});

// 获取单个文档详情（私有文档需鉴权与访问权限）
router.get('/:id', optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const doc = await KnowledgeDocument.findById(req.params.id)
      .populate('author', 'username')
      .populate('relatedDocs', 'title');

    if (!doc) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // 私有文档：校验当前用户访问权限
    if (!doc.isPublic) {
      const memberRole = await resolveDocMemberRole(doc, req.user?.id);
      const allowed = canAccessResource({
        userId: req.user?.id,
        author: doc.author,
        memberRole,
        minRole: 'viewer',
      });
      if (!allowed) {
        return res.status(403).json({ error: '无权访问该私有文档' });
      }
    }

    // 增加浏览次数
    doc.viewCount += 1;
    await doc.save();

    res.json({
      success: true,
      data: doc
    });
  } catch (error) {
    sendError(res, error);
  }
});

// 更新文档（作者或团队成员 >= member）
router.put('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { title, content, tags, categories, isPublic } = req.body;

    const doc = await KnowledgeDocument.findById(req.params.id);

    if (!doc) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const memberRole = await resolveDocMemberRole(doc, req.user!.id);
    if (!canAccessResource({ userId: req.user!.id, author: doc.author, memberRole, minRole: 'member' })) {
      return res.status(403).json({ error: '无权编辑该文档' });
    }

    // 更新字段
    if (title !== undefined) doc.title = title;
    if (content !== undefined) doc.content = content;
    if (tags !== undefined) doc.tags = tags;
    if (categories !== undefined) doc.categories = categories;
    if (isPublic !== undefined) doc.isPublic = isPublic;

    await doc.save();

    res.json({
      success: true,
      data: doc
    });
  } catch (error) {
    sendError(res, error);
  }
});

// 删除文档（作者或团队成员 >= member）
router.delete('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const doc = await KnowledgeDocument.findById(req.params.id);

    if (!doc) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const memberRole = await resolveDocMemberRole(doc, req.user!.id);
    if (!canAccessResource({ userId: req.user!.id, author: doc.author, memberRole, minRole: 'member' })) {
      return res.status(403).json({ error: '无权删除该文档' });
    }

    await doc.deleteOne();

    res.json({
      success: true,
      message: 'Document deleted successfully'
    });
  } catch (error) {
    sendError(res, error);
  }
});

// 获取所有标签和分类（用于过滤）
router.get('/meta/tags-and-categories', async (req: Request, res: Response) => {
  try {
    const [tags, categories] = await Promise.all([
      KnowledgeDocument.distinct('tags'),
      KnowledgeDocument.distinct('categories')
    ]);

    res.json({
      success: true,
      data: {
        tags: tags.filter(t => t), // 过滤空值
        categories: categories.filter(c => c)
      }
    });
  } catch (error) {
    sendError(res, error);
  }
});

export default router;
