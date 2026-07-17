import { useCallback, useState } from 'react';
import { Button, Input, List, Typography, Space, Tag, Popconfirm, Badge, Tooltip } from 'antd';
import {
  PlusOutlined, MessageOutlined, DeleteOutlined,
  EditOutlined, QuestionCircleOutlined, OrderedListOutlined,
  ThunderboltOutlined, FileOutlined, ClockCircleOutlined, RobotOutlined,
} from '@ant-design/icons';
import { useChatStore, ChatMode } from '@/stores/chat';

const { Text } = Typography;

const modeConfig: Record<ChatMode, { label: string; icon: React.ReactNode; color: string; desc: string }> = {
  qa: { label: '问答模式', icon: <QuestionCircleOutlined />, color: '#6366f1', desc: '一问一答，获取精准答案' },
  plan: { label: '计划模式', icon: <OrderedListOutlined />, color: '#f59e0b', desc: 'AI 先规划步骤，再逐步执行' },
  execute: { label: '直接执行', icon: <ThunderboltOutlined />, color: '#10b981', desc: '跳过规划，直接操作工具执行' },
};

export default function ChatSidebar({ onOpenCreateAgent }: { onOpenCreateAgent?: () => void }) {
  const {
    sessions, activeSessionId, mode, createSession,
    switchSession, deleteSession, renameSession, setMode,
  } = useChatStore();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');

  const handleNewSession = useCallback(() => {
    createSession();
  }, [createSession]);

  const handleStartRename = useCallback((id: string, title: string) => {
    setEditingId(id);
    setEditTitle(title);
  }, []);

  const handleFinishRename = useCallback(() => {
    if (editingId && editTitle.trim()) {
      renameSession(editingId, editTitle.trim());
    }
    setEditingId(null);
    setEditTitle('');
  }, [editingId, editTitle, renameSession]);

  // 按时间分组会话
  const today = sessions.filter((s) => Date.now() - s.createdAt < 86400000);
  const yesterday = sessions.filter(
    (s) => Date.now() - s.createdAt >= 86400000 && Date.now() - s.createdAt < 172800000
  );
  const older = sessions.filter((s) => Date.now() - s.createdAt >= 172800000);

  return (
    <div className="chat-sidebar">
      {/* 新建对话 / 创建智能体 */}
      <div style={{ padding: '12px' }}>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          block
          onClick={handleNewSession}
          style={{
            borderRadius: 10,
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            border: 'none',
            height: 40,
          }}
        >
          新建对话
        </Button>
        <Button
          block
          icon={<RobotOutlined />}
          onClick={onOpenCreateAgent}
          style={{ marginTop: 8, borderRadius: 10, height: 40 }}
        >
          创建智能体
        </Button>
      </div>

      {/* 模式切换 */}
      <div style={{ padding: '0 12px 12px' }}>
        <Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 }}>
          对话模式
        </Text>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 6 }}>
          {(Object.keys(modeConfig) as ChatMode[]).map((m) => (
            <Tooltip key={m} title={modeConfig[m].desc} placement="right">
              <div
                className={`mode-item ${mode === m ? 'active' : ''}`}
                onClick={() => setMode(m)}
              >
                <span className="mode-icon" style={{ color: modeConfig[m].color }}>
                  {modeConfig[m].icon}
                </span>
                <span className="mode-label">{modeConfig[m].label}</span>
                {mode === m && <Badge status="processing" style={{ marginLeft: 'auto' }} />}
              </div>
            </Tooltip>
          ))}
        </div>
      </div>

      {/* 历史会话 */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '0 12px 8px' }}>
          <Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 }}>
            历史会话
          </Text>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 4px' }}>
          {renderSessionGroup('今天', today)}
          {renderSessionGroup('昨天', yesterday)}
          {renderSessionGroup('更早', older)}
          {sessions.length === 0 && (
            <div style={{ textAlign: 'center', padding: 24, color: '#94a3b8' }}>
              <MessageOutlined style={{ fontSize: 24, marginBottom: 8 }} />
              <div style={{ fontSize: 12 }}>暂无会话</div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        .chat-sidebar {
          width: 280px; height: 100%; display: flex; flex-direction: column;
          background: #fafbfc; border-right: 1px solid #eef1f5;
        }
        .mode-item {
          display: flex; align-items: center; gap: 8px;
          padding: 8px 12px; border-radius: 8px; cursor: pointer;
          font-size: 13px; transition: all 0.2s;
        }
        .mode-item:hover { background: #f0f4ff; }
        .mode-item.active { background: #eef2ff; font-weight: 600; }
        .mode-icon { font-size: 16px; }
        .mode-label { color: #334155; }
        .session-item {
          padding: 8px 12px; border-radius: 8px; cursor: pointer;
          font-size: 13px; display: flex; align-items: center; justify-content: space-between;
          transition: all 0.2s; margin: 2px 4px;
        }
        .session-item:hover { background: #f0f4ff; }
        .session-item.active { background: #eef2ff; font-weight: 500; }
      `}</style>
    </div>
  );

  function renderSessionGroup(title: string, list: typeof sessions) {
    if (list.length === 0) return null;
    return (
      <div style={{ marginBottom: 8 }}>
        <Text type="secondary" style={{ fontSize: 11, padding: '0 12px 2px', display: 'block' }}>
          {title}
        </Text>
        {list.map((s) => (
          <div
            key={s.id}
            className={`session-item ${s.id === activeSessionId ? 'active' : ''}`}
            onClick={() => switchSession(s.id)}
          >
            {editingId === s.id ? (
              <Input
                size="small"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                onPressEnter={handleFinishRename}
                onBlur={handleFinishRename}
                autoFocus
                style={{ flex: 1, fontSize: 13 }}
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {s.title}
              </span>
            )}
            {editingId !== s.id && (
              <Space size={2} style={{ opacity: 0, transition: 'opacity 0.2s' }} className="session-actions">
                <Button
                  type="text" size="small"
                  icon={<EditOutlined style={{ fontSize: 11 }} />}
                  onClick={(e) => { e.stopPropagation(); handleStartRename(s.id, s.title); }}
                />
                <Popconfirm
                  title="删除此会话？"
                  onConfirm={(e) => { e?.stopPropagation(); deleteSession(s.id); }}
                  onCancel={(e) => e?.stopPropagation()}
                >
                  <Button
                    type="text" size="small" danger
                    icon={<DeleteOutlined style={{ fontSize: 11 }} />}
                    onClick={(e) => e.stopPropagation()}
                  />
                </Popconfirm>
              </Space>
            )}
          </div>
        ))}
      </div>
    );
  }
}
