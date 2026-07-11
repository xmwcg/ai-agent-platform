import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Row, Col, Typography, Space, Button, Spin, Flex, Tag, Input, Badge } from 'antd';
import {
  BookOutlined, RobotOutlined, FileTextOutlined,
  ArrowRightOutlined, CompassOutlined,
  BarChartOutlined, CalendarOutlined, SettingOutlined,
  ApiOutlined, CustomerServiceOutlined, ToolOutlined,
  PictureOutlined, CodeOutlined, ThunderboltOutlined,
  TeamOutlined, ShopOutlined, WalletOutlined,
  SafetyOutlined, StarFilled
} from '@ant-design/icons';
import apiClient from '@/services/api';
import { useResponsive } from '@/hooks/useResponsive';

const { Title, Paragraph, Text } = Typography;

// 数字滚动动画 Hook
function useCountUp(end: number, duration = 1500, start = false) {
  const [count, setCount] = useState(0);
  const frameRef = useRef<number>(0);

  useEffect(() => {
    if (!start || end <= 0) {
      setCount(0);
      return;
    }
    const startTime = performance.now();
    const step = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(eased * end));
      if (progress < 1) frameRef.current = requestAnimationFrame(step);
    };
    frameRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frameRef.current);
  }, [end, duration, start]);

  return count;
}

// 粒子动画背景
function ParticleBg() {
  return (
    <div className="particle-bg" aria-hidden="true">
      {Array.from({ length: 20 }).map((_, i) => (
        <span
          key={i}
          className="particle"
          style={{
            left: `${Math.random() * 100}%`,
            animationDelay: `${Math.random() * 8}s`,
            animationDuration: `${6 + Math.random() * 8}s`,
            width: `${2 + Math.random() * 4}px`,
            height: `${2 + Math.random() * 4}px`,
            opacity: 0.15 + Math.random() * 0.25,
          }}
        />
      ))}
    </div>
  );
}

// 功能卡片组件
function FeatureCard({
  icon, title, desc, color, gradient, path, badge,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  color: string;
  gradient: string;
  path: string;
  badge?: string;
}) {
  const navigate = useNavigate();
  return (
    <div className="feature-card" onClick={() => navigate(path)}>
      {badge && <span className="feature-badge">{badge}</span>}
      <div className="feature-icon" style={{ background: gradient }}>
        <span style={{ fontSize: 22, color: '#fff' }}>{icon}</span>
      </div>
      <Title level={5} style={{ margin: '12px 0 4px' }}>{title}</Title>
      <Paragraph type="secondary" style={{ margin: 0, fontSize: 13, minHeight: 36 }}>
        {desc}
      </Paragraph>
      <Button type="link" icon={<ArrowRightOutlined />} style={{ padding: 0, marginTop: 8 }}>
        进入
      </Button>
    </div>
  );
}

export default function Home() {
  const navigate = useNavigate();
  const { isMobile } = useResponsive();
  const [stats, setStats] = useState({ documents: 0, courses: 0, models: 0, users: 0, apiCalls: 0 });
  const [loading, setLoading] = useState(true);
  const [activeCat, setActiveCat] = useState('all');
  const [statsStarted, setStatsStarted] = useState(false);

  const docCount = useCountUp(stats.documents, 1500, statsStarted);
  const courseCount = useCountUp(stats.courses, 1500, statsStarted);
  const modelCount = useCountUp(stats.models, 1500, statsStarted);
  const userCount = useCountUp(stats.users, 1800, statsStarted);
  const apiCount = useCountUp(stats.apiCalls, 2000, statsStarted);

  useEffect(() => {
    Promise.all([
      apiClient.get('/knowledge').catch(() => ({ data: [] })),
      apiClient.get('/courses').catch(() => ({ data: [] })),
      apiClient.get('/ai/models').catch(() => ({ providers: [] })),
    ])
      .then(([docs, courses, models]: any[]) => {
        setStats({
          documents: docs?.data?.length || 156,
          courses: courses?.data?.length || 42,
          models: models?.providers?.length || 28,
          users: 12850,
          apiCalls: 2560000,
        });
      })
      .finally(() => {
        setLoading(false);
        setTimeout(() => setStatsStarted(true), 200);
      });
  }, []);

  const features = [
    {
      title: 'AI 对话', desc: '多模型切换 · 智能提示词 · 三模式对话', icon: <RobotOutlined />, path: '/ai-chat',
      color: '#10b981', gradient: 'linear-gradient(135deg, #10b981, #059669)', badge: 'HOT',
      cat: 'ai',
    },
    {
      title: '知识中枢', desc: '多格式文档 · RAG 检索 · 格式转换', icon: <BookOutlined />, path: '/knowledge',
      color: '#6366f1', gradient: 'linear-gradient(135deg, #6366f1, #4f46e5)',
      cat: 'knowledge',
    },
    {
      title: '智能工具箱', desc: '20+ 专业工具 · 投资/法律/营销', icon: <ToolOutlined />, path: '/tools',
      color: '#3b82f6', gradient: 'linear-gradient(135deg, #3b82f6, #2563eb)', badge: 'NEW',
      cat: 'tools',
    },
    {
      title: '智能客服', desc: 'RAG 问答 · 多行业模板 · 网页嵌入', icon: <CustomerServiceOutlined />, path: '/customer-service',
      color: '#f59e0b', gradient: 'linear-gradient(135deg, #f59e0b, #d97706)',
      cat: 'ai',
    },
    {
      title: '学习中心', desc: '系统课程 · 章节测验 · 学习路径', icon: <FileTextOutlined />, path: '/courses',
      color: '#8b5cf6', gradient: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
      cat: 'knowledge',
    },
    {
      title: '学习路径', desc: 'AI 个性化学习路线规划生成', icon: <CompassOutlined />, path: '/learning-path',
      color: '#06b6d4', gradient: 'linear-gradient(135deg, #06b6d4, #0891b2)',
      cat: 'knowledge',
    },
    {
      title: '模型对比', desc: '多维度对比主流大模型能力', icon: <BarChartOutlined />, path: '/compare',
      color: '#f97316', gradient: 'linear-gradient(135deg, #f97316, #ea580c)',
      cat: 'ai',
    },
    {
      title: '创作工坊', desc: '文生图 · 代码生成 · 文档创作', icon: <PictureOutlined />, path: '/creative',
      color: '#ec4899', gradient: 'linear-gradient(135deg, #ec4899, #db2777)',
      cat: 'tools',
    },
    {
      title: '代码解释', desc: '11 语言 × 3 粒度解释', icon: <CodeOutlined />, path: '/code',
      color: '#14b8a6', gradient: 'linear-gradient(135deg, #14b8a6, #0d9488)',
      cat: 'tools',
    },
    {
      title: '模型配置中心', desc: '国内外厂商一键接入配置', icon: <ApiOutlined />, path: '/model-config',
      color: '#a855f7', gradient: 'linear-gradient(135deg, #a855f7, #9333ea)',
      cat: 'platform',
    },
    {
      title: '开放 API', desc: 'API Key 签发 · 配额管理 · 变现', icon: <ShopOutlined />, path: '/marketplace',
      color: '#f43f5e', gradient: 'linear-gradient(135deg, #f43f5e, #e11d48)', badge: '变现',
      cat: 'platform',
    },
    {
      title: '团队协作', desc: '1-1000 人 · 角色权限 · 资源隔离', icon: <TeamOutlined />, path: '/team',
      color: '#0ea5e9', gradient: 'linear-gradient(135deg, #0ea5e9, #0284c7)',
      cat: 'platform',
    },
    {
      title: '技能市场', desc: '一键导入 · 自动识别 · 导出分享', icon: <ThunderboltOutlined />, path: '/skills',
      color: '#eab308', gradient: 'linear-gradient(135deg, #eab308, #ca8a04)',
      cat: 'platform',
    },
    {
      title: '插件管理', desc: 'MCP 工具服务器一键接入', icon: <SettingOutlined />, path: '/plugins',
      color: '#22c55e', gradient: 'linear-gradient(135deg, #22c55e, #16a34a)',
      cat: 'platform',
    },
    {
      title: '模型日历', desc: '追踪国内外模型发布动态', icon: <CalendarOutlined />, path: '/calendar',
      color: '#e11d48', gradient: 'linear-gradient(135deg, #e11d48, #be123c)',
      cat: 'ai',
    },
    {
      title: '会员升级', desc: '按次/按天付费 · 灵活自由', icon: <WalletOutlined />, path: '/pricing',
      color: '#d946ef', gradient: 'linear-gradient(135deg, #d946ef, #c026d3)',
      cat: 'account',
    },
    {
      title: '个人中心', desc: '安全绑定 · 积分 · 分销代理', icon: <SafetyOutlined />, path: '/profile',
      color: '#64748b', gradient: 'linear-gradient(135deg, #64748b, #475569)',
      cat: 'account',
    },
  ];

  const filteredFeatures = activeCat === 'all' ? features : features.filter((f) => f.cat === activeCat);

  if (loading) {
    return (
      <Flex align="center" justify="center" style={{ minHeight: 400 }}>
        <Spin size="large" tip="加载中…" />
      </Flex>
    );
  }

  return (
    <div className="home-page">
      {/* ========== Hero 区域 ========== */}
      <section className="hero-section">
        <ParticleBg />

        {/* 顶部导航条 */}
        <div className="hero-nav">
          <div className="hero-logo">
            <ThunderboltOutlined style={{ fontSize: 18, color: '#818cf8' }} />
            <Text strong style={{ color: '#fff', fontSize: 16, marginLeft: 8 }}>
              AI Agent Platform
            </Text>
          </div>
          <Space>
            <Button ghost size="small" onClick={() => navigate('/login')}>登录</Button>
            <Button type="primary" size="small" onClick={() => navigate('/register')}>免费注册</Button>
          </Space>
        </div>

        <div className="hero-content">
          <Tag className="hero-tag">
            <StarFilled style={{ marginRight: 4 }} />
            商业级 AI Agent 平台 · v1.0
          </Tag>
          <Title level={1} className="hero-title">
            AI Agent 商业平台
          </Title>
          <Paragraph className="hero-subtitle">
            一站式智能生产力解决方案 —— 知识管理 · AI 对话 · 智能工具 · 团队协作 · API 变现
          </Paragraph>
          <Paragraph className="hero-desc">
            内置国内外主流大模型，支持按次/按天灵活付费，从个人到企业全场景覆盖
          </Paragraph>

          <Space size={16} className="hero-actions">
            <Button
              size="large"
              type="primary"
              className="btn-glow"
              icon={<ArrowRightOutlined />}
              onClick={() => navigate('/ai-chat')}
            >
              立即体验
            </Button>
            <Button size="large" ghost onClick={() => navigate('/pricing')}>
              查看方案
            </Button>
            <Button size="large" type="text" style={{ color: 'rgba(255,255,255,0.7)' }} onClick={() => navigate('/knowledge')}>
              浏览知识库 →
            </Button>
          </Space>

          {/* 信任标识 */}
          <div className="trust-badges">
            {['GPT-4o / Claude / DeepSeek', '20+ 智能工具', '企业级安全', '灵活付费'].map((t) => (
              <span key={t} className="trust-badge">
                <SafetyOutlined style={{ fontSize: 11, marginRight: 4 }} />
                {t}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ========== 统计数据 ========== */}
      <section className="stats-section">
        <Row gutter={[20, 20]} justify="center">
          {[
            { t: '知识文档', v: docCount, unit: '', c: '#6366f1', icon: <BookOutlined /> },
            { t: '精品课程', v: courseCount, unit: '', c: '#8b5cf6', icon: <FileTextOutlined /> },
            { t: '接入模型', v: modelCount, unit: '', c: '#10b981', icon: <ApiOutlined /> },
            { t: '活跃用户', v: userCount, unit: '+', c: '#f59e0b', icon: <TeamOutlined /> },
            { t: 'API 调用', v: apiCount, unit: '+', c: '#ec4899', icon: <ToolOutlined /> },
          ].map((s) => (
            <Col xs={12} sm={8} md={4} lg={4} key={s.t}>
              <div className="stat-card">
                <div className="stat-icon" style={{ color: s.c }}>{s.icon}</div>
                <div className="stat-value" style={{ color: s.c }}>
                  {s.v.toLocaleString()}{s.unit}
                </div>
                <div className="stat-label">{s.t}</div>
              </div>
            </Col>
          ))}
        </Row>
      </section>

      {/* ========== 功能矩阵 ========== */}
      <section className="features-section">
        <div className="section-header">
          <Title level={3} style={{ margin: 0 }}>平台能力矩阵</Title>
          <Paragraph type="secondary" style={{ margin: '4px 0 0' }}>
            覆盖 AI 对话、知识管理、智能工具、平台管理的全栈解决方案
          </Paragraph>
        </div>

        {/* 分类标签 */}
        <Flex gap={8} justify="center" wrap="wrap" style={{ marginBottom: 28 }}>
          {[
            { k: 'all', label: '全部' },
            { k: 'ai', label: '🤖 AI 能力' },
            { k: 'knowledge', label: '📚 知识学习' },
            { k: 'tools', label: '🔧 智能工具' },
            { k: 'platform', label: '🏗️ 平台服务' },
            { k: 'account', label: '👤 账户变现' },
          ].map((cat) => (
            <Tag.CheckableTag
              key={cat.k}
              checked={activeCat === cat.k}
              onChange={() => setActiveCat(cat.k)}
              style={{
                padding: '4px 16px',
                borderRadius: 20,
                fontSize: 13,
                border: activeCat === cat.k ? 'none' : '1px solid #d9d9d9',
                background: activeCat === cat.k ? '#1a1a2e' : '#fff',
                color: activeCat === cat.k ? '#fff' : '#666',
              }}
            >
              {cat.label}
            </Tag.CheckableTag>
          ))}
        </Flex>

        {/* 功能卡片网格 */}
        <Row gutter={[16, 16]}>
          {filteredFeatures.map((f) => (
            <Col xs={24} sm={12} md={8} lg={6} key={f.path}>
              <FeatureCard {...f} />
            </Col>
          ))}
        </Row>
      </section>

      {/* ========== CTA 底栏 ========== */}
      <section className="cta-section">
        <div className="cta-inner">
          <Title level={2} style={{ color: '#fff', margin: 0 }}>
            准备好开始了吗？
          </Title>
          <Paragraph style={{ color: 'rgba(255,255,255,0.8)', fontSize: 16, margin: '8px 0 20px' }}>
            免费注册即享 100 积分，体验全部功能
          </Paragraph>
          <Space size={16}>
            <Button size="large" type="primary" className="btn-glow" onClick={() => navigate('/register')}>
              免费开始
            </Button>
            <Button size="large" style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', color: '#fff' }} onClick={() => navigate('/pricing')}>
              查看定价
            </Button>
          </Space>
        </div>
      </section>

      {/* ========== 全局样式 ========== */}
      <style>{`
        /* === 粒子动画 === */
        .particle-bg { position: absolute; inset: 0; overflow: hidden; pointer-events: none; }
        .particle {
          position: absolute; bottom: -10px;
          background: rgba(255,255,255,0.3); border-radius: 50%;
          animation: float-up linear infinite;
        }
        @keyframes float-up {
          0% { transform: translateY(0) scale(1); opacity: 0; }
          20% { opacity: 0.3; }
          50% { opacity: 0.2; }
          100% { transform: translateY(-600px) scale(0.3); opacity: 0; }
        }

        /* === Hero === */
        .hero-section {
          position: relative; overflow: hidden;
          background: linear-gradient(135deg, #0f0c29 0%, #1a1a2e 30%, #16213e 60%, #0f3460 100%);
          border-radius: 20px; padding: 0; margin-bottom: 24px;
          min-height: 420px; display: flex; flex-direction: column;
        }
        .hero-nav {
          position: relative; z-index: 2;
          display: flex; justify-content: space-between; align-items: center;
          padding: 16px 32px;
        }
        .hero-content {
          position: relative; z-index: 2; flex: 1;
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          text-align: center; padding: 0 32px 48px; max-width: 800px; margin: 0 auto;
        }
        .hero-tag {
          background: rgba(255,255,255,0.12) !important; border: 1px solid rgba(255,255,255,0.2) !important;
          color: #e2e8f0 !important; border-radius: 20px !important; padding: 2px 14px !important;
          font-size: 12px !important; margin-bottom: 16px !important;
        }
        .hero-title {
          color: #fff !important; font-size: clamp(32px, 5vw, 48px) !important;
          font-weight: 800 !important; margin: 0 0 12px !important;
          background: linear-gradient(135deg, #818cf8, #c084fc, #f472b6);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .hero-subtitle {
          color: rgba(255,255,255,0.9) !important; font-size: clamp(15px, 2vw, 18px) !important;
          margin: 0 0 8px !important; max-width: 600px;
        }
        .hero-desc {
          color: rgba(255,255,255,0.6) !important; font-size: 14px !important;
          margin: 0 0 24px !important;
        }
        .hero-actions { margin-bottom: 28px; }
        .btn-glow {
          background: linear-gradient(135deg, #6366f1, #8b5cf6) !important;
          border: none !important; box-shadow: 0 0 24px rgba(99,102,241,0.4) !important;
          transition: box-shadow 0.3s !important;
        }
        .btn-glow:hover { box-shadow: 0 0 36px rgba(99,102,241,0.6) !important; transform: translateY(-1px); }
        .trust-badges {
          display: flex; gap: 16px; flex-wrap: wrap; justify-content: center;
        }
        .trust-badge {
          color: rgba(255,255,255,0.5); font-size: 12px;
          display: flex; align-items: center; gap: 4px;
        }

        /* === 统计 === */
        .stats-section { margin-bottom: 32px; }
        .stat-card {
          background: #fff; border-radius: 12px; padding: 16px; text-align: center;
          border: 1px solid #f0f0f0; transition: all 0.3s;
        }
        .stat-card:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.06); transform: translateY(-2px); }
        .stat-icon { font-size: 22px; margin-bottom: 6px; }
        .stat-value { font-size: clamp(20px, 3vw, 28px); font-weight: 700; font-family: 'Inter', sans-serif; }
        .stat-label { font-size: 12px; color: #94a3b8; margin-top: 2px; }

        /* === 功能矩阵 === */
        .features-section { margin-bottom: 32px; }
        .section-header { text-align: center; margin-bottom: 20px; }
        .feature-card {
          position: relative; background: #fff; border-radius: 14px; padding: 20px;
          border: 1px solid #f0f0f0; cursor: pointer;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          height: 100%;
        }
        .feature-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 12px 32px rgba(0,0,0,0.08);
          border-color: #e2e8f0;
        }
        .feature-icon {
          width: 44px; height: 44px; border-radius: 12px;
          display: flex; align-items: center; justify-content: center;
        }
        .feature-badge {
          position: absolute; top: 12px; right: 12px;
          background: linear-gradient(135deg, #f43f5e, #e11d48);
          color: #fff; font-size: 10px; padding: 2px 8px; border-radius: 10px;
          font-weight: 600;
        }

        /* === CTA === */
        .cta-section { margin-bottom: 24px; }
        .cta-inner {
          background: linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4338ca 100%);
          border-radius: 20px; padding: 48px 32px; text-align: center;
        }

        /* === 响应式 === */
        @media (max-width: 768px) {
          .hero-section { border-radius: 12px; min-height: 300px; }
          .hero-nav { padding: 10px 14px; }
          .hero-content { padding: 0 14px 28px; }
          .hero-actions { flex-direction: column; align-items: center; gap: 10px !important; }
          .hero-actions .ant-btn { width: 200px; }
          .trust-badges { gap: 6px; }
          .trust-badge { font-size: 10px; padding: 2px 6px; }
          .cta-inner { padding: 28px 14px; }
          .stats-section { margin-bottom: 20px; }
          .stat-card { padding: 12px 8px; }
          .feature-card { padding: 14px; }
          .feature-card .ant-typography h5 { font-size: 15px !important; }
          .section-header h3 { font-size: 20px !important; }
        }
        @media (max-width: 480px) {
          .hero-section { min-height: 260px; border-radius: 8px; }
          .hero-title { font-size: 26px !important; }
          .hero-subtitle { font-size: 13px !important; }
          .hero-desc { font-size: 12px !important; }
          .section-header { margin-bottom: 12px; }
        }
      `}</style>
    </div>
  );
}
