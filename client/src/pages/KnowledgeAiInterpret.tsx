import { useState, useRef, useEffect, useCallback } from 'react';
import { Card, Space, Button, Input, Tag, Spin, Tooltip, Empty, Select } from 'antd';
import {
  RobotOutlined, ThunderboltOutlined, SendOutlined, ClearOutlined,
  CloudOutlined, FullscreenOutlined, PictureOutlined, UploadOutlined,
  DownloadOutlined, ReloadOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { aibakAPI, extractApiError } from '@/services/api';
import { AIBAK_FREE_MODELS, getAibakModel } from '@/config/aibakModels';
import PromptOptimizer from '@/pages/AiChat/PromptOptimizer';

const { TextArea } = Input;

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface Props {
  /** 文档标题 */
  title: string;
  /** 文档正文（Markdown） */
  content: string;
}

// 把文档内容拼成 AI 解读的系统上下文（截断避免超长）
function buildContext(title: string, content: string): string {
  const truncated = (content || '').replace(/\s+/g, ' ').slice(0, 6000);
  return [
    '你正在解读 aibak.site 知识库中的一篇文档。',
    `文档标题：${title}`,
    '文档正文（Markdown）：',
    truncated,
    '',
    '请严格基于上述文档内容回答用户问题，引用原文要点，使用中文，必要时用 Markdown 排版。若文档未提及，请明确说明「文档中未涉及」。',
  ].join('\n');
}

// 轻量 Markdown → HTML（用于渲染 AI 解读返回的富文本）
function renderRich(content: string): string {
  if (!content) return '';
  return content
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/^### (.+)$/gm, '<h4 style="margin:10px 0 4px;font-size:15px">$1</h4>')
    .replace(/^## (.+)$/gm, '<h3 style="margin:12px 0 6px;font-size:17px">$1</h3>')
    .replace(/^# (.+)$/gm, '<h2 style="margin:14px 0 6px;font-size:19px">$1</h2>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code style="background:#f0f0f0;padding:1px 5px;border-radius:3px;font-size:13px">$1</code>')
    .replace(/^> (.+)$/gm, '<blockquote style="border-left:3px solid #6366f1;padding:2px 12px;margin:6px 0;color:#64748b">$1</blockquote>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, '<ul style="padding-left:22px;margin:6px 0">$&</ul>')
    .split('\n')
    .map((line) => line.trim() === '' ? '<br/>' : `<div style="margin:4px 0;line-height:1.75">${line}</div>`)
    .join('');
}

const IMG_SIZE_OPTIONS = [
  { label: '1024×1024（方形）', value: '1024x1024' },
  { label: '1280×720（横屏）', value: '1280x720' },
  { label: '720×1280（竖屏）', value: '720x1280' },
  { label: '1280×1280（大正方）', value: '1280x1280' },
];

const IMAGE_SUGGESTIONS = ['把这篇文档的核心观点画成一张信息图，扁平插画风', '为文档内容生成一张科技感封面图', '以文档主题为灵感生成一张水彩风格插图'];

const QUICK_ACTIONS = [
  { key: 'overview', label: '📖 一键解读全文', prompt: '请对这篇文档做完整解读：核心观点、整体结构、关键要点、适用场景与注意事项。' },
  { key: 'summary', label: '✨ 总结要点', prompt: '请把这篇文档总结为 5 条以内的核心要点。' },
  { key: 'keywords', label: '🔑 提取关键词', prompt: '请提取这篇文档的 10 个核心关键词，并简述每个的含义。' },
  { key: 'outline', label: '🗂 生成大纲', prompt: '请根据这篇文档生成一个逻辑清晰的思维导图大纲（分级列表）。' },
  { key: 'quiz', label: '❓ 出题自测', prompt: '请基于这篇文档出 3 道自测题（含答案），帮助读者检验理解。' },
];

// 图生图垫图压缩：降分辨率到 ≤1024px 并转 JPEG，避免 base64 超出网关请求体上限
function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('读取失败'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('图片解析失败'));
      img.onload = () => {
        const max = 1024;
        let { width, height } = img;
        if (width > max || height > max) {
          const ratio = Math.min(max / width, max / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('canvas 不可用'));
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export default function KnowledgeAiInterpret({ title, content }: Props) {
  const navigate = useNavigate();
  const [activeId, setActiveId] = useState<string>('hy3');
  const active = getAibakModel(activeId) || AIBAK_FREE_MODELS[0];
  const isText = active.kind === 'text';

  // 文本对话状态
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [optimizerOpen, setOptimizerOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 图像生成状态
  const [imgPrompt, setImgPrompt] = useState('');
  const [imgSize, setImgSize] = useState('1024x1024');
  const [imgPreview, setImgPreview] = useState('');
  const [imgBase64, setImgBase64] = useState('');
  const [genLoading, setGenLoading] = useState(false);
  const [images, setImages] = useState<{ url: string; revised_prompt?: string }[]>([]);
  const [imgError, setImgError] = useState('');

  // 自动滚动到底部（首次挂载跳过，避免覆盖路由级回顶）
  const chatMountedRef = useRef(false);
  useEffect(() => {
    if (!chatMountedRef.current) { chatMountedRef.current = true; return; }
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // ── 文本解读：把整篇文档作为系统上下文，经 CloudBase 云函数调用免费文本模型 ──
  const send = useCallback(
    async (text: string) => {
      const msg = (text ?? input).trim();
      if (!msg || loading) return;
      const userMsg: Message = { id: `u_${Date.now()}`, role: 'user', content: msg };
      const aiId = `a_${Date.now()}`;
      const placeholder: Message = { id: aiId, role: 'assistant', content: '⏳ 正在解读…' };
      setMessages((prev) => [...prev, userMsg, placeholder]);
      setInput('');
      setLoading(true);

      try {
        const history = messages
          .filter((m) => m.role === 'user' || m.role === 'assistant')
          .slice(-8)
          .map((m) => ({ role: m.role, content: m.content }));
        const res: any = await aibakAPI.chat({
          messages: [
            { role: 'system', content: buildContext(title, content) },
            ...history,
            { role: 'user', content: msg },
          ],
          model: activeId as 'hy3' | 'hy3-preview',
          stream: false,
        });
        if (res?.success) {
          setMessages((prev) => prev.map((m) => (m.id === aiId ? { ...m, content: res.text || '（AI 无响应，请检查网络或稍后重试）' } : m)));
        } else {
          setMessages((prev) => prev.map((m) => (m.id === aiId ? { ...m, content: `⚠️ 解读失败：${res?.error || '未知错误'}` } : m)));
        }
      } catch (err: any) {
        const errMsg = extractApiError(err, '请求失败');
        setMessages((prev) => prev.map((m) => (m.id === aiId ? { ...m, content: `⚠️ 解读失败：${errMsg}` } : m)));
      } finally {
        setLoading(false);
      }
    },
    [input, messages, loading, activeId, title, content]
  );

  const handleOptimizerApply = (optimized: string) => {
    setInput(optimized);
    send(optimized);
  };

  // ── 图像生成：文生图 / 图生图，经 CloudBase 云函数 ──
  const onPickImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { setImgError('参考图需小于 10MB'); return; }
    setImgError('');
    try {
      const dataUrl = await compressImage(file);
      setImgPreview(dataUrl);
      setImgBase64(dataUrl);
    } catch {
      setImgError('图片处理失败，请换一张');
    }
  };

  const genImage = useCallback(async () => {
    if (!imgPrompt.trim() || genLoading) return;
    if (active.kind === 'i2i' && !imgBase64) { setImgError('图生图请先上传一张参考图'); return; }
    setGenLoading(true);
    setImgError('');
    setImages([]);
    try {
      const res: any = await aibakAPI.image({
        model: active.id,
        prompt: imgPrompt.trim(),
        size: imgSize,
        imageBase64: active.kind === 'i2i' ? imgBase64 : undefined,
      });
      if (res?.success) setImages(res.images || []);
      else setImgError(res?.error || '图像生成失败');
    } catch (err: any) {
      setImgError(extractApiError(err, '图像生成失败'));
    } finally {
      setGenLoading(false);
    }
  }, [imgPrompt, genLoading, active, imgBase64, imgSize]);

  const renderTextView = () => (
    <>
      {/* 快捷解读动作 */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        {QUICK_ACTIONS.map((a) => (
          <Tag
            key={a.key}
            style={{ cursor: 'pointer', borderRadius: 14, padding: '4px 12px', border: '1px solid #e0e7ff', color: '#4f46e5' }}
            onClick={() => send(a.prompt)}
          >
            {a.label}
          </Tag>
        ))}
      </div>

      {/* 对话区 */}
      <div
        style={{
          minHeight: 140, maxHeight: 420, overflowY: 'auto',
          background: '#fff', border: '1px solid #eef1f5', borderRadius: 12, padding: 14, marginBottom: 12,
        }}
      >
        {messages.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#94a3b8', padding: '28px 12px' }}>
            <RobotOutlined style={{ fontSize: 32, color: '#c4b5fd' }} />
            <div style={{ marginTop: 8, fontSize: 13 }}>
              点击下方任一按钮，或输入问题，让 AI 基于本文档真实解读
            </div>
          </div>
        ) : (
          <Space direction="vertical" style={{ width: '100%' }} size={12}>
            {messages.map((m) => (
              <div key={m.id} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                <div
                  style={{
                    maxWidth: '88%', padding: '10px 14px', borderRadius: 12, fontSize: 14, lineHeight: 1.7,
                    background: m.role === 'user' ? '#6366f1' : '#f5f3ff',
                    color: m.role === 'user' ? '#fff' : '#1e293b',
                    whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                  }}
                  dangerouslySetInnerHTML={{
                    __html: m.role === 'user'
                      ? m.content.replace(/</g, '&lt;').replace(/>/g, '&gt;')
                      : renderRich(m.content),
                  }}
                />
              </div>
            ))}
            {loading && (
              <div style={{ color: '#94a3b8', fontSize: 13, paddingLeft: 4 }}>
                <Spin size="small" /> 解读中…
              </div>
            )}
            <div ref={messagesEndRef} />
          </Space>
        )}
      </div>

      {/* 输入区 */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
        <TextArea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="向 AI 提问这篇文档的内容…"
          autoSize={{ minRows: 1, maxRows: 4 }}
          onPressEnter={(e) => { if (!e.shiftKey) { e.preventDefault(); send(input); } }}
          disabled={loading}
        />
        <Tooltip title="提示词优化">
          <Button
            icon={<ThunderboltOutlined />}
            onClick={() => input.trim() && setOptimizerOpen(true)}
            disabled={!input.trim() || loading}
          />
        </Tooltip>
        <Button
          type="primary"
          icon={<SendOutlined />}
          onClick={() => send(input)}
          loading={loading}
          disabled={!input.trim()}
          style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', border: 'none' }}
        >
          发送
        </Button>
      </div>
    </>
  );

  const renderImageView = () => (
    <div>
      <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 6 }}>提示词（最多 500 字）</div>
      <TextArea
        value={imgPrompt}
        onChange={(e) => setImgPrompt(e.target.value)}
        placeholder={active.kind === 'i2i' ? '描述想要的生成效果，例如：换成水彩风格' : '描述你想生成的画面，可结合文档主题…'}
        autoSize={{ minRows: 3, maxRows: 6 }}
        maxLength={500}
      />
      <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <Select value={imgSize} onChange={setImgSize} options={IMG_SIZE_OPTIONS} style={{ width: 180 }} size="small" />
        {active.kind === 'i2i' && (
          <label>
            <input type="file" accept="image/png,image/jpeg" onChange={onPickImage} style={{ display: 'none' }} id="ki2i-input" />
            <Button icon={<UploadOutlined />} size="small" onClick={() => document.getElementById('ki2i-input')?.click()}>
              上传参考图
            </Button>
          </label>
        )}
      </div>
      {active.kind === 'i2i' && imgPreview && (
        <div style={{ marginTop: 10 }}>
          <img src={imgPreview} alt="参考图" style={{ width: 96, height: 96, objectFit: 'cover', borderRadius: 10, border: '1px solid #eef1f5' }} />
        </div>
      )}
      {!imgPrompt && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
          {IMAGE_SUGGESTIONS.map((s) => (
            <Tag key={s} style={{ cursor: 'pointer', borderRadius: 12, padding: '2px 10px' }} onClick={() => setImgPrompt(s)}>
              {s.length > 18 ? s.slice(0, 18) + '…' : s}
            </Tag>
          ))}
        </div>
      )}

      <div style={{ marginTop: 16 }}>
        {genLoading && (
          <div style={{ textAlign: 'center', color: '#94a3b8', padding: 24 }}>
            <Spin /> <div style={{ marginTop: 10, fontSize: 13 }}>正在生成（消耗免费额度，请稍候）…</div>
          </div>
        )}
        {imgError && (
          <div style={{ background: '#fff1f0', border: '1px solid #ffccc7', color: '#cf1322', borderRadius: 10, padding: '10px 12px', fontSize: 13 }}>
            {imgError}
          </div>
        )}
        {!genLoading && !imgError && images.length === 0 && (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="生成结果将显示在这里" style={{ marginTop: 16 }} />
        )}
        {images.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 4 }}>
            {images.map((im, i) => (
              <div key={i} style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid #eef1f5', background: '#000' }}>
                <img src={im.url} alt={`生成图 ${i + 1}`} style={{ width: '100%', display: 'block' }} />
                <a href={im.url} target="_blank" rel="noreferrer"
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '6px 0', fontSize: 12, color: '#6366f1', background: '#fafbff' }}>
                  <DownloadOutlined /> 下载
                </a>
              </div>
            ))}
          </div>
        )}
        {images.length > 0 && images[0]?.revised_prompt && (
          <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 8 }}>
            改写提示词：{images[0].revised_prompt}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
        <Button onClick={() => { setImages([]); setImgPrompt(''); setImgPreview(''); setImgBase64(''); setImgError(''); }} icon={<ReloadOutlined />}>
          重置
        </Button>
        <Button
          type="primary"
          icon={<ThunderboltOutlined />}
          onClick={genImage}
          loading={genLoading}
          disabled={!imgPrompt.trim() || (active.kind === 'i2i' && !imgBase64)}
          style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', border: 'none', flex: 1 }}
        >
          生成
        </Button>
      </div>
    </div>
  );

  return (
    <Card
      style={{
        marginTop: 24, borderRadius: 16, border: '1px solid #eef1f5',
        background: 'linear-gradient(180deg, #fff 0%, #fafbff 100%)',
        boxShadow: '0 4px 24px rgba(99,102,241,0.06)',
      }}
      title={
        <Space>
          <RobotOutlined style={{ color: '#6366f1' }} />
          <span style={{ fontWeight: 600 }}>AI 解读</span>
          <Tag color="green" style={{ marginLeft: 4, borderRadius: 10 }}>
            <CloudOutlined /> CloudBase 云函数 · 免费额度
          </Tag>
        </Space>
      }
      extra={
        <Tooltip title="在独立对话页打开">
          <Button
            type="text"
            size="small"
            icon={<FullscreenOutlined />}
            onClick={() => navigate('/ai-chat', { state: { initialMessage: `请帮我深入解读这篇文档：${title}` } })}
          >
            独立对话
          </Button>
        </Tooltip>
      }
    >
      {/* 模型选择 + 模块切换（与免费体验/左侧 AI 对话同款接入） */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        {(['文本对话', '图像生成'] as const).map((g) => (
          <Space key={g} size={8} wrap>
            {AIBAK_FREE_MODELS.filter((m) => m.group.endsWith(g) || (g === '文本对话' && m.kind === 'text') || (g === '图像生成' && m.kind !== 'text')).map((m) => {
              const sel = m.id === activeId;
              return (
                <button
                  key={m.id}
                  onClick={() => setActiveId(m.id)}
                  title={m.desc}
                  style={{
                    border: sel ? '1.5px solid #6366f1' : '1px solid #eef1f5',
                    background: sel ? 'rgba(99,102,241,0.08)' : '#fff',
                    color: sel ? '#6366f1' : '#64748b',
                    borderRadius: 12, padding: '7px 12px', cursor: 'pointer',
                    fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6,
                  }}
                >
                  {m.kind === 'text' ? <RobotOutlined /> : <PictureOutlined />}
                  {m.label.replace(/（.*）/, '')}
                </button>
              );
            })}
          </Space>
        ))}
        {messages.length > 0 && isText && (
          <Button type="text" size="small" icon={<ClearOutlined />} onClick={() => setMessages([])}>
            清空
          </Button>
        )}
      </div>

      {isText ? renderTextView() : renderImageView()}

      {/* 提示词优化（与左侧同款，真正调用） */}
      <PromptOptimizer
        open={optimizerOpen}
        onClose={() => setOptimizerOpen(false)}
        originalPrompt={input}
        onApply={handleOptimizerApply}
      />
    </Card>
  );
}
