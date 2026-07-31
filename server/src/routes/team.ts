import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { requireTeamRole } from '../middleware/rbac';
import { Team, TeamRole, ITeam, ITeamMember } from '../models/Team';
import { TeamAuditLog } from '../models/TeamAuditLog';
import { sendError } from '../lib/http-error';
import { validate, ValidationSchema } from '../lib/validation';
import { logTeamAudit } from '../services/team-audit.service';

/** rbac 中间件在 req 上挂载的团队上下文（与 middleware/rbac.ts 一致） */
interface TeamRequest extends AuthRequest {
  team: ITeam;
  teamRole: TeamRole;
}

/** 生成安全的邀请码（24 字符十六进制） */
function generateInviteCode(): string {
  return crypto.randomBytes(12).toString('hex');
}

const ROLES: readonly TeamRole[] = ['owner', 'admin', 'member', 'viewer'];

const inviteMemberSchema: ValidationSchema = {
  userId: { required: true, type: 'string' },
  role: { type: 'string', oneOf: ROLES },
};

const changeRoleSchema: ValidationSchema = {
  role: { required: true, type: 'string', oneOf: ROLES },
};

const router = Router();

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

router.post('/', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { name, plan } = req.body;
    if (!name) return res.status(400).json({ success: false, error: '团队名称必填' });
    const team = await Team.create({
      name,
      ownerId: req.user!.id,
      plan: plan || 'team',
      members: [{ userId: req.user!.id, role: 'owner', joinedAt: new Date() }],
    });
    logTeamAudit({
      teamId: team._id.toString(),
      actorId: req.user!.id,
      action: 'team_created',
      detail: { name: team.name },
    });
    res.json({ success: true, data: team });
  } catch (err) {
    sendError(res, err);
  }
});

/** 我参与的团队 */
router.get('/mine', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const teams = await Team.find({ 'members.userId': req.user!.id }).sort({ createdAt: -1 }).lean();
    res.json({ success: true, data: teams });
  } catch (err) {
    sendError(res, err);
  }
});

/** 团队详情（viewer 即可查看） */
router.get('/:teamId', requireAuth, requireTeamRole('viewer'), async (req: TeamRequest, res: Response) => {
  try {
    const team = await Team.findById(req.params.teamId).lean();
    res.json({ success: true, data: team, yourRole: req.teamRole });
  } catch (err) {
    sendError(res, err);
  }
});

/** 邀请成员（admin 及以上） */
router.post('/:teamId/members', requireAuth, requireTeamRole('admin'), validate(inviteMemberSchema), async (req: TeamRequest, res: Response) => {
  try {
    const { userId, role } = req.body as { userId: string; role?: TeamRole };
    const team = (req as TeamRequest).team;
    if (team.members.some((m: ITeamMember) => m.userId === userId)) {
      return res.status(400).json({ success: false, error: '成员已存在' });
    }
    const assignedRole = role || 'member';
    team.members.push({ userId, role: assignedRole, joinedAt: new Date() });
    await team.save();
    logTeamAudit({
      teamId: team._id.toString(),
      actorId: req.user!.id,
      action: 'member_joined',
      targetId: userId,
      detail: { role: assignedRole },
    });
    res.json({ success: true, data: team });
  } catch (err) {
    sendError(res, err);
  }
});

/** 修改成员角色（admin 及以上，不能改 owner） */
router.put('/:teamId/members/:userId', requireAuth, requireTeamRole('admin'), validate(changeRoleSchema), async (req: TeamRequest, res: Response) => {
  try {
    const { role } = req.body as { role: TeamRole };
    const team = (req as TeamRequest).team;
    const member = team.members.find((m: ITeamMember) => m.userId === req.params.userId);
    if (!member) return res.status(404).json({ success: false, error: '成员不存在' });
    if (member.role === 'owner') return res.status(400).json({ success: false, error: '不能修改所有者角色' });
    const oldRole = member.role;
    member.role = role;
    await team.save();
    logTeamAudit({
      teamId: team._id.toString(),
      actorId: req.user!.id,
      action: 'role_changed',
      targetId: req.params.userId,
      detail: { oldRole, newRole: role },
    });
    res.json({ success: true, data: team });
  } catch (err) {
    sendError(res, err);
  }
});

/** 移除成员 */
router.delete('/:teamId/members/:userId', requireAuth, requireTeamRole('admin'), async (req: TeamRequest, res: Response) => {
  try {
    const team = (req as TeamRequest).team;
    if (req.params.userId === team.ownerId) {
      return res.status(400).json({ success: false, error: '不能移除团队所有者' });
    }
    team.members = team.members.filter((m: ITeamMember) => m.userId !== req.params.userId);
    await team.save();
    logTeamAudit({
      teamId: team._id.toString(),
      actorId: req.user!.id,
      action: 'member_removed',
      targetId: req.params.userId,
    });
    res.json({ success: true, data: team });
  } catch (err) {
    sendError(res, err);
  }
});

/** 删除团队（仅 owner） */
router.delete('/:teamId', requireAuth, requireTeamRole('owner'), async (req: AuthRequest, res: Response) => {
  try {
    const team = await Team.findById(req.params.teamId);
    if (!team) return res.status(404).json({ success: false, error: '团队不存在' });
    logTeamAudit({
      teamId: team._id.toString(),
      actorId: req.user!.id,
      action: 'team_deleted',
      detail: { name: team.name },
    });
    await Team.findByIdAndDelete(req.params.teamId);
    res.json({ success: true });
  } catch (err) {
    sendError(res, err);
  }
});

/** 生成/重新生成邀请链接（admin 及以上） */
router.post('/:teamId/invite', requireAuth, requireTeamRole('admin'), async (req: TeamRequest, res: Response) => {
  try {
    const team = (req as TeamRequest).team;
    const oldCode = team.inviteCode;
    team.inviteCode = generateInviteCode();
    await team.save();
    logTeamAudit({
      teamId: team._id.toString(),
      actorId: req.user!.id,
      action: oldCode ? 'invite_generated' : 'invite_generated',
      detail: { regenerated: !!oldCode },
    });
    res.json({ success: true, data: { inviteCode: team.inviteCode } });
  } catch (err) {
    sendError(res, err);
  }
});

/** 撤销邀请链接（admin 及以上） */
router.delete('/:teamId/invite', requireAuth, requireTeamRole('admin'), async (req: TeamRequest, res: Response) => {
  try {
    const team = (req as TeamRequest).team;
    if (!team.inviteCode) {
      return res.status(400).json({ success: false, error: '没有有效的邀请链接' });
    }
    team.inviteCode = null;
    await team.save();
    logTeamAudit({
      teamId: team._id.toString(),
      actorId: req.user!.id,
      action: 'invite_revoked',
    });
    res.json({ success: true });
  } catch (err) {
    sendError(res, err);
  }
});

/** 通过邀请码加入团队（登录用户即可） */
router.post('/join/:inviteCode', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { inviteCode } = req.params;
    const team = await Team.findOne({ inviteCode });
    if (!team) {
      return res.status(404).json({ success: false, error: '邀请链接无效或已失效' });
    }
    if (team.members.some((m) => m.userId === req.user!.id)) {
      return res.status(400).json({ success: false, error: '您已是该团队成员' });
    }
    team.members.push({ userId: req.user!.id, role: 'member', joinedAt: new Date() });
    await team.save();
    logTeamAudit({
      teamId: team._id.toString(),
      actorId: req.user!.id,
      action: 'member_joined',
      targetId: req.user!.id,
      detail: { via: 'invite_link' },
    });
    res.json({ success: true, data: { teamId: team._id, teamName: team.name } });
  } catch (err) {
    sendError(res, err);
  }
});

/** 查询团队审计日志（viewer 及以上可查看） */
router.get('/:teamId/audit', requireAuth, requireTeamRole('viewer'), async (req: TeamRequest, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string) || 50));
    const { action } = req.query;

    const filter: Record<string, unknown> = { teamId: req.params.teamId };
    if (action && typeof action === 'string') {
      filter.action = action;
    }

    const [logs, total] = await Promise.all([
      TeamAuditLog.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .lean(),
      TeamAuditLog.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: { logs, total, page, pageSize },
    });
  } catch (err) {
    sendError(res, err);
  }
});

export default router;
