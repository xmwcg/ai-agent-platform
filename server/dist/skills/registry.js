"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerSkill = registerSkill;
exports.getSkill = getSkill;
exports.listSkills = listSkills;
exports.listMarketableSkills = listMarketableSkills;
const knowledge_skill_1 = require("./defs/knowledge.skill");
const ai_chat_skill_1 = require("./defs/ai-chat.skill");
const media_skill_1 = require("./defs/media.skill");
const customer_service_skill_1 = require("./defs/customer-service.skill");
const code_explain_skill_1 = require("./defs/code-explain.skill");
const translate_skill_1 = require("./defs/translate.skill");
const video_pipeline_skill_1 = require("./defs/video-pipeline.skill");
const skill_authoring_skill_1 = require("./defs/skill-authoring.skill");
const summarize_skill_1 = require("./defs/summarize.skill");
const xhs_experts_skill_1 = require("./defs/xhs-experts.skill");
const SKILLS = [
    knowledge_skill_1.knowledgeSkill,
    ai_chat_skill_1.chatSkill,
    media_skill_1.mediaSkill,
    customer_service_skill_1.customerServiceSkill,
    code_explain_skill_1.codeExplainSkill,
    translate_skill_1.translateSkill,
    video_pipeline_skill_1.videoPipelineSkill,
    skill_authoring_skill_1.skillAuthoringSkill,
    summarize_skill_1.summarizeSkill,
    ...xhs_experts_skill_1.xhsExpertSkills,
];
const byId = new Map(SKILLS.map((s) => [s.manifest.id, s]));
function registerSkill(skill) {
    byId.set(skill.manifest.id, skill);
}
function getSkill(id) {
    return byId.get(id);
}
function listSkills() {
    return Array.from(byId.values());
}
/** 仅列出可上架开放 API 市场的技能 */
function listMarketableSkills() {
    return listSkills().filter((s) => s.manifest.marketable);
}
//# sourceMappingURL=registry.js.map