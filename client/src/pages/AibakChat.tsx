import { useState, useRef, useEffect, useCallback } from 'react';
import { Card, Input, Button, Typography, Space, Spin, message, Tag, Alert } from 'antd';
import { SendOutlined, RobotOutlined, UserOutlined, ClearOutlined, CloudOutlined, CopyOutlined, DownloadOutlined } from '@ant-design/icons';
import { aibakAPI, extractApiError } from '@/services/api';

const { Text, Paragraph } = Typography;
const { TextArea } = Input;

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  model?: string;
}

export default function AibakChat() {
  const handleCopyMsg = (text: string) => {
    navigator.clipboard.writeText(text).then(() => message.success('已复制'), () => message.error('复制失败'));
  };
  const handleExportChat = () => {
    const text = messages.map((m: any) => (m.role === 'user' ? '[用户] ' : '[AI] ') + (typeof m.content === 'string' ? m.content : JSON.stringify(m.content))).join('\n\n---\n\n');
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'aibak-chat-export.txt'; a.click();
    URL.revokeObjectURL(url);
    message.success('对话已导出');
  };

  const [messages, setMessages] = useState<Message[]>([
    { id: 'welcome', role: 'assistant', content: '你好！我是 AIbak 免费助手，由 CloudBase AI 驱动。我可以帮你回答问题、创作内容、分析文本等。请随时向我提问！' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const prevMsgCountRef = useRef(0);
  const scrollToBottom = useCallback(() => {
    const container = messagesEndRef.current?.parentElement;
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }, []);

  useEffect(() => {
    if (messages.length > prevMsgCountRef.current) {
      scrollToBottom();
    }
    prevMsgCountRef.current = messages.length;
  }, [messages, scrollToBottom]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');

    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    try {
      const res: any = await aibakAPI.chat({ message: text });
      const reply = res?.data?.message || res?.message || res?.reply || '（无回复）';
      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: reply,
        model: 'CloudBase-AI'
      };
      setMessages(prev => [...prev, assistantMsg]);
    } catch (e: any) {
      const errMsg = extractApiError(e, '请求失败，请检查网络或稍后重试');
      message.error(errMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <Alert
        type="info"
        showIcon
        icon={<CloudOutlined />}
        message="CloudBase AI 免费对话"
        description="本页面使用腾讯云 CloudBase 成长计划免费 AI 额度，无需配置 API Key，开箱即用。如需更强大模型，请前往「AI 对话」页面。"
        style={{ marginBottom: 16, borderRadius: 12 }}
      />

      <Card
        style={{ borderRadius: 16, border: '1px solid #eef1f5', minHeight: 400 }}
        bodyStyle={{ padding: 0, display: 'flex', flexDirection: 'column', height: 'calc(100vh - 260px)' }}
      >
        {/* Messages area */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
          {messages.map((msg) => (
            <div key={msg.id} style={{ display: 'flex', gap: 10, marginBottom: 16, flexDirection: msg.role === 'user' ? 'row-reverse' : 'row' }}>
              <div style={{
                width: 36, height: 36, borderRadius: '50%',
                background: msg.role === 'user' ? '#52c41a' : '#6366f1',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', flexShrink: 0, fontSize: 16
              }}>
                {msg.role === 'user' ? <UserOutlined /> : <RobotOutlined />}
              </div>
              <div style={{ maxWidth: '70%' }}>
                <div style={{
                  padding: '10px 14px', borderRadius: 14, fontSize: 14, lineHeight: 1.65,
                  background: msg.role === 'user' ? 'linear-gradient(135deg, #eef2ff, #e0e7ff)' : '#fff',
                  border: msg.role === 'user' ? '1px solid #c7d2fe' : '1px solid #e8ecf1',
                  whiteSpace: 'pre-wrap', wordBreak: 'break-word'
                }}>
                  {msg.content}
                </div>
                {msg.model && (
                  <div style={{ marginTop: 2, fontSize: 10, color: '#999', textAlign: msg.role === 'user' ? 'right' : 'left' }}>
                    <Tag style={{ fontSize: 10, lineHeight: '16px', padding: '0 6px' }} color="blue">{msg.model}</Tag>
                  </div>
                )}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        <div style={{ padding: '12px 20px', borderTop: '1px solid #eef1f5', background: '#fafbfe' }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <TextArea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="输入你的问题... (Enter 发送，Shift+Enter 换行)"
              autoSize={{ minRows: 1, maxRows: 4 }}
              disabled={loading}
              style={{ flex: 1, borderRadius: 12 }}
            />
            <Button
              type="primary"
              icon={loading ? <Spin size="small" /> : <SendOutlined />}
              onClick={handleSend}
              disabled={!input.trim() || loading}
              style={{ borderRadius: 12, height: 'auto', minWidth: 48 }}
            />
            <Button
              icon={<ClearOutlined />}
              onClick={() => setMessages([messages[0]])}
              disabled={messages.length <= 1}
              style={{ borderRadius: 12, height: 'auto' }}
            />
          </div>
          <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 4 }}>
            由 CloudBase AI 提供支持 · 免费额度有限 · 请勿输入敏感信息
          </Text>
        </div>
      </Card>
    </div>
  );
}
