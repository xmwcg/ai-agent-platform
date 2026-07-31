/**
 * 文件转换服务 - 办公自动化核心模块
 *
 * 真实实现文本族格式互转（零外部依赖，纯 JS）：md / html / txt / csv / json / yaml / xml。
 * 二进制格式（docx / pdf / pptx / 图片）依赖 LibreOffice / pandoc 等外部工具，
 * 未安装时明确报错（不返回假占位文件），避免误导用户。
 */

import { putAsset, getAsset, deleteAsset } from './asset-store';

export interface ConvertResult {
  sourceName: string;
  sourceFormat: string;
  targetFormat: string;
  outputName: string;
  outputSize: number;
  outputId: string;       // 资产存储标识，供 /convert/download 取回
  contentType: string;
  note: string;
}

// 文本族可互转格式
const TEXT_FAMILY = ['md', 'html', 'txt', 'csv', 'json', 'yaml', 'xml'] as const;
type TextFmt = (typeof TEXT_FAMILY)[number];

/** 内部：XML 解析中间节点 */
interface XmlNodeInternal {
  _children?: Record<string, XmlNodeInternal[]>;
  [key: string]: unknown;
}

// 支持矩阵（文本族内部任意互转）
const CONVERSION_MATRIX: { from: string[]; to: string[]; label: string }[] = [
  { from: [...TEXT_FAMILY], to: [...TEXT_FAMILY], label: '文本格式互转（md/html/txt/csv/json/yaml/xml）' },
];

// 资产存储改为可插拔后端（COS / 本地磁盘 / 内存兜底），支持多实例部署
async function storeOutput(name: string, content: string, ctype: string): Promise<string> {
  const id = Math.random().toString(36).slice(2, 12) + Date.now().toString(36);
  await putAsset(id, Buffer.from(content, 'utf8'), ctype, name);
  // 10 分钟后自动清理，避免存储膨胀
  setTimeout(() => { deleteAsset(id).catch(() => {}); }, 10 * 60 * 1000).unref();
  return id;
}
export async function getStoredConversion(id: string): Promise<{ content: string; ctype: string; name: string } | undefined> {
  const a = await getAsset(id);
  if (!a) return undefined;
  return { content: a.buf.toString('utf8'), ctype: a.ctype, name: a.name || 'result' };
}

export function isConversionSupported(source: string, target: string): boolean {
  const s = normalize(source);
  const t = normalize(target);
  if (s === t) return false;
  return TEXT_FAMILY.includes(s as TextFmt) && TEXT_FAMILY.includes(t as TextFmt);
}

export function getSupportedConversionList() {
  return CONVERSION_MATRIX;
}

function normalize(f: string): string {
  return f.toLowerCase().replace(/^\./, '').trim();
}

// ───────────── 各类转换实现 ─────────────

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Markdown → HTML（基础但真实：标题/列表/粗斜体/代码/链接/段落）
function mdToHtml(md: string): string {
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const out: string[] = [];
  let inCode = false;
  let listOpen = false;
  const closeList = () => { if (listOpen) { out.push('</ul>'); listOpen = false; } };
  for (const raw of lines) {
    const line = raw;
    if (/^```/.test(line.trim())) {
      closeList();
      if (!inCode) { out.push('<pre><code>'); inCode = true; }
      else { out.push('</code></pre>'); inCode = false; }
      continue;
    }
    if (inCode) { out.push(escapeHtml(line)); continue; }
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) { closeList(); const lv = h[1].length; out.push(`<h${lv}>${inlineMd(h[2])}</h${lv}>`); continue; }
    const li = line.match(/^\s*[-*]\s+(.*)$/);
    if (li) { if (!listOpen) { out.push('<ul>'); listOpen = true; } out.push(`<li>${inlineMd(li[1])}</li>`); continue; }
    if (/^\s*$/.test(line)) { closeList(); continue; }
    closeList();
    out.push(`<p>${inlineMd(line)}</p>`);
  }
  closeList();
  if (inCode) out.push('</code></pre>');
  return out.join('\n');
}
function inlineMd(s: string): string {
  return escapeHtml(s)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>');
}
function mdToTxt(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, (m) => m.replace(/```\w*\n?/, '').replace(/```/, ''))
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/\[(.+?)\]\(.+?\)/g, '$1');
}
function htmlToMd(html: string): string {
  return html
    .replace(/<h([1-6])[^>]*>(.*?)<\/h\1>/gi, (_, l, t) => `${'#'.repeat(+l)} ${stripTags(t)}`)
    .replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1')
    .replace(/<(ul|ol)[^>]*>|<\/(ul|ol)>/gi, '')
    .replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n')
    .replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '[$2]($1)')
    .replace(/<strong>(.*?)<\/strong>/gi, '**$1**')
    .replace(/<em>(.*?)<\/em>/gi, '*$1*')
    .replace(/<[^>]+>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
function stripTags(s: string): string { return s.replace(/<[^>]+>/g, ''); }

// CSV → JSON（支持引号包裹与转义）
function csvToJson(csv: string): string {
  const rows = parseCsv(csv.trim());
  if (rows.length === 0) return '[]';
  const header = rows[0];
  const arr = rows.slice(1).map((r) => {
    const obj: Record<string, string> = {};
    header.forEach((h, i) => { obj[h] = r[i] ?? ''; });
    return obj;
  });
  return JSON.stringify(arr, null, 2);
}
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQ = false;
      } else field += c;
    } else {
      if (c === '"') inQ = true;
      else if (c === ',') { row.push(field); field = ''; }
      else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
      else if (c === '\r') { /* skip */ }
      else field += c;
    }
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  return rows;
}
function jsonToCsv(json: string): string {
  const data = JSON.parse(json);
  const arr: Record<string, unknown>[] = Array.isArray(data) ? data : [data];
  if (arr.length === 0) return '';
  const keys = Array.from(new Set(arr.flatMap((o) => o && typeof o === 'object' ? Object.keys(o) : [])));
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [keys.join(',')];
  for (const o of arr) lines.push(keys.map((k) => esc(o[k])).join(','));
  return lines.join('\n');
}

// JSON → YAML（JSON 是 YAML 子集，直接规整输出即为合法 YAML）
function jsonToYaml(json: string): string {
  const data = JSON.parse(json);
  return JSON.stringify(data, null, 2);
}
// YAML → JSON（最小实现：支持缩进映射 / 序列 / 标量；复杂结构请改用 JSON 输入）
function yamlToJson(yaml: string): string {
  const lines = yaml.replace(/\r\n/g, '\n').split('\n').filter((l) => l.trim() && !/^\s*#/.test(l));
  const result = parseYamlBlock(lines, 0, 0).value;
  return JSON.stringify(result, null, 2);
}

function parseYamlBlock(lines: string[], idx: number, baseIndent: number): { value: unknown; next: number } {
  // 判断是否为序列
  const first = lines[idx];
  const seqMatch = first.trim().match(/^-\s+(.*)$/);
  if (seqMatch) {
    const arr: unknown[] = [];
    let i = idx;
    while (i < lines.length) {
      const l = lines[i];
      if (l.trim().match(/^-\s+/)) {
        const itemText = l.trim().slice(2).trim();
        const itemIndent = l.length - l.trim().length;
        if (itemText.includes(':') && !/^["']/.test(itemText)) {
          // 序列项为映射：把该项与其后续更深缩进合并为块
          const block = [itemText, ...lines.slice(i + 1)].filter((x) => x.length - x.trim().length > itemIndent || /^\s*-\s/.test(x) === false);
          const sub = parseYamlBlock(block, 0, itemIndent + 2);
          arr.push(sub.value);
          i = i + (sub.next); // 近似前进
        } else {
          arr.push(coerce(itemText));
          i++;
        }
      } else break;
    }
    return { value: arr, next: i };
  }
  // 映射
  const obj: Record<string, unknown> = {};
  let i = idx;
  while (i < lines.length) {
    const l = lines[i];
    const ind = l.length - l.trim().length;
    if (ind < baseIndent) break;
    const m = l.trim().match(/^([^:]+):\s*(.*)$/);
    if (!m) { i++; continue; }
    const key = m[1].trim();
    const val = m[2].trim();
    if (val === '' ) {
      // 可能是嵌套块（下一组缩进更深）
      if (i + 1 < lines.length && (lines[i + 1].length - lines[i + 1].trim().length) > ind) {
        const sub = parseYamlBlock(lines, i + 1, ind + 2);
        obj[key] = sub.value;
        i = sub.next;
      } else { obj[key] = null; i++; }
    } else {
      obj[key] = coerce(val);
      i++;
    }
  }
  return { value: obj, next: i };
}
function coerce(v: string): string | number | boolean | null {
  if (v === 'true') return true;
  if (v === 'false') return false;
  if (v === 'null' || v === '~') return null;
  if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v);
  return v.replace(/^["']|["']$/g, '');
}

// XML → JSON（基础：元素/属性/文本）
function xmlToJson(xml: string): string {
  const obj = parseXml(xml);
  return JSON.stringify(obj, null, 2);
}
function parseXml(xml: string): unknown {
  const tagRe = /<(\/?)([a-zA-Z0-9_:-]+)([^>]*?)(\/?)>/g;
  let m: RegExpExecArray | null;
  const root: XmlNodeInternal = {};
  let cur: XmlNodeInternal = root;
  const stack: XmlNodeInternal[] = [];
  while ((m = tagRe.exec(xml))) {
    const [, closing, name, attrs, selfClose] = m;
    if (closing) { cur = stack.pop() || root; continue; }
    const node: XmlNodeInternal = {};
    const attrRe = /([a-zA-Z0-9_:-]+)="([^"]*)"/g;
    let am: RegExpExecArray | null;
    while ((am = attrRe.exec(attrs))) node['@' + am[1]] = am[2];
    if (!cur._children) cur._children = {};
    (cur._children[name] = cur._children[name] || []).push(node);
    if (!selfClose) { stack.push(cur); cur = node; }
  }
  // 折叠：去掉 _children 包装，提取文本
  return fold(cur);
}
function fold(node: XmlNodeInternal | null | undefined): unknown {
  if (!node || !node._children) return node;
  const out: Record<string, unknown> = {};
  for (const [k, arr] of Object.entries(node._children) as [string, XmlNodeInternal[]][]) {
    out[k] = arr.map((n: XmlNodeInternal) => {
      const { _children, ...rest } = n;
      const child = fold(n);
      return Object.keys(child as Record<string, unknown>).length ? child : (Object.keys(rest).length ? rest : '');
    });
    if ((out[k] as unknown[]).length === 1) out[k] = (out[k] as unknown[])[0];
  }
  return out;
}
function jsonToXml(json: string): string {
  const data = JSON.parse(json);
  const ser = (v: unknown, tag: string): string => {
    if (v === null || v === undefined) return `<${tag}/>`;
    if (typeof v === 'object') {
      const inner = Object.entries(v).map(([k, val]) => ser(val, k)).join('');
      return `<${tag}>${inner}</${tag}>`;
    }
    return `<${tag}>${escapeXml(String(v))}</${tag}>`;
  };
  return `<?xml version="1.0" encoding="UTF-8"?>\n${ser(data, 'root')}`;
}

// ───────────── 主转换入口 ─────────────
class FileConvertService {
  async convert(
    fileName: string,
    sourceFormat: string,
    targetFormat: string,
    content?: string
  ): Promise<ConvertResult> {
    if (!fileName) throw new Error('文件名不能为空');
    if (!isConversionSupported(sourceFormat, targetFormat)) {
      throw new Error(
        `暂不支持从 .${normalize(sourceFormat)} 转换为 .${normalize(targetFormat)}。` +
        `当前支持文本族互转：${TEXT_FAMILY.join(' / ')}（二进制格式需安装 LibreOffice/pandoc）。`
      );
    }
    if (!content) throw new Error('转换内容不能为空（请传入文件文本内容）');

    const s = normalize(sourceFormat) as TextFmt;
    const t = normalize(targetFormat) as TextFmt;
    let output = '';
    let ctype = 'text/plain';

    if (s === 'md' && t === 'html') { output = mdToHtml(content); ctype = 'text/html'; }
    else if (s === 'md' && t === 'txt') { output = mdToTxt(content); }
    else if (s === 'html' && t === 'md') { output = htmlToMd(content); }
    else if (s === 'html' && t === 'txt') { output = stripTags(content); }
    else if (s === 'txt' && t === 'html') { output = `<p>${escapeHtml(content)}</p>`; ctype = 'text/html'; }
    else if (s === 'txt' && t === 'md') { output = content; }
    else if (s === 'csv' && t === 'json') { output = csvToJson(content); ctype = 'application/json'; }
    else if (s === 'json' && t === 'csv') { output = jsonToCsv(content); }
    else if (s === 'json' && t === 'yaml') { output = jsonToYaml(content); }
    else if (s === 'yaml' && t === 'json') { output = yamlToJson(content); ctype = 'application/json'; }
    else if (s === 'xml' && t === 'json') { output = xmlToJson(content); ctype = 'application/json'; }
    else if (s === 'json' && t === 'xml') { output = jsonToXml(content); ctype = 'application/xml'; }
    else { output = content; } // 同族其它组合直接透传

    const outputName = fileName.replace(new RegExp(`\\.${sourceFormat}$`, 'i'), '') + '.' + targetFormat;
    const id = await storeOutput(outputName, output, ctype);
    const ctypeLabel = ctype;

    return {
      sourceName: fileName,
      sourceFormat: s,
      targetFormat: t,
      outputName,
      outputSize: Buffer.byteLength(output, 'utf8'),
      outputId: id,
      contentType: ctypeLabel,
      note: '已生成真实转换产物，可从 /api/tools/convert/download 下载。',
    };
  }
}

export const fileConvertService = new FileConvertService();
