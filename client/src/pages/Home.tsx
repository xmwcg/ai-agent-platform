import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Row, Col, Typography, Space, Button, Flex, Tag, Badge, Spin } from 'antd';
import {
  BookOutlined, RobotOutlined, FileTextOutlined,
  ArrowRightOutlined, CompassOutlined, BarChartOutlined,
  CalendarOutlined, SettingOutlined, ApiOutlined,
  CustomerServiceOutlined, ToolOutlined, PictureOutlined,
  CodeOutlined, ThunderboltOutlined, TeamOutlined, ShopOutlined,
  WalletOutlined, SafetyOutlined, StarFilled, GiftOutlined,
  EditOutlined, BulbOutlined, ExperimentOutlined, ShareAltOutlined,
  CheckCircleFilled, RocketOutlined,
} from '@ant-design/icons';
import apiClient from '@/services/api';
import { useUIStore } from '@/stores/ui';

const { Title, Paragraph, Text } = Typography;

// ─── 数字滚动动画 ───
function useCountUp(end: number, duration = 1500, start = false) {
  const [count, setCount] = useState(0);
  const frameRef = useRef<number>(0);
  useEffect(() => {
    if (!start || end <= 0) { setCount(0); return; }
    const startTime = performance.now();
    const step = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      setCount(Math.floor((1 - Math.pow(1 - progress, 3)) * end));
      if (progress < 1) frameRef.current = requestAnimationFrame(step);
    };
    frameRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frameRef.current);
  }, [end, duration, start]);
  return count;
}

// ─── 粒子背景 ───
function ParticleBg() {
  return (
    <div className="particle-bg" aria-hidden="true">
      {Array.from({ length: 22 }).map((_, i) => (
        <span key={i} className="particle" style={{
          left: `${Math.random() * 100}%`,
          animationDelay: `${Math.random() * 8}s`,
          animationDuration: `${6 + Math.random() * 8}s`,
          width: `${2 + Math.random() * 4}px`,
          height: `${2 + Math.random() * 4}px`,
        }} />
      ))}
    </div>
  );
}

// ─── 浮动光斑 ───
function Orbs() {
  return (
    <div aria-hidden style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      <div style={orb('#a29bfe', '12%', '18%', 320, 14)} />
      <div style={orb('#81ecec', '70%', '10%', 260, 18)} />
      <div style={orb('#fdcb6e', '55%', '60%', 220, 22)} />
    </div>
  );
}
function orb(color: string, left: string, top: string, size: number, dur: number): React.CSSProperties {
  return {
    position: 'absolute', left, top, width: size, height: size, borderRadius: '50%',
    background: `radial-gradient(circle, ${color}55, transparent 70%)`,
    filter: 'blur(20px)', animation: `orbFloat ${dur}s ease-in-out infinite alternate`,
  };
}

// ─── 渐变统计卡片 ───
function StatCard({ icon, label, value, unit, gradient, suffix }: {
  icon: React.ReactNode; label: string; value: number; unit?: string;
  gradient: string; suffix?: string;
}) {
  return (
    <div style={{
      background: 'var(--bg-container)', borderRadius: 16, padding: '18px 20px',
      border: '1px solid var(--border)', transition: 'all 0.3s ease',
      position: 'relative', overflow: 'hidden',
    }}
      onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 12px 32px var(--shadow-color)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; }}
    >
      <div style={{ position: 'absolute', top: -18, right: -18, width: 64, height: 64, borderRadius: '50%', background: gradient, opacity: 0.1 }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <Text style={{ fontSize: 12, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</Text>
          <div style={{ fontSize: 28, fontWeight: 800, lineHeight: 1.3, color: 'var(--text-primary)' }}>
            {value.toLocaleString()}{unit}{suffix && <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-tertiary)' }}>{suffix}</span>}
          </div>
        </div>
        <div style={{ width: 40, height: 40, borderRadius: 12, background: gradient, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 18 }}>{icon}</div>
      </div>
    </div>
  );
}

// ─── 功能卡片（玻璃拟态 + 渐变描边）───
function FeatureCard({ icon, title, desc, gradient, path, badge }: {
  icon: React.ReactNode; title: string; desc: string; gradient: string; path: string; badge?: string;
}) {
  const navigate = useNavigate();
  return (
    <div
      onClick={() => navigate(path)}
      style={{
        position: 'relative', cursor: 'pointer', background: 'var(--bg-container)', borderRadius: 16,
        padding: '22px 20px', border: '1px solid var(--border)', height: '100%',
        transition: 'all 0.35s cubic-bezier(0.4,0,0.2,1)', overflow: 'hidden',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-6px)'; e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.boxShadow = '0 18px 40px var(--shadow-color)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = ''; e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.boxShadow = ''; }}
    >
      <div style={{ position: 'absolute', inset: 0, borderRadius: 16, padding: 1, background: gradient, WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)', WebkitMaskComposite: 'xor', maskComposite: 'exclude', opacity: 0, transition: 'opacity 0.3s' }} className="card-glow" />
      {badge && <span style={{ position: 'absolute', top: 10, right: 10, background: gradient, color: '#fff', fontSize: 10, padding: '2px 8px', borderRadius: 10, fontWeight: 600 }}>{badge}</span>}
      <div style={{ width: 46, height: 46, borderRadius: 14, background: gradient, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 20, marginBottom: 14, boxShadow: '0 6px 16px rgba(0,0,0,0.15)' }}>{icon}</div>
      <Title level={5} style={{ margin: '0 0 4px', color: 'var(--text-primary)', fontSize: 15 }}>{title}</Title>
      <Text style={{ fontSize: 12, color: 'var(--text-secondary)', minHeight: 32, display: 'block' }}>{desc}</Text>
      <Button type="link" icon={<ArrowRightOutlined />} style={{ padding: 0, marginTop: 6, color: 'var(--brand-primary)' }}>进入</Button>
    </div>
  );
}

// ─── 核心优势 ───
function Pillar({ icon, title, desc, gradient }: { icon: React.ReactNode; title: string; desc: string; gradient: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '8px 12px' }}>
      <div style={{ width: 56, height: 56, borderRadius: 16, background: gradient, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 24, margin: '0 auto 12px', boxShadow: '0 8px 20px rgba(0,0,0,0.12)' }}>{icon}</div>
      <Title level={5} style={{ margin: '0 0 6px', fontSize: 15 }}>{title}</Title>
      <Text style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>{desc}</Text>
    </div>
  );
}

export default function Home() {
  const navigate = useNavigate();
  const isMobile = useUIStore((s) => s.isMobile);
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
    ]).then(([docs, courses, models]: any[]) => {
      setStats({ documents: docs?.data?.length || 156, courses: courses?.data?.length || 42, models: models?.providers?.length || 28, users: 12850, apiCalls: 2560000 });
    }).finally(() => { setLoading(false); setTimeout(() => setStatsStarted(true), 200); });
  }, []);

  const features = [
    { title: 'AI 对话', desc: '多模型切换 · 智能提示词', icon: <RobotOutlined />, path: '/ai-chat', gradient: 'linear-gradient(135deg, #10b981, #059669)', badge: 'HOT', cat: 'ai' },
    { title: '通用知识库', desc: 'RAG 检索 · 法律/AI/行业问答', icon: <BookOutlined />, path: '/knowledge', gradient: 'linear-gradient(135deg, #6c5ce7, #5541d7)', cat: 'knowledge' },
    { title: '智能工具箱', desc: '20+ 专业工具', icon: <ToolOutlined />, path: '/tools', gradient: 'linear-gradient(135deg, #3b82f6, #2563eb)', badge: 'NEW', cat: 'tools' },
    { title: '智能客服', desc: 'RAG 问答 · 网页嵌入', icon: <CustomerServiceOutlined />, path: '/customer-service', gradient: 'linear-gradient(135deg, #f59e0b, #d97706)', cat: 'ai' },
    { title: '学习中心', desc: '系统课程 · 测验', icon: <ExperimentOutlined />, path: '/courses', gradient: 'linear-gradient(135deg, #8b5cf6, #7c3aed)', cat: 'knowledge' },
    { title: '学习路径', desc: 'AI 智能学习规划', icon: <CompassOutlined />, path: '/learning-path', gradient: 'linear-gradient(135deg, #06b6d4, #0891b2)', cat: 'knowledge' },
    { title: '创作工坊', desc: '文生图 · 代码生成', icon: <BulbOutlined />, path: '/creative', gradient: 'linear-gradient(135deg, #ec4899, #db2777)', cat: 'tools' },
    { title: '代码解释', desc: '11 语言 × 3 粒度', icon: <CodeOutlined />, path: '/code', gradient: 'linear-gradient(135deg, #14b8a6, #0d9488)', cat: 'tools' },
    { title: '对比分析', desc: '多维度对比主流大模型', icon: <BarChartOutlined />, path: '/compare', gradient: 'linear-gradient(135deg, #f97316, #ea580c)', cat: 'ai' },
    { title: '模型配置', desc: '国内外厂商一键接入', icon: <ApiOutlined />, path: '/model-config', gradient: 'linear-gradient(135deg, #a855f7, #9333ea)', cat: 'platform' },
    { title: 'API 市场', desc: 'Key 签发 · 配额 · 变现', icon: <ShopOutlined />, path: '/marketplace', gradient: 'linear-gradient(135deg, #f43f5e, #e11d48)', badge: '变现', cat: 'platform' },
    { title: '分销中心', desc: '邀请返佣 · 多级裂变', icon: <ShareAltOutlined />, path: '/distribution', gradient: 'linear-gradient(135deg, #0ea5e9, #0284c7)', badge: '赚', cat: 'account' },
    { title: '团队协作', desc: '1-1000 人 · RBAC', icon: <TeamOutlined />, path: '/team', gradient: 'linear-gradient(135deg, #0ea5e9, #0284c7)', cat: 'platform' },
    { title: '技能市场', desc: '一键导入 · 分享', icon: <ThunderboltOutlined />, path: '/skills', gradient: 'linear-gradient(135deg, #eab308, #ca8a04)', cat: 'platform' },
    { title: '会员升级', desc: '灵活付费 · 按次按天', icon: <WalletOutlined />, path: '/pricing', gradient: 'linear-gradient(135deg, #d946ef, #c026d3)', cat: 'account' },
    { title: '积分中心', desc: '签到 · 任务 · 兑换', icon: <GiftOutlined />, path: '/points-center', gradient: 'linear-gradient(135deg, #fbbf24, #f59e0b)', cat: 'account' },
  ];

  const filteredFeatures = activeCat === 'all' ? features : features.filter((f) => f.cat === activeCat);

  if (loading) return <Flex align="center" justify="center" style={{ minHeight: 400 }}><Spin size="large" /></Flex>;

  return (
    <div>
      {/* ═══ Hero ═══ */}
      <section style={{
        position: 'relative', overflow: 'hidden',
        background: 'linear-gradient(135deg, #0f0c29 0%, #1a1a2e 30%, #16213e 60%, #0f3460 100%)',
        borderRadius: 24, marginBottom: 28, minHeight: isMobile ? 340 : 460,
        display: 'flex', flexDirection: 'column',
      }}>
        <ParticleBg />
        <Orbs />
        <div style={{ position: 'relative', zIndex: 2, flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: isMobile ? '32px 16px' : '0 32px 48px', maxWidth: 860, margin: '0 auto' }}>
          <Tag style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.18)', color: '#e2e8f0', borderRadius: 20, padding: '3px 16px', fontSize: 12.5, marginBottom: 18 }}>
            <StarFilled style={{ marginRight: 4, color: '#fdcb6e' }} />商业级 AI Agent 平台 · aibak.site
          </Tag>
          <h1 style={{
            color: '#fff', fontSize: isMobile ? 28 : 48, fontWeight: 800, lineHeight: 1.18, margin: '0 0 14px',
            background: 'linear-gradient(135deg, #a29bfe, #81ecec, #fdcb6e)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>
            AIbak · 打造您的全站 AI 应用平台
          </h1>
          <Text style={{ color: 'rgba(255,255,255,0.86)', fontSize: isMobile ? 14.5 : 18 }}>
            一站式智能生产力平台 —— 知识管理 · AI 对话 · 智能工具 · 团队协作 · API 变现
          </Text>
          <Space size={12} style={{ marginTop: 26, marginBottom: 22 }} wrap>
            <Button size="large" type="primary" icon={<RocketOutlined />} onClick={() => navigate('/ai-chat')}
              style={{ background: 'linear-gradient(135deg, #6c5ce7, #a29bfe)', border: 'none', boxShadow: '0 0 28px rgba(108,92,231,0.45)', borderRadius: 12, fontWeight: 600, height: 46, paddingInline: 24 }}>
              立即体验
            </Button>
            <Button size="large" ghost onClick={() => navigate('/pricing')} style={{ borderRadius: 12, height: 46, paddingInline: 24, borderColor: 'rgba(255,255,255,0.4)', color: '#fff' }}>
              查看方案
            </Button>
          </Space>
          <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', justifyContent: 'center' }}>
            {['GPT-4o / Claude / DeepSeek', '20+ 智能工具', '企业级安全', '灵活付费'].map((t) => (
              <span key={t} style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12.5, display: 'flex', alignItems: 'center', gap: 5 }}>
                <SafetyOutlined style={{ fontSize: 12 }} />{t}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ 统计数据 ═══ */}
      <Row gutter={[12, 12]} style={{ marginBottom: 30 }}>
        {[
          { label: '知识文档', value: docCount, icon: <BookOutlined />, gradient: 'linear-gradient(135deg, #6c5ce7, #a29bfe)' },
          { label: '精品课程', value: courseCount, icon: <FileTextOutlined />, gradient: 'linear-gradient(135deg, #8b5cf6, #c084fc)' },
          { label: '接入模型', value: modelCount, icon: <ApiOutlined />, gradient: 'linear-gradient(135deg, #10b981, #34d399)' },
          { label: '活跃用户', value: userCount, icon: <TeamOutlined />, gradient: 'linear-gradient(135deg, #f59e0b, #fbbf24)', suffix: '+' },
          { label: 'API 调用', value: apiCount, icon: <ThunderboltOutlined />, gradient: 'linear-gradient(135deg, #ec4899, #f472b6)', suffix: '+' },
        ].map((s) => (
          <Col xs={12} sm={8} md={4} lg={4} key={s.label}><StatCard {...s} unit="" /></Col>
        ))}
      </Row>

      {/* ═══ 核心优势 ═══ */}
      <div style={{ textAlign: 'center', marginBottom: 14 }}>
        <Title level={isMobile ? 4 : 3} style={{ margin: '0 0 4px' }}>为什么选择 AIbak</Title>
        <Text style={{ color: 'var(--text-secondary)', fontSize: 13 }}>为企业与个人打造的全栈 AI 生产力底座</Text>
      </div>
      <Row gutter={[16, 24]} style={{ marginBottom: 34 }}>
        <Col xs={12} md={6}><Pillar icon={<RobotOutlined />} title="多模型对话" desc="一键切换国内外主流大模型" gradient="linear-gradient(135deg,#10b981,#059669)" /></Col>
        <Col xs={12} md={6}><Pillar icon={<BookOutlined />} title="通用知识库" desc="RAG 检索 · 法律/AI/行业问答" gradient="linear-gradient(135deg,#6c5ce7,#5541d7)" /></Col>
        <Col xs={12} md={6}><Pillar icon={<ToolOutlined />} title="智能工具箱" desc="20+ 创作/分析/办公工具" gradient="linear-gradient(135deg,#3b82f6,#2563eb)" /></Col>
        <Col xs={12} md={6}><Pillar icon={<ShopOutlined />} title="API 变现" desc="自有模型上架 · 分销返佣" gradient="linear-gradient(135deg,#f43f5e,#e11d48)" /></Col>
      </Row>

      {/* ═══ 功能矩阵 ═══ */}
      <div style={{ textAlign: 'center', marginBottom: 20 }}>
        <Title level={isMobile ? 4 : 3} style={{ margin: '0 0 4px' }}>平台能力矩阵</Title>
        <Text style={{ color: 'var(--text-secondary)', fontSize: 13 }}>覆盖 AI 对话、知识管理、智能工具、平台管理的全栈解决方案</Text>
      </div>

      <Flex gap={8} justify="center" wrap="wrap" style={{ marginBottom: 24 }}>
        {[
          { k: 'all', label: '全部' }, { k: 'ai', label: 'AI 能力' }, { k: 'knowledge', label: '知识学习' },
          { k: 'tools', label: '智能工具' }, { k: 'platform', label: '平台服务' }, { k: 'account', label: '账户变现' },
        ].map((cat) => (
          <Tag.CheckableTag key={cat.k} checked={activeCat === cat.k} onChange={() => setActiveCat(cat.k)} style={{
            padding: '4px 16px', borderRadius: 20, fontSize: 13, border: activeCat === cat.k ? 'none' : `1px solid var(--border)`,
            background: activeCat === cat.k ? 'var(--brand-primary)' : 'var(--bg-container)',
            color: activeCat === cat.k ? '#fff' : 'var(--text-secondary)',
          }}>{cat.label}</Tag.CheckableTag>
        ))}
      </Flex>

      <Row gutter={[14, 14]}>
        {filteredFeatures.map((f) => (<Col xs={24} sm={12} md={8} lg={6} key={f.path}><FeatureCard {...f} /></Col>))}
      </Row>

      {/* ═══ CTA ═══ */}
      <div style={{
        marginTop: 36, borderRadius: 24, padding: isMobile ? '32px 16px' : '52px 32px', textAlign: 'center',
        background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4338ca 100%)', position: 'relative', overflow: 'hidden',
      }}>
        <Orbs />
        <div style={{ position: 'relative', zIndex: 2 }}>
          <Title level={2} style={{ color: '#fff', margin: 0, fontSize: isMobile ? 22 : 30 }}>准备好开始了吗？</Title>
          <Text style={{ color: 'rgba(255,255,255,0.82)', fontSize: 15, display: 'block', margin: '8px 0 22px' }}>
            免费注册即享 100 积分，体验全部功能
          </Text>
          <Space size={12} wrap>
            <Button size="large" type="primary" onClick={() => navigate('/register')} style={{ background: '#fff', color: '#6c5ce7', border: 'none', borderRadius: 12, fontWeight: 600, height: 46, paddingInline: 24 }}>免费开始</Button>
            <Button size="large" onClick={() => navigate('/pricing')} style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.25)', color: '#fff', borderRadius: 12, height: 46, paddingInline: 24 }}>查看定价</Button>
          </Space>
          <div style={{ marginTop: 18, display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap', color: 'rgba(255,255,255,0.6)', fontSize: 12.5 }}>
            <span><CheckCircleFilled style={{ color: '#07c160' }} /> 无需信用卡</span>
            <span><CheckCircleFilled style={{ color: '#07c160' }} /> 4 个免费 AI 模型</span>
            <span><CheckCircleFilled style={{ color: '#07c160' }} /> 微信 / 支付宝收款</span>
          </div>
        </div>
      </div>
    </div>
  );
}
