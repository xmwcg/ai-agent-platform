import type { Skill } from '../types';
/**
 * 视频生产流水线技能：research → script → compose。
 * 所有阶段必须由真实 Provider 产出；任何关键阶段失败都会返回明确错误，绝不把错误文本包装成成功结果。
 */
export declare const videoPipelineSkill: Skill;
//# sourceMappingURL=video-pipeline.skill.d.ts.map