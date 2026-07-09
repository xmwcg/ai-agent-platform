/**
 * 技能注册表（agency-agents 的「名册 roster」）
 * ----------------------------------------------------------------
 * 所有能力在此集中注册，路由层 / 网关 / 开放 API 市场只需遍历此表，
 * 即可实现「能力可声明、可插拔、可上架」。新增能力 = 新增一个 Skill 并注册。
 */
import type { Skill } from './types';
import { knowledgeSkill } from './defs/knowledge.skill';
import { chatSkill } from './defs/ai-chat.skill';
import { mediaSkill } from './defs/media.skill';
import { customerServiceSkill } from './defs/customer-service.skill';
import { codeExplainSkill } from './defs/code-explain.skill';
import { translateSkill } from './defs/translate.skill';
import { videoPipelineSkill } from './defs/video-pipeline.skill';
import { skillAuthoringSkill } from './defs/skill-authoring.skill';
import { summarizeSkill } from './defs/summarize.skill';

const SKILLS: Skill[] = [
  knowledgeSkill,
  chatSkill,
  mediaSkill,
  customerServiceSkill,
  codeExplainSkill,
  translateSkill,
  videoPipelineSkill,
  skillAuthoringSkill,
  summarizeSkill,
];

const byId = new Map<string, Skill>(SKILLS.map((s) => [s.manifest.id, s]));

export function registerSkill(skill: Skill): void {
  byId.set(skill.manifest.id, skill);
}

export function getSkill(id: string): Skill | undefined {
  return byId.get(id);
}

export function listSkills(): Skill[] {
  return Array.from(byId.values());
}

/** 仅列出可上架开放 API 市场的技能 */
export function listMarketableSkills(): Skill[] {
  return listSkills().filter((s) => s.manifest.marketable);
}
