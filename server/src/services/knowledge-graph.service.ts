/**
 * 知识图谱聚合服务
 *
 * 从知识文档（KnowledgeDocument）聚合出「文档 / 标签 / 分类」三类节点与它们之间的关联边，
 * 为前端力导向图（ECharts graph）提供数据。纯本地计算、零外部依赖，可完整单测。
 *
 * 节点：
 *  - doc：每篇知识文档（weight = 浏览量 viewCount）
 *  - tag：去重后的全部标签（weight = 关联文档数）
 *  - category：去重后的全部分类（weight = 关联文档数）
 * 边：
 *  - doc-tag / doc-category：文档与自身标签 / 分类的归属
 *  - doc-doc：两篇文档共享 ≥ minSharedTags 个标签时连边（权重 = 共享标签数）；
 *            文档显式 relatedDocs 关联也连 doc-doc 边（权重更高，视为强关联）
 */
import { KnowledgeDocument } from '../models/KnowledgeDocument';

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
export function aggregateGraph(
  rawDocs: RawKnowledgeDoc[],
  options: { includeTags?: boolean; includeCategories?: boolean; minSharedTags?: number } = {}
): KnowledgeGraph {
  const { includeTags = true, includeCategories = true, minSharedTags = 1 } = options;

  const nodes: GraphNode[] = [];
  const links: GraphLink[] = [];
  const tagDocCount = new Map<string, number>();
  const categoryDocCount = new Map<string, number>();
  const tagToDocs = new Map<string, string[]>();
  const docIds = new Set<string>();

  for (const doc of rawDocs) {
    const docId = String(doc._id);
    docIds.add(docId);
    const tags = Array.isArray(doc.tags) ? doc.tags : [];
    const categories = Array.isArray(doc.categories) ? doc.categories : [];

    nodes.push({
      id: `doc:${docId}`,
      label: doc.title || '(无标题)',
      type: 'doc',
      weight: typeof doc.viewCount === 'number' ? doc.viewCount : 1,
      tags,
    });

    for (const tag of tags) {
      if (!tag) continue;
      links.push({ source: `doc:${docId}`, target: `tag:${tag}`, type: 'doc-tag', weight: 1 });
      tagDocCount.set(tag, (tagDocCount.get(tag) || 0) + 1);
      if (!tagToDocs.has(tag)) tagToDocs.set(tag, []);
      tagToDocs.get(tag)!.push(docId);
    }

    if (includeCategories) {
      for (const cat of categories) {
        if (!cat) continue;
        links.push({ source: `doc:${docId}`, target: `cat:${cat}`, type: 'doc-category', weight: 1 });
        categoryDocCount.set(cat, (categoryDocCount.get(cat) || 0) + 1);
      }
    }
  }

  // doc-doc 边：共现（权重=共享标签数）+ 显式 relatedDocs（权重更高）
  const docDocEdges = new Map<string, number>();
  const addEdge = (a: string, b: string, w: number) => {
    const key = a < b ? `${a}|${b}` : `${b}|${a}`;
    docDocEdges.set(key, (docDocEdges.get(key) || 0) + w);
  };

  if (includeTags) {
    for (const [, ids] of tagToDocs) {
      for (let i = 0; i < ids.length; i++) {
        for (let j = i + 1; j < ids.length; j++) {
          addEdge(ids[i], ids[j], 1);
        }
      }
    }
    for (const [tag, count] of tagDocCount) {
      nodes.push({ id: `tag:${tag}`, label: tag, type: 'tag', weight: count, docCount: count });
    }
  }

  for (const doc of rawDocs) {
    const docId = String(doc._id);
    const related = Array.isArray(doc.relatedDocs) ? doc.relatedDocs : [];
    for (const rel of related) {
      const r = String(rel);
      if (docIds.has(r)) addEdge(docId, r, 5);
    }
  }

  for (const [key, weight] of docDocEdges) {
    if (weight < minSharedTags) continue;
    const [a, b] = key.split('|');
    links.push({ source: `doc:${a}`, target: `doc:${b}`, type: 'doc-doc', weight });
  }

  if (includeCategories) {
    for (const [cat, count] of categoryDocCount) {
      nodes.push({ id: `cat:${cat}`, label: cat, type: 'category', weight: count, docCount: count });
    }
  }

  return { nodes, links };
}

/** 从数据库查询知识文档并聚合为图谱 */
export async function buildKnowledgeGraph(options: BuildGraphOptions = {}): Promise<KnowledgeGraph> {
  const {
    teamId,
    includeTags = true,
    includeCategories = true,
    minSharedTags = 1,
    limit = 500,
  } = options;

  const filter: Record<string, unknown> = {};
  if (teamId) {
    filter.$or = [{ teamId }, { isPublic: true }];
  }

  const docs = (await KnowledgeDocument.find(filter)
    .select('title tags categories viewCount relatedDocs')
    .limit(limit)
    .lean()) as unknown as Array<{
    _id: any;
    title: string;
    tags?: string[];
    categories?: string[];
    viewCount?: number;
    relatedDocs?: string[];
  }>;

  const raw: RawKnowledgeDoc[] = docs.map((d) => ({
    _id: String(d._id),
    title: d.title,
    tags: d.tags,
    categories: d.categories,
    viewCount: d.viewCount,
    relatedDocs: d.relatedDocs,
  }));

  return aggregateGraph(raw, { includeTags, includeCategories, minSharedTags });
}
