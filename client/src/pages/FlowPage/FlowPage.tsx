import React, { useState, useEffect } from 'react';
import { Card, Button, message, Typography, Space, Statistic, Row, Col } from 'antd';
import { SyncOutlined, CloudUploadOutlined } from '@ant-design/icons';
import { apiClient, extractApiError } from '@/services/api';

const { Title, Text, Paragraph } = Typography;

interface FlowStatus {
  plan: string;
  canAutoSync: boolean;
  canMultiVault: boolean;
  dailyLimit: number;
  availableSources: number;
  usedToday: number;
  remainingToday: number;
}

interface SyncResult {
  status: string;
  category: string;
  copied: number;
  updated: number;
  index: string;
}

const FlowPage: React.FC = () => {
  const [status, setStatus] = useState<FlowStatus | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<SyncResult | null>(null);

  useEffect(() => {
    loadStatus();
  }, []);

  const loadStatus = async () => {
    try {
      const res: any = await apiClient.get('/flow/status');
      setStatus(res.data);
    } catch (e) {
      message.error(extractApiError(e, '加载 Flow 状态失败'));
    }
  };

  const handleSync = async () => {
    try {
      setSyncing(true);
      const res: any = await apiClient.post('/flow/sync');
      setLastSync(res.data);
      message.success('同步成功');
      loadStatus();
    } catch (e) {
      message.error(extractApiError(e, '同步失败'));
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '24px 16px' }}>
      <Title level={2}>NexMind Flow</Title>
      <Paragraph>
        知识库同步管理页面，可用于触发同步、查看同步状态与结果。
      </Paragraph>

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic title="当前套餐" value={status?.plan?.toUpperCase() || '-'} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="今日同步次数"
              value={`${status?.usedToday || 0} / ${status?.dailyLimit || 0}`}
              suffix="次"
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="自动同步" value={status?.canAutoSync ? '已启用' : '未启用'} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="多库同步" value={status?.canMultiVault ? '已启用' : '未启用'} />
          </Card>
        </Col>
      </Row>

      <Card style={{ marginBottom: 16 }}>
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <Title level={4} style={{ margin: 0 }}>手动同步</Title>
              <Text type="secondary">将当前 AI 产出归档到知识库</Text>
            </div>
            <Button
              type="primary"
              icon={<SyncOutlined />}
              loading={syncing}
              onClick={handleSync}
              disabled={!status || status.availableSources === 0 || status.remainingToday === 0}
            >
              立即同步
            </Button>
          </div>

          {status && status.availableSources === 0 ? (
            <Text type="secondary">暂无可同步内容，请先导出 AI 对话或知识库内容。</Text>
          ) : null}

          {lastSync && (
            <Card type="inner" title="最近一次同步结果">
              <p><strong>状态：</strong>{lastSync.status}</p>
              <p><strong>分类：</strong>{lastSync.category}</p>
              <p><strong>新增：</strong>{lastSync.copied}</p>
              <p><strong>更新：</strong>{lastSync.updated}</p>
              <p><strong>索引：</strong>{lastSync.index}</p>
            </Card>
          )}
        </Space>
      </Card>

      <Card>
        <Space direction="vertical">
          <Title level={4}>功能说明</Title>
          <Text>• 支持手动触发知识同步</Text>
          <Text>• 支持查看当前订阅能力</Text>
          <Text>• 后续可扩展自动同步、多库同步等高级能力</Text>
        </Space>
      </Card>
    </div>
  );
};

export default FlowPage;
