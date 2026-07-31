import React from 'react';
import { Card, Typography, Button, Space } from 'antd';
import { BulbOutlined, CloseOutlined, RightOutlined, SafetyOutlined, ClockCircleOutlined, TeamOutlined, CustomerServiceOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

const { Text } = Typography;

interface Tip {
  type: 'value' | 'objection' | 'urgency' | 'social_proof' | 'guide';
  title: string;
  content: string;
  action?: { text: string; path: string };
}

const iconMap: Record<string, React.ReactNode> = {
  value: <BulbOutlined style={{ color: '#6366f1' }} />,
  objection: <SafetyOutlined style={{ color: '#10b981' }} />,
  urgency: <ClockCircleOutlined style={{ color: '#f59e0b' }} />,
  social_proof: <TeamOutlined style={{ color: '#06b6d4' }} />,
  guide: <CustomerServiceOutlined style={{ color: '#8b5cf6' }} />,
};

const typeColor: Record<string, string> = {
  value: '#6366f1', objection: '#10b981', urgency: '#f59e0b',
  social_proof: '#06b6d4', guide: '#8b5cf6',
};

export const SalesCoach: React.FC<{
  tips: Tip[]; visible: boolean; onDismiss: () => void; productName?: string;
}> = ({ tips, visible, onDismiss, productName }) => {
  const nav = useNavigate();
  if (!visible || !tips.length) return null;

  return (
    <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 1000, maxWidth: 360 }}>
      <Card size="small" style={{ borderRadius: 14, boxShadow: '0 8px 32px rgba(0,0,0,0.15)' }}
        title={<Space><BulbOutlined style={{ color: '#faad14' }} /><Text strong style={{ fontSize: 14 }}>{productName ? `关于${productName}` : '智能建议'}</Text></Space>}
        extra={<Button type="text" size="small" icon={<CloseOutlined />} onClick={onDismiss} />}>
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          {tips.map((tip, i) => (
            <div key={i} style={{ padding: 12, borderRadius: 10, background: `${typeColor[tip.type] || '#6366f1'}08`, border: `1px solid ${typeColor[tip.type] || '#6366f1'}20` }}>
              <Space align="start" size={8}>
                <span style={{ marginTop: 2 }}>{iconMap[tip.type] || <BulbOutlined />}</span>
                <div style={{ flex: 1 }}>
                  <Text strong style={{ fontSize: 13, display: 'block', marginBottom: 4 }}>{tip.title}</Text>
                  <Text style={{ fontSize: 12, color: '#64748b', lineHeight: 1.6 }}>{tip.content}</Text>
                  {tip.action && (
                    <Button type="link" size="small" onClick={() => { onDismiss(); nav(tip.action!.path); }} style={{ padding: 0, fontSize: 12, marginTop: 4, height: 'auto' }}>
                      {tip.action.text} <RightOutlined style={{ fontSize: 10 }} />
                    </Button>
                  )}
                </div>
              </Space>
            </div>
          ))}
        </Space>
      </Card>
    </div>
  );
};