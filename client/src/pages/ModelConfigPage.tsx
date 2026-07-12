import React, { useEffect, useState } from 'react';
import {
  Card, Typography, Button, Table, Tag, Space, Modal, Form, Input, Select,
  Switch, message, Popconfirm, Tooltip, Badge, Empty, Alert, Row, Col
} from 'antd';
import {
  PlusOutlined, SettingOutlined, DeleteOutlined, EditOutlined,
  ApiOutlined, StarOutlined, ThunderboltOutlined, PushpinOutlined, PushpinFilled, GiftOutlined
} from '@ant-design/icons';
import { modelConfigAPI , extractApiError} from '@/services/api';
import ModelSelector from '@/components/ModelSelector';
import { PROVIDER_PRESETS, NOTE_OPTIONS, capabilityTags } from './ModelConfig/ProviderPresets';

const { Title, Text } = Typography;

interface ModelCfg {
  _id: string;
  name: string;
  provider: string;
  baseURL: string;
  models: string[];
  defaultModel: string;
  enabled: boolean;
  isDefault: boolean;
  pinned: boolean;
  description?: string;
  note?: string;
  createdAt: string;
}

const BUILTIN_OPTIONS = [
  ...PROVIDER_PRESETS.map(p => ({
    value: p.id, label: `${p.name} (${p.category === 'international' ? '国际' : '国内'})`,
    group: p.category,
  })),
  { value: 'custom', label: '自定义 OpenAPI 兼容接口', group: 'other' },
];

const ModelConfigPage: React.FC = () => {
  const [list, setList] = useState<ModelCfg[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ModelCfg | null>(null);
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  // 自动获取模型 / 平台免费额度
  const [fetchingModels, setFetchingModels] = useState(false);
  const [aibakFree, setAibakFree] = useState<any[]>([]);
  const [selProvider, setSelProvider] = useState<string>('');

  // 「测试连接」弹窗状态：复用 ModelSelector 选择要测试的具体模型
  const [testOpen, setTestOpen] = useState(false);
  const [testTarget, setTestTarget] = useState<ModelCfg | null>(null);
  const [testModel, setTestModel] = useState<string>('');
  const [testing, setTesting] = useState(false);

  const isCustom = (r: ModelCfg) => r.provider === 'custom';

  const load = async () => {
    setLoading(true);
    try {
      const res: any = await modelConfigAPI.list();
      setList(res.data || []);
    } catch { /* ignore */ }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  // 加载平台免费额度（云函数 4 个免费模型）元信息
  useEffect(() => {
    modelConfigAPI.aibakFree().then((r: any) => { if (r?.data) setAibakFree(r.data); }).catch(() => { /* 忽略 */ });
  }, []);

  // 自动获取厂商模型清单（OpenAI 兼容，服务端 15s 超时 + 缓存）
  const onAutoFetchModels = async () => {
    const baseURL = form.getFieldValue('baseURL');
    const apiKey = form.getFieldValue('apiKey');
    if (!baseURL || !apiKey) {
      message.warning('请先填写 API Base URL 与 API Key');
      return;
    }
    setFetchingModels(true);
    try {
      const res: any = await modelConfigAPI.fetchModels({ baseURL, apiKey });
      const ids: string[] = res?.data || [];
      if (ids.length === 0) {
        message.info('未从该厂商拉取到模型，请手动填写');
      } else {
        form.setFieldsValue({ models: ids, defaultModel: ids[0] });
        message.success(`已自动获取 ${ids.length} 个模型`);
      }
    } catch (e: any) {
      message.error(extractApiError(e, '自动获取失败'));
    }
    setFetchingModels(false);
  };

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ provider: 'deepseek', enabled: true, models: ['deepseek-chat'], note: 'personal' });
    setModalOpen(true);
  };

  // 选择厂商时自动填充默认配置
  const onProviderChange = (provider: string) => {
    setSelProvider(provider);
    const preset = PROVIDER_PRESETS.find(p => p.id === provider);
    if (preset) {
      form.setFieldsValue({
        baseURL: preset.apiBaseUrl,
        models: preset.models,
        defaultModel: preset.models[0],
        name: preset.name,
      });
    } else {
      form.setFieldsValue({ baseURL: '', models: [], defaultModel: '' });
    }
  };

  const openEdit = (rec: ModelCfg) => {
    setEditing(rec);
    form.setFieldsValue(rec);
    setModalOpen(true);
  };

  const onSubmit = async () => {
    const vals = await form.validateFields();
    setSubmitting(true);
    try {
      if (editing) {
        await modelConfigAPI.update(editing._id, vals);
        message.success('已更新模型配置');
      } else {
        await modelConfigAPI.create(vals);
        message.success('已添加模型配置');
      }
      setModalOpen(false);
      load();
    } catch (e) {
      message.error(extractApiError(e, '操作失败'));
    }
    setSubmitting(false);
  };

  const onDelete = async (id: string) => {
    try { await modelConfigAPI.remove(id); message.success('已删除'); load(); }
    catch { message.error('删除失败'); }
  };

  const onSetDefault = async (id: string) => {
    try { await modelConfigAPI.setDefault(id); message.success('已设为默认'); load(); }
    catch { message.error('操作失败'); }
  };

  // 打开「测试连接」弹窗：复用统一 ModelSelector，从当前配置自身模型列表中选模型
  const openTest = (rec: ModelCfg) => {
    setTestTarget(rec);
    setTestModel(`${rec.provider}/${rec.defaultModel}`);
    setTestOpen(true);
  };

  const onTest = async () => {
    if (!testTarget) return;
    const model = testModel.includes('/') ? testModel.slice(testModel.indexOf('/') + 1) : testModel;
    setTesting(true);
    try {
      const res: any = await modelConfigAPI.test(testTarget._id, model);
      if (res.data?.connected) message.success(`连接成功（模型：${res.data.model || model}）`);
      else message.warning(`连接失败：${res.data?.error || '请检查 Key / URL / 模型名'}`);
    } catch (e) {
      message.error(extractApiError(e, '测试失败'));
    }
    setTesting(false);
  };

  // 置顶 / 取消置顶（运营将常用自定义模型固定在列表顶部）
  const onTogglePin = async (rec: ModelCfg) => {
    try {
      await modelConfigAPI.update(rec._id, { pinned: !rec.pinned });
      message.success(rec.pinned ? '已取消置顶' : '已置顶');
      load();
    } catch { message.error('操作失败'); }
  };

  const columns = [
    {
      title: '名称', dataIndex: 'name', key: 'name',
      render: (t: string, r: ModelCfg) => (
        <Space>
          <ApiOutlined />
          <span>{t}</span>
          {r.isDefault && <Tag color="gold"><StarOutlined /> 默认</Tag>}
          {r.pinned && <Tag color="geekblue"><PushpinFilled /> 置顶</Tag>}
          {isCustom(r) && <Tag color="purple">自定义</Tag>}
        </Space>
      )
    },
    {
      title: '厂商', dataIndex: 'provider', key: 'provider',
      render: (p: string) => {
        const preset = PROVIDER_PRESETS.find(pr => pr.id === p);
        return <Tag color={preset?.category === 'international' ? 'blue' : 'purple'}>{preset?.name || p}</Tag>;
      }
    },
    {
      title: '默认模型', dataIndex: 'defaultModel', key: 'defaultModel',
      render: (m: string) => <Tag>{m}</Tag>
    },
    {
      title: '状态', dataIndex: 'enabled', key: 'enabled',
      render: (e: boolean) => e ? <Badge status="success" text="已启用" /> : <Badge status="default" text="已停用" />
    },
    {
      title: '操作', key: 'action',
      render: (_: any, r: ModelCfg) => (
        <Space>
          <Tooltip title="编辑"><Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} /></Tooltip>
          <Tooltip title="测试连接（选择具体模型）"><Button size="small" icon={<ThunderboltOutlined />} onClick={() => openTest(r)} /></Tooltip>
          <Tooltip title={isCustom(r) ? '设为默认后，该自定义模型将在对话/客服中优先被选中' : '设为默认'}>
            <Button size="small" icon={<StarOutlined />} disabled={r.isDefault} onClick={() => onSetDefault(r._id)} />
          </Tooltip>
          <Tooltip title={r.pinned ? '取消置顶' : '置顶到列表顶部（方便运营快速定位常用模型）'}>
            <Button size="small" icon={r.pinned ? <PushpinFilled /> : <PushpinOutlined />} onClick={() => onTogglePin(r)} />
          </Tooltip>
          <Popconfirm title="确认删除？" onConfirm={() => onDelete(r._id)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      )
    }
  ];

  return (
    <div style={{ maxWidth: 1080, margin: '0 auto', padding: '24px 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <Title level={3} style={{ margin: 0 }}><SettingOutlined /> 大模型配置中心</Title>
          <Text type="secondary">接入并管理各厂商大模型，为对话、RAG、客服、生成等模块统一提供模型能力</Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>添加模型</Button>
      </div>

      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message="自定义模型运营提示"
        description="「自定义」模型接入后，可在对话与客服界面直接点选使用。点击星标「设为默认」可让其成为平台默认模型（对话/客服优先选中）；点击图钉「置顶」可将其固定在列表顶部，方便快速定位。测试连接时可指定具体模型精确校验可达性。"
      />

      {/* 平台免费额度专区：云函数 4 个免费模型，全站已内置可用 */}
      <Card style={{ marginBottom: 16, borderRadius: 16, border: '1px solid var(--border)',
        background: 'linear-gradient(135deg, rgba(108,92,231,0.08), rgba(162,155,254,0.05))' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div>
            <Title level={5} style={{ margin: 0, color: 'var(--text-primary)' }}>
              <GiftOutlined style={{ color: 'var(--brand-primary)', marginRight: 6 }} />平台免费额度
            </Title>
            <Text type="secondary" style={{ fontSize: 13 }}>云函数 4 个免费模型（文本大模型 + 文生图/图生图），无需配置即可在全站对话、创作、客服中使用</Text>
          </div>
        </div>
        <Row gutter={[12, 12]}>
          {aibakFree.map((m) => (
            <Col xs={24} sm={12} md={6} key={m.id}>
              <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: '12px 14px', background: 'var(--bg-container)' }}>
                <Text strong style={{ display: 'block', fontSize: 13, color: 'var(--text-primary)' }}>{m.label}</Text>
                <div style={{ margin: '6px 0' }}>{capabilityTags(m.capabilities).map((t) => <Tag key={t.text} color={t.color}>{t.text}</Tag>)}</div>
                <Text type="secondary" style={{ fontSize: 11, fontFamily: 'monospace' }}>{m.id}</Text>
              </div>
            </Col>
          ))}
        </Row>
      </Card>

      <Card>
        {list.length === 0 && !loading ? (
          <Empty description="尚未配置模型，点击右上角添加" />
        ) : (
          <Table rowKey="_id" dataSource={list} columns={columns} loading={loading} pagination={false} />
        )}
      </Card>

      <Modal
        title={editing ? '编辑模型配置' : '添加模型配置'}
        open={modalOpen}
        onOk={onSubmit}
        confirmLoading={submitting}
        onCancel={() => setModalOpen(false)}
        width={560}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="配置名称" rules={[{ required: true, message: '请输入名称' }]}>
            <Input placeholder="例如：我的 DeepSeek" />
          </Form.Item>
          <Form.Item name="provider" label="厂商 / Provider" rules={[{ required: true }]}>
            <Select onChange={onProviderChange}
              options={[
                { label: '🌍 国际厂商', options: BUILTIN_OPTIONS.filter(o => o.group === 'international') },
                { label: '🇨🇳 国内厂商', options: BUILTIN_OPTIONS.filter(o => o.group === 'domestic') },
                { label: '🔧 其他', options: BUILTIN_OPTIONS.filter(o => o.group === 'other') },
              ]}
            />
          </Form.Item>
          <Form.Item name="baseURL" label="API Base URL" rules={[{ required: true, message: '请输入接口地址' }]}
            tooltip="选择厂商后自动填写，可手动修改">
            <Input placeholder="https://api.deepseek.com/v1" />
          </Form.Item>
          <Form.Item name="apiKey" label="API Key" rules={[{ required: true, message: '请输入 Key' }]}
            tooltip="请在此输入您从对应厂商获取的 API Key">
            <Input.Password placeholder="sk-..." />
          </Form.Item>
          <Form.Item name="defaultModel" label="默认模型" rules={[{ required: true }]}>
            <Input placeholder="deepseek-chat" />
          </Form.Item>
          <Form.Item name="models" label="可用模型列表" tooltip="可手动增删，支持自动获取">
            <Select mode="tags" placeholder="输入模型名后回车" />
          </Form.Item>
          <Space style={{ marginBottom: 12, marginTop: -8 }} wrap>
            {(() => {
              const p = PROVIDER_PRESETS.find((x) => x.id === selProvider);
              const tags = capabilityTags(p?.capabilities);
              return tags.length ? (
                <>自动识别能力：{tags.map((t) => <Tag key={t.text} color={t.color}>{t.text}</Tag>)}</>
              ) : null;
            })()}
          </Space>
          {(() => {
            const p = PROVIDER_PRESETS.find((x) => x.id === selProvider);
            return p?.supportsAutoFetch ? (
              <Button block icon={<ThunderboltOutlined />} loading={fetchingModels} onClick={onAutoFetchModels}
                style={{ marginBottom: 4 }}>
                自动获取模型（调用厂商 /models 接口，15s 超时）
              </Button>
            ) : null;
          })()}
          <Form.Item name="note" label="用途备注" tooltip="标记此配置的应用场景">
            <Select options={NOTE_OPTIONS} />
          </Form.Item>
          <Form.Item name="description" label="补充说明">
            <Input.TextArea rows={2} placeholder="选填：额外说明" />
          </Form.Item>
          <Form.Item name="enabled" label="启用" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>

      {/* 测试连接弹窗：复用统一 ModelSelector 选择要测试的具体模型 */}
      <Modal
        title={`测试连接 · ${testTarget?.name || ''}`}
        open={testOpen}
        onOk={onTest}
        confirmLoading={testing}
        okText="开始测试"
        onCancel={() => setTestOpen(false)}
        width={480}
      >
        <p style={{ color: 'rgba(0,0,0,0.45)' }}>
          选择要校验可达性的模型（基于该配置自身的模型列表，精确验证具体模型能否连通）：
        </p>
        <ModelSelector
          value={testModel}
          onChange={setTestModel}
          customGroups={testTarget ? [{ provider: testTarget.provider, label: testTarget.provider, models: testTarget.models?.length ? testTarget.models : [testTarget.defaultModel] }] : undefined}
          placeholder="选择要测试的模型"
          style={{ width: '100%' }}
        />
      </Modal>
    </div>
  );
};

export default ModelConfigPage;
