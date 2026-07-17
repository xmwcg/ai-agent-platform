import React, { useEffect, useState } from 'react';
import { Card, Typography, Button, Table, Tag, Modal, Form, Input, Select, message, Space, Tabs, Tooltip } from 'antd';
import { TeamOutlined, PlusOutlined, DeleteOutlined, LinkOutlined, CopyOutlined, HistoryOutlined, LoginOutlined } from '@ant-design/icons';
import { teamAPI, extractApiError } from '@/services/api';

const { Title, Paragraph, Text } = Typography;

interface Member { userId: string; role: string; joinedAt?: string; }
interface Team { _id: string; name: string; ownerId: string; plan: string; members: Member[]; inviteCode?: string | null; }
interface AuditEntry { _id: string; action: string; actorId: string; targetId?: string; detail?: Record<string, unknown>; createdAt: string; }

const ROLE_TAG: Record<string, string> = { owner: 'gold', admin: 'blue', member: 'default', viewer: 'default' };
const ACTION_LABEL: Record<string, string> = {
  team_created: '创建团队', team_deleted: '删除团队',
  member_joined: '成员加入', member_left: '成员退出', member_removed: '移除成员',
  role_changed: '角色变更', invite_generated: '生成邀请', invite_revoked: '撤销邀请',
};

const TeamPage: React.FC = () => {
  const [list, setList] = useState<Team[]>([]);
  const [loading, setLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteTeamId, setInviteTeamId] = useState<string | null>(null);
  const [roleOpen, setRoleOpen] = useState(false);
  const [roleTarget, setRoleTarget] = useState<{ teamId: string; userId: string; current: string } | null>(null);
  const [detail, setDetail] = useState<Team | null>(null);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditEntry[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [form] = Form.useForm();
  const [joinForm] = Form.useForm();
  const [inviteForm] = Form.useForm();
  const [roleForm] = Form.useForm();

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

  const invite = (teamId: string) => {
    setInviteTeamId(teamId);
    inviteForm.resetFields();
    setInviteOpen(true);
  };
  const submitInvite = async () => {
    if (!inviteTeamId) return;
    try {
      const v = await inviteForm.validateFields();
      await teamAPI.invite(inviteTeamId, { userId: v.userId, role: v.role });
      message.success('已邀请成员');
      setInviteOpen(false);
      openDetail(inviteTeamId);
    } catch (e) { if (e) message.error(extractApiError(e, '邀请失败')); }
  };

  const generateInvite = async (teamId: string) => {
    try {
      const res: any = await teamAPI.generateInvite(teamId);
      if (res.success) {
        setInviteCode(res.data.inviteCode);
        message.success('邀请链接已生成');
      }
    } catch (e) { message.error(extractApiError(e, '生成失败')); }
  };

  const revokeInvite = async (teamId: string) => {
    try {
      await teamAPI.revokeInvite(teamId);
      setInviteCode(null);
      message.success('邀请链接已撤销');
    } catch (e) { message.error(extractApiError(e, '撤销失败')); }
  };

  const copyInviteLink = () => {
    if (!inviteCode) return;
    navigator.clipboard.writeText(`${window.location.origin}/team/join/${inviteCode}`);
    message.success('邀请链接已复制到剪贴板');
  };

  const joinByCode = async () => {
    try {
      const v = await joinForm.validateFields();
      await teamAPI.joinViaInvite(v.code);
      message.success('加入团队成功');
      setJoinOpen(false);
      joinForm.resetFields();
      load();
    } catch (e) { message.error(extractApiError(e, '加入失败')); }
  };

  const openDetail = async (id: string) => {
    try {
      const res: any = await teamAPI.get(id);
      setDetail(res.data);
      setInviteCode(res.data?.inviteCode || null);
      loadAudit(id);
    } catch { /* ignore */ }
  };

  const loadAudit = async (teamId: string) => {
    setAuditLoading(true);
    try {
      const res: any = await teamAPI.getAudit(teamId, { pageSize: 20 });
      setAuditLogs(res.data?.logs || []);
    } catch { /* ignore */ }
    setAuditLoading(false);
  };

  const removeMember = async (teamId: string, userId: string) => {
    try {
      await teamAPI.remove(teamId, userId);
      message.success('已移除成员');
      openDetail(teamId);
    } catch (e) { message.error(extractApiError(e, '移除失败')); }
  };

  const changeRole = (teamId: string, userId: string, currentRole: string) => {
    setRoleTarget({ teamId, userId, current: currentRole });
    roleForm.setFieldsValue({ role: currentRole });
    setRoleOpen(true);
  };
  const submitRole = async () => {
    if (!roleTarget) return;
    try {
      const v = await roleForm.validateFields();
      if (v.role === roleTarget.current) { setRoleOpen(false); return; }
      await teamAPI.updateRole(roleTarget.teamId, roleTarget.userId, { role: v.role });
      message.success('角色已更新');
      setRoleOpen(false);
      openDetail(roleTarget.teamId);
    } catch (e) { if (e) message.error(extractApiError(e, '更新失败')); }
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

  const auditColumns = [
    { title: '时间', dataIndex: 'createdAt', width: 170, render: (t: string) => new Date(t).toLocaleString() },
    { title: '操作', dataIndex: 'action', width: 100, render: (a: string) => <Tag>{ACTION_LABEL[a] || a}</Tag> },
    { title: '操作人', dataIndex: 'actorId', width: 160, ellipsis: true },
    { title: '目标', dataIndex: 'targetId', width: 160, ellipsis: true, render: (v: string) => v || '-' },
    { title: '详情', dataIndex: 'detail', render: (d: Record<string, unknown>) =>
      d ? <Text type="secondary" style={{ fontSize: 12 }}>{JSON.stringify(d)}</Text> : '-' },
  ];

  return (
    <div>
      <Title level={3}><TeamOutlined /> 团队与权限（RBAC）</Title>
      <Paragraph type="secondary">创建团队、邀请成员并分配 owner/admin/member/viewer 角色，支撑企业协作与资源隔离。</Paragraph>

      <Space style={{ marginBottom: 16 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>新建团队</Button>
        <Button icon={<LoginOutlined />} onClick={() => setJoinOpen(true)}>加入团队</Button>
      </Space>

      <Card>
        <Table rowKey="_id" loading={loading} dataSource={list} columns={columns} pagination={false} />
      </Card>

      {/* 新建团队 Modal */}
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

      {/* 加入团队 Modal */}
      <Modal title="通过邀请码加入团队" open={joinOpen} onOk={joinByCode} onCancel={() => setJoinOpen(false)} okText="加入">
        <Form form={joinForm} layout="vertical">
          <Form.Item name="code" label="邀请码" rules={[{ required: true, message: '请输入邀请码' }]}>
            <Input placeholder="粘贴 24 位邀请码" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 邀请成员 Modal */}
      <Modal title="邀请成员" open={inviteOpen} onOk={submitInvite} onCancel={() => setInviteOpen(false)} okText="邀请" destroyOnClose>
        <Form form={inviteForm} layout="vertical">
          <Form.Item name="userId" label="用户 ID" rules={[{ required: true, message: '请输入要邀请的用户 ID' }]}>
            <Input placeholder="输入对方用户 ID" />
          </Form.Item>
          <Form.Item name="role" label="角色" initialValue="member">
            <Select options={[{ value: 'admin', label: '管理员 (admin)' }, { value: 'member', label: '成员 (member)' }, { value: 'viewer', label: '访客 (viewer)' }]} />
          </Form.Item>
        </Form>
      </Modal>

      {/* 修改角色 Modal */}
      <Modal title="修改成员角色" open={roleOpen} onOk={submitRole} onCancel={() => setRoleOpen(false)} okText="保存" destroyOnClose>
        <Form form={roleForm} layout="vertical">
          <Form.Item name="role" label="角色" rules={[{ required: true, message: '请选择角色' }]}>
            <Select options={[{ value: 'admin', label: '管理员 (admin)' }, { value: 'member', label: '成员 (member)' }, { value: 'viewer', label: '访客 (viewer)' }]} />
          </Form.Item>
        </Form>
      </Modal>

      {/* 团队详情 Modal */}
      <Modal title={detail ? `团队成员 · ${detail.name}` : ''} open={!!detail} footer={null} onCancel={() => { setDetail(null); setInviteCode(null); }} width={720}>
        {detail && (
          <Tabs defaultActiveKey="members" items={[
            {
              key: 'members',
              label: '成员管理',
              children: (
                <>
                  {/* 邀请链接区域 */}
                  <Card size="small" style={{ marginBottom: 12, background: '#fafafa' }}>
                    <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                      <Space>
                        <LinkOutlined />
                        <Text strong>邀请链接</Text>
                        {inviteCode ? (
                          <Tooltip title="点击复制">
                            <Text code copyable style={{ cursor: 'pointer' }} onClick={copyInviteLink}>
                              {inviteCode.substring(0, 8)}...
                            </Text>
                          </Tooltip>
                        ) : (
                          <Text type="secondary">未生成</Text>
                        )}
                      </Space>
                      <Space>
                        {inviteCode ? (
                          <>
                            <Button size="small" icon={<CopyOutlined />} onClick={copyInviteLink}>复制</Button>
                            <Button size="small" danger onClick={() => revokeInvite(detail._id)}>撤销</Button>
                          </>
                        ) : (
                          <Button size="small" type="primary" onClick={() => generateInvite(detail._id)}>生成邀请链接</Button>
                        )}
                      </Space>
                    </Space>
                  </Card>

                  <Space style={{ marginBottom: 12 }}>
                    <Button type="primary" icon={<PlusOutlined />} size="small" onClick={() => invite(detail._id)}>直接拉人</Button>
                  </Space>
                  <Table
                    rowKey={(r) => r.userId}
                    dataSource={detail.members}
                    pagination={false}
                    columns={[
                      { title: '用户 ID', dataIndex: 'userId', ellipsis: true },
                      { title: '角色', dataIndex: 'role', width: 80, render: (role: string) => <Tag color={ROLE_TAG[role]}>{role}</Tag> },
                      {
                        title: '操作', width: 140, render: (_: any, m: Member) => (
                          <Space>
                            {m.role !== 'owner' && (
                              <>
                                <Button type="link" size="small" onClick={() => changeRole(detail._id, m.userId, m.role)}>改角色</Button>
                                <Button type="link" danger size="small" icon={<DeleteOutlined />} onClick={() => removeMember(detail._id, m.userId)}>移除</Button>
                              </>
                            )}
                          </Space>
                        ),
                      },
                    ]}
                  />
                </>
              ),
            },
            {
              key: 'audit',
              label: <><HistoryOutlined /> 操作日志</>,
              children: (
                <Table
                  rowKey="_id"
                  loading={auditLoading}
                  dataSource={auditLogs}
                  pagination={false}
                  size="small"
                  columns={auditColumns}
                />
              ),
            },
          ]} />
        )}
      </Modal>
    </div>
  );
};

export default TeamPage;
