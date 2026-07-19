"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const points_service_1 = require("../services/points.service");
const http_error_1 = require("../lib/http-error");
const router = (0, express_1.Router)();
// ───────────── API 状态 ─────────────
router.get('/', (_req, res) => { res.json({ ok: true, name: 'points' }); });
router.use(auth_1.requireAuth);
router.post('/checkin', async (req, res) => {
    try {
        const result = await (0, points_service_1.dailyCheckIn)(req.user.id);
        if (!result.success)
            return res.status(400).json({ error: result.message, data: result });
        res.json({ success: true, data: result });
    }
    catch (error) {
        (0, http_error_1.sendError)(res, error);
    }
});
router.get('/checkin/status', async (req, res) => {
    try {
        const status = await (0, points_service_1.getCheckInStatus)(req.user.id);
        res.json({ success: true, data: status });
    }
    catch (error) {
        (0, http_error_1.sendError)(res, error);
    }
});
router.get('/checkin/history', async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const pageSize = Math.min(50, Math.max(1, parseInt(req.query.pageSize) || 30));
        const data = await (0, points_service_1.getCheckInHistory)(req.user.id, page, pageSize);
        res.json({ success: true, data });
    }
    catch (error) {
        (0, http_error_1.sendError)(res, error);
    }
});
// 仅展示任务规则；任务奖励只能由已验证的内部业务事件触发。
router.get('/tasks', (_req, res) => {
    res.json({
        success: true,
        data: {
            tasks: Object.entries(points_service_1.TASK_POINTS).map(([key, points]) => ({
                taskType: key,
                points,
                label: {
                    ai_chat: 'AI 对话',
                    knowledge_upload: '上传知识文档',
                    course_complete: '完成课程',
                    tool_use: '使用智能工具',
                    daily_login: '每日登录',
                    profile_complete: '完善个人资料',
                    share_content: '分享内容',
                }[key] || key,
            })),
        },
    });
});
exports.default = router;
//# sourceMappingURL=points.js.map