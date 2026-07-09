import { Router, Request, Response } from 'express';
import { Course } from '../models/Course';
import { AuthRequest, requireAuth } from '../middleware/auth';
import { sendError } from '../lib/http-error';
import { logger } from '../lib/logger';

const router = Router();

// 创建课程（需登录）
router.post('/', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { title, description, category, level, tags, price, chapters } = req.body;

    if (!title || !description) {
      return res.status(400).json({ error: 'Title and description are required' });
    }

    const course = new Course({
      title,
      description,
      category,
      level: level || 'beginner',
      tags: tags || [],
      price: price || 0,
      chapters: chapters || [],
      instructor: req.user!.id
    });

    await course.save();

    res.status(201).json({
      success: true,
      data: course
    });
  } catch (error) {
    logger.error('courses', '创建课程失败', error);
    sendError(res, error);
  }
});

// 获取课程列表
router.get('/', async (req: Request, res: Response) => {
  try {
    const {
      page = '1',
      limit = '10',
      category,
      level,
      search,
      sortBy = 'createdAt',
      order = 'desc'
    } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    // 构建查询
    let query: any = { isPublished: true };

    if (category) query.category = category;
    if (level) query.level = level;
    if (search) query.$text = { $search: search };

    // 排序
    const sort: any = {};
    sort[sortBy as string] = order === 'asc' ? 1 : -1;

    const [courses, total] = await Promise.all([
      Course.find(query)
        .sort(sort)
        .skip(skip)
        .limit(limitNum)
        .select('-chapters.quiz'), // 不返回测验详情
      Course.countDocuments(query)
    ]);

    res.json({
      success: true,
      data: courses,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    logger.error('courses', '获取课程列表失败', error);
    sendError(res, error);
  }
});

// 获取课程详情
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const course = await Course.findById(req.params.id);

    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }

    res.json({
      success: true,
      data: course
    });
  } catch (error) {
    logger.error('courses', '获取课程详情失败', error);
    sendError(res, error);
  }
});

// 更新课程（需登录 + 仅作者）
router.put('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const course = await Course.findById(req.params.id);

    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }

    if (course.instructor.toString() !== req.user!.id) {
      return res.status(403).json({ error: '无权修改他人课程' });
    }

    const updates = req.body;
    Object.assign(course, updates);
    await course.save();

    res.json({
      success: true,
      data: course
    });
  } catch (error) {
    logger.error('courses', '更新课程失败', error);
    sendError(res, error);
  }
});

// 发布/取消发布课程（需登录 + 仅作者）
router.patch('/:id/publish', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { isPublished } = req.body;

    const course = await Course.findById(req.params.id);
    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }

    if (course.instructor.toString() !== req.user!.id) {
      return res.status(403).json({ error: '无权发布他人课程' });
    }

    course.isPublished = isPublished;
    await course.save();

    res.json({
      success: true,
      message: `Course ${isPublished ? 'published' : 'unpublished'} successfully`
    });
  } catch (error) {
    logger.error('courses', '更新发布状态失败', error);
    sendError(res, error);
  }
});

// 添加章节（需登录 + 仅作者）
router.post('/:id/chapters', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const course = await Course.findById(req.params.id);
    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }

    if (course.instructor.toString() !== req.user!.id) {
      return res.status(403).json({ error: '无权向他人课程添加章节' });
    }

    course.chapters.push(req.body);
    await course.save();

    res.json({
      success: true,
      data: course
    });
  } catch (error) {
    logger.error('courses', '添加章节失败', error);
    sendError(res, error);
  }
});

export default router;
