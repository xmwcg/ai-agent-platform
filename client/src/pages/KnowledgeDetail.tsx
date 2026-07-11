import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card, Typography, Button, message, Spin, Tag, Space, Divider, Anchor, Tooltip, Dropdown, Skeleton,
} from 'antd';
import {
  ArrowLeftOutlined, EditOutlined, DownloadOutlined, SwapOutlined,
  RobotOutlined, ClockCircleOutlined, UserOutlined, EyeOutlined,
  HeartOutlined, ShareAltOutlined,
} from '@ant-design/icons';
import { knowledgeAPI } from '@/services/api';
import apiClient from '@/services/api';
import FileConverter from '@/components/FileConverter';

const { Title, Text, Paragraph } = Typography;

interface KnowledgeDocument {
  _id: string;
  title: string;
  content: string;
  tags: string[];
  categories: string[];
  viewCount: number;
  likeCount: number;
  createdAt: string;
  updatedAt: string;
  author: { username: string };
}

// 从 Markdown 提取标题层次结构
function extractHeadings(content: string): { level: number; text: string; id: string }[] {
  const headingRegex = /^(#{2,4})\s+(.+)$/gm;
  const headings: { level: number; text: string; id: string }[] = [];
  let match;
  while ((match = headingRegex.exec(content)) !== null) {
    const level = match[1].length;
    const text = match[2].trim();
    const id = `heading-${text.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')}`;
    headings.push({ level, text, id });
  }
  return headings;
}

// 简单的 Markdown to HTML 渲染（无依赖）
function renderMarkdown(content: string): string {
  if (!content) return '';
  const html = content
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/^### (.+)$/gm, '<h4 id="heading-$1">$1</h4>')
    .replace(/^## (.+)$/gm, '<h3 id="heading-$1">$1</h3>')
    .replace(/^# (.+)$/gm, '<h2 id="heading-$1">$1</h2>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code style="background:#f0f0f0;padding:2px 6px;border-radius:3px;font-size:13px">$1</code>')
    .replace(/```(\w*)\n([\s\S]*?)```/g,
      '<div style="background:#1e1e2e;color:#cdd6f4;border-radius:8px;overflow:hidden;margin:12px 0"><div style="padding:4px 12px;font-size:11px;background:#181825;color:#6c7086">$1</div><pre style="margin:0;padding:12px;overflow-x:auto;font-size:13px"><code>$2</code></pre></div>')
    .replace(/^> (.+)$/gm, '<blockquote style="border-left:3px solid #6366f1;padding:4px 12px;margin:8px 0;color:#64748b;background:#f8f9fb;border-radius:0 8px 8px 0">$1</blockquote>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, '<ul style="padding-left:24px;margin:8px 0">$&</ul>')
    .replace(/^(?!<[a-z]).+$/gm, (line) => line.trim() ? `<p style="margin:8px 0;line-height:1.8">${line}</p>` : '<br/>');
  return html;
}

export default function KnowledgeDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [document, setDocument] = useState<KnowledgeDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [liked, setLiked] = useState(false);
  const [converterOpen, setConverterOpen] = useState(false);

  const headings = useMemo(() => (document?.content ? extractHeadings(document.content) : []), [document]);
  const htmlContent = useMemo(() => (document?.content ? renderMarkdown(document.content) : ''), [document]);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    apiClient.get(`/knowledge/${id}`)
      .then((res: any) => { if (res?.data) setDocument(res.data); })
      .catch(() => {
        // 使用模拟文档
        setDocument({
          _id: id, title: 'RAG 技术详解',
          content: `# RAG 技术概述\n\nRAG（检索增强生成）是结合信息检索与文本生成的技术。\n\n## 核心原理\n\n1. **检索**：从知识库中检索相关文档\n2. **增强**：将检索结果作为上下文\n3. **生成**：由大模型生成最终回答\n\n## 代码示例\n\n\`\`\`typescript\nasync function ragChat(query: string) {\n  const docs = await searchDocuments(query);\n  const prompt = buildPrompt(query, docs);\n  return await llm.generate(prompt);\n}\n\`\`\`\n\n## 应用场景\n\n- 知识库问答\n- 文档助手\n- 研究辅助`,
          tags: ['AI', 'RAG'], categories: ['技术'], viewCount: 128, likeCount: 36,
          createdAt: '2025-01-08', updatedAt: '2025-06-15',
          author: { username: 'admin' },
        });
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
              items={headings.map((h) => ({
                key: h.id,
                href: `#${h.id}`,
                title: <span style={{ fontSize: h.level === 2 ? 13 : 12, paddingLeft: (h.level - 2) * 12 }}>{h.text}</span>,
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
          <Title level={2} style={{ marginBottom: 8 }}>{document.title}</Title>

          {/* 元信息 */}
          <Space size={20} style={{ marginBottom: 16 }} wrap>
            <span style={{ color: '#64748b' }}><UserOutlined /> {document.author?.username}</span>
            <span style={{ color: '#64748b' }}><ClockCircleOutlined /> {new Date(document.updatedAt || document.createdAt).toLocaleDateString('zh-CN')}</span>
            <span style={{ color: '#64748b' }}><EyeOutlined /> {document.viewCount} 浏览</span>
            <span
              style={{ color: liked ? '#ef4444' : '#64748b', cursor: 'pointer' }}
              onClick={() => setLiked(!liked)}
            >
              <HeartOutlined style={{ color: liked ? '#ef4444' : undefined }} /> {document.likeCount + (liked ? 1 : 0)} 赞
            </span>
          </Space>

          {/* 标签 */}
          <div style={{ marginBottom: 20 }}>
            {document.tags?.map((tag) => <Tag color="blue" key={tag}>{tag}</Tag>)}
            {document.categories?.map((cat) => <Tag color="purple" key={cat}>{cat}</Tag>)}
          </div>

          <Divider style={{ margin: '0 0 20px' }} />

          {/* 文档内容 */}
          <div className="kd-content" dangerouslySetInnerHTML={{ __html: htmlContent }} />

          {/* 底部操作 */}
          <Divider />
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <Space size={16}>
              <Button size="large" type="primary" icon={<RobotOutlined />}
                onClick={() => navigate('/ai-chat', { state: { initialMessage: `请帮我解释以下文档：${document.title}` } })}
                style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', border: 'none' }}
              >
                AI 解读
              </Button>
              <Button size="large" icon={<ShareAltOutlined />}>分享</Button>
              <Button size="large" icon={<DownloadOutlined />} onClick={() => setConverterOpen(true)}>下载/转换</Button>
            </Space>
          </div>
        </main>

        {/* 右侧信息（桌面端） */}
        <aside className="kd-sidebar">
          <Card size="small" style={{ marginBottom: 12 }}>
            <Text strong>文档信息</Text>
            <div style={{ marginTop: 8, fontSize: 13 }}>
              <div>格式: Markdown</div>
              <div>字数: ~{document.content?.length || 0}</div>
              <div>标签: {document.tags?.length || 0} 个</div>
              <div>创建: {new Date(document.createdAt).toLocaleDateString('zh-CN')}</div>
              <div>更新: {new Date(document.updatedAt || document.createdAt).toLocaleDateString('zh-CN')}</div>
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
        fileName={`${document.title || 'document'}.md`}
        content={document.content}
        onConvert={() => message.info('格式转换功能已在开发中')}
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
        }
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
