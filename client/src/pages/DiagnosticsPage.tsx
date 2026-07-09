import React, { useEffect, useState } from 'react';
import { Card, Typography, Tag, List, Progress, Alert, Button, Space } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined, ReloadOutlined, DashboardOutlined } from '@ant-design/icons';
import { diagnosticsAPI } from '@/services/api';

const { Title, Text, Paragraph } = Typography;

interface Check { key: string; label: string; ok: boolean; tip: string; }
interface MediaP { name: string; label: string; configured: boolean; }

const DiagnosticsPage: React.FC = () => {
  const [checks, setChecks] = useState<Check[]>([]);
  const [media, setMedia] = useState<MediaP[]>([]);
  const [mockMode, setMockMode] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const res: any = await diagnosticsAPI.check();
      const d = res.data || {};
      setChecks(d.checks || []);
      setMedia(d.mediaProviders || []);
      setMockMode(!!d.mockMode);
    } catch { /* ignore */ }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const okCount = checks.filter((c) => c.ok).length;
  const percent = checks.length ? Math.round((okCount / checks.length) * 100) : 0;

  return (
    <div>
      <Title level={3}><DashboardOutlined /> 部署自检 / 健康看板</Title>
      <Paragraph type="secondary">
        一键检测各项依赖与厂商集成状态（不泄露任何密钥明文），快速定位部署问题。
      </Paragraph>
      {mockMode && (
        <Alert type="info" showIcon style={{ marginBottom: 16 }}
          message="当前为 Mock 模式：无需任何 API Key 即可演示，AI 返回模拟结果。" />
      )}
      <Card title="集成状态" extra={<Button icon={<ReloadOutlined />} onClick={load} loading={loading}>刷新</Button>}>
        <Progress percent={percent} status={percent === 100 ? 'success' : 'active'} />
        <List
          loading={loading}
          dataSource={checks}
          renderItem={(c) => (
            <List.Item>
              <Space>
                {c.ok ? <CheckCircleOutlined style={{ color: '#52c41a' }} /> : <CloseCircleOutlined style={{ color: '#ff4d4f' }} />}
                <Text strong>{c.label}</Text>
                <Tag color={c.ok ? 'success' : 'error'}>{c.ok ? '正常' : '未配置'}</Tag>
                {!c.ok && c.tip && <Text type="secondary" style={{ fontSize: 12 }}>{c.tip}</Text>}
              </Space>
            </List.Item>
          )}
        />
      </Card>
      <Card title="媒体生成厂商" style={{ marginTop: 16 }}>
        <Space wrap>
          {media.map((m) => (
            <Tag key={m.name} color={m.configured ? 'blue' : 'default'}>
              {m.label} {m.configured ? '· 已接入' : '· 未接入(走Mock)'}
            </Tag>
          ))}
        </Space>
      </Card>
    </div>
  );
};

export default DiagnosticsPage;
