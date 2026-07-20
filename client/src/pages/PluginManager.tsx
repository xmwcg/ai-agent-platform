import { useState, useEffect } from 'react';
import {
  Card, Typography, Button, Space, Switch, Tag, Spin, Empty,
  Modal, Form, Input, Select, message, Badge, Tooltip, Popconfirm
} from 'antd';
import {
  PlusOutlined, SettingOutlined, CloudServerOutlined,
  CloseOutlined, ReloadOutlined, DeleteOutlined,
  ApiOutlined, ToolOutlined
} from '@ant-design/icons';
import { mcpAPI , extractApiError} from '@/services/api';

const { Title, Paragraph, Text } = Typography;
const { TextArea } = Input;

interface MCPTool {
  name: string;
  description: string;
}

interface MCPServer {
  id: string;
  name: string;
  description?: string;
  transport: 'stdio' | 'sse';
  command?: string;
  args?: string;
  url?: string;
  env?: string;
  enabled: boolean;
  status: 'connected' | 'disconnected' | 'error' | 'connecting';
  tools?: MCPTool[];
  connectedAt?: number;
}

export default function PluginManager() {
  const [servers, setServers] = useState<MCPServer[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState<Record<string, boolean>>({});
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<MCPServer | null>(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();

  const loadServers = async () => {
    setLoading(true);
    try {
      const res: any = await mcpAPI.list();
      setServers(res.data || []);
    } catch (e) {
      message.error(extractApiError(e, '加载 MCP 服务器失败'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadServers(); }, []);

  const openModal = (server: MCPServer | null) => {
    setEditing(server);
    setModalVisible(true);
    if (server) {
      form.setFieldsValue({
        id: server.id,
        name: server.name,
        transport: server.transport,
        command: server.command,
        args: server.args,
        url: server.url,
        env: server.env,
      });
    } else {
      form.resetFields();
    }
  };

  const handleConnect = async (id: string) => {
    setConnecting(prev => ({ ...prev, [id]: true }));
    try {
      await mcpAPI.connect(id);
      message.success('连接成功');
      loadServers();
    } catch (err) {
      message.error(extractApiError(err, '连接失败'));
    } finally {
      setConnecting(prev => ({ ...prev, [id]: false }));
    }
  };

  const handleDisconnect = async (id: string) => {
    try {
      await mcpAPI.disconnect(id);
      message.success('已断开');
      loadServers();
    } catch (e) {
      message.error(extractApiError(e, '断开失败'));
    }
  };

  const handleToggle = async (server: MCPServer) => {
    const newEnabled = !server.enabled;
    try {
      await mcpAPI.setEnabled(server.id, newEnabled);
      message.success(newEnabled ? '已启用' : '已禁用');
      loadServers();
    } catch (err) {
      message.error(extractApiError(err, '操作失败'));
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await mcpAPI.remove(id);
      message.success('已删除');
      loadServers();
    } catch (err) {
      message.error(extractApiError(err, '删除失败'));
    }
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      const payload: any = {
        id: values.id,
        name: values.name,
        transport: values.transport,
        enabled: true,
      };
      if (values.transport === 'stdio') {
        payload.command = values.command;
        payload.args = (values.args || '').split(/\s+/).filter(Boolean);
      } else {
        payload.url = values.url;
      }
      if (values.env) {
        const envObj: Record<string, string> = {};
        values.env.split('\n').forEach((line: string) => {
          const idx = line.indexOf('=');
          if (idx > 0) envObj[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
        });
        payload.env = envObj;
      }
      if (editing) {
        await mcpAPI.update(editing.id, payload);
        message.success('更新成功');
      } else {
        await mcpAPI.create(payload);
        message.success('添加成功');
      }
      setModalVisible(false);
      loadServers();
    } catch (err) {
      message.error(extractApiError(err, '保存失败'));
    } finally {
      setSaving(false);
    }
  };

  const statusColor: Record<string, string> = {
    connected: 'green',
    disconnected: 'default',
    error: 'red',
    connecting: 'orange',
  };
  const statusLabel: Record<string, string> = {
    connected: '已连接',
    disconnected: '未连接',
    error: '错误',
    connecting: '连接中...',
  };

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Space>
            <Title level={3} style={{ margin: 0 }}>🔌 MCP 插件管理</Title>
            <Badge count={servers.filter(s => s.status === 'connected').length} showZero color="green" />
          </Space>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal(null)}>
            添加服务器
          </Button>
        </div>
        <Paragraph type="secondary">
          管理 MCP (Model Context Protocol) 服务器，扩展 AI Agent 的工具调用能力。
          已连接 <Text strong>{servers.filter(s => s.status === 'connected').length}</Text> 个服务器，
          共 <Text strong>{servers.reduce((sum, s) => sum + (s.tools?.length || 0), 0)}</Text> 个可用工具。
          配置持久化保存，重启后仍生效。
        </Paragraph>
      </Card>

      {loading ? (
        <Card><div style={{ textAlign: 'center', padding: 100 }}><Spin size="large" /><p>加载中...</p></div></Card>
      ) : servers.length === 0 ? (
        <Card><Empty description="暂无 MCP 服务器，点击「添加服务器」开始配置" /></Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {servers.map(server => (
            <Card key={server.id} hoverable style={{ borderLeft: `4px solid ${statusColor[server.status]}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <Space size={12} style={{ marginBottom: 8 }}>
                    <CloudServerOutlined style={{ fontSize: 20, color: '#1890ff' }} />
                    <Text strong style={{ fontSize: 16 }}>{server.name}</Text>
                    <Tag color={statusColor[server.status]}>{statusLabel[server.status]}</Tag>
                    {server.transport === 'stdio' ? <Tag color="blue">Stdio</Tag> : <Tag color="purple">SSE</Tag>}
                    {server.enabled ? <Tag color="green">已启用</Tag> : <Tag>未启用</Tag>}
                  </Space>
                  {server.description && <Paragraph type="secondary" style={{ marginBottom: 8 }}>{server.description}</Paragraph>}
                  <div style={{ marginBottom: 8 }}>
                    {server.transport === 'stdio' ? (
                      <Text type="secondary" style={{ fontSize: 12 }}><ApiOutlined /> 命令：{server.command} {server.args}</Text>
                    ) : (
                      <Text type="secondary" style={{ fontSize: 12 }}><ApiOutlined /> URL：{server.url}</Text>
                    )}
                  </div>
                  {server.tools && server.tools.length > 0 && (
                    <div style={{ marginTop: 8 }}>
                      <Text type="secondary" style={{ fontSize: 12, marginBottom: 4, display: 'block' }}>
                        <ToolOutlined /> 可用工具（{server.tools.length}）
                      </Text>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {server.tools.map(tool => (
                          <Tooltip key={tool.name} title={tool.description}>
                            <Tag style={{ cursor: 'pointer' }}>{tool.name}</Tag>
                          </Tooltip>
                        ))}
                      </div>
                    </div>
                  )}
                  {server.connectedAt && (
                    <Text type="secondary" style={{ fontSize: 11, marginTop: 4, display: 'block' }}>
                      连接于 {new Date(server.connectedAt).toLocaleTimeString()}
                    </Text>
                  )}
                </div>
                <Space direction="vertical" size={8}>
                  <Switch checked={server.enabled} onChange={() => handleToggle(server)} checkedChildren="启用" unCheckedChildren="禁用" />
                  {server.status === 'connected' ? (
                    <Button size="small" icon={<CloseOutlined />} onClick={() => handleDisconnect(server.id)}>断开</Button>
                  ) : (
                    <Button type="primary" size="small" icon={<ReloadOutlined />} loading={connecting[server.id]} onClick={() => handleConnect(server.id)} disabled={!server.enabled}>连接</Button>
                  )}
                  <Button size="small" icon={<SettingOutlined />} onClick={() => openModal(server)}>编辑</Button>
                  <Popconfirm title="确认删除该服务器？" onConfirm={() => handleDelete(server.id)} okText="删除" cancelText="取消">
                    <Button size="small" danger icon={<DeleteOutlined />}>删除</Button>
                  </Popconfirm>
                </Space>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        title={editing ? '编辑服务器' : '添加 MCP 服务器'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={handleSave}
        confirmLoading={saving}
        width={640}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="id" label="服务器 ID" rules={[{ required: true, message: '请输入服务器 ID' }]}>
            <Input placeholder="例：my-server" disabled={!!editing} />
          </Form.Item>
          <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入名称' }]}>
            <Input placeholder="例：文件系统" />
          </Form.Item>
          <Form.Item name="transport" label="传输类型" initialValue="stdio">
            <Select options={[
              { label: 'Stdio（本地进程）', value: 'stdio' },
              { label: 'SSE（HTTP 事件流）', value: 'sse' },
            ]} />
          </Form.Item>
          <Form.Item name="command" label="命令（Stdio）">
            <Input placeholder="例：npx" />
          </Form.Item>
          <Form.Item name="args" label="参数（空格分隔）">
            <TextArea placeholder="例：-y @modelcontextprotocol/server-filesystem" rows={2} />
          </Form.Item>
          <Form.Item name="url" label="URL（SSE）">
            <Input placeholder="例：http://localhost:3001/sse" />
          </Form.Item>
          <Form.Item name="env" label="环境变量（每行一个 KEY=VALUE）">
            <TextArea placeholder="BRAVE_API_KEY=xxx" rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
