import React, { useState, useRef, useEffect, useCallback } from 'react';
import styles from './style.module.css';
import { aibakAPI, extractApiError } from '@/services/api';

// ─── 常量区 ───────────────────────────────
const MODELS = [
  { value: 'hy3', label: 'hy3（免费）' },
  { value: 'hy3-preview', label: 'hy3-preview（免费）' },
];

const SUGGESTIONS = [
  '介绍一下 Reasonix AI 平台',
  '知识库怎么用？',
  '写一个 Python 你好世界',
  '解释一下什么是 RAG',
];

// ─── 类型 ──────────────────────────────────
interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

// ─── Markdown 渲染（轻量）───────────────────
function renderMarkdown(text: string): string {
  if (!text) return '';
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // 代码块 (```lang\n...```)
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_m, _lang, code) =>
    `<pre><code>${code.trim()}</code></pre>`
  );

  // 行内代码
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  // 粗体
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

  // 标题
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

  // 列表
  html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>[^<]*<\/li>)+/g, '<ul>$&</ul>');

  // 换行
  html = html.replace(/\n/g, '<br>');

  return html;
}

// ─── 组件 ──────────────────────────────────
const AibakChat: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [model, setModel] = useState('hy3');
  const [statusText, setStatusText] = useState('AI 在线 · 免费额度');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 自动滚动到底部（首次挂载跳过，避免覆盖路由级回顶）
  const chatMountedRef = useRef(false);
  const scrollToBottom = useCallback(() => {
    if (chatMountedRef.current) { chatMountedRef.current = false; return; }
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);

  // textarea 自适应高度
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 160) + 'px';
  };

  // 发送消息
  const sendMessage = useCallback(async (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || isGenerating) return;

    const userMsg: ChatMessage = { role: 'user', content: msg };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    setIsGenerating(true);
    setStatusText('思考中...');

    try {
      const data: any = await aibakAPI.chat({
        messages: newMessages,
        model: model as 'hy3' | 'hy3-preview',
        stream: false,
      });

      if (data?.success) {
        const aiMsg: ChatMessage = { role: 'assistant', content: data.text };
        setMessages(prev => [...prev, aiMsg]);
        const tokens = data.usage?.total_tokens ?? 'N/A';
        setStatusText(`上次: ${tokens} tokens · 免费额度`);
      } else {
        const errMsg: ChatMessage = { role: 'assistant', content: `❌ 错误: ${data?.error || '未知错误'}` };
        setMessages(prev => [...prev, errMsg]);
        setStatusText('AI 在线 · 免费额度');
      }
    } catch (err: any) {
      const errMsg: ChatMessage = { role: 'assistant', content: `❌ 网络错误: ${extractApiError(err)}` };
      setMessages(prev => [...prev, errMsg]);
      setStatusText('AI 在线 · 免费额度');
    }

    setIsGenerating(false);
  }, [input, messages, model, isGenerating]);

  // 键盘操作
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // 清空对话
  const handleClear = () => {
    setMessages([]);
    setStatusText('AI 在线 · 免费额度');
  };

  // 点击建议
  const handleSuggestion = (text: string) => {
    setInput(text);
    // 用 setTimeout 确保 input 更新后再发送
    setTimeout(() => sendMessage(text), 0);
  };

  return (
    <div className={styles.container}>
      {/* 顶部栏 */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.logo}>AI</div>
          <div>
            <div className={styles.title}>AI 智能对话</div>
            <div className={styles.subtitle}>
              <span className={styles.statusDot} />
              {statusText}
            </div>
          </div>
        </div>
        <div className={styles.headerRight}>
          <select
            className={styles.modelSelect}
            value={model}
            onChange={e => setModel(e.target.value)}
          >
            {MODELS.map(m => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
          <button className={styles.clearBtn} onClick={handleClear}>
            清空对话
          </button>
        </div>
      </header>

      {/* 消息列表 */}
      <div className={styles.messages}>
        {messages.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>AI</div>
            <div className={styles.emptyTitle}>有什么可以帮你的？</div>
            <p className={styles.emptyDesc}>基于 CloudBase 小程序成长计划免费额度</p>
            <div className={styles.suggestions}>
              {SUGGESTIONS.map((s, i) => (
                <div
                  key={i}
                  className={styles.suggestionCard}
                  onClick={() => handleSuggestion(s)}
                >
                  {s}
                </div>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg, i) => (
            <div
              key={i}
              className={`${styles.message} ${msg.role === 'user' ? styles.messageUser : styles.messageAi}`}
            >
              <div className={styles.messageAvatar}>
                {msg.role === 'user' ? '我' : 'AI'}
              </div>
              <div
                className={styles.messageContent}
                dangerouslySetInnerHTML={
                  msg.role === 'assistant'
                    ? { __html: renderMarkdown(msg.content) }
                    : undefined
                }
              >
                {msg.role === 'user' ? msg.content : undefined}
              </div>
            </div>
          ))
        )}
        {isGenerating && (
          <div className={`${styles.message} ${styles.messageAi}`}>
            <div className={styles.messageAvatar}>AI</div>
            <div className={styles.messageContent}>
              <div className={styles.typing}>
                <span /><span /><span />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* 输入区域 */}
      <div className={styles.inputArea}>
        <div className={styles.inputWrapper}>
          <textarea
            ref={textareaRef}
            className={styles.input}
            placeholder="输入消息...（回车发送，Shift+回车换行）"
            rows={1}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            disabled={isGenerating}
          />
          <button
            className={styles.sendBtn}
            onClick={() => sendMessage()}
            disabled={isGenerating || !input.trim()}
          >
            {isGenerating ? '发送中...' : '发送'}
          </button>
        </div>
        <div className={styles.footer}>
          由 CloudBase 小程序成长计划免费额度提供服务
        </div>
      </div>
    </div>
  );
};

export default AibakChat;
