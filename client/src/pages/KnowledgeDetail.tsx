import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import DOMPurify from 'dompurify';
import {
  Card, Typography, Button, message, Tag, Space, Divider, Anchor, Tooltip, Skeleton, Alert,
} from 'antd';
import {
  ArrowLeftOutlined, EditOutlined, DownloadOutlined, SwapOutlined,
  RobotOutlined, ClockCircleOutlined, UserOutlined, EyeOutlined,
  HeartOutlined, ShareAltOutlined, CrownOutlined, LockOutlined,
} from '@ant-design/icons';
import apiClient, { extractApiError, toolsAPI } from '@/services/api';
import FileConverter from '@/components/FileConverter';
import { repairKnowledgeDocument } from '@/utils/repairMojibake';

const { Title, Text } = Typography;

interface KnowledgeDocument {
  _id: string;
  title: string;
  content?: string;
  htmlContent?: string;
  previewContent?: string;
  access?: string;
  requiredPlan?: string;
  creditsCost?: number;
  creditsNeeded?: number;
  creditsHave?: number;
  freePreviewPages?: number;
  price?: number;
  tags: string[];
  categories: string[];
  viewCount: number;
  likeCount: number;
  createdAt: string;
  updatedAt: string;
  author: { username: string };
}

type KnowledgeHeading = { level: number; text: string; id: string };
type RenderedKnowledgeContent = { html: string; headings: KnowledgeHeading[] };

const HTML_CONTENT_PATTERN = /^\s*<\/?(?:h[1-6]|p|ul|ol|blockquote|pre|div|hr|table|section|article|strong|em|a|br)\b/i;
const ALLOWED_HTML_TAGS = new Set([
  'A', 'ARTICLE', 'BLOCKQUOTE', 'BR', 'CODE', 'DEL', 'DIV', 'EM', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
  'HR', 'I', 'LI', 'OL', 'P', 'PRE', 'SECTION', 'S', 'STRONG', 'TABLE', 'TBODY', 'TD', 'TH', 'THEAD',
  'TR', 'U', 'UL',
]);
const REMOVED_HTML_TAGS = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'FORM', 'INPUT', 'BUTTON', 'SVG', 'MATH']);

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function createHeadingId(text: string, usedIds: Map<string, number>): string {
  const base = text
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'section';
  const count = usedIds.get(base) || 0;
  usedIds.set(base, count + 1);
  return count === 0 ? `heading-${base}` : `heading-${base}-${count + 1}`;
}

function stripMarkdownFormatting(text: string): string {
  return text
    .replace(/!\[([^]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^]]+)\]\([^)]*\)/g, '$1')
    .replace(/[`*_~]/g, '')
    .replace(/<[^>]+>/g, '')
    .trim();
}

function renderInlineMarkdown(text: string): string {
  return text
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*\n]+)\*/g, '<em>$1</em>')
    .replace(/\[([^]]+)\]\((https?:\/\/|mailto:)([^)]+)\)/g, '<a href="$2$3" target="_blank" rel="noopener noreferrer">$1</a>');
}

function renderMarkdown(content: string): RenderedKnowledgeContent {
  const usedIds = new Map<string, number>();
  const headings: KnowledgeHeading[] = [];
  const escaped = escapeHtml(content.replace(/\r\n?/g, '\n'));
  const codeBlocks: string[] = [];
  const withCodeTokens = escaped.replace(/```([\w+-]*)\n([\s\S]*?)```/g, (_match, language: string, code: string) => {
    const index = codeBlocks.push(
      `<div class="kd-code-block"><div class="kd-code-language">${language || 'code'}</div><pre><code>${code}</code></pre></div>`,
    ) - 1;
    return `__KDCODE_${index}__`;
  });

  const lines = withCodeTokens.split('\n');
  const html: string[] = [];
  let index = 0;
  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) {
      index += 1;
      continue;
    }

    const codeToken = line.match(/^__KDCODE_(\d+)__$/);
    if (codeToken) {
      html.push(codeBlocks[Number(codeToken[1])]);
      index += 1;
      continue;
    }

    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const rawText = headingMatch[2].trim();
      const text = stripMarkdownFormatting(rawText);
      const id = createHeadingId(text, usedIds);
      headings.push({ level, text, id });
      html.push(`<h${level} id="${id}">${renderInlineMarkdown(rawText)}</h${level}>`);
      index += 1;
      continue;
    }

    if (/^>\s?/.test(line)) {
      const quoteLines: string[] = [];
      while (index < lines.length && /^>\s?/.test(lines[index])) {
        quoteLines.push(lines[index].replace(/^>\s?/, ''));
        index += 1;
      }
      html.push(`<blockquote>${quoteLines.map(renderInlineMarkdown).join('<br>')}</blockquote>`);
      continue;
    }

    if (/^[-*+]\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^[-*+]\s+/.test(lines[index])) {
        items.push(`<li>${renderInlineMarkdown(lines[index].replace(/^[-*+]\s+/, ''))}</li>`);
        index += 1;
      }
      html.push(`<ul>${items.join('')}</ul>`);
      continue;
    }

    if (/^\d+[.)]\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^\d+[.)]\s+/.test(lines[index])) {
        items.push(`<li>${renderInlineMarkdown(lines[index].replace(/^\d+[.)]\s+/, ''))}</li>`);
        index += 1;
      }
      html.push(`<ol>${items.join('')}</ol>`);
      continue;
    }

    html.push(`<p>${renderInlineMarkdown(line)}</p>`);
    index += 1;
  }

  return { html: html.join(''), headings };
}

function sanitizeHtmlContent(content: string): RenderedKnowledgeContent {
  if (typeof window === 'undefined' || typeof window.DOMParser === 'undefined') {
    return { html: escapeHtml(content), headings: [] };
  }

  const safeContent = DOMPurify.sanitize(content, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: Array.from(REMOVED_HTML_TAGS).map((tag) => tag.toLowerCase()),
    FORBID_ATTR: ['style'],
  });
  const parsed = new window.DOMParser().parseFromString(safeContent, 'text/html');
  const container = parsed.createElement('div');
  Array.from(parsed.body.childNodes).forEach((node) => container.appendChild(node.cloneNode(true)));
  const usedIds = new Map<string, number>();
  const headings: KnowledgeHeading[] = [];

  const sanitizeNode = (node: Node) => {
    Array.from(node.childNodes).forEach((child) => {
      if (child.nodeType !== Node.ELEMENT_NODE) return;
      const element = child as HTMLElement;
      const tag = element.tagName.toUpperCase();
      if (REMOVED_HTML_TAGS.has(tag)) {
        element.remove();
        return;
      }
      if (!ALLOWED_HTML_TAGS.has(tag)) {
        const fragment = parsed.createDocumentFragment();
        while (element.firstChild) fragment.appendChild(element.firstChild);
        element.replaceWith(fragment);
        sanitizeNode(fragment);
        return;
      }

      const rawHref = tag === 'A' ? (element.getAttribute('href') || '').trim() : '';
      Array.from(element.attributes).forEach((attribute) => element.removeAttribute(attribute.name));
      if (tag === 'A') {
        const href = /^(?:https?:|mailto:)/i.test(rawHref) ? rawHref : '';
        if (href) {
          element.setAttribute('href', href);
          element.setAttribute('target', '_blank');
          element.setAttribute('rel', 'noopener noreferrer');
        }
      }
      if (/^H[1-6]$/.test(tag)) {
        const text = (element.textContent || '').trim();
        const id = createHeadingId(text, usedIds);
        element.setAttribute('id', id);
        headings.push({ level: Number(tag.slice(1)), text, id });
      }
      sanitizeNode(element);
    });
  };

  sanitizeNode(container);
  return { html: container.innerHTML, headings };
}

function renderKnowledgeContent(content: string): RenderedKnowledgeContent {
  if (!content) return { html: '', headings: [] };
  return HTML_CONTENT_PATTERN.test(content) ? sanitizeHtmlContent(content) : renderMarkdown(content);
}

export default function KnowledgeDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [doc, setDoc] = useState<KnowledgeDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [converterOpen, setConverterOpen] = useState(false);
  const [unlocking, setUnlocking] = useState(false);

  // 是否可阅读全文（免费 / 已解锁）
  const isFull = !doc || doc?.access === 'full' || doc?.access === undefined;
  // 实际展示正文：全文优先，否则用试看内容
  const shownContent = isFull
    ? (doc?.htmlContent || doc?.content || '')
    : (doc?.previewContent || '');

  const renderedContent = useMemo(() => renderKnowledgeContent(shownContent), [shownContent]);
  const { headings, html: htmlContent } = renderedContent;

  // 处理直接打开带目录 hash 的链接：正文是异步加载的，内容落地后再定位一次。
  useEffect(() => {
    if (loading || !window.location.hash) return undefined;
    let hashId = window.location.hash.slice(1);
    try {
      hashId = decodeURIComponent(hashId);
    } catch {
      return undefined;
    }
    const frame = window.requestAnimationFrame(() => {
      const element = window.document.getElementById(hashId);
      if (!element) return;
      const top = element.getBoundingClientRect().top + window.scrollY - 80;
      window.scrollTo({ top: Math.max(0, top), left: 0, behavior: 'auto' });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [loading, htmlContent]);

  // 解锁全文：重新拉取（服务端按积分扣减并记录，二次返回 full）
  const unlock = async () => {
    if (!id) return;
    setUnlocking(true);
    try {
      const res: any = await apiClient.get(`/knowledge/${id}`);
      if (res?.data) {
        setDoc(repairKnowledgeDocument(res.data));
        if (res.data.access !== 'full') {
          message.warning('积分不足，请先充值积分或升级会员');
        } else {
          message.success('已解锁全文');
        }
      }
    } catch { message.error('解锁失败'); }
    setUnlocking(false);
  };

  // 分享：复制当前文档链接（公开文档可直接访问；私有文档需授权）
  const handleShare = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: doc?.title || 'AIBAK 知识库', url });
        return;
      }
    } catch {
      /* 用户取消分享则降级为复制链接 */
    }
    try {
      await navigator.clipboard.writeText(url);
      message.success('分享链接已复制到剪贴板');
    } catch {
      // 剪贴板不可用时，弹出可手动复制的链接
      window.prompt('复制以下链接分享：', url);
    }
  };

  // 下载/转换：调用后端真实转换接口，拿到产物 id 后触发文件下载
  const handleConvert = async (sourceFormat: string, targetFormat: string) => {
    const source = doc?.content || doc?.htmlContent || shownContent || '';
    if (!source.trim()) {
      message.warning('当前文档没有可转换的正文内容');
      return;
    }
    try {
      const res: any = await toolsAPI.convert({
        fileName: `${doc?.title || 'document'}.${sourceFormat}`,
        sourceFormat,
        targetFormat,
        content: source,
      });
      const data = res?.data?.data || res?.data;
      const outputId = data?.outputId;
      const outputName = data?.outputName || `${doc?.title || 'document'}.${targetFormat}`;
      if (!outputId) {
        message.error('转换未返回产物，请重试');
        return;
      }
      const a = window.document.createElement('a');
      a.href = `/api/tools/convert/download?id=${encodeURIComponent(outputId)}`;
      a.download = outputName;
      a.rel = 'noopener';
      window.document.body.appendChild(a);
      a.click();
      window.document.body.removeChild(a);
      message.success(`已转换并下载（.${targetFormat}）`);
    } catch (e) {
      message.error(extractApiError(e, '转换失败，请重试'));
    }
  };

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    apiClient.get(`/knowledge/${id}`)
      .then((res: any) => {
        if (!res?.data) throw new Error('文档数据格式无效');
        setDoc(repairKnowledgeDocument(res.data));
      })
      .catch((error) => {
        setDoc(null);
        message.error(extractApiError(error, '文档加载失败'));
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div style={{ maxWidth: 900, margin: '0 auto', padding: 24 }}>
        <Skeleton active paragraph={{ rows: 12 }} />
      </div>
    );
  }

  if (!document) {
    return (
      <Card style={{ textAlign: 'center', padding: 60 }}>
        <Title level={3}>文档未找到</Title>
        <Button type="primary" onClick={() => navigate('/knowledge')}>返回列表</Button>
      </Card>
    );
  }

  return (
    <div className="knowledge-detail-page">
      <div className="kd-layout">
        {/* 左侧目录导航 */}
        {headings.length > 0 && (
          <aside className="kd-toc">
            <div className="toc-title">📑 目录</div>
            <Anchor
              affix={false}
              targetOffset={80}
              getContainer={() => (window.document.querySelector('.knowledge-detail-page') as HTMLElement) || window}
              onChange={(currentLink: string) => {
                if (!currentLink) return;
                const id = currentLink.replace('#', '');
                const el = window.document.getElementById(id);
                if (el) {
                  const top = el.getBoundingClientRect().top + window.scrollY - 80;
                  window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
                }
              }}
              items={headings.map((h) => ({
                key: h.id,
                href: `#${h.id}`,
                title: <span style={{ fontSize: h.level <= 2 ? 13 : 12, paddingLeft: Math.max(0, h.level - 2) * 12 }}>{h.text}</span>,
              }))}
            />
          </aside>
        )}

        {/* 中间主内容 */}
        <main className="kd-main">
          {/* 顶部导航 */}
          <div className="kd-topbar">
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/knowledge')}>返回</Button>
            <Space>
              <Tooltip title="格式转换下载">
                <Button icon={<SwapOutlined />} onClick={() => setConverterOpen(true)}>下载</Button>
              </Tooltip>
              <Button type="primary" icon={<EditOutlined />} onClick={() => navigate(`/knowledge/${id}/edit`)}>编辑</Button>
            </Space>
          </div>

          {/* 标题 */}
          <Title level={2} style={{ marginBottom: 8 }}>{doc?.title}</Title>

          {/* 元信息 */}
          <Space size={20} style={{ marginBottom: 16 }} wrap>
            <span style={{ color: '#64748b' }}><UserOutlined /> {doc?.author?.username}</span>
            <span style={{ color: '#64748b' }}><ClockCircleOutlined /> {new Date(doc?.updatedAt ?? doc?.createdAt ?? "").toLocaleDateString('zh-CN')}</span>
            <span style={{ color: '#64748b' }}><EyeOutlined /> {doc?.viewCount} 浏览</span>
            <span style={{ color: '#64748b' }}>
              <HeartOutlined /> {doc?.likeCount} 赞
            </span>
          </Space>

          {/* 标签 */}
          <div style={{ marginBottom: 20 }}>
            {doc?.tags?.map((tag) => <Tag color="blue" key={tag}>{tag}</Tag>)}
            {doc?.categories?.map((cat) => <Tag color="purple" key={cat}>{cat}</Tag>)}
          </div>

          <Divider style={{ margin: '0 0 20px' }} />

          {/* 权限门控：试看 / 积分 / 会员专享 */}
          {!isFull && (
            <Alert
              type={doc?.access === 'plan_locked' ? 'warning' : 'info'}
              showIcon
              icon={doc?.access === 'plan_locked' ? <CrownOutlined /> : <LockOutlined />}
              style={{ marginBottom: 20, borderRadius: 12 }}
              message={
                doc?.access === 'plan_locked'
                  ? `本文档为${doc?.requiredPlan === 'max' ? '旗舰' : '专业'}会员专享`
                  : doc?.access === 'credit_locked'
                    ? `解锁全文需消耗 ${doc?.creditsNeeded ?? doc?.creditsCost} 积分（当前 ${doc?.creditsHave ?? 0} 积分）`
                    : `免费试看${doc?.freePreviewPages ? ` ${doc?.freePreviewPages} 页` : ''}，解锁查看全文`
              }
              description={
                <Space wrap style={{ marginTop: 4 }}>
                  {doc?.access === 'plan_locked' ? (
                    <Button type="primary" size="small" icon={<CrownOutlined />} onClick={() => navigate('/pricing')}>升级会员</Button>
                  ) : (
                    <Button type="primary" size="small" loading={unlocking} icon={<LockOutlined />} onClick={unlock}>解锁全文</Button>
                  )}
                  {doc?.access !== 'plan_locked' && (
                    <Button size="small" onClick={() => navigate('/points-center')}>获取积分</Button>
                  )}
                </Space>
              }
            />
          )}

          {/* 文档内容 */}
          <div className="kd-content" dangerouslySetInnerHTML={{ __html: htmlContent }} />

          {/* 底部操作 */}
          <Divider />
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <Space size={16}>
              <Button size="large" type="primary" icon={<RobotOutlined />}
                onClick={() => navigate('/ai-chat', { state: { initialMessage: `请帮我解释以下文档：${doc?.title}` } })}
                style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', border: 'none' }}
              >
                AI 解读
              </Button>
              <Button size="large" icon={<ShareAltOutlined />} onClick={handleShare}>分享</Button>
              <Button size="large" icon={<DownloadOutlined />} onClick={() => setConverterOpen(true)}>下载/转换</Button>
            </Space>
          </div>
        </main>

        {/* 右侧信息（桌面端） */}
        <aside className="kd-sidebar">
          <Card size="small" style={{ marginBottom: 12 }}>
            <Text strong>文档信息</Text>
            <div style={{ marginTop: 8, fontSize: 13 }}>
              <div>格式: {doc?.htmlContent ? '富文本' : 'Markdown'}</div>
              <div>字数: ~{shownContent.length || 0}</div>
              <div>标签: {doc?.tags?.length || 0} 个</div>
              <div>创建: {new Date(doc?.createdAt ?? "").toLocaleDateString('zh-CN')}</div>
              <div>更新: {new Date(doc?.updatedAt ?? doc?.createdAt ?? "").toLocaleDateString('zh-CN')}</div>
            </div>
          </Card>
          <Card size="small">
            <Text strong>快捷操作</Text>
            <div style={{ marginTop: 8 }}>
              <Space direction="vertical" style={{ width: '100%' }}>
                <Button block size="small" icon={<RobotOutlined />}
                  onClick={() => navigate('/ai-chat')}>AI 对话</Button>
                <Button block size="small" icon={<SwapOutlined />}
                  onClick={() => setConverterOpen(true)}>格式转换</Button>
              </Space>
            </div>
          </Card>
        </aside>
      </div>

      <FileConverter
        open={converterOpen}
        onClose={() => setConverterOpen(false)}
        fileName={`${doc?.title || 'document'}.md`}
        content={doc?.content || doc?.htmlContent || shownContent}
        onConvert={handleConvert}
      />

      <style>{`
        .knowledge-detail-page { max-width: 1200px; margin: 0 auto; }
        .kd-layout { display: flex; gap: 24px; }
        .kd-toc {
          width: 200px; flex-shrink: 0; position: sticky; top: 88px;
          max-height: calc(100vh - 120px); overflow-y: auto;
          padding: 16px; background: #fafbfc; border-radius: 12px;
          border: 1px solid #eef1f5;
        }
        .toc-title { font-weight: 600; margin-bottom: 12px; font-size: 14px; color: #334155; }
        .kd-main { flex: 1; min-width: 0; }
        .kd-topbar {
          display: flex; justify-content: space-between; align-items: center;
          margin-bottom: 16px;
        }
        .kd-content {
          font-size: 15px; line-height: 1.85; color: #334155;
          overflow-wrap: anywhere;
        }
        .kd-content h1, .kd-content h2, .kd-content h3, .kd-content h4, .kd-content h5, .kd-content h6 {
          scroll-margin-top: 88px;
        }
        .kd-content h1 { font-size: 26px; margin-top: 32px; color: #1e293b; }
        .kd-content h5 { font-size: 14px; margin-top: 14px; color: #475569; }
        .kd-content h6 { font-size: 13px; margin-top: 12px; color: #475569; }
        .kd-content ul, .kd-content ol { padding-left: 24px; }
        .kd-content blockquote {
          border-left: 3px solid #6366f1; padding: 4px 12px; margin: 12px 0;
          color: #64748b; background: #f8f9fb; border-radius: 0 8px 8px 0;
        }
        .kd-content a { color: #2563eb; }
        .kd-content .kd-code-block {
          background: #1e1e2e; color: #cdd6f4; border-radius: 8px; overflow: hidden; margin: 12px 0;
        }
        .kd-content .kd-code-language {
          padding: 4px 12px; font-size: 11px; background: #181825; color: #6c7086;
        }
        .kd-content .kd-code-block pre { margin: 0; padding: 12px; overflow-x: auto; font-size: 13px; }
        .kd-content h2 { font-size: 22px; margin-top: 28px; color: #1e293b; }
        .kd-content h3 { font-size: 18px; margin-top: 20px; color: #334155; }
        .kd-content h4 { font-size: 15px; margin-top: 16px; color: #475569; }
        .kd-content p { margin: 10px 0; }
        .kd-content pre { font-family: 'JetBrains Mono', 'Fira Code', monospace; }
        .kd-sidebar {
          width: 200px; flex-shrink: 0; position: sticky; top: 88px;
        }
        @media (max-width: 1023px) {
          .kd-toc { display: none; }
          .kd-sidebar { display: none; }
        }
        @media (max-width: 768px) {
          .kd-layout { flex-direction: column; }
        }
      `}</style>
    </div>
  );
}
