import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import { TeamRole } from '../models/Team';
export type { TeamRole };
export declare const ROLE_RANK: Record<TeamRole, number>;
/** 判断用户角色是否满足所需最小角色 */
export declare function hasTeamRole(userRole: TeamRole | undefined, required: TeamRole): boolean;
/**
 * 团队 RBAC 中间件：要求当前登录用户在指定团队中具备 >= required 的角色。
 * teamId 默认取自 req.params.teamId，也可通过 teamIdSource 自定义来源。
 */
export declare function requireTeamRole(required: TeamRole, teamIdSource?: (req: AuthRequest) => string | undefined): (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
//# sourceMappingURL=rbac.d.ts.map