import { extractSources } from './customer-service';

describe('智能客服 - 答案可追溯来源提取', () => {
  it('应提取 docId / 标题 / 置信度 / 摘要', () => {
    const scoped = [
      {
        document: { _id: { toString: () => 'doc_1' }, title: '退款政策', content: 'a'.repeat(200) },
        similarity: 0.9123,
      },
    ];
    const sources = extractSources(scoped);
    expect(sources[0].docId).toBe('doc_1');
    expect(sources[0].title).toBe('退款政策');
    expect(sources[0].confidence).toBe(0.912);
    expect(sources[0].snippet.endsWith('...')).toBe(true);
    expect(sources[0].snippet.length).toBe(153);
  });

  it('空结果返回空数组', () => {
    expect(extractSources([])).toEqual([]);
  });
});
