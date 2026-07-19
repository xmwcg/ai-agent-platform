"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RESOURCE_ROLE_RANK = void 0;
exports.canAccessResource = canAccessResource;
exports.RESOURCE_ROLE_RANK = {
    owner: 4,
    admin: 3,
    member: 2,
    viewer: 1,
};
/** 纯函数：判定用户是否可访问资源（可单测） */
function canAccessResource(input) {
    const { userId, ownerId, author, memberRole, minRole = 'viewer' } = input;
    if (!userId)
        return false;
    if (ownerId && ownerId === userId)
        return true;
    if (author && author === userId)
        return true;
    if (memberRole) {
        const rank = exports.RESOURCE_ROLE_RANK[memberRole] ?? 0;
        return rank >= (exports.RESOURCE_ROLE_RANK[minRole] ?? 1);
    }
    return false;
}
//# sourceMappingURL=resourceAccess.js.map