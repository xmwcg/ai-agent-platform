import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import { Team, TeamRole } from '../models/Team';

export type { TeamRole };

export const ROLE_RANK: Record<TeamRole, number> = {
  owner: 4,
  admin: 3,
  member: 2,
  viewer: 1,
};

/** 判断用户角色是否满足所需最小角色 */
export function hasTeamRole(userRole: TeamRole | undefined, required: TeamRole): boolean {
  if (!userRole) return false;
  return ROLE_RANK[userRole] >= ROLE_RANK[required];
}

/**
 * 团队 RBAC 中间件：要求当前登录用户在指定团队中具备 >= required 的角色。
 * teamId 默认取自 req.params.teamId，也可通过 teamIdSource 自定义来源。
 */
export function requireTeamRole(
  required: TeamRole,
  teamIdSource: (req: AuthRequest) => string | undefined = (req) => req.params.teamId
) {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    const teamId = teamIdSource(req);
    if (!req.user || !teamId) {
      res.status(401).json({ error: '缺少团队或登录信息' });
      return;
    }
    const team = await Team.findById(teamId);
    if (!team) {
      res.status(404).json({ error: '团队不存在' });
      return;
    }
    const member = team.members.find((m) => m.userId === req.user!.id);
    if (!member || !hasTeamRole(member.role as TeamRole, required)) {
      res.status(403).json({ error: '团队权限不足', requiredRole: required, yourRole: member?.role });
      return;
    }
    (req as any).teamRole = member.role;
    (req as any).team = team;
    next();
  };
}
