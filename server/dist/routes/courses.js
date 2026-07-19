"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const Course_1 = require("../models/Course");
const UserCourseProgress_1 = require("../models/UserCourseProgress");
const auth_1 = require("../middleware/auth");
const http_error_1 = require("../lib/http-error");
const logger_1 = require("../lib/logger");
const router = (0, express_1.Router)();
// 创建课程（需登录）
router.post('/', auth_1.requireAuth, async (req, res) => {
    try {
        const { title, description, category, level, tags, price, chapters } = req.body;
        if (!title || !description) {
            return res.status(400).json({ error: 'Title and description are required' });
        }
        const course = new Course_1.Course({
            title,
            description,
            category,
            level: level || 'beginner',
            tags: tags || [],
            price: price || 0,
            chapters: chapters || [],
            instructor: req.user.id
        });
        await course.save();
        res.status(201).json({
            success: true,
            data: course
        });
    }
    catch (error) {
        logger_1.logger.error('courses', '创建课程失败', error);
        (0, http_error_1.sendError)(res, error);
    }
});
// 获取课程列表
router.get('/', async (req, res) => {
    try {
        const { page = '1', limit = '10', category, level, search, sortBy = 'createdAt', order = 'desc' } = req.query;
        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const skip = (pageNum - 1) * limitNum;
        // 构建查询
        let query = { isPublished: true };
        if (category)
            query.category = category;
        if (level)
            query.level = level;
        if (search)
            query.$text = { $search: search };
        // 排序
        const sort = {};
        sort[sortBy] = order === 'asc' ? 1 : -1;
        const [courses, total] = await Promise.all([
            Course_1.Course.find(query)
                .sort(sort)
                .skip(skip)
                .limit(limitNum)
                .select('-chapters.quiz'), // 不返回测验详情
            Course_1.Course.countDocuments(query)
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
    }
    catch (error) {
        logger_1.logger.error('courses', '获取课程列表失败', error);
        (0, http_error_1.sendError)(res, error);
    }
});
// ─── 获取用户所有课程进度列表（需登录，必须在 /:id 之前注册）───
router.get('/user/progress-list', auth_1.requireAuth, async (req, res) => {
    try {
        const userId = req.user.id;
        const progresses = await UserCourseProgress_1.UserCourseProgress.find({ userId })
            .populate('courseId', 'title thumbnail chapters')
            .lean();
        const data = progresses.map((p) => {
            const course = p.courseId || {};
            const chapterCount = course.chapters?.length || 0;
            return {
                courseId: p.courseId?._id || p.courseId,
                courseTitle: course.title || '未知课程',
                courseThumbnail: course.thumbnail,
                enrolled: p.enrolled,
                completedChapters: p.completedChapters || [],
                quizScores: p.quizScores || {},
                completionPct: chapterCount > 0 ? Math.round((p.completedChapters?.length || 0) / chapterCount * 100) : 0,
                isCompleted: p.isCompleted,
                totalStudySeconds: p.totalStudySeconds || 0,
                lastStudyAt: p.lastStudyAt,
                totalChapters: chapterCount,
            };
        });
        res.json({ success: true, data });
    }
    catch (error) {
        logger_1.logger.error('courses', '获取用户进度列表失败', error);
        (0, http_error_1.sendError)(res, error);
    }
});
// 获取已发布课程详情（公开响应不得泄漏测验答案与解析）
router.get('/:id', async (req, res) => {
    try {
        const course = await Course_1.Course.findById(req.params.id);
        if (!course || !course.isPublished) {
            return res.status(404).json({ error: 'Course not found' });
        }
        res.json({
            success: true,
            data: sanitizeCourseForLearner(course)
        });
    }
    catch (error) {
        logger_1.logger.error('courses', '获取课程详情失败', error);
        (0, http_error_1.sendError)(res, error);
    }
});
// 更新课程（需登录 + 仅作者）
router.put('/:id', auth_1.requireAuth, async (req, res) => {
    try {
        const course = await Course_1.Course.findById(req.params.id);
        if (!course) {
            return res.status(404).json({ error: 'Course not found' });
        }
        if (course.instructor.toString() !== req.user.id) {
            return res.status(403).json({ error: '无权修改他人课程' });
        }
        const updates = req.body;
        Object.assign(course, updates);
        await course.save();
        res.json({
            success: true,
            data: course
        });
    }
    catch (error) {
        logger_1.logger.error('courses', '更新课程失败', error);
        (0, http_error_1.sendError)(res, error);
    }
});
// 发布/取消发布课程（需登录 + 仅作者）
router.patch('/:id/publish', auth_1.requireAuth, async (req, res) => {
    try {
        const { isPublished } = req.body;
        const course = await Course_1.Course.findById(req.params.id);
        if (!course) {
            return res.status(404).json({ error: 'Course not found' });
        }
        if (course.instructor.toString() !== req.user.id) {
            return res.status(403).json({ error: '无权发布他人课程' });
        }
        course.isPublished = isPublished;
        await course.save();
        res.json({
            success: true,
            message: `Course ${isPublished ? 'published' : 'unpublished'} successfully`
        });
    }
    catch (error) {
        logger_1.logger.error('courses', '更新发布状态失败', error);
        (0, http_error_1.sendError)(res, error);
    }
});
// 添加章节（需登录 + 仅作者）
router.post('/:id/chapters', auth_1.requireAuth, async (req, res) => {
    try {
        const course = await Course_1.Course.findById(req.params.id);
        if (!course) {
            return res.status(404).json({ error: 'Course not found' });
        }
        if (course.instructor.toString() !== req.user.id) {
            return res.status(403).json({ error: '无权向他人课程添加章节' });
        }
        course.chapters.push(req.body);
        await course.save();
        res.json({
            success: true,
            data: course
        });
    }
    catch (error) {
        logger_1.logger.error('courses', '添加章节失败', error);
        (0, http_error_1.sendError)(res, error);
    }
});
// ─── 课程报名（需登录）───
router.post('/:id/enroll', auth_1.requireAuth, async (req, res) => {
    try {
        const courseId = req.params.id;
        const userId = req.user.id;
        const course = await Course_1.Course.findById(courseId);
        if (!course || !course.isPublished) {
            return res.status(404).json({ error: '课程不存在或未发布' });
        }
        // upsert 进度记录
        let progress = await UserCourseProgress_1.UserCourseProgress.findOne({ userId, courseId });
        if (progress) {
            if (progress.enrolled) {
                return res.json({ success: true, data: { enrolled: true, progress: formatProgress(progress, course.chapters.length) } });
            }
            progress.enrolled = true;
            progress.enrolledAt = new Date();
            await progress.save();
        }
        else {
            progress = await UserCourseProgress_1.UserCourseProgress.create({
                userId,
                courseId,
                enrolled: true,
                enrolledAt: new Date(),
            });
        }
        // 递增报名人数
        await Course_1.Course.findByIdAndUpdate(courseId, { $inc: { enrolledStudents: 1 } });
        res.json({ success: true, data: { enrolled: true, progress: formatProgress(progress, course.chapters.length) } });
    }
    catch (error) {
        logger_1.logger.error('courses', '课程报名失败', error);
        (0, http_error_1.sendError)(res, error);
    }
});
// ─── 获取用户课程进度（需登录）───
router.get('/:id/progress', auth_1.requireAuth, async (req, res) => {
    try {
        const courseId = req.params.id;
        const userId = req.user.id;
        const course = await Course_1.Course.findById(courseId);
        if (!course) {
            return res.status(404).json({ error: '课程不存在' });
        }
        const progress = await UserCourseProgress_1.UserCourseProgress.findOne({ userId, courseId });
        res.json({
            success: true,
            data: progress ? formatProgress(progress, course.chapters.length) : {
                enrolled: false,
                completedChapters: [],
                quizScores: {},
                completionPct: 0,
                totalChapters: course.chapters.length,
            },
        });
    }
    catch (error) {
        logger_1.logger.error('courses', '获取课程进度失败', error);
        (0, http_error_1.sendError)(res, error);
    }
});
// ─── 标记章节完成（需登录）───
router.post('/:id/complete-chapter', auth_1.requireAuth, async (req, res) => {
    try {
        const courseId = req.params.id;
        const userId = req.user.id;
        const { chapterIndex } = req.body;
        if (chapterIndex === undefined || chapterIndex === null) {
            return res.status(400).json({ error: 'chapterIndex 必填' });
        }
        const course = await Course_1.Course.findById(courseId);
        if (!course) {
            return res.status(404).json({ error: '课程不存在' });
        }
        if (chapterIndex < 0 || chapterIndex >= course.chapters.length) {
            return res.status(400).json({ error: '章节索引无效' });
        }
        const progress = await UserCourseProgress_1.UserCourseProgress.findOneAndUpdate({ userId, courseId }, {
            $addToSet: { completedChapters: chapterIndex },
            $set: { lastStudyAt: new Date() },
        }, { upsert: true, new: true });
        // 检查是否全部完成
        const allDone = course.chapters.every((_, i) => progress.completedChapters.includes(i));
        if (allDone && !progress.isCompleted) {
            progress.isCompleted = true;
            await progress.save();
        }
        res.json({ success: true, data: formatProgress(progress, course.chapters.length) });
    }
    catch (error) {
        logger_1.logger.error('courses', '标记章节完成失败', error);
        (0, http_error_1.sendError)(res, error);
    }
});
// ─── 获取章节测验（需登录；正确答案与解析仅在提交后返回）───
router.get('/:id/quiz/:chapterIdx', auth_1.requireAuth, async (req, res) => {
    try {
        const courseId = req.params.id;
        const chapterIdx = Number.parseInt(req.params.chapterIdx, 10);
        if (!Number.isInteger(chapterIdx) || chapterIdx < 0) {
            return res.status(400).json({ error: '章节索引无效' });
        }
        const course = await Course_1.Course.findById(courseId).select('title chapters isPublished');
        if (!course || !course.isPublished) {
            return res.status(404).json({ error: '课程不存在或未发布' });
        }
        if (chapterIdx >= course.chapters.length) {
            return res.status(400).json({ error: '章节索引无效' });
        }
        const quiz = course.chapters[chapterIdx].quiz;
        if (!quiz) {
            return res.status(404).json({ error: '该章节没有测验' });
        }
        res.json({
            success: true,
            data: {
                title: quiz.title,
                description: quiz.description,
                timeLimit: quiz.timeLimit,
                passingScore: quiz.passingScore,
                questions: quiz.questions.map((question) => ({
                    type: question.type,
                    question: question.question,
                    options: question.options,
                    points: question.points,
                })),
            },
        });
    }
    catch (error) {
        logger_1.logger.error('courses', '获取章节测验失败', error);
        (0, http_error_1.sendError)(res, error);
    }
});
// ─── 提交测验答案 + 自动评分（需登录）───
router.post('/:id/quiz/:chapterIdx/submit', auth_1.requireAuth, async (req, res) => {
    try {
        const courseId = req.params.id;
        const chapterIdx = Number.parseInt(req.params.chapterIdx, 10);
        const userId = req.user.id;
        const { answers } = req.body; // { [questionIdx]: userAnswer }
        if (!Number.isInteger(chapterIdx) || chapterIdx < 0) {
            return res.status(400).json({ error: '章节索引无效' });
        }
        if (!answers || typeof answers !== 'object' || Array.isArray(answers)) {
            return res.status(400).json({ error: 'answers 必须是题号到答案的对象' });
        }
        const course = await Course_1.Course.findById(courseId);
        if (!course || !course.isPublished) {
            return res.status(404).json({ error: '课程不存在或未发布' });
        }
        if (chapterIdx < 0 || chapterIdx >= course.chapters.length) {
            return res.status(400).json({ error: '章节索引无效' });
        }
        const chapter = course.chapters[chapterIdx];
        const quiz = chapter.quiz;
        if (!quiz) {
            return res.status(400).json({ error: '该章节没有测验' });
        }
        // 自动评分
        let totalPoints = 0;
        let earnedPoints = 0;
        const results = [];
        quiz.questions.forEach((q, i) => {
            totalPoints += q.points;
            const userAnswer = (answers && answers[i] !== undefined) ? answers[i] : null;
            let correct = false;
            if (q.type === 'multiple') {
                // 多选：数组排序后比较
                const userArr = Array.isArray(userAnswer) ? [...userAnswer].sort() : [];
                const correctArr = Array.isArray(q.correctAnswer) ? [...q.correctAnswer].sort() : [q.correctAnswer];
                correct = JSON.stringify(userArr) === JSON.stringify(correctArr);
            }
            else if (q.type === 'code') {
                // 代码题：宽松匹配（trim 后比对）
                correct = typeof userAnswer === 'string' && userAnswer.trim() === String(q.correctAnswer).trim();
            }
            else {
                // 单选/判断/填空
                correct = String(userAnswer) === String(q.correctAnswer);
            }
            if (correct)
                earnedPoints += q.points;
            results.push({
                idx: i,
                correct,
                userAnswer,
                correctAnswer: q.correctAnswer,
                points: correct ? q.points : 0,
                explanation: q.explanation,
            });
        });
        const score = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0;
        const passed = score >= quiz.passingScore;
        // 持久化成绩到进度
        const update = {
            $set: {
                [`quizScores.${chapterIdx}`]: score,
                lastStudyAt: new Date(),
            },
        };
        if (passed) {
            update.$addToSet = { completedChapters: chapterIdx };
        }
        const progress = await UserCourseProgress_1.UserCourseProgress.findOneAndUpdate({ userId, courseId }, update, { upsert: true, new: true });
        res.json({
            success: true,
            data: {
                score,
                passed,
                passingScore: quiz.passingScore,
                totalPoints,
                earnedPoints,
                results,
                progress: formatProgress(progress, course.chapters.length),
            },
        });
    }
    catch (error) {
        logger_1.logger.error('courses', '提交测验失败', error);
        (0, http_error_1.sendError)(res, error);
    }
});
exports.default = router;
/** 课程公开详情只返回作答所需字段，正确答案与解析必须在提交评分后返回。 */
function sanitizeCourseForLearner(course) {
    const plain = typeof course?.toObject === 'function' ? course.toObject() : course;
    return {
        ...plain,
        chapters: Array.isArray(plain?.chapters)
            ? plain.chapters.map((chapter) => ({
                ...chapter,
                quiz: chapter.quiz
                    ? {
                        title: chapter.quiz.title,
                        description: chapter.quiz.description,
                        timeLimit: chapter.quiz.timeLimit,
                        passingScore: chapter.quiz.passingScore,
                        questions: Array.isArray(chapter.quiz.questions)
                            ? chapter.quiz.questions.map((question) => ({
                                type: question.type,
                                question: question.question,
                                options: question.options,
                                points: question.points,
                            }))
                            : [],
                    }
                    : undefined,
            }))
            : [],
    };
}
/** 格式化进度对象 */
function formatProgress(progress, totalChapters) {
    const completed = progress.completedChapters?.length || 0;
    return {
        enrolled: progress.enrolled,
        completedChapters: progress.completedChapters || [],
        quizScores: progress.quizScores || {},
        completionPct: totalChapters > 0 ? Math.round(completed / totalChapters * 100) : 0,
        isCompleted: progress.isCompleted,
        totalChapters,
        lastStudyAt: progress.lastStudyAt,
        totalStudySeconds: progress.totalStudySeconds || 0,
    };
}
//# sourceMappingURL=courses.js.map