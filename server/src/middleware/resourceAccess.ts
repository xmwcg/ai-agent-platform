/**
 * 资源级访问控制（团队 RBAC 下沉到具体资源）
 *
 * 设计：把“用户对该资源的权限”拆成纯函数判定，方便单元测试，
 * DB 查询（团队成员关系）由路由层负责、把已查得的结果传入。
 *
 * 判定逻辑：
 * - 资源直接归属用户（ownerId / author === userId）→ 允许
 * - 资源归属某团队且用户是该团队成员 → 按成员角色判定是否满足 minRole
 * - 否则拒绝
 */
import { TeamRole } from '../models/Team';

export const RESOURCE_ROLE_RANK: Record<TeamRole, number> = {
  owner: 4,
  admin: 3,
  member: 2,
  viewer: 1,
};

export interface ResourceAccessInput {
  userId: string | undefined;
  /** 资源直接拥有者（客服 bot 的 ownerId） */
  ownerId?: string;
  /** 文档作者（knowledge.author） */
  author?: string;
  /** 资源所属团队的“当前用户角色”（路由层查得后传入，未加入则传 undefined） */
  memberRole?: TeamRole | string | null;
  /** 所需最小角色，默认 viewer（只读） */
  minRole?: TeamRole;
}

/** 纯函数：判定用户是否可访问资源（可单测） */
export function canAccessResource(input: ResourceAccessInput): boolean {
  const { userId, ownerId, author, memberRole, minRole = 'viewer' } = input;
  if (!userId) return false;
  if (ownerId && ownerId === userId) return true;
  if (author && author === userId) return true;
  if (memberRole) {
    const rank = RESOURCE_ROLE_RANK[memberRole as TeamRole] ?? 0;
    return rank >= (RESOURCE_ROLE_RANK[minRole] ?? 1);
  }
  return false;
}
