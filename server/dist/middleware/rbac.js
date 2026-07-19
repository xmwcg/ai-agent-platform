"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ROLE_RANK = void 0;
exports.hasTeamRole = hasTeamRole;
exports.requireTeamRole = requireTeamRole;
const Team_1 = require("../models/Team");
exports.ROLE_RANK = {
    owner: 4,
    admin: 3,
    member: 2,
    viewer: 1,
};
/** 判断用户角色是否满足所需最小角色 */
function hasTeamRole(userRole, required) {
    if (!userRole)
        return false;
    return exports.ROLE_RANK[userRole] >= exports.ROLE_RANK[required];
}
/**
 * 团队 RBAC 中间件：要求当前登录用户在指定团队中具备 >= required 的角色。
 * teamId 默认取自 req.params.teamId，也可通过 teamIdSource 自定义来源。
 */
function requireTeamRole(required, teamIdSource = (req) => req.params.teamId) {
    return async (req, res, next) => {
        const teamId = teamIdSource(req);
        if (!req.user || !teamId) {
            res.status(401).json({ error: '缺少团队或登录信息' });
            return;
        }
        const team = await Team_1.Team.findById(teamId);
        if (!team) {
            res.status(404).json({ error: '团队不存在' });
            return;
        }
        const member = team.members.find((m) => m.userId === req.user.id);
        if (!member || !hasTeamRole(member.role, required)) {
            res.status(403).json({ error: '团队权限不足', requiredRole: required, yourRole: member?.role });
            return;
        }
        req.teamRole = member.role;
        req.team = team;
        next();
    };
}
//# sourceMappingURL=rbac.js.map