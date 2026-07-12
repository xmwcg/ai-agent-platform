import { useEffect, useCallback, useMemo, useState } from 'react';
import {
  Layout, Menu, Typography, Button, Avatar, Dropdown, Space, Tag,
  Drawer, Breadcrumb, Badge, Tooltip, Switch, Divider,
} from 'antd';
import { Outlet, useNavigate, useLocation, Link } from 'react-router-dom';
import {
  HomeOutlined, BookOutlined, RobotOutlined, SettingOutlined,
  CompassOutlined, CalendarOutlined, UserOutlined, LogoutOutlined,
  LoginOutlined, CrownOutlined, CodeOutlined, ProfileOutlined,
  ApiOutlined, CustomerServiceOutlined, ToolOutlined, RocketOutlined,
  TeamOutlined, DashboardOutlined, AppstoreOutlined, NodeIndexOutlined,
  ApartmentOutlined, EditOutlined, MenuOutlined, GiftOutlined, ShareAltOutlined,
  SunOutlined, MoonOutlined, ThunderboltOutlined, PictureOutlined,
  BarChartOutlined, ExperimentOutlined, BulbOutlined, SecurityScanOutlined,
} from '@ant-design/icons';
import { useAuthStore } from '@/stores/auth';
import { useUIStore } from '@/stores/ui';
import FreeExperienceFab from '@/components/FreeExperienceFab';
import ScrollFab from '@/components/ScrollFab';
import CustomerServiceFab from '@/components/CustomerServiceFab';
import AppFooter from '@/components/AppFooter';

// ─── 品牌常量 ───
const BRAND_NAME = 'AIbak';
const BRAND_SLOGAN = '打造您的全站 AI 应用平台';
const BRAND_URL = 'https://aibak.site';

const { Header, Content, Sider } = Layout;
const { Text } = Typography;

// ─── 常量化菜单配置 ───
const MENU_GROUPS = [
  {
    key: 'core', label: '核心功能', defaultOpen: true,
    children: [
      { key: '/', icon: <HomeOutlined />, label: '首页' },
      { key: '/quickstart', icon: <RocketOutlined />, label: '快速启动' },
      { key: '/ai-chat', icon: <RobotOutlined />, label: 'AI 对话' },
      { key: '/knowledge', icon: <BookOutlined />, label: '通用知识库' },
      { key: '/sandbox', icon: <CodeOutlined />, label: '实践沙盒' },
    ],
  },
  {
    key: 'create', label: '创作与学习',
    children: [
      { key: '/courses', icon: <ExperimentOutlined />, label: '学习中心' },
      { key: '/learning-path', icon: <CompassOutlined />, label: '学习路径' },
      { key: '/creative', icon: <BulbOutlined />, label: '创作工坊' },
      { key: '/code', icon: <CodeOutlined />, label: '代码解释' },
    ],
  },
  {
    key: 'tools', label: '工具与分析',
    children: [
      { key: '/tools', icon: <ToolOutlined />, label: '智能工具箱' },
      { key: '/compare', icon: <BarChartOutlined />, label: '对比分析' },
      { key: '/calendar', icon: <CalendarOutlined />, label: '模型日历' },
      { key: '/workflows', icon: <NodeIndexOutlined />, label: '工作流编辑器' },
    ],
  },
  {
    key: 'platform', label: '平台与生态',
    children: [
      { key: '/model-config', icon: <ApiOutlined />, label: '模型配置' },
      { key: '/marketplace', icon: <ShopOutlined />, label: 'API 市场' },
      { key: '/skills', icon: <AppstoreOutlined />, label: '技能市场' },
      { key: '/plugins', icon: <SettingOutlined />, label: '插件管理' },
      { key: '/customer-service', icon: <CustomerServiceOutlined />, label: '智能客服' },
    ],
  },
  {
    key: 'manage', label: '管理与账户',
    children: [
      { key: '/team', icon: <TeamOutlined />, label: '团队权限' },
      { key: '/diagnostics', icon: <DashboardOutlined />, label: '部署自检' },
      { key: '/pricing', icon: <CrownOutlined />, label: '会员升级' },
      { key: '/points-center', icon: <GiftOutlined />, label: '积分中心' },
      { key: '/distribution', icon: <ShareAltOutlined />, label: '分销中心' },
      { key: '/profile', icon: <ProfileOutlined />, label: '个人中心' },
    ],
  },
];

// 从所有菜单中提取扁平的 key→label 映射，用于面包屑
const ALL_MENU_FLAT: Record<string, string> = {};
MENU_GROUPS.forEach((g) =>
  g.children.forEach((c) => {
    ALL_MENU_FLAT[c.key] = c.label;
  })
);

const PLAN_TAGS: Record<string, { text: string; color: string }> = {
  free: { text: '免费版', color: 'default' },
  pro: { text: '专业版', color: 'blue' },
  max: { text: '旗舰版', color: 'gold' },
};

// ─── 面包屑路径解析 ───
function useBreadcrumbs() {
  const location = useLocation();
  return useMemo(() => {
    const parts = location.pathname.split('/').filter(Boolean);
    if (!parts.length) return [{ label: '首页', path: '/' }];

    const crumbs = [{ label: '首页', path: '/' }];
    let accumulated = '';
    parts.forEach((part, i) => {
      accumulated += '/' + part;
      // 尝试从菜单表匹配
      const matched = ALL_MENU_FLAT[accumulated];
      if (matched) {
        crumbs.push({ label: matched, path: accumulated });
      } else if (i === parts.length - 1) {
        // 最后一个未匹配的 segment，显示原始值
        const decoded = decodeURIComponent(part);
        crumbs.push({ label: decoded.length > 16 ? decoded.slice(0, 16) + '…' : decoded, path: accumulated });
      }
    });
    return crumbs;
  }, [location.pathname]);
}

// ─── 移动端底部 TabBar ───
function BottomTabBar({ onMenuOpen }: { onMenuOpen: () => void }) {
  const navigate = useNavigate();
  const location = useLocation();
  const currentPath = location.pathname;

  const tabs = [
    { key: '/', icon: <HomeOutlined />, label: '首页' },
    { key: '/ai-chat', icon: <RobotOutlined />, label: 'AI 对话' },
    { key: '/knowledge', icon: <BookOutlined />, label: '知识库' },
    { key: '/profile', icon: <UserOutlined />, label: '我的' },
  ];

  return (
    <div className="hide-on-desktop" style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 100,
      background: 'var(--bg-container)', borderTop: '1px solid var(--border)',
      display: 'flex', justifyContent: 'space-around', alignItems: 'center',
      height: 56, paddingBottom: 'env(safe-area-inset-bottom, 0)',
    }}>
      {tabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => (tab.key === '/more' ? onMenuOpen() : navigate(tab.key))}
          style={{
            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', gap: 2, border: 'none', background: 'transparent',
            cursor: 'pointer', padding: '6px 0',
            color: currentPath === tab.key ? 'var(--brand-primary)' : 'var(--text-tertiary)',
            fontSize: 10, lineHeight: 1.2, transition: 'color 0.2s',
          }}
        >
          <span style={{ fontSize: 20 }}>{tab.icon}</span>
          <span>{tab.label}</span>
        </button>
      ))}
      <button
        onClick={onMenuOpen}
        style={{
          flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', gap: 2, border: 'none', background: 'transparent',
          cursor: 'pointer', padding: '6px 0',
          color: 'var(--text-tertiary)', fontSize: 10, lineHeight: 1.2,
        }}
      >
        <span style={{ fontSize: 20 }}><MenuOutlined /></span>
        <span>更多</span>
      </button>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
//  App 主组件
// ══════════════════════════════════════════════════════════════
function App() {
  const navigate = useNavigate();
  const location = useLocation();

  // ─── Zustand 全局状态 ───
  const user = useAuthStore((s) => s.user);
  const status = useAuthStore((s) => s.status);
  const fetchProfile = useAuthStore((s) => s.fetchProfile);
  const logout = useAuthStore((s) => s.logout);

  const sidebarCollapsed = useUIStore((s) => s.sidebarCollapsed);
  const sidebarMobileOpen = useUIStore((s) => s.sidebarMobileOpen);
  const isMobile = useUIStore((s) => s.isMobile);
  const isTablet = useUIStore((s) => s.isTablet);
  const themeMode = useUIStore((s) => s.themeMode);
  const setSidebarCollapsed = useUIStore((s) => s.setSidebarCollapsed);
  const setSidebarMobileOpen = useUIStore((s) => s.setSidebarMobileOpen);
  const setViewport = useUIStore((s) => s.setViewport);
  const toggleTheme = useUIStore((s) => s.toggleTheme);

  const breadcrumbs = useBreadcrumbs();

  // ─── 初始化 ───
  useEffect(() => {
    if (status === 'idle') fetchProfile();
  }, [status, fetchProfile]);

  // ─── 视口监听 ───
  const handleResize = useCallback(() => setViewport(window.innerWidth), [setViewport]);
  useEffect(() => {
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [handleResize]);

  // ─── 移动端自动折叠 ───
  useEffect(() => {
    if (isMobile && !sidebarCollapsed) setSidebarCollapsed(true);
  }, [isMobile]);

  // ─── 当前选中菜单（智能匹配路径） ───
  const selectedKeys = useMemo(() => {
    const path = location.pathname;
    if (path === '/') return ['/'];
    // 优先最长匹配
    const candidates = Object.keys(ALL_MENU_FLAT).filter((k) => k !== '/' && path.startsWith(k));
    candidates.sort((a, b) => b.length - a.length);
    return candidates.length > 0 ? [candidates[0]] : ['/'];
  }, [location.pathname]);

  // 默认展开的菜单组
  const defaultOpenKeys = useMemo(() => {
    for (const group of MENU_GROUPS) {
      if (group.children.some((c) => selectedKeys.includes(c.key))) return [group.key];
    }
    return ['core'];
  }, [selectedKeys]);

  const handleMenuClick = (key: string) => {
    navigate(key);
    if (isMobile) setSidebarMobileOpen(false);
  };

  const handleLogout = () => { logout(); navigate('/login'); };

  // ─── 渲染 Logo（左上角品牌，悬浮锁定；点击回首页） ───
  const renderLogo = (collapsed: boolean) => (
    <div
      onClick={() => { navigate('/'); window.scrollTo({ top: 0, behavior: 'smooth' }); if (isMobile) setSidebarMobileOpen(false); }}
      title={`${BRAND_NAME} · ${BRAND_SLOGAN}`}
      style={{
        position: 'sticky', top: 0, zIndex: 5,
        height: collapsed ? 56 : 64, padding: collapsed ? '12px 0' : '12px 16px',
        display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
        transition: 'all 0.2s ease',
        background: 'var(--bg-sidebar)',
        borderBottom: '1px solid var(--border-light)',
      }}
    >
      <div style={{
        width: 34, height: 34, borderRadius: 10, flexShrink: 0,
        background: 'linear-gradient(135deg, #6c5ce7 0%, #a29bfe 100%)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 2px 8px rgba(108,92,231,0.3)',
      }}>
        <ThunderboltOutlined style={{ color: '#fff', fontSize: 17 }} />
      </div>
      {!collapsed && (
        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.15, overflow: 'hidden' }}>
          <span style={{ fontWeight: 800, fontSize: 18, color: 'var(--text-primary)', letterSpacing: '-0.3px' }}>
            {BRAND_NAME}
          </span>
          <span style={{ fontSize: 10.5, color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>
            {BRAND_SLOGAN}
          </span>
        </div>
      )}
    </div>
  );

  // ─── 渲染桌面侧边栏菜单 ───
  const renderSideMenu = () => (
    <Menu
      mode="inline"
      selectedKeys={selectedKeys}
      defaultOpenKeys={defaultOpenKeys}
      onClick={({ key }) => handleMenuClick(key)}
      style={{
        background: 'transparent', borderInlineEnd: 0,
        color: 'var(--text-secondary)', fontWeight: 500,
      }}
      items={MENU_GROUPS.map((group) => ({
        type: 'group' as const,
        key: group.key,
        label: sidebarCollapsed ? undefined : (
          <span style={{
            fontSize: 11, fontWeight: 600, letterSpacing: '0.04em',
            color: 'var(--text-tertiary)', textTransform: 'uppercase',
          }}>
            {group.label}
          </span>
        ),
        children: group.children.map((item) => {
          const isPrimary = item.key === '/' || item.key === '/ai-chat';
          return {
            key: item.key,
            icon: <span style={{ fontSize: 18, color: isPrimary ? 'var(--brand-primary)' : undefined }}>{item.icon}</span>,
            label: item.label,
            style: isPrimary ? { fontWeight: 600 } : undefined,
          };
        }),
      }))}
    />
  );

  // ─── 渲染用户区 ───
  const renderUserArea = () => {
    if (status === 'loading') return <div style={{ width: 80 }} />;
    if (!user) {
      return (
        <Button type="primary" icon={<LoginOutlined />} onClick={() => navigate('/login')} size={isMobile ? 'small' : 'middle'}>
          登录
        </Button>
      );
    }
    return (
      <Dropdown
        menu={{
          items: [
            { key: 'profile', icon: <UserOutlined />, label: '个人中心' },
            { key: 'points-center', icon: <GiftOutlined />, label: '积分中心' },
            ...(user.plan && user.plan !== 'free' ? [{ key: 'pricing', icon: <CrownOutlined />, label: '管理订阅' }] : []),
            { type: 'divider' as const },
            { key: 'logout', icon: <LogoutOutlined />, label: '退出登录', danger: true },
          ],
          onClick: ({ key }: any) => {
            if (key === 'logout') handleLogout();
            if (key === 'pricing') navigate('/pricing');
            if (key === 'profile') navigate('/profile');
            if (key === 'points-center') navigate('/points-center');
          },
        }}
        placement="bottomRight"
      >
        <Button type="text" style={{
          height: isMobile ? 36 : 44, padding: '0 8px', borderRadius: 12,
        }}>
          <Space size={8}>
            <Avatar size={isMobile ? 28 : 32} icon={<UserOutlined />}
              style={{ background: 'linear-gradient(135deg, #6c5ce7, #a29bfe)' }} />
            {!isMobile && <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{user.name}</span>}
            {user.plan && user.plan !== 'free' && !isMobile && (
              <Tag color={PLAN_TAGS[user.plan]?.color} style={{ marginInlineEnd: 0 }}>
                {PLAN_TAGS[user.plan]?.text}
              </Tag>
            )}
          </Space>
        </Button>
      </Dropdown>
    );
  };

  // ─── 渲染面包屑 ───
  const renderBreadcrumb = () => {
    if (isMobile || breadcrumbs.length <= 1) return null;
    return (
      <Breadcrumb
        items={breadcrumbs.map((crumb, i) => ({
          title: i === breadcrumbs.length - 1 ? crumb.label : <Link to={crumb.path}>{crumb.label}</Link>,
        }))}
        style={{ fontSize: 13 }}
      />
    );
  };

  const sidebarSider = (
    <Sider
      collapsible
      collapsed={sidebarCollapsed}
      onCollapse={(v) => setSidebarCollapsed(v)}
      width={240}
      collapsedWidth={72}
      trigger={null}
      style={{
        background: 'var(--bg-sidebar)',
        borderRight: '1px solid var(--border)',
        boxShadow: 'var(--sidebar-shadow)',
        transition: 'all 0.25s ease',
        overflowY: 'auto',
      }}
    >
      {renderLogo(sidebarCollapsed)}
      <div style={{ paddingBottom: 20 }}>
        {renderSideMenu()}
      </div>
    </Sider>
  );

  // ─── 桌面/平板：经典侧边栏 ───
  // ─── 移动端：Drawer ───
  const sidebarContent = (
    <div style={{
      height: '100%', display: 'flex', flexDirection: 'column',
      background: 'var(--bg-sidebar)',
    }}>
      {renderLogo(false)}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {renderSideMenu()}
      </div>
    </div>
  );

  // ─── 内容区域页码过渡 key ───
  const [pageKey, setPageKey] = useState(0);
  useEffect(() => {
    setPageKey((k) => k + 1);
  }, [location.pathname]);

  return (
    <Layout style={{ minHeight: '100vh', background: 'var(--bg-base)' }}>
      {/* 桌面端/平板侧边栏 */}
      {!isMobile && sidebarSider}

      {/* 移动端 Drawer */}
      {isMobile && (
        <Drawer
          placement="left"
          open={sidebarMobileOpen}
          onClose={() => setSidebarMobileOpen(false)}
          width={280}
          bodyStyle={{ padding: 0 }}
          headerStyle={{ display: 'none' }}
          closable={false}
        >
          {sidebarContent}
        </Drawer>
      )}

      {/* 主区域 */}
      <Layout style={{ background: 'var(--bg-base)' }}>
        {/* ─── 顶栏 ─── */}
        <Header style={{
          height: isMobile ? 48 : 56,
          padding: isMobile ? '0 12px' : '0 24px',
          background: 'var(--header-bg)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          borderBottom: '1px solid var(--border)',
          position: 'sticky', top: 0, zIndex: 50,
          transition: 'background 0.3s',
        }}>
          <Space size={12}>
            {/* 移动端汉堡菜单 */}
            {isMobile && (
              <Button type="text" icon={<MenuOutlined />}
                onClick={() => setSidebarMobileOpen(true)}
                style={{ fontSize: 18, width: 36, height: 36 }} />
            )}
            {/* 桌面端侧边栏折叠按钮 */}
            {!isMobile && (
              <Button
                type="text"
                icon={<MenuOutlined />}
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                style={{ fontSize: 16, width: 36, height: 36 }}
              />
            )}
            {/* 品牌标题（悬浮锁定左上角，链接官网 aibak.site） */}
            <a
              href={BRAND_URL}
              target="_blank"
              rel="noopener noreferrer"
              title="访问官网 aibak.site"
              style={{ display: 'flex', alignItems: 'baseline', gap: 8, textDecoration: 'none' }}
            >
              <span style={{
                fontWeight: 800, fontSize: isMobile ? 16 : 19,
                color: 'var(--text-primary)', letterSpacing: '-0.3px',
              }}>
                {BRAND_NAME}
              </span>
              {!isMobile && (
                <span style={{ fontWeight: 500, fontSize: 13, color: 'var(--text-tertiary)' }}>
                  {BRAND_SLOGAN}
                </span>
              )}
            </a>
          </Space>

          {/* 面包屑（桌面） */}
          {!isMobile && (
            <div style={{
              position: 'absolute', left: '50%', transform: 'translateX(-50%)',
              pointerEvents: 'auto',
            }}>
              {renderBreadcrumb()}
            </div>
          )}

          <Space size={4}>
            {/* 主题切换 */}
            <Tooltip title={themeMode === 'dark' ? '切换亮色' : '切换暗色'}>
              <Button
                type="text"
                icon={themeMode === 'dark' ? <SunOutlined /> : <MoonOutlined />}
                onClick={toggleTheme}
                style={{ width: 36, height: 36, fontSize: 16, borderRadius: 10 }}
              />
            </Tooltip>

            {/* 系统状态 */}
            <Tooltip title="系统运行正常">
              <Badge dot status="success" offset={[-2, 2]}>
                <Button type="text" icon={<DashboardOutlined />}
                  style={{ width: 36, height: 36, borderRadius: 10 }} />
              </Badge>
            </Tooltip>

            {renderUserArea()}
          </Space>
        </Header>

        {/* ─── 内容区 ─── */}
        <Content
          key={pageKey}
          className="page-enter"
          style={{
            margin: isMobile ? '8px' : '16px',
            paddingBottom: isMobile ? 64 : 0, // 为底部 TabBar 留空间
          }}
        >
          <div style={{
            padding: isMobile ? 16 : 24,
            minHeight: 360,
            background: 'var(--bg-container)',
            borderRadius: 16,
            border: '1px solid var(--border-light)',
            boxShadow: '0 1px 2px var(--shadow-color)',
          }}>
            <Outlet />
          </div>
          {/* ─── 全局页脚 ─── */}
          <AppFooter />
        </Content>

        {/* ─── 移动端底部 TabBar ─── */}
        {isMobile && (
          <BottomTabBar onMenuOpen={() => setSidebarMobileOpen(true)} />
        )}
      </Layout>

      {/* 全局左侧悬浮入口：免费体验 AI 工具（4 个免费模型） */}
      <FreeExperienceFab />

      {/* 右下角悬浮工具条：返回顶部 / 返回首页 / 上下翻页 */}
      <ScrollFab />

      {/* 左下角自动客服弹窗（接入云函数 4 模型，售前售后问答） */}
      <CustomerServiceFab />
    </Layout>
  );
}

export default App;
