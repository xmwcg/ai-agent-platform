import { useEffect, useLayoutEffect, useCallback, useMemo, useState } from 'react';
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
  ApartmentOutlined, EditOutlined, MenuOutlined, GiftOutlined, ShareAltOutlined, ShopOutlined,
  SunOutlined, MoonOutlined, ThunderboltOutlined, PictureOutlined,
  BarChartOutlined, ExperimentOutlined, BulbOutlined, SecurityScanOutlined, SearchOutlined,
} from '@ant-design/icons';
import { useAuthStore } from '@/stores/auth';
import { useUIStore } from '@/stores/ui';
import FreeExperienceFab from '@/components/FreeExperienceFab';
import ScrollFab from '@/components/ScrollFab';
import CustomerServiceFab from '@/components/CustomerServiceFab';
import AppFooter from '@/components/AppFooter';
import CookieConsentBanner from './components/CookieConsentBanner';
import GlobalSearch from '@/components/GlobalSearch';
import SiteQueryMenu from '@/components/SiteQueryMenu';
import { NAVIGATION_GROUPS, SITE_FEATURES, visibleSiteFeatures } from '@/config/site-features';

// ─── 品牌常量 ───
const BRAND_NAME = 'AIbak';
const BRAND_SLOGAN = '打造您的全栈 AI 应用平台';
const BRAND_URL = 'https://aibak.site';

const { Header, Content, Sider } = Layout;
const { Text } = Typography;

// ─── 全站功能注册表驱动菜单、面包屑和搜索 ───
const FEATURE_ICONS: Record<string, React.ReactNode> = {
  home: <HomeOutlined />, rocket: <RocketOutlined />, robot: <RobotOutlined />,
  book: <BookOutlined />, code: <CodeOutlined />, experiment: <ExperimentOutlined />,
  compass: <CompassOutlined />, bulb: <BulbOutlined />, tool: <ToolOutlined />,
  chart: <BarChartOutlined />, calendar: <CalendarOutlined />, workflow: <NodeIndexOutlined />,
  search: <SearchOutlined />, api: <ApiOutlined />, shop: <ShopOutlined />,
  apps: <AppstoreOutlined />, setting: <SettingOutlined />, service: <CustomerServiceOutlined />,
  team: <TeamOutlined />, dashboard: <DashboardOutlined />, security: <SecurityScanOutlined />,
  crown: <CrownOutlined />, gift: <GiftOutlined />, share: <ShareAltOutlined />,
  profile: <ProfileOutlined />,
};

const MENU_GROUPS = (role?: string) => {
  const visible = new Map(visibleSiteFeatures(role).map((feature) => [feature.id, feature]));
  return NAVIGATION_GROUPS.map((group) => ({
    key: group.key,
    label: group.label,
    defaultOpen: group.defaultOpen,
    children: group.featureIds
      .map((id) => visible.get(id))
      .filter((feature): feature is NonNullable<typeof feature> => Boolean(feature))
      .map((feature) => ({ key: feature.path, label: feature.title, icon: FEATURE_ICONS[feature.icon] })),
  })).filter((group) => group.children.length > 0);
};

const ALL_MENU_FLAT: Record<string, string> = Object.fromEntries(
  SITE_FEATURES.map((feature) => [feature.path, feature.title]),
);

const PLAN_TAGS: Record<string, { text: string; color: string }> = {
  free: { text: '免费版', color: 'default' },
  pro: { text: '专业版', color: 'blue' },
  max: { text: '旗舰版', color: 'gold' },
};

// ─── 面包屑路径解析 ───
function useBreadcrumbs() {
  const location = useLocation();

  // ─── 路由切换时滚动到顶部 ───
  useEffect(() => {
    // 自管理滚动的页面跳过全局 scrollTo（避免与页面内部滚动冲突）
    const SELF_SCROLL_PAGES = ['/ai-chat', '/aibak-chat', '/sandbox'];
    if (SELF_SCROLL_PAGES.some(p => location.pathname.startsWith(p))) return;
    // 延迟执行以确保页面 DOM 已更新
    var timer = setTimeout(() => {
      window.scrollTo({ top: 0, behavior: 'instant' });
      // 也处理可滚动的容器元素
      var mainContent = document.querySelector('.ant-layout-content');
      if (mainContent) mainContent.scrollTop = 0;
    }, 50);
    return () => clearTimeout(timer);
  }, [location.pathname]);
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
        crumbs.push({ label: decoded.length > 16 ? decoded.slice(0, 16) + "..." : decoded, path: accumulated });
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

function RouteScrollRestoration() {
  const location = useLocation();

  // 以下页面自行管理滚动（内部容器 overflow:auto + height:100vh），跳过全局 scrollTo 以避免页面弹跳
  const SELF_SCROLL_PAGES = ['/ai-chat', '/aibak-chat', '/sandbox'];

  useEffect(() => {
    const previous = window.history.scrollRestoration;
    window.history.scrollRestoration = 'manual';
    return () => {
      window.history.scrollRestoration = previous;
    };
  }, []);

  // 只响应 pathname 变更（页面导航），不响应 hash 变更（页内锚点），
  // 避免 hash 锚点定位与强制回到顶部并行执行，导致页面弹到下方。
  useLayoutEffect(() => {
    let frame = 0;
    let hashAttempts = 0;

    // 跳过自管理滚动的页面（AI对话/沙盒等有独立滚动容器）
    if (SELF_SCROLL_PAGES.some(p => location.pathname.startsWith(p))) return;
    // 立即同步滚动一次：useLayoutEffect 在 paint 前同步执行，
    // 保证浏览器以 scrollY=0 渲染新页面，避免先看到旧位置再跳的闪烁。
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });

    const scrollToLocation = () => {
      if (location.hash) {
        let id = location.hash.slice(1);
        try {
          id = decodeURIComponent(id);
        } catch {
          // 非法 hash 不应阻塞。
        }
        const element = window.document.getElementById(id);
        if (element) {
          const top = element.getBoundingClientRect().top + window.scrollY - 80;
          window.scrollTo({ top: Math.max(0, top), left: 0, behavior: 'auto' });
          return;
        }
        // 详情正文可能在异步请求后才生成，短暂重试避免深链接落在旧页面位置。
        if (hashAttempts < 8) {
          hashAttempts += 1;
          frame = window.requestAnimationFrame(scrollToLocation);
          return;
        }
      }
      // 无 hash 且 hash 重试耗尽：保持在顶部（已在同步步骤中完成）。
    };

    if (location.hash) {
      // 有 hash 的页面导航：只做 hash 定位，不并行强制回到顶部。
      frame = window.requestAnimationFrame(scrollToLocation);
    } else {
      if (SELF_SCROLL_PAGES.some(p => location.pathname.startsWith(p))) return;
      // 无 hash 的普通导航：仅做一次延迟校正，避免多帧重复滚动导致的页面弹跳。
      // useLayoutEffect 的同步 scrollTo 已确保首帧在顶部；
      // 无 hash 导航：多次校正确保始终回到顶部，防止异步加载内容导致页面弹跳
      const t1 = window.setTimeout(() => window.scrollTo({ top: 0, left: 0, behavior: 'auto' }), 100);
      const t2 = window.setTimeout(() => window.scrollTo({ top: 0, left: 0, behavior: 'auto' }), 500);
      const t3 = window.setTimeout(() => window.scrollTo({ top: 0, left: 0, behavior: 'auto' }), 1000);

      return () => {
        window.clearTimeout(t1);
        window.clearTimeout(t2);
        window.clearTimeout(t3);
      };
    }

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [location.pathname]);

  return null;
}

// ══════════════════════════════════════════════════════════════
//  App 主组件
// ══════════════════════════════════════════════════════════════
function App() {
  const navigate = useNavigate();
  const location = useLocation();

  // ─── Zustand 全局状态───
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

  // 菜单按当前用户角色动态生成（管理员可见「用户管理」）
  const menuGroups = useMemo(() => MENU_GROUPS(user?.role), [user?.role]);

  // ─── 初始化───
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

  // ─── 移动端自动折叠───
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
    for (const group of menuGroups) {
      if (group.children.some((c) => selectedKeys.includes(c.key))) return [group.key];
    }
    return ['core'];
  }, [selectedKeys, menuGroups]);

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

  // ─── 渲染桌面侧边栏菜单───
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
      items={menuGroups.map((group) => ({
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

  // ─── 渲染用户区───
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

  // ─── 渲染面包屑───
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

  // --- 内容区域页码过渡 key：由 Outlet wrapper 根据 pathname 驱动动画 ---

  return (
    <>
      <RouteScrollRestoration />
      <Layout style={{ minHeight: '100vh', background: 'var(--bg-base)' }}>
      {/* 桌面 / 平板侧边栏*/}
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

      {/* 主区域*/}
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
          <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 4 : 12, flex: 1, minWidth: 0 }}>
            {isMobile ? (
              <Button type="text" icon={<MenuOutlined />} onClick={() => setSidebarMobileOpen(true)} style={{ fontSize: 18, width: 36, height: 36, flexShrink: 0 }} />
            ) : (
              <Button type="text" icon={<MenuOutlined />} onClick={() => setSidebarCollapsed(!sidebarCollapsed)} style={{ fontSize: 16, width: 36, height: 36, flexShrink: 0 }} />
            )}
            <a
              href={BRAND_URL}
              target="_blank"
              rel="noopener noreferrer"
              title="访问官网 aibak.site"
              style={{ display: 'flex', alignItems: 'baseline', gap: 8, textDecoration: 'none', flexShrink: 0 }}
            >
              <span style={{ fontWeight: 800, fontSize: isMobile ? 16 : 19, color: 'var(--text-primary)', letterSpacing: '-0.3px' }}>
                {BRAND_NAME}
              </span>
              {!isMobile && !isTablet && (
                <span style={{ fontWeight: 500, fontSize: 13, color: 'var(--text-tertiary)' }}>{BRAND_SLOGAN}</span>
              )}
            </a>
            <GlobalSearch compact={isMobile || isTablet} />
            <SiteQueryMenu compact={isMobile || isTablet} />
          </div>

          <Space size={4}>
            {/* 移动端为搜索与查询入口让出空间，主题切换保留在桌面端 */}
            {!isMobile && <Tooltip title={themeMode === 'dark' ? '切换亮色' : '切换暗色'}>
              <Button
                type="text"
                icon={themeMode === 'dark' ? <SunOutlined /> : <MoonOutlined />}
                onClick={toggleTheme}
                style={{ width: 36, height: 36, fontSize: 16, borderRadius: 10 }}
              />
            </Tooltip>}

            {/* 系统状态*/}
            {!isMobile && <Tooltip title="系统运行正常">
              <Badge dot status="success" offset={[-2, 2]}>
                <Button type="text" icon={<DashboardOutlined />}
                  style={{ width: 36, height: 36, borderRadius: 10 }} />
              </Badge>
            </Tooltip>}

            {renderUserArea()}
          </Space>
        </Header>

        {/* ─── 内容区─── */}
        <Content
          style={{
            margin: isMobile ? '8px' : '16px',
            paddingBottom: isMobile ? 64 : 0, // 为底部 TabBar 留空间
          }}
        >
          {!isMobile && breadcrumbs.length > 1 && (
            <div style={{ margin: '0 4px 12px', minHeight: 24 }}>{renderBreadcrumb()}</div>
          )}
          <div style={{
            padding: isMobile ? 16 : 24,
            minHeight: 360,
            background: 'var(--bg-container)',
            borderRadius: 16,
            border: '1px solid var(--border-light)',
            boxShadow: '0 1px 2px var(--shadow-color)',
          }}>
            <div key={location.pathname} className="page-enter">
              <Outlet />
            </div>
          </div>
          {/* ─── 全局页脚 ─── */}
          <AppFooter />
        </Content>

      {/* ─── 移动端底部 TabBar ─── */}
        {isMobile && (
          <BottomTabBar onMenuOpen={() => setSidebarMobileOpen(true)} />
        )}
      <CookieConsentBanner />
      </Layout>

      {/* 全局左侧悬浮入口：免费体验 AI 工具（ 个免费模型） */}
      <FreeExperienceFab />

      {/* 右下角悬浮工具条：返回顶部 / 返回首页 / 上下翻页 */}
      <ScrollFab />

      {/* 左下角自动客服弹窗（接入云函数 4 模型，售前售后问答） */}
      <CustomerServiceFab />
      <CookieConsentBanner />
      </Layout>
    </>
  );
}

export default App;
