import { useState } from 'react';
import { Modal, Input, Select, Button, Spin, Typography, Space, Tag, Divider } from 'antd';
import { ThunderboltOutlined, SwapOutlined, CheckOutlined } from '@ant-design/icons';
import { aiAPI } from '@/services/api';

const { TextArea } = Input;
const { Text, Title } = Typography;

interface Props {
  open: boolean;
  onClose: () => void;
  originalPrompt: string;
  onApply: (optimized: string) => void;
}

const OPTIMIZE_DIRECTIONS = [
  { value: 'detailed', label: '更详细', desc: '补充上下文和示例细节' },
  { value: 'concise', label: '更简洁', desc: '精简到核心要点' },
  { value: 'professional', label: '更专业', desc: '使用专业术语和正式表达' },
  { value: 'creative', label: '更有创意', desc: '增加创意角度和新思路' },
  { value: 'structured', label: '更结构化', desc: '分点组织，逻辑清晰' },
  { value: 'role_based', label: '角色扮演', desc: '赋予AI特定角色视角' },
];

export default function PromptOptimizer({ open, onClose, originalPrompt, onApply }: Props) {
  const [direction, setDirection] = useState('detailed');
  const [optimized, setOptimized] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleOptimize = async () => {
    if (!originalPrompt.trim()) {
      setError('请输入原始提示词');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res: any = await aiAPI.chat({
        message: `请根据"${OPTIMIZE_DIRECTIONS.find(d => d.value === direction)?.label}"的方向，优化以下提示词。只返回优化后的提示词，不要添加其他解释：

${originalPrompt}`,
        model: 'agnes/agnes-2.0-flash',
      });
      setOptimized(res?.message || '（优化失败，请重试）');
    } catch (err: any) {
      setError(err?.response?.data?.message || '优化失败，请检查网络和API配置');
    } finally {
      setLoading(false);
    }
  };

  const handleApply = () => {
    onApply(optimized);
    onClose();
  };

  const selectedDirection = OPTIMIZE_DIRECTIONS.find(d => d.value === direction);

  return (
    <Modal
      title={
        <Space>
          <ThunderboltOutlined style={{ color: '#8b5cf6' }} />
          <span>AI 提示词优化</span>
        </Space>
      }
      open={open}
      onCancel={onClose}
      width={640}
      footer={null}
      destroyOnClose
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* 优化方向 */}
        <div>
          <Text type="secondary" style={{ fontSize: 12, marginBottom: 6, display: 'block' }}>
            选择优化方向
          </Text>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {OPTIMIZE_DIRECTIONS.map((d) => (
              <Tag
                key={d.value}
                color={direction === d.value ? '#8b5cf6' : undefined}
                style={{
                  cursor: 'pointer',
                  padding: '4px 12px',
                  borderRadius: 16,
                  border: direction === d.value ? 'none' : '1px solid #d9d9d9',
                }}
                onClick={() => setDirection(d.value)}
              >
                {d.label}
              </Tag>
            ))}
          </div>
          {selectedDirection && (
            <Text type="secondary" style={{ fontSize: 12, marginTop: 4, display: 'block' }}>
              💡 {selectedDirection.desc}
            </Text>
          )}
        </div>

        <Divider style={{ margin: 0 }} />

        {/* 原始提示词 */}
        <div>
          <Text strong style={{ fontSize: 12 }}>原始提示词</Text>
          <TextArea
            value={originalPrompt}
            readOnly
            rows={3}
            style={{ marginTop: 4, background: '#f8f9fa', fontSize: 13 }}
          />
        </div>

        <Button
          type="primary"
          icon={<ThunderboltOutlined />}
          onClick={handleOptimize}
          loading={loading}
          block
          style={{
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            border: 'none',
            height: 38,
          }}
        >
          一键优化
        </Button>

        {error && <Text type="danger" style={{ fontSize: 13 }}>{error}</Text>}

        {/* 优化结果 */}
        {optimized && (
          <>
            <Divider style={{ margin: 0 }} />
            <div style={{
              background: 'linear-gradient(135deg, #f0f4ff, #eef2ff)',
              borderRadius: 10,
              padding: 14,
              border: '1px solid #c7d2fe',
            }}>
              <Space style={{ marginBottom: 8 }}>
                <ThunderboltOutlined style={{ color: '#8b5cf6' }} />
                <Text strong style={{ fontSize: 12, color: '#4f46e5' }}>优化结果</Text>
              </Space>
              <div style={{
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                fontSize: 14,
                lineHeight: 1.6,
                color: '#334155',
              }}>
                {optimized}
              </div>
            </div>
            <Space style={{ justifyContent: 'flex-end', width: '100%' }}>
              <Button onClick={() => setOptimized('')}>重新优化</Button>
              <Button
                type="primary"
                icon={<CheckOutlined />}
                onClick={handleApply}
              >
                应用并发送
              </Button>
            </Space>
          </>
        )}
      </div>
    </Modal>
  );
}
