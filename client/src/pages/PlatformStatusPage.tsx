import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Card, Col, Empty, Progress, Row, Space, Spin, Tag, Typography } from 'antd';
import { CheckCircleOutlined, CloudServerOutlined, HomeOutlined, ReloadOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import axios from 'axios';

const { Title, Text } = Typography;
const PUBLIC_STATUS_URL = import.meta.env.VITE_NEXMIND_PUBLIC_STATUS_URL || '/api/ops/public-status';

type PublicStatus = {
  service: { status: string; label: string };
  availability: { healthy: boolean; label: string };
  route: { target: string; label: string };
  nodes: { local: string; cloud: string };
  modules: Array<{ id: string; name: string; status: string; latencyMs?: number }>;
  incidents: Array<{ time: string; message: string }>;
  checkedAt: string;
  refreshAfterSeconds: number;
  dataSource: string;
  brand: { name: string; subtitle: string };
};

function nodeLabel(value: string) {
  if (value === 'operational') return '运行正常';
  if (value === 'degraded') return '部分异常';
  return '未公开探测';
}

export default function PlatformStatusPage() {
  const [data, setData] = useState<PublicStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    try {
      const response = await axios.get(PUBLIC_STATUS_URL, { timeout: 12000, params: { t: Date.now() } });
      setData(response.data?.data ?? null);
      setError('');
    } catch {
      setError('状态服务暂时不可用，请稍后刷新。');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const timer = window.setInterval(load, 15000);
    return () => window.clearInterval(timer);
  }, []);

  const percent = useMemo(() => (data?.availability.healthy ? 100 : 0), [data]);
  if (loading && !data) return <Spin style={{ display: 'block', margin: '80px auto' }} />;

  return (
    <div style={{ maxWidth: 1120, margin: '0 auto', padding: '28px 16px 60px' }}>
      <Space direction="vertical" size={20} style={{ width: '100%' }}>
        <div style={{ textAlign: 'center' }}>
          <SafetyCertificateOutlined style={{ fontSize: 38, color: '#6366f1' }} />
          <Title level={2} style={{ margin: '10px 0 4px' }}>NexMind by AIbak 平台状态</Title>
          <Text type="secondary">NexMind 实时运行状态 · 客户只读视图</Text>
        </div>
        {error && <Alert type="warning" showIcon message={error} />}
        {data ? <>
          <Card bordered={false} style={{ background: data.service.status === 'operational' ? '#f6ffed' : '#fff7e6' }}>
            <Row align="middle" gutter={[24, 16]}>
              <Col xs={24} md={5} style={{ textAlign: 'center' }}><Progress type="circle" percent={percent} status={percent === 100 ? 'success' : 'exception'} /></Col>
              <Col xs={24} md={13}><Title level={3} style={{ margin: 0 }}>{data.service.label}</Title><Text>{data.availability.label}</Text><div style={{ marginTop: 10 }}><Tag color={data.route.target === 'local' ? 'green' : 'blue'}>{data.route.label}</Tag><Text type="secondary">最近检查：{new Date(data.checkedAt).toLocaleString('zh-CN')}</Text></div></Col>
              <Col xs={24} md={6} style={{ textAlign: 'right' }}><Text type="secondary">自动刷新</Text><Title level={4} style={{ margin: '4px 0' }}>{data.refreshAfterSeconds} 秒</Title></Col>
            </Row>
          </Card>
          <Row gutter={[16, 16]}>
            <Col xs={24} md={12}><Card title={<><HomeOutlined /> 本地节点</>}><Tag color={data.nodes.local === 'operational' ? 'green' : data.nodes.local === 'unknown' ? 'blue' : 'red'} icon={<CheckCircleOutlined />}>{nodeLabel(data.nodes.local)}</Tag><Text type="secondary" style={{ marginLeft: 10 }}>公开页仅展示安全摘要，不暴露内部地址</Text></Card></Col>
            <Col xs={24} md={12}><Card title={<><CloudServerOutlined /> 云端备用节点</>}><Tag color={data.nodes.cloud === 'operational' ? 'green' : data.nodes.cloud === 'unknown' ? 'blue' : 'red'} icon={<CheckCircleOutlined />}>{nodeLabel(data.nodes.cloud)}</Tag><Text type="secondary" style={{ marginLeft: 10 }}>云端状态由生产入口配置决定</Text></Card></Col>
          </Row>
          <Card title="公开服务模块"><Row gutter={[12, 12]}>{data.modules.map((module) => <Col xs={12} sm={8} md={6} key={module.id}><Card size="small" style={{ height: '100%' }}><Text strong>{module.name}</Text><div style={{ marginTop: 8 }}><Tag color={module.status === 'operational' ? 'green' : 'orange'}>{module.status === 'operational' ? '正常' : '部分异常'}</Tag>{Number.isFinite(module.latencyMs) && <Text type="secondary">{module.latencyMs}ms</Text>}</div></Card></Col>)}</Row></Card>
          {data.incidents.length > 0 && <Alert type="info" showIcon message="近期状态提醒" description={data.incidents[0].message} />}
          <Text type="secondary" style={{ display: 'block', textAlign: 'center' }}><ReloadOutlined /> 数据源：{data.dataSource} · 页面不展示内部服务器、仓库和运维控制信息</Text>
        </> : <Empty description="暂无状态数据" />}
      </Space>
    </div>
  );
}
