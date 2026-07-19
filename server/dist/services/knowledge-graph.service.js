"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.aggregateGraph = aggregateGraph;
exports.buildKnowledgeGraph = buildKnowledgeGraph;
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
const KnowledgeDocument_1 = require("../models/KnowledgeDocument");
/**
 * 纯函数：将知识文档列表聚合为图谱（节点 + 边）。不依赖数据库，便于单测。
 */
function aggregateGraph(rawDocs, options = {}) {
    const { includeTags = true, includeCategories = true, minSharedTags = 1 } = options;
    const nodes = [];
    const links = [];
    const tagDocCount = new Map();
    const categoryDocCount = new Map();
    const tagToDocs = new Map();
    const docIds = new Set();
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
        if (includeTags) {
            for (const tag of tags) {
                if (!tag)
                    continue;
                links.push({ source: `doc:${docId}`, target: `tag:${tag}`, type: 'doc-tag', weight: 1 });
                tagDocCount.set(tag, (tagDocCount.get(tag) || 0) + 1);
                if (!tagToDocs.has(tag))
                    tagToDocs.set(tag, []);
                tagToDocs.get(tag).push(docId);
            }
        }
        if (includeCategories) {
            for (const cat of categories) {
                if (!cat)
                    continue;
                links.push({ source: `doc:${docId}`, target: `cat:${cat}`, type: 'doc-category', weight: 1 });
                categoryDocCount.set(cat, (categoryDocCount.get(cat) || 0) + 1);
            }
        }
    }
    // doc-doc 边：共现（权重=共享标签数）+ 显式 relatedDocs（权重更高）
    const docDocEdges = new Map();
    const addEdge = (a, b, w) => {
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
            if (docIds.has(r))
                addEdge(docId, r, 5);
        }
    }
    for (const [key, weight] of docDocEdges) {
        if (weight < minSharedTags)
            continue;
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
async function buildKnowledgeGraph(options = {}) {
    const { teamId, includeTags = true, includeCategories = true, minSharedTags = 1, limit = 500, } = options;
    const filter = {};
    if (teamId) {
        filter.$or = [{ teamId }, { isPublic: true }];
    }
    const docs = (await KnowledgeDocument_1.KnowledgeDocument.find(filter)
        .select('title tags categories viewCount relatedDocs')
        .limit(limit)
        .lean());
    const raw = docs.map((d) => ({
        _id: String(d._id),
        title: d.title,
        tags: d.tags,
        categories: d.categories,
        viewCount: d.viewCount,
        relatedDocs: d.relatedDocs,
    }));
    return aggregateGraph(raw, { includeTags, includeCategories, minSharedTags });
}
//# sourceMappingURL=knowledge-graph.service.js.map