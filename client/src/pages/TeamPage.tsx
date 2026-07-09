import React, { useEffect, useState } from 'react';
import { Card, Typography, Button, Table, Tag, Modal, Form, Input, Select, message, Space } from 'antd';
import { TeamOutlined, PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { teamAPI , extractApiError} from '@/services/api';

const { Title, Paragraph } = Typography;

interface Member { userId: string; role: string; joinedAt?: string; }
interface Team { _id: string; name: string; ownerId: string; plan: string; members: Member[]; }

const ROLE_TAG: Record<string, string> = { owner: 'gold', admin: 'blue', member: 'default', viewer: 'default' };

const TeamPage: React.FC = () => {
  const [list, setList] = useState<Team[]>([]);
  const [loading, setLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [detail, setDetail] = useState<Team | null>(null);
  const [form] = Form.useForm();

  const load = async () => {
    setLoading(true);
    try {
      const res: any = await teamAPI.mine();
      setList(res.data || []);
    } catch { /* ignore */ }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const createTeam = async () => {
    try {
      const v = await form.validateFields();
      const res: any = await teamAPI.create(v);
      if (res.success) {
        message.success('团队已创建');
        setCreateOpen(false);
        form.resetFields();
        load();
      }
    } catch (e) {
      message.error(extractApiError(e, '创建失败'));
    }
  };

  const invite = async (teamId: string) => {
    const userId = prompt('输入要邀请的用户 ID：');
    if (!userId) return;
    const role = (prompt('角色(admin/member/viewer)：', 'member') || 'member') as string;
    try {
      await teamAPI.invite(teamId, { userId, role });
      message.success('已邀请成员');
      openDetail(teamId);
    } catch (e) { message.error(extractApiError(e, '邀请失败')); }
  };

  const openDetail = async (id: string) => {
    try {
      const res: any = await teamAPI.get(id);
      setDetail(res.data);
    } catch { /* ignore */ }
  };

  const removeMember = async (teamId: string, userId: string) => {
    try {
      await teamAPI.remove(teamId, userId);
      message.success('已移除成员');
      openDetail(teamId);
    } catch (e) { message.error(extractApiError(e, '移除失败')); }
  };

  const columns = [
    { title: '名称', dataIndex: 'name' },
    { title: '套餐', dataIndex: 'plan', render: (p: string) => <Tag>{p}</Tag> },
    { title: '成员数', dataIndex: 'members', render: (m: Member[]) => m?.length || 0 },
    {
      title: '操作', render: (_: any, r: Team) => (
        <Space>
          <Button type="link" onClick={() => openDetail(r._id)}>管理</Button>
          <Button type="link" danger onClick={async () => { await teamAPI.removeTeam(r._id); message.success('已删除'); load(); }}>删除</Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Title level={3}><TeamOutlined /> 团队与权限（RBAC）</Title>
      <Paragraph type="secondary">创建团队、邀请成员并分配 owner/admin/member/viewer 角色，支撑企业协作与资源隔离。</Paragraph>
      <Button type="primary" icon={<PlusOutlined />} style={{ marginBottom: 16 }} onClick={() => setCreateOpen(true)}>新建团队</Button>
      <Card>
        <Table rowKey="_id" loading={loading} dataSource={list} columns={columns} pagination={false} />
      </Card>

      <Modal title="新建团队" open={createOpen} onOk={createTeam} onCancel={() => setCreateOpen(false)} okText="创建">
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="团队名称" rules={[{ required: true, message: '请输入名称' }]}>
            <Input placeholder="如：增长事业部" />
          </Form.Item>
          <Form.Item name="plan" label="套餐" initialValue="team">
            <Select options={[{ value: 'team', label: '团队版' }, { value: 'pro', label: '专业版' }, { value: 'max', label: '旗舰版' }]} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title={detail ? `团队成员 · ${detail.name}` : ''} open={!!detail} footer={null} onCancel={() => setDetail(null)} width={640}>
        {detail && (
          <>
            <Button type="primary" icon={<PlusOutlined />} style={{ marginBottom: 12 }} onClick={() => invite(detail._id)}>邀请成员</Button>
            <Table
              rowKey={(r) => r.userId}
              dataSource={detail.members}
              pagination={false}
              columns={[
                { title: '用户 ID', dataIndex: 'userId' },
                { title: '角色', dataIndex: 'role', render: (role: string) => <Tag color={ROLE_TAG[role]}>{role}</Tag> },
                { title: '操作', render: (_: any, m: Member) => (
                  <Button type="link" danger icon={<DeleteOutlined />} disabled={m.role === 'owner'} onClick={() => removeMember(detail._id, m.userId)}>移除</Button>
                ) },
              ]}
            />
          </>
        )}
      </Modal>
    </div>
  );
};

export default TeamPage;
