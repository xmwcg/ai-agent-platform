import { useEffect, useRef, useCallback, useState } from 'react';
import {
  Typography, Space, Tag, Button, Tooltip, Drawer, Empty, Divider,
  Progress, Statistic, Modal, Form, Input, Select, message,
} from 'antd';
import {
  MenuFoldOutlined, MenuUnfoldOutlined, InfoCircleOutlined,
  ClearOutlined, RobotOutlined, ThunderboltOutlined,
  BarChartOutlined, SettingOutlined,
} from '@ant-design/icons';
import { useChatStore } from '@/stores/chat';
import { aiAPI } from '@/services/api';
import ModelSelector from '@/components/ModelSelector';
import ChatSidebar from './AiChat/ChatSidebar';
import ChatMessageBubble from './AiChat/ChatMessage';
import ChatInput from './AiChat/ChatInput';
import PromptOptimizer from './AiChat/PromptOptimizer';

const { Text, Title } = Typography;

export default function AiChat() {
  const {
    sessions, activeSessionId, mode, model, loading,
    createSession, addMessage, updateMessage, clearMessages,
    setMode, setModel, setLoading, rightPanelOpen, toggleRightPanel,
  } = useChatStore();

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [optimizerOpen, setOptimizerOpen] = useState(false);
  const [optimizerPrompt, setOptimizerPrompt] = useState('');
  const [createAgentOpen, setCreateAgentOpen] = useState(false);
  const [agentForm] = Form.useForm();

  // 创建智能体（复用会话机制 + 系统提示词）
  const handleCreateAgent = useCallback(async () => {
    try {
      const values = await agentForm.validateFields();
      createSession({
        title: values.title,
        description: values.description,
        model: values.model || model,
        mode: values.mode || 'qa',
        systemPrompt: values.systemPrompt,
      });
      setCreateAgentOpen(false);
      agentForm.resetFields();
      message.success('智能体已创建，开始对话吧');
    } catch {
      /* 表单校验失败，等待用户修正 */
    }
  }, [createSession, model, agentForm]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  const activeSession = sessions.find((s) => s.id === activeSessionId);
  const messages = activeSession?.messages || [];

  // 自动滚动到底部（首次挂载跳过，避免覆盖路由级回顶）
  const chatMountedRef = useRef(false);
  useEffect(() => {
    if (!chatMountedRef.current) { chatMountedRef.current = true; return; }
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // 如果没有活跃会话，自动创建
  useEffect(() => {
    if (!activeSessionId && sessions.length === 0) {
      createSession();
    }
  }, [activeSessionId, sessions.length, createSession]);

  // 发送消息
  const handleSend = useCallback(
    async (text: string) => {
      if (!text.trim() || loading) return;

      // 确保有活跃会话
      let sid = activeSessionId;
      if (!sid) {
        sid = createSession();
      }

      // 添加用户消息
      addMessage({ role: 'user', content: text.trim(), model, mode });

      // 添加空的 AI 消息占位
      const aiMsgId = `msg_${Date.now()}_placeholder`;
      addMessage({ role: 'assistant', content: '⏳ 思考中...', model, mode });
      setLoading(true);

      try {
        const history = messages.map((m) => ({ role: m.role, content: m.content }));
        const res: any = await aiAPI.chat({
          message: text.trim(),
          history: history.slice(-10),
          sessionId: sid,
          model,
          config: activeSession?.systemPrompt ? { systemPrompt: activeSession.systemPrompt } : undefined,
        });

        // 更新 AI 消息
        useChatStore.getState().updateMessage(
          aiMsgId,
          { content: res?.message || '（AI 无响应，请检查 API 配置）' }
        );
      } catch (err: any) {
        const errMsg = err?.response?.data?.message || err?.message || '请求失败';
        useChatStore.getState().updateMessage(aiMsgId, {
          content: `⚠️ 请求失败：${errMsg}`,
        });
      } finally {
        setLoading(false);
      }
    },
    [activeSessionId, messages, model, mode, loading, addMessage, createSession, setLoading]
  );

  // 打开提示词优化
  const handleOpenOptimizer = useCallback((text: string) => {
    if (!text) return;
    setOptimizerPrompt(text);
    setOptimizerOpen(true);
  }, []);

  // 移动端侧边栏
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 1024;

  // 客户端只能准确统计字符数；真实 Token/计费数据应以后端返回为准。
  const totalChars = messages.reduce((sum, m) => sum + m.content.length, 0);
  const userChars = messages.filter((m) => m.role === 'user').reduce((sum, m) => sum + m.content.length, 0);

  return (
    <div className="chat-container" ref={containerRef}>
      {/* ===== 左侧边栏 ===== */}
      {!isMobile && sidebarOpen && <ChatSidebar onOpenCreateAgent={() => setCreateAgentOpen(true)} />}
      {isMobile && (
        <Drawer
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          width={280}
          placement="left"
          styles={{ body: { padding: 0 } }}
        >
          <ChatSidebar onOpenCreateAgent={() => setCreateAgentOpen(true)} />
        </Drawer>
      )}

      {/* ===== 中间主聊天区 ===== */}
      <div className="chat-main">
        {/* 顶部工具栏 */}
        <div className="chat-topbar">
          <Space size={8}>
            <Tooltip title={sidebarOpen ? '收起侧边栏' : '展开侧边栏'}>
              <Button
                type="text"
                icon={sidebarOpen ? <MenuFoldOutlined /> : <MenuUnfoldOutlined />}
                onClick={() => setSidebarOpen(!sidebarOpen)}
              />
            </Tooltip>

            <div className="mode-indicator">
              <Tag
                color={mode === 'qa' ? '#6366f1' : mode === 'plan' ? '#f59e0b' : '#10b981'}
                style={{ borderRadius: 12, padding: '2px 10px', border: 'none' }}
              >
                {mode === 'qa' ? '💬 问答模式' : mode === 'plan' ? '📋 计划模式' : '⚡ 直接执行'}
              </Tag>
            </div>
          </Space>

          <Space size={8}>
            <Text type="secondary" style={{ fontSize: 13 }}>🤖 模型</Text>
            <ModelSelector value={model} onChange={setModel} style={{ width: 200 }} size="small" placeholder="选择模型" mode="chat" />

            <Tooltip title="清空对话">
              <Button type="text" icon={<ClearOutlined />} onClick={clearMessages} disabled={messages.length === 0} />
            </Tooltip>

            <Tooltip title="会话详情">
              <Button
                type="text"
                icon={<InfoCircleOutlined />}
                onClick={toggleRightPanel}
                style={{ color: rightPanelOpen ? '#6366f1' : undefined }}
              />
            </Tooltip>
          </Space>
        </div>

        {/* 消息列表 */}
        <div className="chat-messages" ref={messagesContainerRef}>
          {messages.length === 0 ? (
            <div className="chat-empty">
              <div className="empty-icon">
                <RobotOutlined style={{ fontSize: 48, color: '#c4b5fd' }} />
              </div>
              <Title level={4} style={{ color: '#64748b', margin: '12px 0 4px' }}>
                开始对话
              </Title>
              <Text type="secondary">选择模型和模式，输入问题开始体验</Text>
              <Button
                type="primary"
                icon={<RobotOutlined />}
                onClick={() => setCreateAgentOpen(true)}
                style={{ marginTop: 16 }}
              >
                创建智能体（Agent）
              </Button>
              <div className="quick-tags">
                {[
                  { t: '代码解释', m: '请解释以下代码的逻辑：' },
                  { t: '技术问答', m: '请详细解释什么是 RAG？' },
                  { t: '文档总结', m: '请帮我把以下内容总结成要点：' },
                  { t: '方案策划', m: '请帮我在以下方面做一个方案：' },
                  { t: '翻译对比', m: '请把以下内容翻译成英文：' },
                  { t: '知识检索', m: '请检索知识库中关于：' },
                ].map((qt) => (
                  <Tag
                    key={qt.t}
                    style={{ cursor: 'pointer', borderRadius: 14, padding: '2px 14px' }}
                    onClick={() => handleSend(qt.m)}
                  >
                    {qt.t}
                  </Tag>
                ))}
              </div>
            </div>
          ) : (
            <div className="message-list">
              {messages.map((msg, i) => (
                <ChatMessageBubble key={msg.id || i} msg={msg} />
              ))}
              {loading && (
                <div className="loading-indicator">
                  <span className="loading-dot" />
                  <span className="loading-dot" />
                  <span className="loading-dot" />
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* 输入区域 */}
        <ChatInput
          onSend={(text) => handleSend(text)}
          onPromptOptimize={handleOpenOptimizer}
          disabled={loading}
        />
      </div>

      {/* ===== 右侧面板 ===== */}
      {rightPanelOpen && (
        <div className="chat-right-panel">
          <Title level={5} style={{ margin: 0 }}>会话详情</Title>
          <Divider style={{ margin: '12px 0' }} />

          <Space direction="vertical" style={{ width: '100%' }} size={16}>
            <div>
              <Text type="secondary" style={{ fontSize: 12 }}>当前模型</Text>
              <div className="panel-value">{model ? model.replace(/^mc_[^/]+\//, '') : '未选择'}</div>
            </div>

            <div>
              <Text type="secondary" style={{ fontSize: 12 }}>对话模式</Text>
              <div className="panel-value">
                {mode === 'qa' ? '问答模式' : mode === 'plan' ? '计划模式' : '直接执行'}
              </div>
            </div>

            <Divider style={{ margin: '4px 0' }} />

            <Statistic title="消息数" value={messages.length} valueStyle={{ fontSize: 20 }} />
            <Statistic title="字符数" value={totalChars} valueStyle={{ fontSize: 20 }} />

            <div>
              <Text type="secondary" style={{ fontSize: 12 }}>字符分布</Text>
              <Progress
                percent={totalChars > 0 ? Math.round((userChars / totalChars) * 100) : 0}
                strokeColor="#6366f1"
                trailColor="#e8ecf1"
                size="small"
                format={() => `用户 ${userChars}`}
              />
            </div>
          </Space>
        </div>
      )}

      {/* 提示词优化弹窗 */}
      <PromptOptimizer
        open={optimizerOpen}
        onClose={() => setOptimizerOpen(false)}
        originalPrompt={optimizerPrompt}
        onApply={(optimized) => {
          setOptimizerOpen(false);
          handleSend(optimized);
        }}
      />

      {/* 创建智能体（Agent）弹窗 */}
      <Modal
        title={
          <Space>
            <RobotOutlined />
            创建智能体（Agent）
          </Space>
        }
        open={createAgentOpen}
        onCancel={() => { setCreateAgentOpen(false); agentForm.resetFields(); }}
        onOk={handleCreateAgent}
        okText="创建并对话"
        width={560}
        destroyOnClose
      >
        <Form form={agentForm} layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item name="title" label="名称" rules={[{ required: true, message: '请输入智能体名称' }]}>
            <Input placeholder="如：Python 编程导师" maxLength={40} />
          </Form.Item>
          <Form.Item name="description" label="描述（可选）">
            <Input placeholder="如：擅长讲解 Python 并给出示例" maxLength={80} />
          </Form.Item>
          <Form.Item name="model" label="模型" initialValue={model}>
            <ModelSelector style={{ width: "100%" }} mode="chat" />
          </Form.Item>
          <Form.Item name="mode" label="对话模式" initialValue="qa">
            <Select options={[
              { label: '问答模式', value: 'qa' },
              { label: '计划模式', value: 'plan' },
              { label: '直接执行', value: 'execute' },
            ]} />
          </Form.Item>
          <Form.Item
            name="systemPrompt"
            label="系统提示词"
            rules={[{ required: true, message: '请设定智能体的角色与行为规范' }]}
            extra="定义该智能体的身份、擅长领域与回答风格，对话时自动生效。"
          >
            <Input.TextArea
              rows={4}
              placeholder="例如：你是一位资深的 Python 编程导师，讲解清晰、循序渐进，多用示例说明。"
            />
          </Form.Item>
        </Form>
      </Modal>

      <style>{`
        .chat-container {
          display: flex; height: calc(100vh - 88px); overflow: hidden;
          background: #fff; border-radius: 0; margin: -24px;
        }

        .chat-main {
          flex: 1; display: flex; flex-direction: column; min-width: 0;
          background: linear-gradient(180deg, #fff 0%, #fafbfe 100%);
        }

        .chat-topbar {
          display: flex; justify-content: space-between; align-items: center;
          padding: 10px 16px; border-bottom: 1px solid #eef1f5;
          background: #fff;
        }
        .mode-indicator { display: flex; align-items: center; }

        .chat-messages {
          flex: 1; overflow-y: auto; padding: 16px 20px;
          scroll-behavior: smooth;
        }
        .message-list {
          max-width: 800px; margin: 0 auto;
          display: flex; flex-direction: column; gap: 4px;
        }

        .chat-empty {
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          height: 100%; text-align: center; padding: 40px 20px;
        }
        .empty-icon {
          width: 80px; height: 80px; border-radius: 50%;
          background: linear-gradient(135deg, #f0f4ff, #eef2ff);
          display: flex; align-items: center; justify-content: center; margin-bottom: 4px;
        }
        .quick-tags {
          display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; margin-top: 16px;
          max-width: 420px;
        }

        .loading-indicator {
          display: flex; gap: 6px; padding: 8px 0 8px 44px; align-items: center;
        }
        .loading-dot {
          width: 6px; height: 6px; background: #a5b4fc; border-radius: 50%;
          animation: dotPulse 1.2s ease-in-out infinite;
        }
        .loading-dot:nth-child(2) { animation-delay: 0.2s; }
        .loading-dot:nth-child(3) { animation-delay: 0.4s; }
        @keyframes dotPulse {
          0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
          40% { opacity: 1; transform: scale(1); }
        }

        .chat-right-panel {
          width: 300px; padding: 16px; border-left: 1px solid #eef1f5;
          background: #fff; overflow-y: auto;
        }
        .panel-value {
          font-size: 15px; font-weight: 500; color: #1e293b; margin-top: 2px;
        }

        /* 滚动条美化 */
        .chat-messages::-webkit-scrollbar,
        .chat-right-panel::-webkit-scrollbar {
          width: 5px;
        }
        .chat-messages::-webkit-scrollbar-thumb,
        .chat-right-panel::-webkit-scrollbar-thumb {
          background: #d4d8e0; border-radius: 3px;
        }

        @media (max-width: 1023px) {
          .chat-container { margin: -16px; border-radius: 0; }
          .chat-right-panel { display: none; }
          .chat-messages { padding: 12px; }
        }
        @media (max-width: 768px) {
          .chat-container { height: calc(100vh - 64px); }
          .chat-topbar { padding: 8px; }
          .mode-indicator { display: none; }
        }
      `}</style>
    </div>
  );
}




