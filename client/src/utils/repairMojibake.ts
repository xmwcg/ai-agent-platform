/**
 * 修复历史数据中常见的 UTF-8 被按 Latin-1/Windows-1252 读取后保存的乱码。
 *
 * 这是前端兼容层：只在候选文本的乱码特征明显减少时采用修复结果，
 * 正常中文、英文和合法西文不会被重新编码。待生产数据完成迁移后仍可保留，
 * 用于兼容缓存、搜索索引和旧导入记录。
 */
const MOJIBAKE_PATTERN = /[\u00C0-\u00FF][\u0080-\u00BF]/g;

function mojibakeScore(value: string): number {
  return (value.match(MOJIBAKE_PATTERN) || []).length;
}

function decodeUtf8AsLatin1(value: string): string | null {
  if (typeof TextDecoder === 'undefined' || mojibakeScore(value) === 0) return null;

  try {
    const bytes = Uint8Array.from(value, (character) => character.charCodeAt(0) & 0xff);
    const decoded = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    return decoded === value ? null : decoded;
  } catch {
    return null;
  }
}

export function repairMojibake(value: unknown): string {
  if (typeof value !== 'string' || !value) return typeof value === 'string' ? value : '';

  let repaired = value;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const candidate = decodeUtf8AsLatin1(repaired);
    if (!candidate || mojibakeScore(candidate) >= mojibakeScore(repaired)) break;
    repaired = candidate;
  }
  return repaired;
}

export function repairStringList(values: unknown): string[] {
  return Array.isArray(values) ? values.map(repairMojibake) : [];
}

export function repairKnowledgeDocument<T extends Record<string, any>>(document: T): T {
  return {
    ...document,
    title: repairMojibake(document.title),
    content: repairMojibake(document.content),
    htmlContent: repairMojibake(document.htmlContent),
    previewContent: repairMojibake(document.previewContent),
    tags: repairStringList(document.tags),
    categories: repairStringList(document.categories),
    author: document.author
      ? { ...document.author, username: repairMojibake(document.author.username) }
      : document.author,
  };
}
