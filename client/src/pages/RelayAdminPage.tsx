import React, { useEffect, useState } from 'react';
import { Card, Typography, Tag, Button, Space, Table, Input, Select, message, Popconfirm } from 'antd';
import { ApiOutlined, ReloadOutlined, PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import apiClient from '@/services/api';

const { Title, Text, Paragraph } = Typography;

interface RelayChannel { _id?: string; name: string; baseURL: string; apiKey: string; models: string[]; weight: number; enabled: boolean; }
interface RelayToken { _id?: string; licenseId: string; token: string; quota: number; used: number; enabled: boolean; createdAt: string; }

const RelayAdminPage: React.FC = () => {
  const [channels, setChannels] = useState<RelayChannel[]>([]);
  const [tokens, setTokens] = useState<RelayToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [newChannel, setNewChannel] = useState({ name: '', baseURL: '', apiKey: '', models: '' });
  const [newLicense, setNewLicense] = useState({ licenseId: '', quota: '1000000' });
  const [generatedToken, setGeneratedToken] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const [ch, tk] = await Promise.all([
        apiClient.get('/relay/admin/channels'),
        apiClient.get('/relay/admin/tokens'),
      ]);
      setChannels((ch as any)?.data?.channels || []);
      setTokens((tk as any)?.data?.tokens || []);
    } catch { /* ignore */ }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const addChannel = async () => {
    if (!newChannel.name || !newChannel.baseURL || !newChannel.apiKey) return message.warning('请填写完整信息');
    await apiClient.post('/relay/admin/channels', {
      ...newChannel,
      models: newChannel.models.split(',').map((m: string) => m.trim()).filter(Boolean),
    });
    setNewChannel({ name: '', baseURL: '', apiKey: '', models: '' });
    message.success('渠道已添加');
    load();
  };

  const deleteChannel = async (id: string) => {
    await apiClient.delete('/relay/admin/channels/' + id);
    message.success('已删除');
    load();
  };

  const issueToken = async () => {
    if (!newLicense.licenseId) return message.warning('请输入 LicenseId');
    const res: any = await apiClient.post('/relay/admin/tokens', newLicense);
    setGeneratedToken(res?.data?.token || '');
    message.success('令牌已发放，请立即复制！');
    load();
  };

  const revokeToken = async (id: string) => {
    await apiClient.delete('/relay/admin/tokens/' + id);
    message.success('已吊销');
    load();
  };

  return (
    <div>
      <Title level={3}><ApiOutlined /> 中转站管理（金网通 AI 模型聚合网关）</Title>
      <Paragraph type="secondary">
        统一接入大模型厂商，按 License 额度分发给金网通客户端。对外接口：<Text code>https://aibak.site/api/relay/v1</Text>
      </Paragraph>

      <Card title="上游渠道" extra={<Button icon={<ReloadOutlined />} onClick={load} loading={loading}>刷新</Button>} style={{ marginBottom: 16 }}>
        <Space style={{ marginBottom: 12 }} wrap>
          <Input placeholder="渠道名称" value={newChannel.name} onChange={e => setNewChannel({...newChannel, name: e.target.value})} style={{ width: 140 }} />
          <Input placeholder="Base URL" value={newChannel.baseURL} onChange={e => setNewChannel({...newChannel, baseURL: e.target.value})} style={{ width: 240 }} />
          <Input.Password placeholder="API Key" value={newChannel.apiKey} onChange={e => setNewChannel({...newChannel, apiKey: e.target.value})} style={{ width: 200 }} />
          <Input placeholder="模型列表（逗号分隔）" value={newChannel.models} onChange={e => setNewChannel({...newChannel, models: e.target.value})} style={{ width: 220 }} />
          <Button type="primary" icon={<PlusOutlined />} onClick={addChannel}>添加渠道</Button>
        </Space>
        <Table dataSource={channels} rowKey="_id" size="small" pagination={false}
          columns={[
            { title: '名称', dataIndex: 'name', key: 'name' },
            { title: 'Base URL', dataIndex: 'baseURL', key: 'baseURL', ellipsis: true },
            { title: '模型', dataIndex: 'models', key: 'models', render: (v: string[]) => v?.map((m: string) => <Tag key={m}>{m}</Tag>) },
            { title: '权重', dataIndex: 'weight', key: 'weight' },
            { title: '状态', dataIndex: 'enabled', key: 'enabled', render: (v: boolean) => <Tag color={v ? 'green' : 'red'}>{v ? '启用' : '禁用'}</Tag> },
            { title: '操作', key: 'actions', render: (_: any, r: RelayChannel) => (
              <Popconfirm title="确定删除？" onConfirm={() => deleteChannel(r._id!)}><Button danger size="small" icon={<DeleteOutlined />} /></Popconfirm>
            )},
          ]}
        />
      </Card>

      <Card title="客户令牌" style={{ marginBottom: 16 }}>
        <Space style={{ marginBottom: 12 }} wrap>
          <Input placeholder="LicenseId" value={newLicense.licenseId} onChange={e => setNewLicense({...newLicense, licenseId: e.target.value})} style={{ width: 200 }} />
          <Input placeholder="配额（tokens）" value={newLicense.quota} onChange={e => setNewLicense({...newLicense, quota: e.target.value})} style={{ width: 140 }} />
          <Button type="primary" icon={<PlusOutlined />} onClick={issueToken}>发放令牌</Button>
        </Space>
        {generatedToken && (
          <Card size="small" style={{ background: '#fff3cd', border: '1px solid #ffc107', marginBottom: 12 }}>
            <Text strong style={{ color: '#856404' }}>新令牌（仅显示一次，请立即复制）：</Text>
            <Paragraph copyable code style={{ fontSize: 13 }}>{generatedToken}</Paragraph>
          </Card>
        )}
        <Table dataSource={tokens} rowKey="_id" size="small" pagination={false}
          columns={[
            { title: 'LicenseId', dataIndex: 'licenseId', key: 'licenseId' },
            { title: '配额', dataIndex: 'quota', key: 'quota', render: (v: number) => v?.toLocaleString() },
            { title: '已用', dataIndex: 'used', key: 'used', render: (v: number) => v?.toLocaleString() },
            { title: '状态', dataIndex: 'enabled', key: 'enabled', render: (v: boolean) => <Tag color={v ? 'green' : 'red'}>{v ? '有效' : '已吊销'}</Tag> },
            { title: '创建时间', dataIndex: 'createdAt', key: 'createdAt', render: (v: string) => v ? new Date(v).toLocaleString('zh-CN') : '-' },
            { title: '操作', key: 'actions', render: (_: any, r: RelayToken) => (
              <Popconfirm title="确定吊销？" onConfirm={() => revokeToken(r._id!)}><Button danger size="small">吊销</Button></Popconfirm>
            )},
          ]}
        />
      </Card>
    </div>
  );
};

export default RelayAdminPage;
