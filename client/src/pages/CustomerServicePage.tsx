import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card, Typography, Button, Table, Tag, Space, Modal, Form, Input, Select,
  message, Popconfirm, Row, Col, Statistic, Empty, Switch as AntdSwitch, Input as AntInput
} from 'antd';
import {
  CustomerServiceOutlined, PlusOutlined, DeleteOutlined, EditOutlined,
  CodeOutlined, MessageOutlined, RobotOutlined, DatabaseOutlined, SafetyCertificateOutlined
} from '@ant-design/icons';
import { customerServiceAPI, knowledgeAPI, teamAPI , extractApiError} from '@/services/api';
import ModelSelector from '@/components/ModelSelector';

const { Title, Text, Paragraph } = Typography;

interface CSBot {
  _id: string;
  name: string;
  description?: string;
  knowledgeBaseIds: string[];
  systemPrompt: string;
  provider: string;
  csModel: string;
  welcomeMessage: string;
  fallbackMessage: string;
  enabled: boolean;
  embedCode: string;
  conversationCount: number;
  createdAt: string;
}

const CustomerServicePage: React.FC = () => {
  const navigate = useNavigate();
  const [list, setList] = useState<CSBot[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CSBot | null>(null);
  const [knowledges, setKnowledges] = useState<{ _id: string; title: string }[]>([]);
  const [teams, setTeams] = useState<{ _id: string; name: string }[]>([]);
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [embedModal, setEmbedModal] = useState<{ code: string; script: string } | null>(null);
  // 模拟对话测试
  const [testBot, setTestBot] = useState<CSBot | null>(null);
  const [chatMsgs, setChatMsgs] = useState<{ role: string; content: string }[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatting, setChatting] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res: any = await customerServiceAPI.list();
      setList(res.data || []);
    } catch { /* ignore */ }
    setLoading(false);
  };

  const loadKnowledge = async () => {
    try {
      const res: any = await knowledgeAPI.list({ limit: 100 });
      setKnowledges((res.data?.docs || res.data || []).map((d: any) => ({ _id: d._id, title: d.title })));
    } catch { /* ignore */ }
  };

  useEffect(() => { load(); loadKnowledge(); loadTeams(); }, []);

  const loadTeams = async () => {
    try {
      const res: any = await teamAPI.mine();
      setTeams(res.data || []);
    } catch { /* ignore */ }
  };

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ model: 'deepseek/deepseek-chat', enabled: true });
    setModalOpen(true);
  };
  const openEdit = (rec: CSBot) => {
    setEditing(rec);
    // csModel 现存储完整网关模型串（如 deepseek/deepseek-chat 或 mc_<id>/glm-4）
    const full = rec.csModel?.includes('/') ? rec.csModel : `${rec.provider}/${rec.csModel}`;
    form.setFieldsValue({ ...rec, model: full });
    setModalOpen(true);
  };

  const onSubmit = async () => {
    const vals = await form.validateFields();
    // 将选择器返回的 "provider/model" 拆为 provider + 完整网关模型串
    const full: string = vals.model || '';
    const idx = full.indexOf('/');
    const provider = idx > -1 ? full.slice(0, idx) : 'openai';
    const modelStr = idx > -1 ? full.slice(idx + 1) : full;
    const payload = { ...vals, provider, model: modelStr };
    setSubmitting(true);
    try {
      if (editing) { await customerServiceAPI.update(editing._id, payload); message.success('已更新'); }
      else { await customerServiceAPI.create(payload); message.success('已创建客服'); }
      setModalOpen(false); load();
    } catch (e) { message.error(extractApiError(e, '操作失败')); }
    setSubmitting(false);
  };

  const onDelete = async (id: string) => {
    try { await customerServiceAPI.remove(id); message.success('已删除'); load(); }
    catch { message.error('删除失败'); }
  };

  const showEmbed = async (id: string) => {
    try {
      const res: any = await customerServiceAPI.embedScript(id);
      setEmbedModal(res.data);
    } catch { message.error('获取嵌入码失败'); }
  };

  const startTest = (bot: CSBot) => {
    setTestBot(bot);
    setChatMsgs([{ role: 'assistant', content: bot.welcomeMessage }]);
    setChatInput('');
  };

  const sendChat = async () => {
    if (!chatInput.trim() || !testBot) return;
    const userMsg = { role: 'user', content: chatInput };
    setChatMsgs((m) => [...m, userMsg]);
    setChatting(true);
    const curInput = chatInput;
    setChatInput('');
    try {
      const res: any = await customerServiceAPI.chatPublic(testBot.embedCode, { message: curInput });
      setChatMsgs((m) => [...m, { role: 'assistant', content: res.data.reply }]);
    } catch (e) {
      message.error('对话失败');
    }
    setChatting(false);
  };

  const columns = [
    {
      title: '客服名称', dataIndex: 'name', key: 'name',
      render: (t: string, r: CSBot) => (
        <Space>
          <RobotOutlined />
          <span>{t}</span>
          {!r.enabled && <Tag>已停用</Tag>}
        </Space>
      )
    },
    {
      title: '知识库绑定', dataIndex: 'knowledgeBaseIds', key: 'kb',
      render: (ids: string[]) => <Tag icon={<DatabaseOutlined />}>{ids?.length || 0} 个文档</Tag>
    },
    {
      title: '模型', key: 'model',
      render: (_: any, r: CSBot) => <Tag color="purple">{r.csModel}</Tag>
    },
    {
      title: '会话数', dataIndex: 'conversationCount', key: 'count',
      render: (c: number) => <Statistic value={c} valueStyle={{ fontSize: 14 }} />
    },
    {
      title: '操作', key: 'action',
      render: (_: any, r: CSBot) => (
        <Space>
          <Button size="small" icon={<MessageOutlined />} onClick={() => startTest(r)}>测试</Button>
          <Button size="small" icon={<SafetyCertificateOutlined />} onClick={() => navigate(`/customer-service/${r._id}/audit`)}>审计</Button>
          <Button size="small" icon={<CodeOutlined />} onClick={() => showEmbed(r._id)}>嵌入码</Button>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
          <Popconfirm title="确认删除？" onConfirm={() => onDelete(r._id)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      )
    }
  ];

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <Title level={3} style={{ margin: 0 }}><CustomerServiceOutlined /> 智能客服系统</Title>
          <Text type="secondary">基于 RAG 知识库的智能问答，可嵌入你的网站，构建完整客服生态</Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>创建客服</Button>
      </div>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={8}><Card><Statistic title="客服机器人" value={list.length} prefix={<RobotOutlined />} /></Card></Col>
        <Col span={8}><Card><Statistic title="累计会话" value={list.reduce((a, b) => a + (b.conversationCount || 0), 0)} prefix={<MessageOutlined />} /></Card></Col>
        <Col span={8}><Card><Statistic title="知识库文档" value={knowledges.length} prefix={<DatabaseOutlined />} /></Card></Col>
      </Row>

      <Card>
        {list.length === 0 && !loading ? (
          <Empty description="还没有客服机器人，点击创建并绑定知识库" />
        ) : (
          <Table rowKey="_id" dataSource={list} columns={columns} loading={loading} pagination={false} />
        )}
      </Card>

      {/* 创建/编辑弹窗 */}
      <Modal title={editing ? '编辑客服' : '创建智能客服'} open={modalOpen}
        onOk={onSubmit} confirmLoading={submitting} onCancel={() => setModalOpen(false)} width={620}>
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="客服名称" rules={[{ required: true }]}>
            <Input placeholder="例如：官网售前助手" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input placeholder="可选" />
          </Form.Item>
          <Form.Item name="knowledgeBaseIds" label="绑定知识库（RAG 支撑）">
            <Select mode="multiple" placeholder="选择知识文档" options={knowledges.map(k => ({ value: k._id, label: k.title }))} />
          </Form.Item>
          <Form.Item name="teamId" label="归属团队（可选，团队资源级隔离）" tooltip="选择后该客服由团队成员共享管理">
            <Select placeholder="个人私有（不归属团队）" allowClear
              options={teams.map(t => ({ value: t._id, label: t.name }))} />
          </Form.Item>
          <Form.Item
            name="model"
            label="对话模型"
            rules={[{ required: true, message: '请选择模型' }]}
            tooltip="支持内置厂商（DeepSeek / 智谱 GLM / 通义千问 / 豆包 / 混元等）与你在「模型配置」中添加的第三方自定义模型"
          >
            <ModelSelector placeholder="选择模型（智谱 / 通义 / 豆包 / 自定义…）" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="systemPrompt" label="人设提示词">
            <Input.TextArea rows={3} placeholder="你是一个专业的客服助手..." />
          </Form.Item>
          <Form.Item name="welcomeMessage" label="欢迎语">
            <Input />
          </Form.Item>
          <Form.Item name="fallbackMessage" label="兜底回复">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="enabled" label="启用" valuePropName="checked">
            <AntdSwitch />
          </Form.Item>
        </Form>
      </Modal>

      {/* 嵌入码弹窗 */}
      <Modal title="网站嵌入代码" open={!!embedModal} footer={null} onCancel={() => setEmbedModal(null)}>
        {embedModal && (
          <>
            <Paragraph>将以下代码粘贴到你的网站 &lt;body&gt; 末尾即可启用客服浮窗：</Paragraph>
            <Input.TextArea readOnly value={embedModal.script} rows={4} />
            <Paragraph type="secondary" style={{ marginTop: 8 }}>嵌入标识：<Tag>{embedModal.code}</Tag></Paragraph>
          </>
        )}
      </Modal>

      {/* 对话测试抽屉 */}
      <Modal title={testBot ? `测试：${testBot.name}` : ''} open={!!testBot}
        onCancel={() => setTestBot(null)} footer={null} width={520}>
        <div style={{ height: 360, overflowY: 'auto', border: '1px solid #f0f0f0', borderRadius: 8, padding: 12, marginBottom: 12 }}>
          {chatMsgs.map((m, i) => (
            <div key={i} style={{ display: 'flex', marginBottom: 10, justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
              <div style={{
                maxWidth: '75%', padding: '8px 12px', borderRadius: 10,
                background: m.role === 'user' ? '#1677ff' : '#f0f0f0',
                color: m.role === 'user' ? '#fff' : '#000'
              }}>{m.content}</div>
            </div>
          ))}
          {chatting && <Text type="secondary">客服正在输入...</Text>}
        </div>
        <Space.Compact style={{ width: '100%' }}>
          <AntInput value={chatInput} onChange={(e) => setChatInput(e.target.value)}
            onPressEnter={sendChat} placeholder="输入测试问题..." />
          <Button type="primary" onClick={sendChat} loading={chatting}>发送</Button>
        </Space.Compact>
      </Modal>
    </div>
  );
};

export default CustomerServicePage;
