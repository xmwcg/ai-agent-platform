"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sanitizeSkillId = sanitizeSkillId;
/** 把任意来源的 id 清洗为安全、唯一的技能 id（用户技能统一加 u- 前缀，避免覆盖内置技能） */
function sanitizeSkillId(raw) {
    let s = String(raw || '').trim().toLowerCase();
    s = s.replace(/[^a-z0-9_-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    s = s.slice(0, 48);
    if (!s)
        s = 'skill';
    return s.startsWith('u-') ? s : `u-${s}`;
}
//# sourceMappingURL=package-types.js.map