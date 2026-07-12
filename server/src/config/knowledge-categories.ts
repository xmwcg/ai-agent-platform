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

export const KNOWLEDGE_CATEGORY_TREE: CategoryNode[] = [
  {
    key: 'legal',
    label: '法律咨询',
    children: [
      { key: 'legal/contract', label: '合同范本' },
      { key: 'legal/labor', label: '劳动用工' },
      { key: 'legal/company', label: '公司合规' },
      { key: 'legal/ip', label: '知识产权' },
      { key: 'legal/dispute', label: '诉讼仲裁' },
    ],
  },
  {
    key: 'ai-tech',
    label: 'AI · Agent · 技术',
    children: [
      { key: 'ai-tech/llm', label: '大模型原理' },
      { key: 'ai-tech/agent', label: 'Agent 工作流' },
      { key: 'ai-tech/prompt', label: '提示词工程' },
      { key: 'ai-tech/rag', label: 'RAG 检索增强' },
      { key: 'ai-tech/coding', label: 'AI 编程' },
    ],
  },
  {
    key: 'customer-service',
    label: '行业自动客服',
    children: [
      { key: 'cs/ecommerce', label: '电商零售' },
      { key: 'cs/education', label: '教育培训' },
      { key: 'cs/medical', label: '医疗健康' },
      { key: 'cs/finance', label: '金融投资' },
      { key: 'cs/government', label: '政务办公' },
    ],
  },
  {
    key: 'office',
    label: '办公文档',
    children: [
      { key: 'office/report', label: '报告方案' },
      { key: 'office/finance-doc', label: '财务模板' },
      { key: 'office/hr', label: '人事行政' },
      { key: 'office/meeting', label: '会议纪要' },
    ],
  },
  {
    key: 'course',
    label: '课程资料',
    children: [
      { key: 'course/ai-basic', label: 'AI 入门' },
      { key: 'course/ai-advance', label: 'AI 进阶' },
      { key: 'course/cert', label: '认证备考' },
    ],
  },
  {
    key: 'general',
    label: '通用百科',
    children: [
      { key: 'general/encyclopedia', label: '文献百科' },
      { key: 'general/industry', label: '行业研究' },
    ],
  },
];

/** 扁平化为可选分类路径（用于列表过滤与文档归类） */
export function flattenCategoryKeys(nodes: CategoryNode[] = KNOWLEDGE_CATEGORY_TREE): string[] {
  const out: string[] = [];
  for (const n of nodes) {
    out.push(n.key);
    if (n.children) out.push(...flattenCategoryKeys(n.children));
  }
  return out;
}
