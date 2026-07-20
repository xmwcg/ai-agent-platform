import React, { useState, useRef, useEffect, useCallback } from 'react';
import styles from './style.module.css';
import { aiAPI, gatewayAPI, extractApiError } from '@/services/api';
import { cleanModelDisplay } from '@/components/ModelSelector';

// ─── 常量区 ───────────────────────────────
const SUGGESTIONS = [
  { t: '介绍一下 AIbak 平台', m: '请介绍一下 AIbak 平台的功能和特色' },
  { t: '知识库怎么用？', m: '请问如何使用知识库功能来管理文档？' },
  { t: '写一个 Python 脚本', m: '请帮我写一个Python脚本，用于批量重命名文件' },
  { t: '解释什么是 RAG', m: '请以更详细的方式解释什么是RAG（检索增强生成）' },
];

interface GatewayModelGroup {
  provider: string;
  label: string;
  models: string[];
  custom?: boolean;
}

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

  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_m, _lang, code) =>
    `<pre><code>${code.trim()}</code></pre>`
  );
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');
  html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>[^<]*<\/li>)+/g, '<ul>$&</ul>');
  html = html.replace(/\n/g, '<br>');
  return html;
}

const FALLBACK_MODELS: GatewayModelGroup[] = [
  { provider: 'deepseek', label: 'DeepSeek', models: ['deepseek-v4-flash', 'deepseek-v4-pro'] },
  { provider: 'agnes', label: 'Agnes AIHub', models: ['agnes-2.0-flash'] },
];

// ─── 组件 ──────────────────────────────────
const AibakChat: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [model, setModel] = useState('deepseek/deepseek-v4-flash');
  const [modelGroups, setModelGroups] = useState<GatewayModelGroup[]>(FALLBACK_MODELS);
  const [statusText, setStatusText] = useState('AI 在线');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 加载网关模型列表
  useEffect(() => {
    gatewayAPI.getModels()
      .then((res: any) => {
        const data = res?.data;
        if (Array.isArray(data) && data.length > 0) {
          const chatGroups = data
            .map((g: any) => ({ ...g, models: (g.models || []).filter((m: string) => !/image|video/i.test(m)) }))
            .filter((g: any) => g.models.length > 0);
          if (chatGroups.length > 0) setModelGroups(chatGroups);
        }
      })
      .catch(() => { /* use fallback */ });
  }, []);

  // 自动滚动到底部（仅在对话容器内滚动，不影响页面）
  const scrollToBottom = useCallback(() => {
    const container = messagesContainerRef.current;
    if (container) container.scrollTop = container.scrollHeight;
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
      // 构建历史（取最近10条）
      const history = messages.slice(-10).map(m => ({ role: m.role, content: m.content }));
      const res: any = await aiAPI.chat({
        message: msg,
        history,
        model,
      });

      if (res?.success) {
        const aiMsg: ChatMessage = { role: 'assistant', content: res.message || res.text };
        setMessages(prev => [...prev, aiMsg]);
        setStatusText('AI 在线');
      } else {
        const errMsg: ChatMessage = { role: 'assistant', content: `❌ 错误: ${res?.error || '未知错误'}` };
        setMessages(prev => [...prev, errMsg]);
        setStatusText('AI 在线');
      }
    } catch (err: any) {
      const errMsg: ChatMessage = { role: 'assistant', content: `❌ 网络错误: ${extractApiError(err)}` };
      setMessages(prev => [...prev, errMsg]);
      setStatusText('AI 在线');
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
    setStatusText('AI 在线');
  };

  // 点击建议
  const handleSuggestion = (text: string) => {
    setInput(text);
    setTimeout(() => sendMessage(text), 0);
  };

  // 导出对话
  const handleExport = () => {
    const text = messages.map(m => `[${m.role === 'user' ? '用户' : 'AI'}] ${m.content}`).join('\n\n---\n\n');
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'aibak-chat-export.txt'; a.click();
    URL.revokeObjectURL(url);
  };

  // 展平模型选项
  const modelOptions = modelGroups.flatMap(g =>
    g.models.map(m => ({ value: `${g.provider}/${m}`, label: `${g.label} - ${m}` }))
  );

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
            {modelOptions.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <button className={styles.clearBtn} onClick={handleExport} title="导出对话">
            导出
          </button>
          <button className={styles.clearBtn} onClick={handleClear}>
            清空
          </button>
        </div>
      </header>

      {/* 消息列表 */}
      <div className={styles.messages} ref={messagesContainerRef}>
        {messages.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>AI</div>
            <div className={styles.emptyTitle}>有什么可以帮你的？</div>
            <p className={styles.emptyDesc}>由 DeepSeek 和 Agnes AIHub 提供模型服务</p>
            <div className={styles.suggestions}>
              {SUGGESTIONS.map((s, i) => (
                <div
                  key={i}
                  className={styles.suggestionCard}
                  onClick={() => handleSuggestion(s.m)}
                >
                  {s.t}
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
          由 DeepSeek V4 / Agnes AIHub 提供模型服务
        </div>
      </div>
    </div>
  );
};

export default AibakChat;
