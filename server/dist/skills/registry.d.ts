/**
 * 技能注册表（agency-agents 的「名册 roster」）
 * ----------------------------------------------------------------
 * 所有能力在此集中注册，路由层 / 网关 / 开放 API 市场只需遍历此表，
 * 即可实现「能力可声明、可插拔、可上架」。新增能力 = 新增一个 Skill 并注册。
 */
import type { Skill } from './types';
export declare function registerSkill(skill: Skill): void;
export declare function getSkill(id: string): Skill | undefined;
export declare function listSkills(): Skill[];
/** 仅列出可上架开放 API 市场的技能 */
export declare function listMarketableSkills(): Skill[];
//# sourceMappingURL=registry.d.ts.map