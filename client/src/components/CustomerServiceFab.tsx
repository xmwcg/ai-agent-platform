import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Button, Input, Tag, Tooltip, Spin, message } from 'antd';
import {
  CustomerServiceOutlined, CloseOutlined, SendOutlined, WechatOutlined,
  PictureOutlined, RobotOutlined, MinusOutlined, MailOutlined,
} from '@ant-design/icons';
import { aibakAPI } from '@/services/api';

// 售前 / 售后 / 合作 知识库人设（调用云函数 hy3 / hy3-preview 文本模型）
const SALES_PROMPT = `你是 AIbak（aibak.site）平台的智能客服助手「小A」。平台定位：打造您的全站 AI 应用平台，提供 AI 对话、通用知识库（含法律/AI技术/行业问答）、智能工具箱（创作/分析/开发/营销/商务/办公）、会员订阅与 API 变现、分销推广。

你的职责：
1. 解答平台功能、工具使用、会员报价（专业版 29 元/月、旗舰版 99 元/月）、企业合作、分销佣金等问题；
2. 引导用户注册、升级会员、使用免费体验；
3. 遇到无法确定的商务/技术细节，引导联系商务邮箱 contact@aibak.site 或微信客服；
4. 用简体中文，语气专业友好、简洁，必要时用要点分条。

不要编造不存在的优惠或承诺。`;

const QUICK_QUESTIONS = [
  '平台都有哪些功能？',
  '会员怎么收费？',
  '如何接入自己的大模型 API？',
  '分销佣金怎么算？',
];

interface Msg { role: 'user' | 'assistant'; content: string; image?: string }

export default function CustomerServiceFab() {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([
    { role: 'assistant', content: '您好！我是 AIbak 智能客服小助手 👋\n关于平台功能、会员报价、企业合作、分销变现，都可以问我～' },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [model, setModel] = useState<'hy3' | 'hy3-preview'>('hy3');
  const [imgMode, setImgMode] = useState(false);
  const [showHuman, setShowHuman] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // 首页自动弹出（仅首次，关闭后当天不再弹）
  useEffect(() => {
    if (location.pathname === '/') {
      const dismissed = localStorage.getItem('cs_popup_dismissed');
      if (!dismissed) {
        const t = setTimeout(() => setOpen(true), 2500);
        return () => clearTimeout(t);
      }
    }
  }, [location.pathname]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, loading]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    const history: Msg[] = [...messages, { role: 'user', content: text }];
    setMessages(history);
    setInput('');
    setLoading(true);

    try {
      if (imgMode) {
        // 文生图：调用 HY-Image-3.0-Plus 免费模型
        const res: any = await aibakAPI.image({
          model: 'HY-Image-3.0-Plus-4090-Tob-v1.0',
          prompt: text,
          size: '1024x1024',
        });
        const imgs = res?.images || res?.data || [];
        if (imgs.length) {
          setMessages((m) => [...m, { role: 'assistant', content: '为您生成的效果图：', image: imgs[0].url }]);
        } else {
          setMessages((m) => [...m, { role: 'assistant', content: '图像生成失败，请稍后重试或换文字提问。' }]);
        }
      } else {
        const res: any = await aibakAPI.chat({
          messages: [{ role: 'system', content: SALES_PROMPT }, ...history.map((m) => ({ role: m.role, content: m.content }))],
          model,
        });
        setMessages((m) => [...m, { role: 'assistant', content: res?.text || '暂时无法回答，请稍后再试。' }]);
      }
    } catch {
      setMessages((m) => [...m, {
        role: 'assistant',
        content: imgMode ? '图像服务暂不可用，请稍后重试。' : '服务暂时不可用，请邮件联系 contact@aibak.site。',
      }]);
    } finally {
      setLoading(false);
    }
  };

  const closeAll = () => {
    setOpen(false);
    localStorage.setItem('cs_popup_dismissed', '1');
  };

  // ─── 收起态：仅悬浮按钮 ───
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        title="AI 智能客服"
        aria-label="打开智能客服"
        style={{
          position: 'fixed', left: 16, bottom: 88, zIndex: 1050,
          width: 52, height: 52, borderRadius: '50%', border: 'none', cursor: 'pointer',
          background: 'linear-gradient(135deg, #07c160, #06ad56)', color: '#fff',
          boxShadow: '0 6px 20px rgba(7,193,96,0.45)', fontSize: 24,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'transform 0.2s',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.08)')}
        onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
      >
        <CustomerServiceOutlined />
      </button>
    );
  }

  return (
    <div style={{
      position: 'fixed', left: 16, bottom: 88, zIndex: 1051,
      width: 360, maxWidth: 'calc(100vw - 32px)',
      height: minimized ? 'auto' : 480, maxHeight: 'calc(100vh - 110px)',
      background: 'var(--bg-container)', borderRadius: 16, overflow: 'hidden',
      boxShadow: '0 12px 40px rgba(0,0,0,0.25)', border: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* 头部 */}
      <div style={{
        background: 'linear-gradient(135deg, #6c5ce7 0%, #a29bfe 100%)', color: '#fff',
        padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <RobotOutlined style={{ fontSize: 18 }} />
          <div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>AIbak 智能客服</div>
            <div style={{ fontSize: 11, opacity: 0.85 }}>在线 · 云函数 AI 驱动</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <Tooltip title="转人工客服（微信 / 飞书 / 邮箱）">
            <Button type="text" size="small" onClick={() => setShowHuman(true)}
              style={{ color: '#fff', fontSize: 12 }}>转人工</Button>
          </Tooltip>
          <Button type="text" size="small" icon={<MinusOutlined />} onClick={() => setMinimized((m) => !m)}
            style={{ color: '#fff' }} />
          <Button type="text" size="small" icon={<CloseOutlined />} onClick={closeAll} style={{ color: '#fff' }} />
        </div>
      </div>

      {!minimized && (
        <>
          {/* 消息区 */}
          <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: 14, background: 'var(--bg-base)' }}>
            {messages.map((m, i) => (
              <div key={i} style={{ display: 'flex', marginBottom: 12, justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                <div style={{
                  maxWidth: '82%', padding: '8px 12px', borderRadius: 12, whiteSpace: 'pre-wrap',
                  fontSize: 13, lineHeight: 1.6,
                  background: m.role === 'user' ? 'linear-gradient(135deg,#6c5ce7,#a29bfe)' : 'var(--bg-container)',
                  color: m.role === 'user' ? '#fff' : 'var(--text-primary)',
                  border: m.role === 'user' ? 'none' : '1px solid var(--border-light)',
                }}>
                  {m.content}
                  {m.image && (
                    <div style={{ marginTop: 8 }}>
                      <img src={m.image} alt="生成图" style={{ width: '100%', borderRadius: 8 }} />
                    </div>
                  )}
                </div>
              </div>
            ))}
            {loading && <Spin size="small" style={{ marginLeft: 4 }} />}

            {/* 转人工联系卡（微信 / 飞书 / 邮箱） */}
            {showHuman && (
              <div style={{
                marginTop: 4, padding: 12, borderRadius: 12,
                background: 'linear-gradient(135deg, rgba(7,193,96,0.10), rgba(108,92,231,0.08))',
                border: '1px solid var(--border-light)',
              }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)', marginBottom: 8 }}>
                  人工客服为您服务
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-secondary)' }}>
                    <WechatOutlined style={{ color: '#07c160', fontSize: 16 }} />
                    <span>微信客服：<b>aibak-service</b>（添加备注「AIbak」）</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-secondary)' }}>
                    <CustomerServiceOutlined style={{ color: '#3370ff', fontSize: 16 }} />
                    <span>飞书客服：搜索「AIbak 支持」或留言工单</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-secondary)' }}>
                    <MailOutlined style={{ color: '#6c5ce7', fontSize: 16 }} />
                    <span>商务 / 技术邮箱：<b>contact@aibak.site</b></span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
                    人工客服服务时间：工作日 9:00–21:00；非工作时间留言将于次日回复。
                  </div>
                </div>
                <Button size="small" type="link" style={{ paddingLeft: 0, marginTop: 4 }}
                  onClick={() => setShowHuman(false)}>收起</Button>
              </div>
            )}

            {/* 快捷问题 */}
            {messages.length <= 1 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                {QUICK_QUESTIONS.map((q) => (
                  <Tag key={q} style={{ cursor: 'pointer', borderRadius: 12, padding: '4px 10px' }}
                    onClick={() => { setInput(q); }}>
                    {q}
                  </Tag>
                ))}
              </div>
            )}
          </div>

          {/* 模式 + 模型切换 */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px',
            borderTop: '1px solid var(--border-light)', fontSize: 12,
          }}>
            <Tooltip title="文生图模式（HY-Image 免费模型）">
              <Button type={imgMode ? 'primary' : 'text'} size="small" icon={<PictureOutlined />}
                onClick={() => setImgMode((v) => !v)} style={{ fontSize: 12 }}>
                {imgMode ? '画图模式' : '文字'}
              </Button>
            </Tooltip>
            {!imgMode && (
              <div style={{ display: 'flex', gap: 4, marginLeft: 'auto' }}>
                {(['hy3', 'hy3-preview'] as const).map((m) => (
                  <Tag key={m} style={{ cursor: 'pointer', borderRadius: 10 }}
                    color={model === m ? 'purple' : undefined}
                    onClick={() => setModel(m)}>{m}</Tag>
                ))}
              </div>
            )}
          </div>

          {/* 输入区 */}
          <div style={{ display: 'flex', gap: 8, padding: 10, borderTop: '1px solid var(--border-light)' }}>
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onPressEnter={send}
              placeholder={imgMode ? '描述你想生成的图片…' : '输入您的问题…'}
              disabled={loading}
              style={{ borderRadius: 10 }}
            />
            <Button type="primary" icon={<SendOutlined />} onClick={send} loading={loading}
              style={{ borderRadius: 10, background: 'linear-gradient(135deg,#6c5ce7,#a29bfe)', border: 'none' }} />
          </div>
        </>
      )}
    </div>
  );
}
