import { aggregateGraph, RawKnowledgeDoc } from './knowledge-graph.service';

/** 测试用知识文档样本 */
const docs: RawKnowledgeDoc[] = [
  { _id: '1', title: '文档A', tags: ['ai', '云'], categories: ['技术'], viewCount: 10 },
  { _id: '2', title: '文档B', tags: ['ai'], categories: ['技术'], viewCount: 5 },
  { _id: '3', title: '文档C', tags: ['设计'], categories: [], viewCount: 2, relatedDocs: ['1'] },
];

describe('知识图谱聚合（aggregateGraph 纯函数）', () => {
  it('生成文档 / 标签 / 分类三类节点', () => {
    const g = aggregateGraph(docs);
    // 文档 3 + 标签(ai,云,设计)3 + 分类(技术)1 = 7
    expect(g.nodes.length).toBe(7);
    const docNodes = g.nodes.filter((n) => n.type === 'doc');
    expect(docNodes.length).toBe(3);
    expect(docNodes.find((n) => n.id === 'doc:1')!.weight).toBe(10);
    expect(g.nodes.find((n) => n.id === 'tag:ai')!.docCount).toBe(2);
    expect(g.nodes.find((n) => n.id === 'cat:技术')!.docCount).toBe(2);
  });

  it('生成 doc-tag 与 doc-category 归属边', () => {
    const g = aggregateGraph(docs);
    // 标签边：A(ai,云) B(ai) C(设计) = 4
    expect(g.links.filter((l) => l.type === 'doc-tag').length).toBe(4);
    // 分类边：A(技术) B(技术) = 2
    expect(g.links.filter((l) => l.type === 'doc-category').length).toBe(2);
  });

  it('共享标签生成 doc-doc 共现边（权重=共享标签数）', () => {
    const g = aggregateGraph(docs);
    const edge = g.links.find(
      (l) => l.type === 'doc-doc' && l.source === 'doc:1' && l.target === 'doc:2'
    );
    expect(edge).toBeTruthy();
    expect(edge!.weight).toBe(1);
  });

  it('relatedDocs 生成强关联 doc-doc 边（权重更高）', () => {
    const g = aggregateGraph(docs);
    const edge = g.links.find(
      (l) => l.type === 'doc-doc' && l.source === 'doc:3' && l.target === 'doc:1'
    );
    expect(edge).toBeTruthy();
    expect(edge!.weight).toBe(5);
  });

  it('minSharedTags 过滤共现边，但保留显式 relatedDocs 强边', () => {
    const g = aggregateGraph(docs, { minSharedTags: 2 });
    const co = g.links.filter((l) => l.type === 'doc-doc');
    // 共现边（权重1，共享1个标签）被过滤；relatedDocs 边（权重5）保留
    expect(co.length).toBe(1);
    expect(co[0].weight).toBe(5);
  });

  it('includeTags=false 时不生成标签节点与共现边', () => {
    const g = aggregateGraph(docs, { includeTags: false });
    expect(g.nodes.filter((n) => n.type === 'tag').length).toBe(0);
    expect(g.links.filter((l) => l.type === 'doc-tag').length).toBe(0);
    expect(g.links.filter((l) => l.type === 'doc-doc' && l.source === 'doc:1' && l.target === 'doc:2').length).toBe(0);
    // relatedDocs 边仍保留
    expect(g.links.filter((l) => l.type === 'doc-doc' && l.source === 'doc:3' && l.target === 'doc:1').length).toBe(1);
  });

  it('空文档列表返回空图谱', () => {
    const g = aggregateGraph([]);
    expect(g.nodes.length).toBe(0);
    expect(g.links.length).toBe(0);
  });
});
