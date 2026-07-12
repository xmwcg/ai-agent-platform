import { useEffect, useCallback } from 'react';
import { Layout, Menu, theme, Typography, Button, Avatar, Dropdown, Space, Tag, Drawer } from 'antd';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
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
  MenuOutlined,
  GiftOutlined,
} from '@ant-design/icons';
import { useAuthStore } from '@/stores/auth';
import { useUIStore } from '@/stores/ui';

const { Header, Content, Footer, Sider } = Layout;
const { Title } = Typography;

const PLAN_LABEL: Record<string, { text: string; color: string }> = {
  free: { text: '免费版', color: 'default' },
  pro: { text: '专业版', color: 'blue' },
  max: { text: '旗舰版', color: 'gold' },
};

// ─── 响应式断点 ───
const MOBILE_BREAKPOINT = 768;

// ─── 侧边栏菜单配置 ───
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
    { key: '/points-center', icon: <GiftOutlined />, label: '积分中心' },
    { key: '/profile', icon: <ProfileOutlined />, label: '个人中心' },
  ]},
];

function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const { token: { colorBgContainer, borderRadiusLG } } = theme.useToken();

  // ─── Zustand 全局状态 ───
  const user = useAuthStore((s) => s.user);
  const status = useAuthStore((s) => s.status);
  const fetchProfile = useAuthStore((s) => s.fetchProfile);
  const logout = useAuthStore((s) => s.logout);

  const sidebarCollapsed = useUIStore((s) => s.sidebarCollapsed);
  const sidebarMobileOpen = useUIStore((s) => s.sidebarMobileOpen);
  const isMobile = useUIStore((s) => s.isMobile);
  const setSidebarCollapsed = useUIStore((s) => s.setSidebarCollapsed);
  const setSidebarMobileOpen = useUIStore((s) => s.setSidebarMobileOpen);
  const setViewport = useUIStore((s) => s.setViewport);

  // ─── 初始化：拉取用户信息 ───
  useEffect(() => {
    if (status === 'idle') {
      fetchProfile();
    }
  }, [status, fetchProfile]);

  // ─── 响应式视口监听 ───
  const handleResize = useCallback(() => {
    setViewport(window.innerWidth);
  }, [setViewport]);

  useEffect(() => {
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [handleResize]);

  // ─── 移动端自动收起侧边栏 ───
  useEffect(() => {
    if (isMobile && !sidebarCollapsed) {
      setSidebarCollapsed(true);
    }
  }, [isMobile]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleMenuClick = (key: string) => {
    navigate(key);
    // 移动端点击菜单后自动关闭
    if (isMobile) {
      setSidebarMobileOpen(false);
    }
  };

  // ─── 当前选中菜单项 ───
  const selectedKey = location.pathname === '/' ? '/' : '/' + location.pathname.split('/')[1];

  // ─── 渲染侧边栏菜单 ───
  const renderMenu = () => (
    <Menu
      theme="dark"
      mode="inline"
      selectedKeys={[selectedKey]}
      defaultSelectedKeys={['/']}
      items={menuItems}
      onClick={({ key }) => handleMenuClick(key)}
      style={{ background: 'transparent', borderInlineEnd: 0 }}
    />
  );

  // ─── 渲染 Sider Logo ───
  const renderLogo = (collapsed: boolean) => (
    <div style={{
      height: 56, margin: 16, display: 'flex', alignItems: 'center', gap: 10,
      color: '#fff', fontWeight: 700, fontSize: 16, paddingLeft: collapsed ? 0 : 8,
      cursor: 'pointer',
    }} onClick={() => navigate('/')}>
      <RobotOutlined style={{ fontSize: 22, color: '#6366f1' }} />
      {!collapsed && <span>Reasonix AI</span>}
    </div>
  );

  // ─── 渲染用户区域 ───
  const renderUserArea = () => {
    if (status === 'loading') return null;
    if (!user) {
      return (
        <Button type="primary" icon={<LoginOutlined />} onClick={() => navigate('/login')}>
          登录
        </Button>
      );
    }
    return (
      <Dropdown menu={{
        items: [
          { key: 'profile', icon: <UserOutlined />, label: '个人中心' },
          ...(user.plan && user.plan !== 'free' ? [{ key: 'pricing', icon: <CrownOutlined />, label: '管理订阅' }] : []),
          { type: 'divider' as const },
          { key: 'logout', icon: <LogoutOutlined />, label: '退出登录', danger: true },
        ],
        onClick: ({ key }: any) => {
          if (key === 'logout') handleLogout();
          if (key === 'pricing') navigate('/pricing');
          if (key === 'profile') navigate('/profile');
        },
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
    );
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {/* ─── 桌面端侧边栏 ─── */}
      {!isMobile && (
        <Sider
          collapsible
          collapsed={sidebarCollapsed}
          onCollapse={(value) => setSidebarCollapsed(value)}
          width={232}
          style={{ background: 'linear-gradient(180deg, #0f172a 0%, #1e293b 100%)' }}
        >
          {renderLogo(sidebarCollapsed)}
          {renderMenu()}
        </Sider>
      )}

      {/* ─── 移动端 Drawer 侧边栏 ─── */}
      {isMobile && (
        <Drawer
          placement="left"
          open={sidebarMobileOpen}
          onClose={() => setSidebarMobileOpen(false)}
          width={260}
          bodyStyle={{ padding: 0, background: 'linear-gradient(180deg, #0f172a 0%, #1e293b 100%)' }}
          headerStyle={{ background: '#0f172a', borderBottom: '1px solid rgba(255,255,255,0.08)' }}
          title={<span style={{ color: '#fff' }}>Reasonix AI</span>}
          closeIcon={<span style={{ color: '#fff' }}>✕</span>}
        >
          {renderMenu()}
        </Drawer>
      )}

      <Layout>
        {/* ─── 顶栏 ─── */}
        <Header style={{
          padding: isMobile ? '0 12px' : '0 24px',
          background: colorBgContainer,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid #f0f0f0',
          position: 'sticky',
          top: 0,
          zIndex: 10,
        }}>
          <Space>
            {/* 移动端汉堡菜单 */}
            {isMobile && (
              <Button
                type="text"
                icon={<MenuOutlined />}
                onClick={() => setSidebarMobileOpen(true)}
                style={{ fontSize: 18 }}
              />
            )}
            <Title level={4} style={{
              margin: 0,
              color: '#0f172a',
              letterSpacing: 0.5,
              fontSize: isMobile ? 16 : 20,
            }}>
              AI Agent 智能体平台
            </Title>
          </Space>
          <Space>
            {renderUserArea()}
          </Space>
        </Header>

        {/* ─── 内容区 ─── */}
        <Content style={{ margin: isMobile ? '8px' : '16px' }}>
          <div
            style={{
              padding: isMobile ? 16 : 24,
              minHeight: 360,
              background: colorBgContainer,
              borderRadius: borderRadiusLG,
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            }}
          >
            <Outlet />
          </div>
        </Content>

        {/* ─── 页脚 ─── */}
        <Footer style={{
          textAlign: 'center',
          color: '#94a3b8',
          fontSize: isMobile ? 12 : 14,
          padding: isMobile ? '12px 24px' : '24px 50px',
        }}>
          Reasonix AI Agent Platform ©2025 · 一站式 AI 学习 / 创作 / 生产力平台
          <span style={{ marginLeft: 12 }}>
            <a onClick={() => navigate('/terms')} style={{ color: '#94a3b8', cursor: 'pointer' }}>服务条款</a>
            <span style={{ margin: '0 8px' }}>·</span>
            <a onClick={() => navigate('/privacy')} style={{ color: '#94a3b8', cursor: 'pointer' }}>隐私政策</a>
          </span>
        </Footer>
      </Layout>
    </Layout>
  );
}

export default App;
