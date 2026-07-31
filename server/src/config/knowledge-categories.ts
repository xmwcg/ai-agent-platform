/**
 * 金奕鸣通用知识库 · 固定业务分类树
 * 命名参考 skillhub 企业专区 12 行业分类：
 *   互联网/科技、金融、医疗健康、零售/电商、教育、企业服务、
 *   工业制造、政府/公共、媒体/通信、专业服务、开源社区、其他
 * 设计：一级 = 行业，二级 = 功能子类（官方文档 / 接入教程 / 客服知识库 / 技术资料 / 模型配置 / 技能MCP）。
 * 节点形状与前端 KnowledgeList 的 TreeSelect 保持一致（key/label/children），向后兼容。
 * 文档的 categoryTree 使用「中文标签路径」，如 ['金融', '官方文档', 'DeepSeek 官方文档']。
 */
export interface CategoryNode {
  key: string;
  label: string;
  children?: CategoryNode[];
}

/** 业务功能子类（二级分类，所有行业通用） */
export const FUNCTIONAL_CHILDREN: CategoryNode[] = [
  { key: 'official-docs', label: '官方文档' },
  { key: 'integration', label: '接入教程' },
  { key: 'cs-kb', label: '客服知识库' },
  { key: 'tech', label: '技术资料' },
  { key: 'model-config', label: '模型配置' },
  { key: 'skills-mcp', label: '技能MCP' },
];

function industry(key: string, label: string): CategoryNode {
  return {
    key,
    label,
    children: FUNCTIONAL_CHILDREN.map((c) => ({ ...c })),
  };
}

export const KNOWLEDGE_CATEGORY_TREE: CategoryNode[] = [
  industry('internet-tech', '互联网/科技'),
  industry('finance', '金融'),
  industry('medical', '医疗健康'),
  industry('retail', '零售/电商'),
  industry('education', '教育'),
  industry('enterprise', '企业服务'),
  industry('manufacturing', '工业制造'),
  industry('government', '政府/公共'),
  industry('media', '媒体/通信'),
  industry('professional', '专业服务'),
  industry('opensource', '开源社区'),
  industry('other', '其他'),
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

/** 一级行业标签列表（用于知识库内容库目录映射） */
export const INDUSTRY_LABELS: string[] = KNOWLEDGE_CATEGORY_TREE.map((n) => n.label);

/** 功能子类标签列表 */
export const FUNCTIONAL_LABELS: string[] = FUNCTIONAL_CHILDREN.map((c) => c.label);
