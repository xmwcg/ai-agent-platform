declare const router: import("express-serve-static-core").Router;
export interface QuickstartTemplate {
    id: string;
    name: string;
    desc: string;
    icon: string;
    category: 'generic' | 'industry';
    vertical?: string;
    knowledge: {
        title: string;
        content: string;
        tags: string[];
    }[];
    bot: {
        name: string;
        systemPrompt: string;
        welcomeMessage: string;
    };
    /** 行业合规触发词：命中即转人工（诊所急诊、律所起诉、工厂起火等） */
    escalationTriggers?: string[];
    modelHint: string;
}
/** 场景化快速启动模板：差异化亮点（对标 n8n 模板市场 / Dify 应用模板），降低上手门槛 */
export declare const QUICKSTART_TEMPLATES: QuickstartTemplate[];
/**
 * 行业预置知识包 + 垂直模板（★ 差异化：县域/传统行业「零技术接入」）
 * 每个模板自带多份行业知识文档 + 行业合规触发词，诊所/律所/培训机构/工厂一键生成「知识库 + 合规客服」，
 * 直接命中 FastGPT/Dify 未做满的「传统行业零技术接入」空白带。
 */
export declare const INDUSTRY_TEMPLATES: QuickstartTemplate[];
/** 合并通用 + 行业模板，作为完整模板目录 */
export declare const ALL_QUICKSTART_TEMPLATES: QuickstartTemplate[];
export default router;
//# sourceMappingURL=quickstart.d.ts.map