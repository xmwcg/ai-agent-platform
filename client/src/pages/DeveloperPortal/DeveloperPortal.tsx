/**
 * NexMind 开发者门户 — API Key 自服务 + API 文档 + 用量仪表盘
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Card, Button, Input, Table, Tag, message, Modal, Typography, Space, Tabs, Tooltip, Divider, Statistic, Row, Col } from 'antd';
import { KeyOutlined, CopyOutlined, DeleteOutlined, PlusOutlined, ApiOutlined, BookOutlined, BarChartOutlined } from '@ant-design/icons';
import { apiClient, extractApiError } from '@/services/api';

const { Title, Text, Paragraph } = Typography;

interface ApiKeyInfo {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  quotaDaily: number;
  usedToday: number;
  creditsEnabled: boolean;
  createdAt: string;
  status: string;
}

const DeveloperPortal: React.FC = () => {
  const [keys, setKeys] = useState<ApiKeyInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyPlain, setNewKeyPlain] = useState('');
  const [newKeyModalOpen, setNewKeyModalOpen] = useState(false);

  const loadKeys = useCallback(async () => {
    setLoading(true);
    try {
      const res: any = await apiClient.get('/keys');
      setKeys(res.data || []);
    } catch (e) {
      message.error(extractApiError(e, '加载 API Key 失败'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadKeys(); }, [loadKeys]);

  const createKey = async () => {
    if (!newKeyName.trim()) return;
    try {
      const res: any = await apiClient.post('/keys', { name: newKeyName, scopes: ['chat'], quotaDaily: 1000 });
      setNewKeyPlain(res.data.apiKey);
      setCreateModalOpen(false);
      setNewKeyModalOpen(true);
      loadKeys();
    } catch (e) {
      message.error(extractApiError(e, '创建失败'));
    }
  };

  const revokeKey = async (id: string) => {
    Modal.confirm({
      title: '确认吊销此 API Key？',
      content: '吊销后将无法恢复，所有使用该 Key 的请求将被拒绝。',
      onOk: async () => {
        await apiClient.delete(`/keys/${id}`);
        message.success('已吊销');
        loadKeys();
      },
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => message.success('已复制'));
  };

  const columns = [
    { title: '名称', dataIndex: 'name', key: 'name' },
    {
      title: 'Key', dataIndex: 'prefix', key: 'prefix',
      render: (prefix: string) => <code>{prefix}****</code>,
    },
    {
      title: '权限', dataIndex: 'scopes', key: 'scopes',
      render: (scopes: string[]) => scopes.map((s) => <Tag key={s} color="blue">{s}</Tag>),
    },
    {
      title: '今日用量', key: 'usage',
      render: (_: any, record: ApiKeyInfo) => (
        <span>{record.usedToday} / {record.quotaDaily}</span>
      ),
    },
    { title: '创建时间', dataIndex: 'createdAt', key: 'createdAt', render: (d: string) => new Date(d).toLocaleDateString() },
    {
      title: '操作', key: 'actions',
      render: (_: any, record: ApiKeyInfo) => (
        <Button type="link" danger icon={<DeleteOutlined />} onClick={() => revokeKey(record.id)}>吊销</Button>
      ),
    },
  ];

  const apiDocsContent = (
    <div>
      <Title level={4}>NexMind API 快速开始</Title>
      <Paragraph>
        使用任一 OpenAI 兼容客户端接入 NexMind 开放 API。
      </Paragraph>
      <Divider />
      <Title level={5}>基础调用</Title>
      <pre style={{ background: '#0F172A', color: '#E2E8F0', padding: 16, borderRadius: 8, overflow: 'auto' }}>
{`curl https://aibak.site/api/relay/v1/chat/completions \\
  -H "Authorization: Bearer <YOUR_API_KEY>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "agnes-2.5-flash",
    "messages": [{"role": "user", "content": "你好"}]
  }'`}
      </pre>
      <Divider />
      <Title level={5}>Python SDK</Title>
      <pre style={{ background: '#0F172A', color: '#E2E8F0', padding: 16, borderRadius: 8, overflow: 'auto' }}>
{`from openai import OpenAI

client = OpenAI(
    api_key="<YOUR_API_KEY>",
    base_url="https://aibak.site/api/relay/v1"
)

response = client.chat.completions.create(
    model="agnes-2.5-flash",
    messages=[{"role": "user", "content": "你好"}]
)
print(response.choices[0].message.content)`}
      </pre>
      <Divider />
      <Title level={5}>可用模型</Title>
      <Table
        dataSource={[
          { model: 'agnes-2.5-flash', provider: 'Agnes AI 2.5', pricing: '免费', tier: '免费（默认）' },
          { model: 'deepseek-v4-flash', provider: 'DeepSeek', pricing: '按厂商配置', tier: '可选' },
          { model: 'glm-4-flash', provider: '智谱 AI', pricing: '免费', tier: '免费' },
          { model: 'qwen-turbo', provider: '阿里百炼', pricing: '¥0.3/¥0.6 per M tokens', tier: '付费' },
          { model: 'qwen-plus', provider: '阿里百炼', pricing: '¥0.8/¥2 per M tokens', tier: '付费' },
        ]}
        columns={[
          { title: '模型', dataIndex: 'model', key: 'model' },
          { title: '厂商', dataIndex: 'provider', key: 'provider' },
          { title: '定价', dataIndex: 'pricing', key: 'pricing' },
          { title: '级别', dataIndex: 'tier', key: 'tier', render: (t: string) => <Tag color={t === '免费' ? 'green' : 'blue'}>{t}</Tag> },
        ]}
        pagination={false}
        size="small"
      />
    </div>
  );

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '24px 16px' }}>
      <Title level={2}><ApiOutlined /> NexMind 开发者门户</Title>
      <Paragraph type="secondary">管理你的 API Key，查阅 API 文档，查看用量统计。</Paragraph>

      <Tabs
        defaultActiveKey="keys"
        items={[
          {
            key: 'keys',
            label: <span><KeyOutlined /> API Key</span>,
            children: (
              <Card
                extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalOpen(true)}>创建 Key</Button>}
              >
                <Table
                  dataSource={keys}
                  columns={columns}
                  loading={loading}
                  rowKey="id"
                  pagination={false}
                  locale={{ emptyText: '暂无 API Key，点击上方按钮创建' }}
                />
              </Card>
            ),
          },
          {
            key: 'docs',
            label: <span><BookOutlined /> API 文档</span>,
            children: <Card>{apiDocsContent}</Card>,
          },
          {
            key: 'usage',
            label: <span><BarChartOutlined /> 用量概览</span>,
            children: (
              <Card>
                <Row gutter={16}>
                  <Col span={8}>
                    <Statistic title="API Key 数量" value={keys.length} suffix="个" />
                  </Col>
                  <Col span={8}>
                    <Statistic
                      title="今日总调用"
                      value={keys.reduce((sum, k) => sum + k.usedToday, 0)}
                      suffix="次"
                    />
                  </Col>
                  <Col span={8}>
                    <Statistic title="日配额上限" value={keys[0]?.quotaDaily || 1000} suffix="次/天" />
                  </Col>
                </Row>
              </Card>
            ),
          },
        ]}
      />

      {/* 创建 Key 弹窗 */}
      <Modal
        title="创建 API Key"
        open={createModalOpen}
        onOk={createKey}
        onCancel={() => setCreateModalOpen(false)}
        okText="创建"
      >
        <Input
          placeholder="给 Key 起个名字（如：我的应用）"
          value={newKeyName}
          onChange={(e) => setNewKeyName(e.target.value)}
        />
      </Modal>

      {/* 新 Key 展示弹窗（只展示一次明文） */}
      <Modal
        title="API Key 创建成功"
        open={newKeyModalOpen}
        onOk={() => setNewKeyModalOpen(false)}
        onCancel={() => setNewKeyModalOpen(false)}
        okText="我已复制保存"
      >
        <Paragraph type="warning" strong>
          ⚠️ 此 Key 仅显示一次，请立即复制保存！
        </Paragraph>
        <Input
          value={newKeyPlain}
          readOnly
          addonAfter={<Tooltip title="复制"><CopyOutlined onClick={() => copyToClipboard(newKeyPlain)} style={{ cursor: 'pointer' }} /></Tooltip>}
        />
      </Modal>
    </div>
  );
};

export default DeveloperPortal;
