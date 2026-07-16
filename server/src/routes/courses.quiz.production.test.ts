import express from 'express';
import request from 'supertest';
import coursesRouter from './courses';
import { Course } from '../models/Course';
import { UserCourseProgress } from '../models/UserCourseProgress';
import { generateToken } from '../middleware/auth';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/courses', coursesRouter);
  return app;
}

const token = generateToken({ id: 'user-quiz-1', email: 'quiz@example.com', role: 'user' });
const auth = { Authorization: `Bearer ${token}` };

function createCourse(overrides: Record<string, unknown> = {}) {
  return {
    _id: 'course-1',
    title: '真实数据库课程',
    isPublished: true,
    chapters: [
      {
        title: '第一章',
        quiz: {
          title: '第一章测验',
          description: '从数据库读取的测验',
          timeLimit: 10,
          passingScore: 60,
          questions: [
            {
              type: 'single',
              question: '单选题',
              options: ['A', 'B', 'C'],
              correctAnswer: 1,
              explanation: 'B 是正确答案',
              points: 40,
            },
            {
              type: 'multiple',
              question: '多选题',
              options: ['A', 'B', 'C'],
              correctAnswer: [0, 2],
              explanation: 'A、C 正确',
              points: 60,
            },
          ],
        },
      },
    ],
    ...overrides,
  };
}

function mockQuizLookup(course: ReturnType<typeof createCourse> | null) {
  const select = jest.fn().mockResolvedValue(course);
  const findById = jest.spyOn(Course, 'findById') as unknown as jest.Mock;
  findById.mockReturnValue({ select });
  return { findById, select };
}

describe('课程测验真实数据与答案保护', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('GET 从课程数据库结果返回测验，但不泄漏正确答案和解析', async () => {
    const course = createCourse();
    const { select } = mockQuizLookup(course);

    const response = await request(createApp())
      .get('/api/courses/course-1/quiz/0')
      .set(auth);

    expect(response.status).toBe(200);
    expect(select).toHaveBeenCalledWith('title chapters isPublished');
    expect(response.body.data).toEqual(expect.objectContaining({
      title: '第一章测验',
      passingScore: 60,
      questions: expect.arrayContaining([
        expect.objectContaining({ question: '单选题', points: 40 }),
      ]),
    }));
    for (const question of response.body.data.questions) {
      expect(question).not.toHaveProperty('correctAnswer');
      expect(question).not.toHaveProperty('explanation');
    }
  });

  it('公开课程详情同样不泄漏测验正确答案和解析', async () => {
    const course = createCourse();
    (course as any).toObject = () => ({ ...course, toObject: undefined });
    const findById = jest.spyOn(Course, 'findById') as unknown as jest.Mock;
    findById.mockResolvedValue(course);

    const response = await request(createApp()).get('/api/courses/course-1');

    expect(response.status).toBe(200);
    const questions = response.body.data.chapters[0].quiz.questions;
    expect(questions).toHaveLength(2);
    for (const question of questions) {
      expect(question).not.toHaveProperty('correctAnswer');
      expect(question).not.toHaveProperty('explanation');
    }
  });

  it('未发布课程不能读取测验', async () => {
    mockQuizLookup(createCourse({ isPublished: false }));

    const response = await request(createApp())
      .get('/api/courses/course-1/quiz/0')
      .set(auth);

    expect(response.status).toBe(404);
  });

  it('非法章节索引在查询数据库前被拒绝', async () => {
    const findById = jest.spyOn(Course, 'findById');

    const response = await request(createApp())
      .get('/api/courses/course-1/quiz/not-a-number')
      .set(auth);

    expect(response.status).toBe(400);
    expect(findById).not.toHaveBeenCalled();
  });

  it('超出范围的章节索引被拒绝', async () => {
    mockQuizLookup(createCourse());

    const response = await request(createApp())
      .get('/api/courses/course-1/quiz/9')
      .set(auth);

    expect(response.status).toBe(400);
  });

  it.each([null, [], 'answer'])('POST answers=%p 时拒绝非对象答案', async (answers) => {
    const findById = jest.spyOn(Course, 'findById');

    const response = await request(createApp())
      .post('/api/courses/course-1/quiz/0/submit')
      .set(auth)
      .send({ answers });

    expect(response.status).toBe(400);
    expect(findById).not.toHaveBeenCalled();
  });

  it('POST 由服务端正确评分并在提交后返回答案解析', async () => {
    const findById = jest.spyOn(Course, 'findById') as unknown as jest.Mock;
    findById.mockResolvedValue(createCourse());
    const findOneAndUpdate = jest.spyOn(UserCourseProgress, 'findOneAndUpdate') as unknown as jest.Mock;
    findOneAndUpdate.mockResolvedValue({
      enrolled: true,
      completedChapters: [0],
      quizScores: { 0: 100 },
      isCompleted: false,
      lastStudyAt: new Date(),
      totalStudySeconds: 0,
    });

    const response = await request(createApp())
      .post('/api/courses/course-1/quiz/0/submit')
      .set(auth)
      .send({ answers: { 0: 1, 1: [2, 0] } });

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual(expect.objectContaining({
      score: 100,
      passed: true,
      totalPoints: 100,
      earnedPoints: 100,
    }));
    expect(response.body.data.results[0]).toEqual(expect.objectContaining({
      correct: true,
      correctAnswer: 1,
      explanation: 'B 是正确答案',
    }));
    expect(findOneAndUpdate).toHaveBeenCalledWith(
      { userId: 'user-quiz-1', courseId: 'course-1' },
      expect.objectContaining({
        $set: expect.objectContaining({ 'quizScores.0': 100 }),
        $addToSet: { completedChapters: 0 },
      }),
      { upsert: true, new: true },
    );
  });

  it('未发布课程不能提交测验', async () => {
    const findById = jest.spyOn(Course, 'findById') as unknown as jest.Mock;
    findById.mockResolvedValue(createCourse({ isPublished: false }));
    const progressSpy = jest.spyOn(UserCourseProgress, 'findOneAndUpdate');

    const response = await request(createApp())
      .post('/api/courses/course-1/quiz/0/submit')
      .set(auth)
      .send({ answers: { 0: 1 } });

    expect(response.status).toBe(404);
    expect(progressSpy).not.toHaveBeenCalled();
  });
});
