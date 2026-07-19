export type GraphNodeType = 'doc' | 'tag' | 'category';
export interface GraphNode {
    id: string;
    label: string;
    type: GraphNodeType;
    weight: number;
    /** 仅 doc 节点带有 tags，便于前端展示 */
    tags?: string[];
    /** 仅 tag / category 节点带有：关联文档数 */
    docCount?: number;
}
export interface GraphLink {
    source: string;
    target: string;
    type: 'doc-tag' | 'doc-category' | 'doc-doc';
    weight: number;
}
export interface KnowledgeGraph {
    nodes: GraphNode[];
    links: GraphLink[];
}
export interface BuildGraphOptions {
    /** 团队隔离：仅返回该团队文档 + 公开文档 */
    teamId?: string;
    includeTags?: boolean;
    includeCategories?: boolean;
    /** doc-doc 共现边的最小共享标签数（默认 1） */
    minSharedTags?: number;
    /** 文档取样上限（默认 500，防止超大规模下 O(n²) 共现计算过慢） */
    limit?: number;
}
/** 知识文档最小结构（用于纯函数聚合，便于单测，避免依赖数据库） */
export interface RawKnowledgeDoc {
    _id: string;
    title: string;
    tags?: string[];
    categories?: string[];
    viewCount?: number;
    relatedDocs?: string[];
}
/**
 * 纯函数：将知识文档列表聚合为图谱（节点 + 边）。不依赖数据库，便于单测。
 */
export declare function aggregateGraph(rawDocs: RawKnowledgeDoc[], options?: {
    includeTags?: boolean;
    includeCategories?: boolean;
    minSharedTags?: number;
}): KnowledgeGraph;
/** 从数据库查询知识文档并聚合为图谱 */
export declare function buildKnowledgeGraph(options?: BuildGraphOptions): Promise<KnowledgeGraph>;
//# sourceMappingURL=knowledge-graph.service.d.ts.map