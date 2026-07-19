import { useState } from 'react';
import { Avatar, Typography, Button, Space, message } from 'antd';
import { RobotOutlined, UserOutlined, CopyOutlined, DownOutlined, RightOutlined } from '@ant-design/icons';
import { ChatMessage as ChatMessageType } from '@/stores/chat';

const { Text } = Typography;

interface Props {
  msg: ChatMessageType;
}

// 简单的 Markdown 渲染（颜色化代码块）
function renderContent(content: string): React.ReactNode {
  const segments = content.split(/(```[\s\S]*?```)/g);
  return segments.map((seg, i) => {
    if (seg.startsWith('```')) {
      const langEnd = seg.indexOf('\n');
      const lang = langEnd > 0 ? seg.slice(3, langEnd).trim() : '';
      const code = langEnd > 0 ? seg.slice(langEnd + 1, -3).trim() : seg.slice(3, -3).trim();
      return (
        <div key={i} className="code-block">
          {lang && <div className="code-lang">{lang}</div>}
          <pre><code>{code}</code></pre>
        </div>
      );
    }
    // 简单 Markdown 处理
    return (
      <span key={i} style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
        {seg.split(/(\*\*.*?\*\*|`.*?`|\n)/g).map((token, j) => {
          if (token.startsWith('**') && token.endsWith('**')) {
            return <strong key={j}>{token.slice(2, -2)}</strong>;
          }
          if (token.startsWith('`') && token.endsWith('`')) {
            return <code key={j} style={{ background: '#f0f0f0', padding: '1px 5px', borderRadius: 3, fontSize: 13 }}>{token.slice(1, -1)}</code>;
          }
          if (token === '\n') return <br key={j} />;
          return <span key={j}>{token}</span>;
        })}
      </span>
    );
  });
}

export default function ChatMessageBubble({ msg }: Props) {
  const [thinkingOpen, setThinkingOpen] = useState(false);
  const isUser = msg.role === 'user';

  const handleCopy = () => {
    navigator.clipboard.writeText(msg.content).then(() => {
      message.success('已复制');
    }).catch(() => {
      message.error('复制失败');
    });
  };

  return (
    <div className={`chat-bubble ${isUser ? 'user' : 'assistant'}`}>
      {/* 头像 */}
      <Avatar
        icon={isUser ? <UserOutlined /> : <RobotOutlined />}
        style={{
          backgroundColor: isUser ? '#52c41a' : '#6366f1',
          flexShrink: 0,
        }}
      />

      {/* 内容 */}
      <div className="bubble-content">
        {/* 发送者 + 操作 */}
        <div className="bubble-header">
          <Text strong style={{ fontSize: 12, color: isUser ? '#52c41a' : '#6366f1' }}>
            {isUser ? '你' : 'AI 助手'}
          </Text>
          {msg.model && (
            <Text type="secondary" style={{ fontSize: 11 }}>
              {msg.model.replace(/^mc_[^/]+\//, "")}
            </Text>
          )}
          {!isUser && (
            <Button type="text" size="small" icon={<CopyOutlined />} onClick={handleCopy} className="copy-btn" />
          )}
        </div>

        {/* 思考过程（仅 AI 消息） */}
        {!isUser && msg.thinking && (
          <div className="thinking-area">
            <div className="thinking-toggle" onClick={() => setThinkingOpen(!thinkingOpen)}>
              {thinkingOpen ? <DownOutlined /> : <RightOutlined />}
              <span>思考过程</span>
            </div>
            {thinkingOpen && (
              <div className="thinking-content">{msg.thinking}</div>
            )}
          </div>
        )}

        {/* 消息内容 */}
        <div className="bubble-text">
          {isUser ? msg.content : renderContent(msg.content)}
        </div>
      </div>

      <style>{`
        .chat-bubble {
          display: flex; gap: 10px; padding: 4px 0; align-items: flex-start;
          animation: bubbleIn 0.25s ease;
        }
        @keyframes bubbleIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        .chat-bubble.user { flex-direction: row-reverse; }
        .bubble-content {
          max-width: 72%; min-width: 120px;
        }
        .bubble-header {
          display: flex; align-items: center; gap: 8px; margin-bottom: 4px;
        }
        .chat-bubble.user .bubble-header { justify-content: flex-end; }
        .copy-btn { opacity: 0; transition: opacity 0.2s; }
        .chat-bubble:hover .copy-btn { opacity: 1; }
        .bubble-text {
          padding: 10px 14px; border-radius: 14px; font-size: 14px; line-height: 1.65;
          word-break: break-word;
        }
        .chat-bubble.user .bubble-text {
          background: linear-gradient(135deg, #eef2ff, #e0e7ff);
          border: 1px solid #c7d2fe; color: #1e3a5f;
        }
        .chat-bubble.assistant .bubble-text {
          background: #fff; border: 1px solid #e8ecf1;
        }
        .code-block {
          background: #1e1e2e; color: #cdd6f4; border-radius: 8px;
          margin: 8px 0; overflow: hidden;
        }
        .code-lang {
          padding: 4px 12px; font-size: 11px; color: #6c7086;
          background: #181825; border-bottom: 1px solid #313244;
        }
        .code-block pre {
          margin: 0; padding: 12px; overflow-x: auto; font-size: 13px;
          font-family: 'JetBrains Mono', 'Fira Code', monospace;
        }
        .thinking-area {
          margin: 4px 0 8px;
          background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px;
          overflow: hidden;
        }
        .thinking-toggle {
          padding: 6px 10px; font-size: 12px; color: #92400e; cursor: pointer;
          display: flex; align-items: center; gap: 6px;
        }
        .thinking-content {
          padding: 6px 10px; font-size: 12px; color: #78716c;
          background: #fffbeb; border-top: 1px solid #fef3c7;
          white-space: pre-wrap; word-break: break-word;
        }
        @media (max-width: 768px) {
          .bubble-content { max-width: 85%; }
        }
      `}</style>
    </div>
  );
}
