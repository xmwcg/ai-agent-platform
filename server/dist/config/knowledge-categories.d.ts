/**
 * 通用知识库固定业务分类树（参考飞书知识库 / 腾讯乐享 / IMA 设计）
 * 用于知识库 2.0 的固定业务分类导航、权限与商业化分层。
 * 每个叶子分类可承载：法律咨询 / AI·Agent·技术 / 行业自动客服 / 办公文档 / 课程资料 等。
 */
export interface CategoryNode {
    key: string;
    label: string;
    children?: CategoryNode[];
}
export declare const KNOWLEDGE_CATEGORY_TREE: CategoryNode[];
/** 扁平化为可选分类路径（用于列表过滤与文档归类） */
export declare function flattenCategoryKeys(nodes?: CategoryNode[]): string[];
//# sourceMappingURL=knowledge-categories.d.ts.map