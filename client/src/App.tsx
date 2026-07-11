import { useState, useEffect } from 'react';
import { Layout, Menu, theme, Typography, Button, Avatar, Dropdown, Space, Tag } from 'antd';
import { Outlet, useNavigate } from 'react-router-dom';
import {
  HomeOutlined,
  BookOutlined,
  RobotOutlined,
  PictureOutlined,
  SettingOutlined,
  CompassOutlined,
  BarChartOutlined,
  CalendarOutlined,
  UserOutlined,
  LogoutOutlined,
  LoginOutlined,
  CrownOutlined,
  CodeOutlined,
  ProfileOutlined,
  ApiOutlined,
  CustomerServiceOutlined,
  ToolOutlined,
  RocketOutlined,
  TeamOutlined,
  DashboardOutlined,
  AppstoreOutlined,
  NodeIndexOutlined,
  ApartmentOutlined,
  EditOutlined,
} from '@ant-design/icons';
import apiClient from '@/services/api';

const { Header, Content, Footer, Sider } = Layout;
const { Title } = Typography;

const PLAN_LABEL: Record<string, { text: string; color: string }> = {
  free: { text: '免费版', color: 'default' },
  pro: { text: '专业版', color: 'blue' },
  max: { text: '旗舰版', color: 'gold' },
};

function App() {
  const [collapsed, setCollapsed] = useState(false);
  const [user, setUser] = useState<{ name: string; email: string; plan?: string; credits?: number } | null>(null);
  const navigate = useNavigate();
  const {
    token: { colorBgContainer, borderRadiusLG }
  } = theme.useToken();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      setUser(null);
      return;
    }
    apiClient.get('/auth/profile')
      .then((res: any) => {
        if (res.data) {
          setUser({ name: res.data.name, email: res.data.email, plan: res.data.plan, credits: res.data.credits });
          localStorage.setItem('user', JSON.stringify(res.data));
        }
      })
      .catch(() => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setUser(null);
      });
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    navigate('/login');
  };

  // 分组侧边栏菜单（借鉴 Codex / LobeChat 信息架构）
  const menuItems = [
    { type: 'group' as const, key: 'g1', label: '核心', children: [
      { key: '/', icon: <HomeOutlined />, label: '首页' },
      { key: '/quickstart', icon: <RocketOutlined />, label: '快速启动' },
      { key: '/knowledge', icon: <BookOutlined />, label: '知识中枢' },
      { key: '/knowledge-graph', icon: <ApartmentOutlined />, label: '知识图谱' },
      { key: '/sandbox', icon: <CodeOutlined />, label: '实践沙盒' },
      { key: '/ai-chat', icon: <RobotOutlined />, label: 'AI 对话' },
      { key: '/customer-service', icon: <CustomerServiceOutlined />, label: '智能客服' },
    ]},
    { type: 'group' as const, key: 'g2', label: '学习与创作', children: [
      { key: '/courses', icon: <PictureOutlined />, label: '学习中心' },
      { key: '/learning-path', icon: <CompassOutlined />, label: '学习路径' },
      { key: '/calendar', icon: <CalendarOutlined />, label: '模型日历' },
      { key: '/compare', icon: <BarChartOutlined />, label: '对比分析' },
      { key: '/creative', icon: <PictureOutlined />, label: '创作工坊' },
      { key: '/code', icon: <CodeOutlined />, label: '代码解释' },
      { key: '/tools', icon: <ToolOutlined />, label: '智能工具箱' },
      { key: '/xhs', icon: <EditOutlined />, label: '小红书文案' },
    ]},
    { type: 'group' as const, key: 'g3', label: '平台与账户', children: [
      { key: '/model-config', icon: <ApiOutlined />, label: '模型配置中心' },
      { key: '/team', icon: <TeamOutlined />, label: '团队权限' },
      { key: '/marketplace', icon: <ApiOutlined />, label: '开放API市场' },
      { key: '/skills', icon: <AppstoreOutlined />, label: '技能市场' },
      { key: '/workflows', icon: <NodeIndexOutlined />, label: '工作流编辑器' },
      { key: '/diagnostics', icon: <DashboardOutlined />, label: '部署自检' },
      { key: '/plugins', icon: <SettingOutlined />, label: '插件管理' },
      { key: '/pricing', icon: <CrownOutlined />, label: '会员升级' },
      { key: '/profile', icon: <ProfileOutlined />, label: '个人中心' },
    ]},
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={(value) => setCollapsed(value)}
        width={232}
        style={{ background: 'linear-gradient(180deg, #0f172a 0%, #1e293b 100%)' }}
      >
        <div style={{
          height: 56, margin: 16, display: 'flex', alignItems: 'center', gap: 10,
          color: '#fff', fontWeight: 700, fontSize: 16, paddingLeft: collapsed ? 0 : 8
        }}>
          <RobotOutlined style={{ fontSize: 22, color: '#6366f1' }} />
          {!collapsed && <span>Reasonix AI</span>}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          defaultSelectedKeys={['/']}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
          style={{ background: 'transparent', borderInlineEnd: 0 }}
        />
      </Sider>
      <Layout>
        <Header style={{
          padding: '0 24px', background: colorBgContainer, display: 'flex',
          justifyContent: 'space-between', alignItems: 'center',
          borderBottom: '1px solid #f0f0f0'
        }}>
          <Title level={4} style={{ margin: 0, color: '#0f172a', letterSpacing: 0.5 }}>
            AI Agent 智能体平台
          </Title>
          <Space>
            {user ? (
              <Dropdown menu={{
                items: [
                  { key: 'profile', icon: <UserOutlined />, label: '个人中心' },
                  ...(user.plan && user.plan !== 'free' ? [{ key: 'pricing', icon: <CrownOutlined />, label: '管理订阅' }] : []),
                  { type: 'divider' },
                  { key: 'logout', icon: <LogoutOutlined />, label: '退出登录', danger: true }
                ],
                onClick: ({ key }: any) => {
                  if (key === 'logout') handleLogout();
                  if (key === 'pricing') navigate('/pricing');
                  if (key === 'profile') navigate('/profile');
                }
              }}>
                <Button type="text" style={{ height: 48 }}>
                  <Space>
                    <Avatar size="small" icon={<UserOutlined />} style={{ background: '#6366f1' }} />
                    <span>{user.name}</span>
                    {user.plan && user.plan !== 'free' && (
                      <Tag color={PLAN_LABEL[user.plan]?.color} style={{ marginInlineEnd: 0 }}>
                        {PLAN_LABEL[user.plan]?.text}
                      </Tag>
                    )}
                  </Space>
                </Button>
              </Dropdown>
            ) : (
              <Button type="primary" icon={<LoginOutlined />} onClick={() => navigate('/login')}>
                登录
              </Button>
            )}
          </Space>
        </Header>
        <Content style={{ margin: '16px' }}>
          <div
            style={{
              padding: 24,
              minHeight: 360,
              background: colorBgContainer,
              borderRadius: borderRadiusLG,
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
            }}
          >
            <Outlet />
          </div>
        </Content>
        <Footer style={{ textAlign: 'center', color: '#94a3b8' }}>
          Reasonix AI Agent Platform ©2025 · 一站式 AI 学习 / 创作 / 生产力平台
        </Footer>
      </Layout>
    </Layout>
  );
}

export default App;
