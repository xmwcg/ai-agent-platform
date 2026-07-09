import { Router, Request, Response } from 'express';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { requireTeamRole } from '../middleware/rbac';
import { Team, TeamRole, ITeam, ITeamMember } from '../models/Team';
import { sendError } from '../lib/http-error';
import { validate, ValidationSchema } from '../lib/validation';

/** rbac 中间件在 req 上挂载的团队上下文（与 middleware/rbac.ts 一致） */
interface TeamRequest extends AuthRequest {
  team: ITeam;
  teamRole: TeamRole;
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
    team.members.push({ userId, role: role || 'member', joinedAt: new Date() });
    await team.save();
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
    member.role = role;
    await team.save();
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
    res.json({ success: true, data: team });
  } catch (err) {
    sendError(res, err);
  }
});

/** 删除团队（仅 owner） */
router.delete('/:teamId', requireAuth, requireTeamRole('owner'), async (req: AuthRequest, res: Response) => {
  try {
    await Team.findByIdAndDelete(req.params.teamId);
    res.json({ success: true });
  } catch (err) {
    sendError(res, err);
  }
});

export default router;
