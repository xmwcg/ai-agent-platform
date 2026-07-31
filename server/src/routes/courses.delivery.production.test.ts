import express from 'express';
import request from 'supertest';
import coursesRouter from './courses';
import { Course } from '../models/Course';
import { UserCourseProgress } from '../models/UserCourseProgress';
import { generateAccessToken } from '../middleware/auth';
import { resolveUserPlan } from '../middleware/subscription';

jest.mock('../middleware/subscription', () => ({
  resolveUserPlan: jest.fn(),
}));

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/courses', coursesRouter);
  return app;
}

const token = generateAccessToken({ id: 'course-user-1', email: 'course@example.com', role: 'user' });
const auth = { Authorization: `Bearer ${token}` };

function createCourse(overrides: Record<string, unknown> = {}) {
  const course = {
    _id: 'course-1',
    title: '可交付课程',
    description: '课程交付测试',
    instructor: 'system',
    category: 'engineering',
    isPublished: true,
    price: 2990,
    requiredPlan: 'pro',
    freePreviewChapters: 1,
    enrolledStudents: 0,
    chapters: [
      { title: '试看章', content: '# 可阅读正文', resources: [], quiz: undefined },
      { title: '会员章', content: '# 会员正文', resources: [{ title: '代码', type: 'code', url: 'https://example.com/code.zip' }], quiz: undefined },
    ],
    ...overrides,
  };
  return Object.assign(course, {
    toObject: () => ({ ...course, toObject: undefined }),
  });
}

describe('课程交付与学习进度门禁', () => {
  beforeEach(() => {
    (resolveUserPlan as jest.Mock).mockResolvedValue({ plan: 'free' });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('公开课程目录不下发任何章节正文、资源、视频或测验', async () => {
    const course = createCourse({
      chapters: [{
        title: '付费章',
        description: '目录简介',
        order: 1,
        duration: 20,
        content: '# 付费正文',
        videoUrl: 'https://example.com/paid.mp4',
        resources: [{ title: '代码', type: 'code', url: 'https://example.com/code.zip' }],
        quiz: { title: '测验', questions: [{ question: '答案？', correctAnswer: 'secret' }] },
      }],
    });
    const query = {
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      select: jest.fn().mockResolvedValue([course]),
    };
    jest.spyOn(Course, 'find').mockReturnValue(query as any);
    jest.spyOn(Course, 'countDocuments').mockResolvedValue(1 as any);

    const response = await request(createApp()).get('/api/courses');

    expect(response.status).toBe(200);
    expect(query.select).toHaveBeenCalledWith(
      '-chapters.quiz -chapters.content -chapters.videoUrl -chapters.resources',
    );
    expect(response.body.data[0].chapters[0]).toEqual(expect.objectContaining({
      title: '付费章',
      description: '目录简介',
      order: 1,
      duration: 20,
    }));
    expect(response.body.data[0].chapters[0]).not.toHaveProperty('content');
    expect(response.body.data[0].chapters[0]).not.toHaveProperty('videoUrl');
    expect(response.body.data[0].chapters[0]).not.toHaveProperty('resources');
    expect(response.body.data[0].chapters[0]).not.toHaveProperty('quiz');
  });

  it('课程详情返回明确权益状态，并仅下发试看章节正文', async () => {
    jest.spyOn(Course, 'findById').mockResolvedValue(createCourse() as any);

    const response = await request(createApp()).get('/api/courses/course-1');

    expect(response.status).toBe(200);
    expect(response.body.data.access).toEqual(expect.objectContaining({
      level: 'preview',
      currentPlan: 'free',
      requiredPlan: 'pro',
      freePreviewChapters: 1,
      hasFullAccess: false,
    }));
    expect(response.body.data.chapters[0]).toEqual(expect.objectContaining({ locked: false, content: '# 可阅读正文' }));
    expect(response.body.data.chapters[1]).toEqual(expect.objectContaining({ locked: true, resources: [] }));
    expect(response.body.data.chapters[1]).not.toHaveProperty('content');
  });

  it('免费用户不能伪造请求记录付费课程进度', async () => {
    jest.spyOn(Course, 'findById').mockResolvedValue(createCourse() as any);
    const progressFind = jest.spyOn(UserCourseProgress, 'findOne');
    const progressUpdate = jest.spyOn(UserCourseProgress, 'findOneAndUpdate');

    const response = await request(createApp())
      .post('/api/courses/course-1/complete-chapter')
      .set(auth)
      .send({ chapterIndex: 1 });

    expect(response.status).toBe(403);
    expect(response.body.code).toBe('COURSE_PLAN_REQUIRED');
    expect(progressFind).not.toHaveBeenCalled();
    expect(progressUpdate).not.toHaveBeenCalled();
  });

  it('有会员权益但未加入课程时不能伪造完成进度', async () => {
    (resolveUserPlan as jest.Mock).mockResolvedValue({ plan: 'pro' });
    jest.spyOn(Course, 'findById').mockResolvedValue(createCourse() as any);
    jest.spyOn(UserCourseProgress, 'findOne').mockResolvedValue(null);
    const progressUpdate = jest.spyOn(UserCourseProgress, 'findOneAndUpdate');

    const response = await request(createApp())
      .post('/api/courses/course-1/complete-chapter')
      .set(auth)
      .send({ chapterIndex: 1 });

    expect(response.status).toBe(409);
    expect(response.body.code).toBe('COURSE_ENROLLMENT_REQUIRED');
    expect(progressUpdate).not.toHaveBeenCalled();
  });

  it('已加入课程的会员可以保存章节进度且不会隐式创建报名', async () => {
    (resolveUserPlan as jest.Mock).mockResolvedValue({ plan: 'pro' });
    jest.spyOn(Course, 'findById').mockResolvedValue(createCourse() as any);
    jest.spyOn(UserCourseProgress, 'findOne').mockResolvedValue({ _id: 'progress-1', enrolled: true } as any);
    const progressUpdate = jest.spyOn(UserCourseProgress, 'findOneAndUpdate').mockResolvedValue({
      enrolled: true,
      completedChapters: [1],
      quizScores: {},
      isCompleted: false,
      lastStudyAt: new Date(),
      totalStudySeconds: 0,
    } as any);

    const response = await request(createApp())
      .post('/api/courses/course-1/complete-chapter')
      .set(auth)
      .send({ chapterIndex: 1 });

    expect(response.status).toBe(200);
    expect(response.body.data.completedChapters).toEqual([1]);
    expect(progressUpdate).toHaveBeenCalledWith(
      { _id: 'progress-1', enrolled: true },
      expect.objectContaining({ $addToSet: { completedChapters: 1 } }),
      { new: true },
    );
  });
});
