"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const crypto_1 = __importDefault(require("crypto"));
const auth_1 = require("../middleware/auth");
const rbac_1 = require("../middleware/rbac");
const Team_1 = require("../models/Team");
const TeamAuditLog_1 = require("../models/TeamAuditLog");
const http_error_1 = require("../lib/http-error");
const validation_1 = require("../lib/validation");
const team_audit_service_1 = require("../services/team-audit.service");
/** 生成安全的邀请码（24 字符十六进制） */
function generateInviteCode() {
    return crypto_1.default.randomBytes(12).toString('hex');
}
const ROLES = ['owner', 'admin', 'member', 'viewer'];
const inviteMemberSchema = {
    userId: { required: true, type: 'string' },
    role: { type: 'string', oneOf: ROLES },
};
const changeRoleSchema = {
    role: { required: true, type: 'string', oneOf: ROLES },
};
const router = (0, express_1.Router)();
/** 创建团队（创建者自动为 owner） */
// ─── 根路由：返回团队能力入口 ───
router.get('/', (_req, res) => {
    res.json({
        success: true,
        data: {
            capabilities: [
                { type: 'create', label: '创建团队', path: '/api/team', method: 'POST' },
                { type: 'my_teams', label: '我的团队', path: '/api/team/mine', method: 'GET' },
                { type: 'join', label: '加入团队', path: '/api/team/join/:inviteCode', method: 'POST' },
            ],
        },
    });
});
router.post('/', auth_1.requireAuth, async (req, res) => {
    try {
        const { name, plan } = req.body;
        if (!name)
            return res.status(400).json({ success: false, error: '团队名称必填' });
        const team = await Team_1.Team.create({
            name,
            ownerId: req.user.id,
            plan: plan || 'team',
            members: [{ userId: req.user.id, role: 'owner', joinedAt: new Date() }],
        });
        (0, team_audit_service_1.logTeamAudit)({
            teamId: team._id.toString(),
            actorId: req.user.id,
            action: 'team_created',
            detail: { name: team.name },
        });
        res.json({ success: true, data: team });
    }
    catch (err) {
        (0, http_error_1.sendError)(res, err);
    }
});
/** 我参与的团队 */
router.get('/mine', auth_1.requireAuth, async (req, res) => {
    try {
        const teams = await Team_1.Team.find({ 'members.userId': req.user.id }).sort({ createdAt: -1 }).lean();
        res.json({ success: true, data: teams });
    }
    catch (err) {
        (0, http_error_1.sendError)(res, err);
    }
});
/** 团队详情（viewer 即可查看） */
router.get('/:teamId', auth_1.requireAuth, (0, rbac_1.requireTeamRole)('viewer'), async (req, res) => {
    try {
        const team = await Team_1.Team.findById(req.params.teamId).lean();
        res.json({ success: true, data: team, yourRole: req.teamRole });
    }
    catch (err) {
        (0, http_error_1.sendError)(res, err);
    }
});
/** 邀请成员（admin 及以上） */
router.post('/:teamId/members', auth_1.requireAuth, (0, rbac_1.requireTeamRole)('admin'), (0, validation_1.validate)(inviteMemberSchema), async (req, res) => {
    try {
        const { userId, role } = req.body;
        const team = req.team;
        if (team.members.some((m) => m.userId === userId)) {
            return res.status(400).json({ success: false, error: '成员已存在' });
        }
        const assignedRole = role || 'member';
        team.members.push({ userId, role: assignedRole, joinedAt: new Date() });
        await team.save();
        (0, team_audit_service_1.logTeamAudit)({
            teamId: team._id.toString(),
            actorId: req.user.id,
            action: 'member_joined',
            targetId: userId,
            detail: { role: assignedRole },
        });
        res.json({ success: true, data: team });
    }
    catch (err) {
        (0, http_error_1.sendError)(res, err);
    }
});
/** 修改成员角色（admin 及以上，不能改 owner） */
router.put('/:teamId/members/:userId', auth_1.requireAuth, (0, rbac_1.requireTeamRole)('admin'), (0, validation_1.validate)(changeRoleSchema), async (req, res) => {
    try {
        const { role } = req.body;
        const team = req.team;
        const member = team.members.find((m) => m.userId === req.params.userId);
        if (!member)
            return res.status(404).json({ success: false, error: '成员不存在' });
        if (member.role === 'owner')
            return res.status(400).json({ success: false, error: '不能修改所有者角色' });
        const oldRole = member.role;
        member.role = role;
        await team.save();
        (0, team_audit_service_1.logTeamAudit)({
            teamId: team._id.toString(),
            actorId: req.user.id,
            action: 'role_changed',
            targetId: req.params.userId,
            detail: { oldRole, newRole: role },
        });
        res.json({ success: true, data: team });
    }
    catch (err) {
        (0, http_error_1.sendError)(res, err);
    }
});
/** 移除成员 */
router.delete('/:teamId/members/:userId', auth_1.requireAuth, (0, rbac_1.requireTeamRole)('admin'), async (req, res) => {
    try {
        const team = req.team;
        if (req.params.userId === team.ownerId) {
            return res.status(400).json({ success: false, error: '不能移除团队所有者' });
        }
        team.members = team.members.filter((m) => m.userId !== req.params.userId);
        await team.save();
        (0, team_audit_service_1.logTeamAudit)({
            teamId: team._id.toString(),
            actorId: req.user.id,
            action: 'member_removed',
            targetId: req.params.userId,
        });
        res.json({ success: true, data: team });
    }
    catch (err) {
        (0, http_error_1.sendError)(res, err);
    }
});
/** 删除团队（仅 owner） */
router.delete('/:teamId', auth_1.requireAuth, (0, rbac_1.requireTeamRole)('owner'), async (req, res) => {
    try {
        const team = await Team_1.Team.findById(req.params.teamId);
        if (!team)
            return res.status(404).json({ success: false, error: '团队不存在' });
        (0, team_audit_service_1.logTeamAudit)({
            teamId: team._id.toString(),
            actorId: req.user.id,
            action: 'team_deleted',
            detail: { name: team.name },
        });
        await Team_1.Team.findByIdAndDelete(req.params.teamId);
        res.json({ success: true });
    }
    catch (err) {
        (0, http_error_1.sendError)(res, err);
    }
});
/** 生成/重新生成邀请链接（admin 及以上） */
router.post('/:teamId/invite', auth_1.requireAuth, (0, rbac_1.requireTeamRole)('admin'), async (req, res) => {
    try {
        const team = req.team;
        const oldCode = team.inviteCode;
        team.inviteCode = generateInviteCode();
        await team.save();
        (0, team_audit_service_1.logTeamAudit)({
            teamId: team._id.toString(),
            actorId: req.user.id,
            action: oldCode ? 'invite_generated' : 'invite_generated',
            detail: { regenerated: !!oldCode },
        });
        res.json({ success: true, data: { inviteCode: team.inviteCode } });
    }
    catch (err) {
        (0, http_error_1.sendError)(res, err);
    }
});
/** 撤销邀请链接（admin 及以上） */
router.delete('/:teamId/invite', auth_1.requireAuth, (0, rbac_1.requireTeamRole)('admin'), async (req, res) => {
    try {
        const team = req.team;
        if (!team.inviteCode) {
            return res.status(400).json({ success: false, error: '没有有效的邀请链接' });
        }
        team.inviteCode = null;
        await team.save();
        (0, team_audit_service_1.logTeamAudit)({
            teamId: team._id.toString(),
            actorId: req.user.id,
            action: 'invite_revoked',
        });
        res.json({ success: true });
    }
    catch (err) {
        (0, http_error_1.sendError)(res, err);
    }
});
/** 通过邀请码加入团队（登录用户即可） */
router.post('/join/:inviteCode', auth_1.requireAuth, async (req, res) => {
    try {
        const { inviteCode } = req.params;
        const team = await Team_1.Team.findOne({ inviteCode });
        if (!team) {
            return res.status(404).json({ success: false, error: '邀请链接无效或已失效' });
        }
        if (team.members.some((m) => m.userId === req.user.id)) {
            return res.status(400).json({ success: false, error: '您已是该团队成员' });
        }
        team.members.push({ userId: req.user.id, role: 'member', joinedAt: new Date() });
        await team.save();
        (0, team_audit_service_1.logTeamAudit)({
            teamId: team._id.toString(),
            actorId: req.user.id,
            action: 'member_joined',
            targetId: req.user.id,
            detail: { via: 'invite_link' },
        });
        res.json({ success: true, data: { teamId: team._id, teamName: team.name } });
    }
    catch (err) {
        (0, http_error_1.sendError)(res, err);
    }
});
/** 查询团队审计日志（viewer 及以上可查看） */
router.get('/:teamId/audit', auth_1.requireAuth, (0, rbac_1.requireTeamRole)('viewer'), async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize) || 50));
        const { action } = req.query;
        const filter = { teamId: req.params.teamId };
        if (action && typeof action === 'string') {
            filter.action = action;
        }
        const [logs, total] = await Promise.all([
            TeamAuditLog_1.TeamAuditLog.find(filter)
                .sort({ createdAt: -1 })
                .skip((page - 1) * pageSize)
                .limit(pageSize)
                .lean(),
            TeamAuditLog_1.TeamAuditLog.countDocuments(filter),
        ]);
        res.json({
            success: true,
            data: { logs, total, page, pageSize },
        });
    }
    catch (err) {
        (0, http_error_1.sendError)(res, err);
    }
});
exports.default = router;
//# sourceMappingURL=team.js.map