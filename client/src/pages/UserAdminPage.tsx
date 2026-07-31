import { useEffect, useState, useCallback } from 'react';
import {
  Table, Tag, Button, Space, Input, Switch, Popconfirm, Typography,
  message, Card, Select, Result,
} from 'antd';
import {
  ReloadOutlined, SearchOutlined, SecurityScanOutlined,
} from '@ant-design/icons';
import { adminAPI } from '@/services/api';
import { useAuthStore } from '@/stores/auth';

const { Title, Text } = Typography;

const ROLE_TAG: Record<string, { color: string; text: string }> = {
  admin: { color: 'gold', text: '管理员' },
  user: { color: 'default', text: '普通用户' },
};

const PLAN_TAG: Record<string, { color: string; text: string }> = {
  free: { color: 'default', text: '免费版' },
  pro: { color: 'blue', text: '专业版' },
  max: { color: 'gold', text: '旗舰版' },
  team: { color: 'purple', text: '团队版' },
};

interface AdminUser {
  _id: string;
  email: string;
  name: string;
  role: 'user' | 'admin';
  plan: string;
  isBanned?: boolean;
  createdAt: string;
}

export default function UserAdminPage() {
  const user = useAuthStore((s) => s.user);
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [search, setSearch] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res: any = await adminAPI.listUsers({ page, limit: pageSize, search });
      setUsers(res?.users || []);
      setTotal(res?.pagination?.total || 0);
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 403) message.error('需要管理员权限');
      else message.error('加载用户列表失败');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search]);

  useEffect(() => { load(); }, [load]);

  const handleRoleChange = async (id: string, role: 'user' | 'admin') => {
    setUpdatingId(id);
    try {
      await adminAPI.setRole(id, role);
      message.success('角色已更新');
      load();
    } catch (err: any) {
      message.error(err?.response?.data?.error || '更新失败');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleBan = async (id: string, banned: boolean) => {
    setUpdatingId(id);
    try {
      await adminAPI.setBanned(id, banned);
      message.success(banned ? '已封禁该账号' : '已解封该账号');
      load();
    } catch (err: any) {
      message.error(err?.response?.data?.error || '操作失败');
    } finally {
      setUpdatingId(null);
    }
  };

  if (user && user.role !== 'admin') {
    return (
      <Result
        status="403"
        title="无访问权限"
        subTitle="用户权限管理仅对管理员开放。"
      />
    );
  }

  const columns = [
    {
      title: '用户',
      key: 'user',
      render: (_: any, r: AdminUser) => (
        <div>
          <div style={{ fontWeight: 500 }}>{r.name}</div>
          <Text type="secondary" style={{ fontSize: 12 }}>{r.email}</Text>
        </div>
      ),
    },
    {
      title: '角色',
      key: 'role',
      width: 160,
      render: (_: any, r: AdminUser) => (
        <Select
          value={r.role}
          style={{ width: 120 }}
          disabled={updatingId === r._id}
          onChange={(v) => handleRoleChange(r._id, v)}
          options={[
            { label: '普通用户', value: 'user' },
            { label: '管理员', value: 'admin' },
          ]}
        />
      ),
    },
    {
      title: '会员',
      dataIndex: 'plan',
      key: 'plan',
      width: 110,
      render: (plan: string) => <Tag color={PLAN_TAG[plan]?.color}>{PLAN_TAG[plan]?.text || plan}</Tag>,
    },
    {
      title: '状态',
      key: 'status',
      width: 100,
      render: (_: any, r: AdminUser) =>
        r.isBanned ? <Tag color="red">已封禁</Tag> : <Tag color="green">正常</Tag>,
    },
    {
      title: '注册时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 130,
      render: (v: string) => new Date(v).toLocaleDateString('zh-CN'),
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_: any, r: AdminUser) => (
        <Popconfirm
          title={r.isBanned ? '解封该账号？' : '封禁该账号？'}
          description={r.isBanned ? '解封后用户可正常登录' : '封禁后该账号将无法登录'}
          onConfirm={() => handleBan(r._id, !r.isBanned)}
          okText="确认"
          cancelText="取消"
        >
          <Button
            size="small"
            danger={!r.isBanned}
            type={r.isBanned ? 'default' : 'link'}
            loading={updatingId === r._id}
          >
            {r.isBanned ? '解封' : '封禁'}
          </Button>
        </Popconfirm>
      ),
    },
  ];

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <Space style={{ width: '100%', justifyContent: 'space-between' }} align="center" wrap>
          <Space align="center">
            <SecurityScanOutlined style={{ fontSize: 22, color: '#6c5ce7' }} />
            <Title level={3} style={{ margin: 0 }}>用户权限管理</Title>
          </Space>
          <Space wrap>
            <Input.Search
              placeholder="搜索邮箱或名称"
              allowClear
              onSearch={(v) => { setPage(1); setSearch(v); }}
              style={{ width: 220 }}
            />
            <Button icon={<ReloadOutlined />} onClick={load}>刷新</Button>
          </Space>
        </Space>
        <Text type="secondary">
          管理平台全部用户：修改角色（普通用户 / 管理员）、封禁或解封账号。封禁后该账号将无法登录。
        </Text>
      </Card>

      <Table
        rowKey="_id"
        dataSource={users}
        columns={columns}
        loading={loading}
        pagination={{
          current: page,
          pageSize,
          total,
          showSizeChanger: true,
          onChange: (p, ps) => { setPage(p); setPageSize(ps); },
        }}
      />
    </div>
  );
}
