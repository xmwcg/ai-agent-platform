declare const router: import("express-serve-static-core").Router;
export declare function isCustomerServiceMockModeEnabled(): boolean;
/** 转人工判定（纯函数，便于单测）：
 *  - handoffEnabled 为 false 时恒不转人工（合规兜底）
 *  - 显式请求 或 命中通用触发词（人工/转人工/客服热线/联系客服/真人）
 *  - 命中机器人自定义行业触发词（如诊所「胸痛」、律所「起诉」、工厂「起火」）
 */
export declare function shouldEscalate(message: string, cs: {
    handoffEnabled: boolean;
    escalationTriggers?: string[];
}, explicit?: boolean): boolean;
/** 检索命中（文档 + 相似度分数），与 embeddingService.searchSimilarDocuments 返回结构一致 */
export type ScoredDoc = {
    document: {
        _id?: {
            toString(): string;
        };
        id?: string;
        title?: string;
        content?: string;
    };
    similarity: number;
};
/** 可追溯来源条目 */
export interface SourceRef {
    docId: string | undefined;
    title: string | undefined;
    confidence: number;
    snippet: string;
}
/** 从检索结果提取可追溯来源（答案引用，差异化亮点：回答可信、可溯源） */
export declare function extractSources(scoped: ScoredDoc[]): SourceRef[];
export default router;
//# sourceMappingURL=customer-service.d.ts.map