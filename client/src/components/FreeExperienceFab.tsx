import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Drawer, Button, Input, Select, Spin, Tag, Empty, Space } from 'antd';
import {
  GiftOutlined, RobotOutlined, PictureOutlined, SendOutlined,
  CloseOutlined, UploadOutlined, DownloadOutlined, ClearOutlined,
  ReloadOutlined, ThunderboltOutlined, ExpandOutlined, CompressOutlined,
} from '@ant-design/icons';
import { aibakAPI, extractApiError } from '@/services/api';

// ─── 常量化：免费额度下的 4 个模型 ───────────────
type ModelKind = 'text' | 't2i' | 'i2i';
interface FabModel {
  id: string;
  label: string;
  kind: ModelKind;
  group: '文本对话' | '图像生成';
  desc: string;
}
const MODELS: FabModel[] = [
  { id: 'hy3', label: 'hy3', kind: 'text', group: '文本对话', desc: '免费文本模型' },
  { id: 'hy3-preview', label: 'hy3-preview', kind: 'text', group: '文本对话', desc: '免费文本模型（预览版）' },
  { id: 'HY-Image-3.0-Plus-4090-Tob-v1.0', label: '文生图', kind: 't2i', group: '图像生成', desc: '混元生图 3.0 · 免费额度' },
  { id: 'HY-Image-v3.0-I2I-ToB-v1.0.1', label: '图生图', kind: 'i2i', group: '图像生成', desc: '混元图生图 3.0 · 免费额度' },
];

const TEXT_SUGGESTIONS = ['介绍一下 AIbak 平台', '知识库怎么用？', '写一个 Python 你好世界', '解释一下什么是 RAG'];
const IMAGE_SUGGESTIONS = ['一只胖橘猫坐在窗台打盹，水彩风格，温暖色调', '赛博朋克风格的未来城市夜景', '极简主义咖啡馆室内设计'];
const SIZE_OPTIONS = [
  { label: '1024×1024（方形）', value: '1024x1024' },
  { label: '1280×720（横屏）', value: '1280x720' },
  { label: '720×1280（竖屏）', value: '720x1280' },
  { label: '1280×1280（大正方）', value: '1280x1280' },
];

// ─── 免费额度（每日软上限，防止被恶意刷有成本的 API）──
// 纯前端 localStorage 计数：作为体验层护栏；真正的限额兜底由云函数白名单 + 成长计划额度承担。
const DAILY_QUOTA = { chat: 30, image: 15 };
function todayKey(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `aibak_free_${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function loadQuota(): { chat: number; image: number } {
  try {
    const raw = localStorage.getItem(todayKey());
    const r = raw ? JSON.parse(raw) : {};
    return { chat: Number(r.chat) || 0, image: Number(r.image) || 0 };
  } catch {
    return { chat: 0, image: 0 };
  }
}
function saveQuota(q: { chat: number; image: number }) {
  try { localStorage.setItem(todayKey(), JSON.stringify(q)); } catch { /* ignore */ }
}

// 剩余额度颜色：充足=明亮绿；接近耗尽=琥珀；已用尽=红
function quotaColor(left: number, cap: number): string {
  if (left <= 0) return '#ff5c5c';
  if (left <= Math.ceil(cap * 0.2)) return '#ffb347';
  return '#00e676'; // 明亮的绿，用于提醒免费次数
}

// 轻量 Markdown 渲染（与免费对话页一致）
function renderMarkdown(text: string): string {
  if (!text) return '';
  let html = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_m, _l, code) => `<pre><code>${code.trim()}</code></pre>`);
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\n/g, '<br>');
  return html;
}

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' && window.innerWidth < 768);
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return isMobile;
}

const ACCENT = '#6c5ce7';
const ACCENT_SOFT = 'rgba(108,92,231,0.08)';

export default function FreeExperienceFab() {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const [maximized, setMaximized] = useState(false);
  const [activeId, setActiveId] = useState<string>('hy3');
  const active = useMemo(() => MODELS.find((m) => m.id === activeId)!, [activeId]);

  // 免费额度计数（每日）
  const [quota, setQuota] = useState<{ chat: number; image: number }>({ chat: 0, image: 0 });
  useEffect(() => { setQuota(loadQuota()); }, []);
  const bumpQuota = (kind: 'chat' | 'image') => {
    setQuota((prev) => {
      const next = { ...prev, [kind]: prev[kind] + 1 };
      saveQuota(next);
      return next;
    });
  };

  // 文本对话状态
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const msgEndRef = useRef<HTMLDivElement>(null);

  // 图像生成状态
  const [imgPrompt, setImgPrompt] = useState('');
  const [imgSize, setImgSize] = useState('1024x1024');
  const [imgPreview, setImgPreview] = useState<string>('');
  const [imgBase64, setImgBase64] = useState<string>('');
  const [genLoading, setGenLoading] = useState(false);
  const [images, setImages] = useState<{ url: string; revised_prompt?: string }[]>([]);
  const [imgError, setImgError] = useState('');

  const isText = active.kind === 'text';

  // 自动滚动到底部（首次挂载跳过，避免覆盖路由级回顶）
  const chatMountedRef = useRef(false);
  useEffect(() => {
    if (chatMountedRef.current) { chatMountedRef.current = false; return; }
    if (isText) msgEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending, isText]);

  // ─── 文本对话发送 ───
  const sendText = useCallback(
    async (text?: string) => {
      const msg = (text ?? input).trim();
      if (!msg || sending) return;

      // 免费额度护栏：超限拦截，防止刷 API
      if (quota.chat >= DAILY_QUOTA.chat) {
        setMessages((prev) => [...prev, {
          role: 'assistant',
          content: `⚠️ 今日免费对话次数已用完（${DAILY_QUOTA.chat} 次/天），明日 0 点自动重置。如需无限使用，请前往正式版解锁。`,
        }]);
        return;
      }

      const userMsg = { role: 'user' as const, content: msg };
      const newMsgs = [...messages, userMsg];
      setMessages(newMsgs);
      setInput('');
      setSending(true);
      try {
        const res: any = await aibakAPI.chat({ messages: newMsgs, model: activeId as 'hy3' | 'hy3-preview', stream: false });
        if (res?.success) {
          setMessages((prev) => [...prev, { role: 'assistant', content: res.text }]);
          bumpQuota('chat');
        } else {
          setMessages((prev) => [...prev, { role: 'assistant', content: `❌ 错误：${res?.error || '未知错误'}` }]);
        }
      } catch (err: any) {
        setMessages((prev) => [...prev, { role: 'assistant', content: `❌ 网络错误：${extractApiError(err)}` }]);
      } finally {
        setSending(false);
      }
    },
    [input, messages, sending, activeId, quota.chat],
  );

  // ─── 图像生成 ───
  // 图生图垫图压缩：降分辨率到 ≤1024px 并转 JPEG，避免 base64 超出网关请求体上限(400)
  const compressImage = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
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

  const onPickImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setImgError('参考图需小于 10MB');
      return;
    }
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

    // 免费额度护栏：超限拦截
    if (quota.image >= DAILY_QUOTA.image) {
      setImgError(`今日免费生图次数已用完（${DAILY_QUOTA.image} 张/天），明日 0 点自动重置。`);
      return;
    }
    if (active.kind === 'i2i' && !imgBase64) {
      setImgError('图生图请先上传一张参考图');
      return;
    }
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
      if (res?.success) {
        setImages(res.images || []);
        bumpQuota('image');
      } else {
        setImgError(res?.error || '图像生成失败');
      }
    } catch (err: any) {
      setImgError(extractApiError(err, '图像生成失败'));
    } finally {
      setGenLoading(false);
    }
  }, [imgPrompt, genLoading, active, imgBase64, imgSize, quota.image]);

  const clearText = () => setMessages([]);
  const clearImage = () => {
    setImages([]);
    setImgPrompt('');
    setImgPreview('');
    setImgBase64('');
    setImgError('');
  };

  // ─── 渲染：文本对话视图 ───
  const renderTextView = () => (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 4px' }}>
        {messages.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--text-tertiary)', marginTop: 32 }}>
            <RobotOutlined style={{ fontSize: 40, color: ACCENT }} />
            <div style={{ marginTop: 10, fontWeight: 600, color: 'var(--text-secondary)' }}>免费 AI 对话</div>
            <div style={{ fontSize: 12, marginTop: 4 }}>基于 CloudBase 小程序成长计划免费额度</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginTop: 16 }}>
              {TEXT_SUGGESTIONS.map((s) => (
                <Tag key={s} style={{ cursor: 'pointer', borderRadius: 14, padding: '4px 12px' }} onClick={() => sendText(s)}>
                  {s}
                </Tag>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {messages.map((m, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, flexDirection: m.role === 'user' ? 'row-reverse' : 'row' }}>
                <div style={{
                  flexShrink: 0, width: 30, height: 30, borderRadius: '50%',
                  background: m.role === 'user' ? 'var(--bg-sidebar)' : ACCENT,
                  color: m.role === 'user' ? 'var(--text-secondary)' : '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700,
                }}>
                  {m.role === 'user' ? '我' : 'AI'}
                </div>
                <div style={{
                  maxWidth: '82%', padding: '10px 12px', borderRadius: 12,
                  background: m.role === 'user' ? ACCENT : 'var(--bg-sidebar)',
                  color: m.role === 'user' ? '#fff' : 'var(--text-primary)',
                  fontSize: 14, lineHeight: 1.6, wordBreak: 'break-word',
                }}
                  dangerouslySetInnerHTML={m.role === 'assistant' ? { __html: renderMarkdown(m.content) } : undefined}
                >
                  {m.role === 'user' ? m.content : undefined}
                </div>
              </div>
            ))}
            {sending && (
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>
                <Spin size="small" /> 思考中...
              </div>
            )}
            <div ref={msgEndRef} />
          </div>
        )}
      </div>
      <div style={{ borderTop: '1px solid var(--border)', padding: '10px 4px 4px' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
          <Input.TextArea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={`和 ${active.label} 聊聊…（回车发送）`}
            autoSize={{ minRows: 1, maxRows: 4 }}
            onPressEnter={(e) => { if (!e.shiftKey) { e.preventDefault(); sendText(); } }}
            disabled={sending}
          />
          <Button type="primary" icon={<SendOutlined />} onClick={() => sendText()} loading={sending}
            style={{ background: ACCENT, borderColor: ACCENT, flexShrink: 0 }} />
        </div>
        {messages.length > 0 && (
          <Button type="text" size="small" icon={<ClearOutlined />} onClick={clearText} style={{ marginTop: 4 }}>
            清空对话
          </Button>
        )}
      </div>
    </div>
  );

  // ─── 渲染：图像生成视图 ───
  const renderImageView = () => (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px' }}>
        {/* 提示词 */}
        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 6 }}>提示词（最多 500 字）</div>
        <Input.TextArea
          value={imgPrompt}
          onChange={(e) => setImgPrompt(e.target.value)}
          placeholder={active.kind === 'i2i' ? '描述想要的生成效果，例如：换成水彩风格' : '描述你想生成的画面…'}
          autoSize={{ minRows: 3, maxRows: 6 }}
          maxLength={500}
        />
        <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <Select value={imgSize} onChange={setImgSize} options={SIZE_OPTIONS} style={{ width: 180 }} size="small" />
          {active.kind === 'i2i' && (
            <label>
              <input type="file" accept="image/png,image/jpeg" onChange={onPickImage} style={{ display: 'none' }} id="fab-i2i-input" />
              <Button icon={<UploadOutlined />} size="small" onClick={() => document.getElementById('fab-i2i-input')?.click()}>
                上传参考图
              </Button>
            </label>
          )}
        </div>
        {active.kind === 'i2i' && imgPreview && (
          <div style={{ marginTop: 10 }}>
            <img src={imgPreview} alt="参考图" style={{ width: 96, height: 96, objectFit: 'cover', borderRadius: 10, border: '1px solid var(--border)' }} />
          </div>
        )}
        {!imgPrompt && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
            {IMAGE_SUGGESTIONS.map((s) => (
              <Tag key={s} style={{ cursor: 'pointer', borderRadius: 12, padding: '2px 10px', maxWidth: '100%' }} onClick={() => setImgPrompt(s)}>
                {s.length > 18 ? s.slice(0, 18) + '…' : s}
              </Tag>
            ))}
          </div>
        )}

        {/* 结果区 */}
        <div style={{ marginTop: 16 }}>
          {genLoading && (
            <div style={{ textAlign: 'center', color: 'var(--text-tertiary)', padding: 24 }}>
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
                <div key={i} style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)', background: '#000' }}>
                  <img src={im.url} alt={`生成图 ${i + 1}`} style={{ width: '100%', display: 'block' }} />
                  <a href={im.url} target="_blank" rel="noreferrer"
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '6px 0', fontSize: 12, color: ACCENT, background: 'var(--bg-sidebar)' }}>
                    <DownloadOutlined /> 下载
                  </a>
                </div>
              ))}
            </div>
          )}
          {images.length > 0 && images[0]?.revised_prompt && (
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 8 }}>
              改写提示词：{images[0].revised_prompt}
            </div>
          )}
        </div>
      </div>
      <div style={{ borderTop: '1px solid var(--border)', padding: '10px 4px 4px', display: 'flex', gap: 8 }}>
        <Button onClick={clearImage} icon={<ReloadOutlined />} style={{ flexShrink: 0 }}>重置</Button>
        <Button type="primary" icon={<ThunderboltOutlined />} onClick={genImage} loading={genLoading}
          disabled={!imgPrompt.trim() || (active.kind === 'i2i' && !imgBase64)}
          style={{ background: ACCENT, borderColor: ACCENT, flex: 1 }}>
          生成
        </Button>
      </div>
    </div>
  );

  // 免费额度剩余（用于绿色提醒）
  const chatLeft = DAILY_QUOTA.chat - quota.chat;
  const imgLeft = DAILY_QUOTA.image - quota.image;

  return (
    <>
      {/* 右侧悬浮入口（打开时隐藏，避免遮挡抽屉） */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          title="免费体验 AI 工具"
          style={{
            position: 'fixed', right: 0, top: '50%', transform: 'translateY(-50%)',
            zIndex: 1100, border: 'none', cursor: 'pointer', color: '#fff',
            background: `linear-gradient(135deg, ${ACCENT} 0%, #a29bfe 100%)`,
            borderTopLeftRadius: 16, borderBottomLeftRadius: 16,
            width: 46, padding: '14px 0', display: 'flex', flexDirection: 'column',
            alignItems: 'center', gap: 8,
            boxShadow: '-2px 0 14px rgba(108,92,231,0.35)',
          }}
        >
          <GiftOutlined style={{ fontSize: 18 }} />
          <span style={{ writingMode: 'vertical-rl', letterSpacing: 3, fontSize: 13, fontWeight: 600 }}>
            免费体验AI工具
          </span>
        </button>
      )}

      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        placement="right"
        width={maximized ? (isMobile ? '100vw' : 'min(1200px, 96vw)') : (isMobile ? '92vw' : 460)}
        closable={false}
        styles={{ body: { padding: 0, display: 'flex', flexDirection: 'column' } }}
        style={{ zIndex: 1100 }}
      >
        {/* 抽屉头部 */}
        <div style={{
          padding: '16px 18px', borderBottom: '1px solid var(--border)',
          background: `linear-gradient(135deg, ${ACCENT} 0%, #a29bfe 100%)`, color: '#fff',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <GiftOutlined style={{ fontSize: 22 }} />
              <div>
                <div style={{ fontWeight: 700, fontSize: 17 }}>免费体验 AI 工具</div>
                <div style={{ fontSize: 12, opacity: 0.95 }}>超强文本大模型及文生图，图生图免费体验</div>
                {/* 免费额度绿色明亮提醒 */}
                <div style={{ fontSize: 12, fontWeight: 600, display: 'flex', gap: 12, alignItems: 'center', marginTop: 3 }}>
                  <span style={{ color: quotaColor(chatLeft, DAILY_QUOTA.chat) }}>● 免费对话 {quota.chat}/{DAILY_QUOTA.chat}</span>
                  <span style={{ color: quotaColor(imgLeft, DAILY_QUOTA.image) }}>免费生图 {quota.image}/{DAILY_QUOTA.image}</span>
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Button type="text" icon={maximized ? <CompressOutlined /> : <ExpandOutlined />}
                onClick={() => setMaximized((v) => !v)} title={maximized ? '还原' : '最大化'}
                style={{ color: '#fff', fontSize: 16 }} />
              <Button type="text" icon={<CloseOutlined />} onClick={() => setOpen(false)}
                style={{ color: '#fff', fontSize: 16 }} />
            </div>
          </div>
        </div>

        {/* 模型选择 */}
        <div style={{ padding: '12px 14px 4px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {(['文本对话', '图像生成'] as const).map((g) => (
            <div key={g}>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 6, fontWeight: 600 }}>{g}</div>
              <Space size={8} wrap>
                {MODELS.filter((m) => m.group === g).map((m) => {
                  const sel = m.id === activeId;
                  return (
                    <button
                      key={m.id}
                      onClick={() => setActiveId(m.id)}
                      title={m.desc}
                      style={{
                        border: sel ? `1.5px solid ${ACCENT}` : '1px solid var(--border)',
                        background: sel ? ACCENT_SOFT : 'var(--bg-container)',
                        color: sel ? ACCENT : 'var(--text-secondary)',
                        borderRadius: 12, padding: '7px 12px', cursor: 'pointer',
                        fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6,
                      }}
                    >
                      {m.kind === 'text' ? <RobotOutlined /> : <PictureOutlined />}
                      {m.label}
                    </button>
                  );
                })}
              </Space>
            </div>
          ))}
          <Tag color="green" style={{ alignSelf: 'flex-start', borderRadius: 10 }}>免费 · 不消耗积分</Tag>
        </div>

        {/* 内容区 */}
        <div style={{ flex: 1, minHeight: 0, padding: '8px 14px 14px', display: 'flex', flexDirection: 'column' }}>
          {isText ? renderTextView() : renderImageView()}
        </div>
      </Drawer>
    </>
  );
}
