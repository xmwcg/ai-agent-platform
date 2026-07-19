import type { Skill } from '../types';
/**
 * 技能编写（skill-authoring）
 * ----------------------------------------------------------------
 * 对应 superpowers 的 `writing-skills` 元技能：把有效经验沉淀为新 skill。
 * 区别：superpowers 在编码代理内写 SKILL.md；本技能在「平台运行时」内，
 * 调用统一 AI 网关（route）生成一份可直接落地的 Skill 定义骨架
 * （manifest + invoke 骨架 TS 代码），供开发者复制到 skills/defs/ 并注册。
 *
 * 这是 superpowers 方法论在本项目「技能协议层」上的工程化映射，也是
 * 开放 API 市场「用户可自助沉淀技能」的前置能力。
 */
export declare const skillAuthoringSkill: Skill;
//# sourceMappingURL=skill-authoring.skill.d.ts.map