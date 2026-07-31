// client/src/pages/PublicMetricsPage.tsx
//
// Public, read-only metrics page (Phase B) — social proof for marketing.
// Pulls ONLY from /api/ops/public (anonymous subset, no sensitive data).
//
// Route: /metrics  (register in client/src/router.tsx, see router.patch.tsx)

import React, { useEffect, useState } from 'react';
import { Card, Row, Col, Statistic, Spin, Alert, Typography, Space } from 'antd';
import { ThunderboltOutlined } from '@ant-design/icons';
import axios from 'axios';
import { extractApiError } from '@/services/api';

const { Title, Text } = Typography;

interface PublicMetrics {
  totalCreators: number;
  weeklyActiveCreators: number;
  serviceOnline: boolean;
}

export default function PublicMetricsPage() {
  const [data, setData] = useState<PublicMetrics | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    axios
      .get('/api/ops/public')
      .then((r) => setData(r.data?.data ?? null))
      .catch((e) => setErr(extractApiError(e, '数据加载失败')));
  }, []);

  if (err) return <Alert type="warning" showIcon message={err} style={{ margin: 16 }} />;
  if (!data) return <Spin style={{ display: 'block', margin: '60px auto' }} />;

  return (
    <div style={{ textAlign: 'center', padding: 16 }}>
      <Space direction="vertical" size="large">
        <div>
          <ThunderboltOutlined style={{ fontSize: 32, color: '#6c5ce7' }} />
          <Title level={3} style={{ marginTop: 8 }}>AIbak 平台实时数据</Title>
          <Text type="secondary">数据每周更新 · 来自平台真实运营</Text>
        </div>
        <Row gutter={[16, 16]} justify="center">
          <Col xs={24} sm={8}>
            <Card>
              <Statistic title="累计创作者" value={data.totalCreators} />
            </Card>
          </Col>
          <Col xs={24} sm={8}>
            <Card>
              <Statistic title="本周活跃创作者" value={data.weeklyActiveCreators} />
            </Card>
          </Col>
          <Col xs={24} sm={8}>
            <Card>
              <Statistic title="服务状态" value={data.serviceOnline ? '在线' : '维护中'} valueStyle={{ color: data.serviceOnline ? '#00b894' : '#e17055' }} />
            </Card>
          </Col>
        </Row>
      </Space>
    </div>
  );
}
