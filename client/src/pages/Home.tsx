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
  CheckCircleFilled, RocketOutlined, DesktopOutlined, ClusterOutlined,
  PrinterOutlined, ScanOutlined, WifiOutlined, SafetyCertificateOutlined,
  AuditOutlined, FileSearchOutlined, LineChartOutlined, FundOutlined,
  ShoppingCartOutlined, LeftOutlined, RightOutlined, SwapOutlined, SoundOutlined, GlobalOutlined, PlaySquareOutlined,
  DashboardOutlined, AlertOutlined, SyncOutlined, CloudServerOutlined, HeartOutlined, EyeOutlined,
} from '@ant-design/icons';
import apiClient from '@/services/api';
import { useUIStore } from '@/stores/ui';
import HomeChatPanel from '@/components/HomeChatPanel';

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

// ─── 电商轮播广告 Hero ───
const HERO_SLIDES = [
  {
    id: 'platform',
    tag: 'AI 全栈平台',
    tagIcon: <ThunderboltOutlined />,
    title: 'NexMind by AIbak · 全栈 AI 应用平台',
    subtitle: 'AI 对话 · 知识库 · 智能工具 · API 变现 · 企业授权 — 一站式 AI 生产力底座',
    gradient: 'linear-gradient(135deg, #1e1b4b 0%, #4338ca 50%, #6366f1 100%)',
    accent: '#818cf8',
    bullets: [
      { icon: <RobotOutlined />, text: '15+ 主流大模型自由切换，国产模型成本仅为 GPT-4 的 1/10' },
      { icon: <BookOutlined />, text: 'RAG 知识库 + 12 行业知识体系 + Obsidian 自动同步' },
      { icon: <ToolOutlined />, text: '20+ 智能工具：文生图/代码实验室/客服/翻译/智评通' },
      { icon: <ShopOutlined />, text: 'API 变现 + 分销返佣 + 企业白标 — 一次打磨多次售卖' },
    ],
    priceTag: '免费注册即享 100 积分',
    discountLabel: '免费体验',
    originPrice: null,
    priceNote: '专业版 ¥9.9/月 · 旗舰版 ¥19.9/月',
    ctaPrimary: { text: '免费注册', path: '/register', icon: <RocketOutlined /> },
    ctaSecondary: { text: '功能总览', path: '/quickstart', icon: <CompassOutlined /> },
    visualIcon: <ThunderboltOutlined />,
    visualGradient: 'linear-gradient(135deg, #6366f1, #818cf8)',
  },
  {
    id: 'jinwangtong',
    tag: '企业 IT 管理神器',
    tagIcon: <DesktopOutlined />,
    title: '金网通 · 企业局域网互联互通系统',
    subtitle: '一台电脑管理全公司：硬件扫描、网络体检、打印机共享、C盘清理、资产报表',
    gradient: 'linear-gradient(135deg, #0f172a 0%, #1e3a8a 50%, #0ea5e9 100%)',
    accent: '#38bdf8',
    bullets: [
      { icon: <ScanOutlined />, text: '一键采集 CPU/主板/内存/硬盘/GPU 完整资产' },
      { icon: <WifiOutlined />, text: 'IP 冲突检测 / 网关可达 / DNS 解析自动修复' },
      { icon: <PrinterOutlined />, text: '打印机一键共享，多电脑无缝打印' },
      { icon: <SafetyOutlined />, text: 'C 盘安全清理，释放空间不丢文件' },
    ],
    priceTag: '永久买断 ¥299 起',
    discountLabel: '省85%',
    originPrice: '竞品年费 ¥2,000+',
    priceNote: '一次付费永久授权 · 无年费',
    ctaPrimary: { text: '立即体验', path: '/jinwangtong-demo', icon: <RocketOutlined /> },
    ctaSecondary: { text: '立即购买', path: '/jinwangtong', icon: <ShoppingCartOutlined /> },
    visualIcon: <ClusterOutlined />,
    visualGradient: 'linear-gradient(135deg, #0ea5e9, #38bdf8)',
  },
  {
    id: 'zhipingtong',
    tag: 'AI 项目体检',
    tagIcon: <AuditOutlined />,
    title: 'NexMind 智评通 · 项目质量与商业价值评估',
    subtitle: 'AI 驱动的项目体检：规则快照 / 证据链 / 风险 Finding / 整改追踪',
    gradient: 'linear-gradient(135deg, #1e1b4b 0%, #4338ca 50%, #7c3aed 100%)',
    accent: '#a78bfa',
    bullets: [
      { icon: <FileSearchOutlined />, text: '35+ 功能模块逐项评估' },
      { icon: <BarChartOutlined />, text: '完成度 / 商业价值 / UX 三维评分' },
      { icon: <SafetyCertificateOutlined />, text: '自动 URL 扫描与发布门禁' },
      { icon: <LineChartOutlined />, text: 'SWOT 分析 + 雷达图 + ROI 测算' },
    ],
    priceTag: '¥9.9/月起',
    discountLabel: '1折',
    originPrice: '竞品 ¥99/月',
    priceNote: '月付 ¥9.9 · 年付 ¥99 · 省17%',
    ctaPrimary: { text: '立即体验', path: '/project-grade', icon: <RocketOutlined /> },
    ctaSecondary: { text: '付费开通', path: '/pricing?source=project-grade', icon: <ShoppingCartOutlined /> },
    visualIcon: <FundOutlined />,
    visualGradient: 'linear-gradient(135deg, #8b5cf6, #a78bfa)',
  },
  {
    id: 'tools',
    tag: '免费 AI 生产力',
    tagIcon: <ThunderboltOutlined />,
    title: '免费体验 AI 工具箱 · 20+ 智能应用',
    subtitle: '文案 / 视频脚本 / 代码解释 / 竞品分析 / 合同审查 / 翻译 / 周报一键生成',
    gradient: 'linear-gradient(135deg, #064e3b 0%, #059669 40%, #10b981 100%)',
    accent: '#34d399',
    bullets: [
      { icon: <BulbOutlined />, text: '7 大分类 20+ 工具免费用' },
      { icon: <RobotOutlined />, text: 'Agnes-2.0/2.5 Flash 等 5 个免费 AI 模型' },
      { icon: <EditOutlined />, text: '小红书文案、文生图、PPT 大纲、SEO 优化' },
      { icon: <GiftOutlined />, text: '注册即送 100 积分，微信/支付宝灵活付费' },
    ],
    priceTag: '注册即送 100 积分',
    discountLabel: '免费体验',
    originPrice: null,
    priceNote: '微信/支付宝灵活付费',
    ctaPrimary: { text: '立即体验', path: '/tools', icon: <RocketOutlined /> },
    ctaSecondary: { text: '购买会员', path: '/pricing', icon: <ShoppingCartOutlined /> },
    visualIcon: <ToolOutlined />,
    visualGradient: 'linear-gradient(135deg, #10b981, #34d399)',
  },
  {
    id: 'transync',
    tag: '多语言实时翻译',
    tagIcon: <GlobalOutlined />,
    title: 'TranSync · AI 多语言实时翻译平台',
    subtitle: 'Web 文本翻译 · 浏览器实时语音 · 文档翻译 · 100+ 语种互译',
    gradient: 'linear-gradient(135deg, #0f172a 0%, #1d4ed8 50%, #06b6d4 100%)',
    accent: '#22d3ee',
    bullets: [
      { icon: <SwapOutlined />, text: 'DeepSeek / DeepL / OpenAI 多家引擎自由切换' },
      { icon: <SoundOutlined />, text: 'Chrome 实时语音识别 → 翻译 → 自动播报' },
      { icon: <FileTextOutlined />, text: '文档翻译：docx / xlsx / pptx / txt / csv / md' },
      { icon: <GlobalOutlined />, text: '注册即用 · 浏览器 PWA · Chrome 扩展 · 跨平台' },
    ],
    priceTag: '免费使用 · 专业版 ¥9.9/月',
    discountLabel: '新上线',
    originPrice: '竞品 ¥99/月',
    priceNote: 'NexMind 账号一键登录 · 90秒授权码安全桥接',
    ctaPrimary: { text: '立即体验', path: '/transync', icon: <RocketOutlined /> },
    ctaSecondary: { text: '查看套餐', path: '/pricing?source=transync', icon: <ShoppingCartOutlined /> },
    visualIcon: <GlobalOutlined />,
    visualGradient: 'linear-gradient(135deg, #06b6d4, #22d3ee)',
  }
];

function HeroCarousel({ isMobile }: { isMobile: boolean }) {
  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);
  const navigate = useNavigate();
  const total = HERO_SLIDES.length;

  useEffect(() => {
    if (paused) return;
    const timer = window.setInterval(() => {
      setCurrent((c) => (c + 1) % total);
    }, 3000);
    return () => window.clearInterval(timer);
  }, [paused, total]);

  const goTo = (idx: number) => setCurrent(idx);
  const prev = () => setCurrent((c) => (c - 1 + total) % total);
  const next = () => setCurrent((c) => (c + 1) % total);

  const arrowBase: React.CSSProperties = {
    position: 'absolute', top: '50%', transform: 'translateY(-50%)',
    width: 40, height: 40, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.25)',
    background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(6px)',
    color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', zIndex: 4, transition: 'all 0.25s ease',
  };

  return (
    <section
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      style={{ position: 'relative', overflow: 'hidden', borderRadius: 24, marginBottom: 28, minHeight: isMobile ? 360 : 480, background: '#0f172a' }}
    >
      <div style={{ display: 'flex', transition: 'transform 0.65s cubic-bezier(0.4,0,0.2,1)', transform: `translateX(-${current * 100}%)`, height: '100%' }}>
        {HERO_SLIDES.map((slide) => (
          <div key={slide.id} style={{ minWidth: '100%', position: 'relative', overflow: 'hidden', background: slide.gradient }}>
            <div style={{ position: 'absolute', inset: 0, opacity: 0.2, backgroundImage: `radial-gradient(circle at 20% 30%, ${slide.accent}33 0%, transparent 40%), radial-gradient(circle at 80% 70%, rgba(255,255,255,0.15) 0%, transparent 35%)` }} />
            <div style={{ position: 'absolute', right: '-6%', top: '-12%', width: 460, height: 460, borderRadius: '50%', background: `${slide.accent}12`, filter: 'blur(80px)' }} />
            <div style={{ position: 'absolute', left: '-8%', bottom: '-15%', width: 360, height: 360, borderRadius: '50%', background: 'rgba(255,255,255,0.05)', filter: 'blur(70px)' }} />

            <div style={{
              position: 'relative', zIndex: 2, display: 'flex', flexDirection: isMobile ? 'column' : 'row',
              alignItems: 'center', justifyContent: 'space-between', gap: isMobile ? 24 : 48,
              padding: isMobile ? '32px 20px 64px' : '56px 64px', maxWidth: 1200, margin: '0 auto',
              minHeight: isMobile ? 360 : 480,
            }}>
              <div style={{ flex: 1, maxWidth: isMobile ? '100%' : 640 }}>
                <Tag style={{ background: 'rgba(255,255,255,0.1)', border: `1px solid ${slide.accent}55`, color: '#fff', borderRadius: 20, padding: '4px 14px', fontSize: 12, marginBottom: 16 }}>
                  {slide.tagIcon}<span style={{ marginLeft: 6 }}>{slide.tag}</span>
                </Tag>
                <h1 style={{ color: '#fff', fontSize: isMobile ? 25 : 40, fontWeight: 800, lineHeight: 1.15, margin: '0 0 14px' }}>
                  {slide.title}
                </h1>
                <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: isMobile ? 14 : 16.5, display: 'block', marginBottom: 18 }}>
                  {slide.subtitle}
                </Text>
                <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px' }}>
                  {slide.bullets.map((b, i) => (
                    <li key={i} style={{ color: 'rgba(255,255,255,0.86)', fontSize: 13.5, display: 'flex', alignItems: 'center', gap: 10, marginBottom: 9 }}>
                      <span style={{ width: 22, height: 22, borderRadius: '50%', background: 'rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: slide.accent, fontSize: 12, flexShrink: 0 }}>{b.icon}</span>
                      {b.text}
                    </li>
                  ))}
                </ul>
                <Space size={12} wrap>
                  <Button size="large" type="primary" icon={slide.ctaPrimary.icon} onClick={() => navigate(slide.ctaPrimary.path)}
                    style={{ background: slide.visualGradient, border: 'none', borderRadius: 12, fontWeight: 600, height: 46, paddingInline: 24, boxShadow: `0 8px 24px ${slide.accent}44` }}>
                    {slide.ctaPrimary.text}
                  </Button>
                  <Button size="large" ghost icon={slide.ctaSecondary.icon} onClick={() => navigate(slide.ctaSecondary.path)}
                    style={{ borderRadius: 12, height: 46, paddingInline: 24, borderColor: 'rgba(255,255,255,0.45)', color: '#fff' }}>
                    {slide.ctaSecondary.text}
                  </Button>
                </Space>
              </div>

              {!isMobile && (
                <div style={{ flex: '0 0 300px', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                  <div style={{ width: 260, height: 260, borderRadius: '50%', background: slide.visualGradient, opacity: 0.16, filter: 'blur(50px)', position: 'absolute' }} />
                  <div style={{
                    width: 170, height: 170, borderRadius: 28, background: 'rgba(255,255,255,0.08)',
                    border: '1px solid rgba(255,255,255,0.16)', backdropFilter: 'blur(10px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 82,
                    color: '#fff', boxShadow: '0 24px 60px rgba(0,0,0,0.25)',
                  }}>
                    {slide.visualIcon}
                  </div>
                  <div style={{ position: 'absolute', top: 16, right: -10, background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 12, padding: '8px 14px', color: '#fff', fontSize: 12, backdropFilter: 'blur(8px)', whiteSpace: 'nowrap' }}>
                    <StarFilled style={{ color: '#fdcb6e', marginRight: 6 }} />强烈推荐
                  </div>
                  <div style={{ position: 'absolute', bottom: 28, left: -10, background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 12, padding: '8px 14px', color: '#fff', fontSize: 12, backdropFilter: 'blur(8px)', whiteSpace: 'nowrap' }}>
                    <CheckCircleFilled style={{ color: slide.accent, marginRight: 6 }} />{slide.priceTag}
                  {slide.discountLabel && slide.originPrice && (
                    <div style={{ position: 'absolute', bottom: 60, left: -60, background: 'linear-gradient(135deg, #ff5c1a, #ff3366)', borderRadius: '8px 8px 4px 8px', padding: '4px 12px', color: '#fff', fontSize: 13, fontWeight: 800, boxShadow: '0 4px 16px rgba(255,92,26,0.5)', letterSpacing: 1, whiteSpace: 'nowrap' }}>
                      {slide.discountLabel}
                    </div>
                  )}
                  {slide.originPrice && (
                    <div style={{ position: 'absolute', bottom: 36, left: -20, background: 'rgba(255,255,255,0.1)', borderRadius: 6, padding: '2px 10px', color: 'rgba(255,255,255,0.7)', fontSize: 11, whiteSpace: 'nowrap', textDecoration: 'line-through' }}>
                      {slide.originPrice}
                    </div>
                  )}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <button onClick={prev} style={{ ...arrowBase, left: 16 }} onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.22)'; }} onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; }}>
        <LeftOutlined />
      </button>
      <button onClick={next} style={{ ...arrowBase, right: 16 }} onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.22)'; }} onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; }}>
        <RightOutlined />
      </button>

      <div style={{ position: 'absolute', bottom: 18, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 8, zIndex: 4 }}>
        {HERO_SLIDES.map((_, idx) => (
          <button key={idx} onClick={() => goTo(idx)} style={{
            width: idx === current ? 32 : 10, height: 6, borderRadius: 3, border: 'none',
            background: idx === current ? '#fff' : 'rgba(255,255,255,0.35)', cursor: 'pointer', transition: 'all 0.3s ease',
          }} />
        ))}
      </div>
    </section>
  );
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
      className="feature-card"
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

// ─── 滚动揭示动效（提升一线大厂级质感）───
function Reveal({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); io.disconnect(); } },
      { threshold: 0.12 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} style={{
      opacity: visible ? 1 : 0,
      transform: visible ? 'none' : 'translateY(26px)',
      transition: `opacity 0.6s cubic-bezier(0.22,1,0.36,1) ${delay}ms, transform 0.6s cubic-bezier(0.22,1,0.36,1) ${delay}ms`,
    }}>
      {children}
    </div>
  );
}

export default function Home() {
  const navigate = useNavigate();
  const isMobile = useUIStore((s) => s.isMobile);
  const [stats, setStats] = useState({ documents: 0, courses: 0, models: 0, users: 0, apiCalls: 0, projectGradeReports: 0, projectGradeProjects: 0 });
  const [loading, setLoading] = useState(true);
  const [activeCat, setActiveCat] = useState('all');
  const [statsStarted, setStatsStarted] = useState(false);

  const docCount = useCountUp(stats.documents, 1500, statsStarted);
  const courseCount = useCountUp(stats.courses, 1500, statsStarted);
  const modelCount = useCountUp(stats.models, 1500, statsStarted);
  const userCount = useCountUp(stats.users, 1800, statsStarted);
  const apiCount = useCountUp(stats.apiCalls, 2000, statsStarted);
  const pgReportsCount = useCountUp(stats.projectGradeReports, 1600, statsStarted);
  const pgProjectsCount = useCountUp(stats.projectGradeProjects, 1600, statsStarted);

  useEffect(() => {
    Promise.all([
      apiClient.get('/knowledge').catch(() => ({ data: [] })),
      apiClient.get('/ops/public').catch(() => ({ data: { totalCreators: 0 } })),
      apiClient.get('/project-grade/public/landing').catch(() => ({ data: { totalPublishedReports: 0, totalPublicProjects: 0 } })),
      apiClient.get('/courses').catch(() => ({ data: [] })),
      apiClient.get('/ai/models').catch(() => ({ providers: [] })),
    ]).then(([docs, courses, opsData, pgData, models]: any[]) => {
      setStats({ documents: docs?.data?.length || 0, courses: courses?.data?.length || 0, models: models?.providers?.length || 0, users: opsData?.data?.totalCreators || 0, apiCalls: opsData?.data?.weeklyActiveCreators || 0, projectGradeReports: pgData?.data?.totalPublishedReports || 0, projectGradeProjects: pgData?.data?.totalPublicProjects || 0 });
    }).finally(() => { setLoading(false); setTimeout(() => setStatsStarted(true), 200); });
  }, []);

  const features = [
    { title: 'AI 对话', desc: '多模型切换 · 智能提示词', icon: <RobotOutlined />, path: '/ai-chat', gradient: 'linear-gradient(135deg, #10b981, #059669)', badge: 'HOT', cat: 'ai' },
    { title: '通用知识库', desc: 'RAG 检索 · 法律/AI/行业问答', icon: <BookOutlined />, path: '/knowledge', gradient: 'linear-gradient(135deg, #6c5ce7, #5541d7)', cat: 'knowledge' },
    { title: '智能工具箱', desc: '20+ 专业工具', icon: <ToolOutlined />, path: '/tools', gradient: 'linear-gradient(135deg, #3b82f6, #2563eb)', badge: 'NEW', cat: 'tools' },
    { title: '智能客服', desc: 'RAG 问答 · 网页嵌入', icon: <CustomerServiceOutlined />, path: '/customer-service', gradient: 'linear-gradient(135deg, #f59e0b, #d97706)', cat: 'ai' },
    { title: '学习中心', desc: '系统课程 · 测验', icon: <ExperimentOutlined />, path: '/courses', gradient: 'linear-gradient(135deg, #8b5cf6, #7c3aed)', cat: 'knowledge' },
    { title: '学习路径', desc: 'AI 智能学习规划', icon: <CompassOutlined />, path: '/learning-path', gradient: 'linear-gradient(135deg, #06b6d4, #0891b2)', cat: 'knowledge' },
    { title: '创作工坊', desc: '短视频 · 数字人 · 电商图文', icon: <PlaySquareOutlined />, path: '/studio', gradient: 'linear-gradient(135deg, #6366F1, #8B5CF6)', badge: 'NEW', cat: 'tools' },
    { title: '代码实验室', desc: '写码 → 执行 → AI 解释 → 验证', icon: <CodeOutlined />, path: '/lab', gradient: 'linear-gradient(135deg, #14b8a6, #0d9488)', cat: 'tools' },
    { title: '对比分析', desc: '多维度对比主流大模型', icon: <BarChartOutlined />, path: '/compare', gradient: 'linear-gradient(135deg, #f97316, #ea580c)', cat: 'ai' },
    { title: '模型配置', desc: '国内外厂商一键接入', icon: <ApiOutlined />, path: '/model-config', gradient: 'linear-gradient(135deg, #a855f7, #9333ea)', cat: 'platform' },
    { title: 'API 市场', desc: 'Key 签发 · 配额 · 变现', icon: <ShopOutlined />, path: '/marketplace', gradient: 'linear-gradient(135deg, #f43f5e, #e11d48)', badge: '变现', cat: 'platform' },
    { title: '分销中心', desc: '邀请返佣 · 多级裂变', icon: <ShareAltOutlined />, path: '/referral', gradient: 'linear-gradient(135deg, #0ea5e9, #0284c7)', badge: '赚', cat: 'account' },
    { title: '团队协作', desc: '1-1000 人 · RBAC', icon: <TeamOutlined />, path: '/team', gradient: 'linear-gradient(135deg, #0ea5e9, #0284c7)', cat: 'platform' },
    { title: '技能市场', desc: '一键导入 · 分享', icon: <ThunderboltOutlined />, path: '/skills', gradient: 'linear-gradient(135deg, #eab308, #ca8a04)', cat: 'platform' },
    { title: '会员升级', desc: '灵活付费 · 按次按天', icon: <WalletOutlined />, path: '/pricing', gradient: 'linear-gradient(135deg, #d946ef, #c026d3)', cat: 'account' },
    { title: '积分中心', desc: '签到 · 任务 · 兑换', icon: <GiftOutlined />, path: '/points-center', gradient: 'linear-gradient(135deg, #fbbf24, #f59e0b)', cat: 'account' },  {
    id: 'guard',
    tag: '运维监控神器',
    tagIcon: <EyeOutlined />,
    title: 'NexMind Guard · 自托管监控与故障自愈平台',
    subtitle: '监控会看病 · 告警会叫人 · 切换会救命 — 部署5分钟，告别凌晨3点的宕机电话',
    gradient: 'linear-gradient(135deg, #0f172a 0%, #1e293b 40%, #6366f1 100%)',
    accent: '#818cf8',
    bullets: [
      { icon: <ThunderboltOutlined />, text: '7天自己写 vs ¥99买一年 — 你的日薪 ¥500，自己做成本 ¥3,500，ROI 35 倍' },
      { icon: <EyeOutlined />, text: '公共状态页 + 品牌定制 — status.你的域名.com，给客户看专业 SLA' },
      { icon: <SyncOutlined />, text: '自动修复 + 故障切换 — 市场唯一，别人只会叫"挂了"，我们帮你修好' },
      { icon: <SafetyOutlined />, text: '本地 Agent + 数据自控 — 业务数据留在自己的服务器' },
    ],
    priceTag: '免费开始 · Pro ¥99/年',
    discountLabel: 'ROI 35x',
    originPrice: '自己开发成本 ¥3,500+',
    priceNote: '5分钟部署 · 私有化自托管 · 数据自控',
    ctaPrimary: { text: '立即体验', path: '/guard', icon: <RocketOutlined /> },
    ctaSecondary: { text: '查看套餐', path: '/pricing?source=guard', icon: <ShoppingCartOutlined /> },
    visualIcon: <DashboardOutlined />,
    visualGradient: 'linear-gradient(135deg, #6366f1, #818cf8)',
    icon: <DashboardOutlined />,
    desc: '自托管监控与故障自愈平台',
    path: '/guard',
  },
  ];

  const filteredFeatures = activeCat === 'all' ? features : features.filter((f) => f.cat === activeCat);

  if (loading && stats.documents === 0) return <Flex align="center" justify="center" style={{ minHeight: 400 }}><Spin size="large" /></Flex>;

  return (
    <div className="home-split">
      <style>{`
        .home-split { display: flex; gap: 24px; align-items: flex-start; }
        .home-chat-rail { position: sticky; top: 80px; align-self: flex-start; width: 380px; flex-shrink: 0; height: calc(100vh - 104px); }
        .home-main-content { flex: 1; min-width: 0; }
        @media (max-width: 992px) {
          .home-split { flex-direction: column; }
          .home-chat-rail { position: static; width: 100%; height: 58vh; margin-bottom: 20px; }
          .home-main-content { width: 100%; }
        }
      `}</style>
      <aside className="home-chat-rail">
        <HomeChatPanel />
      </aside>
      <div className="home-main-content">
      {/* ═══ Hero 轮播广告 ═══ */}
      <HeroCarousel isMobile={isMobile} />

      {/* ═══ 统计数据 ═══ */}
      <Reveal>
      <Row gutter={[12, 12]} style={{ marginBottom: 30 }}>
        {[
          { label: '知识文档', value: docCount, icon: <BookOutlined />, gradient: 'linear-gradient(135deg, #6c5ce7, #a29bfe)' },
          { label: '精品课程', value: courseCount, icon: <FileTextOutlined />, gradient: 'linear-gradient(135deg, #8b5cf6, #c084fc)' },
          { label: '接入模型', value: modelCount, icon: <ApiOutlined />, gradient: 'linear-gradient(135deg, #10b981, #34d399)' },
          { label: '活跃用户', value: userCount, icon: <TeamOutlined />, gradient: 'linear-gradient(135deg, #f59e0b, #fbbf24)', suffix: '+' },
          { label: 'API 调用', value: apiCount, icon: <ThunderboltOutlined />, gradient: 'linear-gradient(135deg, #ec4899, #f472b6)', suffix: '+' },
          { label: '项目评估', value: pgProjectsCount, icon: <AuditOutlined />, gradient: 'linear-gradient(135deg, #6366f1, #818cf8)' },
          { label: '公开报告', value: pgReportsCount, icon: <FileSearchOutlined />, gradient: 'linear-gradient(135deg, #0ea5e9, #38bdf8)' },
        ].map((s) => (
          <Col xs={12} sm={8} md={4} lg={4} key={s.label}><StatCard {...s} unit="" /></Col>
        ))}
      </Row>
      </Reveal>

      {/* ═══ 核心优势 ═══ */}
      <div style={{ textAlign: 'center', marginBottom: 14 }}>
        <Title level={isMobile ? 4 : 3} style={{ margin: '0 0 4px' }}>为什么选择 NexMind</Title>
        <Text style={{ color: 'var(--text-secondary)', fontSize: 13 }}>为企业与个人打造的全栈 AI 生产力底座</Text>
      </div>
      <Reveal>
      <Row gutter={[16, 24]} style={{ marginBottom: 34 }}>
        <Col xs={12} md={6}><Pillar icon={<RobotOutlined />} title="多模型对话" desc="一键切换国内外主流大模型" gradient="linear-gradient(135deg,#10b981,#059669)" /></Col>
        <Col xs={12} md={6}><Pillar icon={<BookOutlined />} title="通用知识库" desc="RAG 检索 · 法律/AI/行业问答" gradient="linear-gradient(135deg,#6c5ce7,#5541d7)" /></Col>
        <Col xs={12} md={6}><Pillar icon={<ToolOutlined />} title="智能工具箱" desc="20+ 创作/分析/办公工具" gradient="linear-gradient(135deg,#3b82f6,#2563eb)" /></Col>
        <Col xs={12} md={6}><Pillar icon={<ShopOutlined />} title="API 变现" desc="自有模型上架 · 分销返佣" gradient="linear-gradient(135deg,#f43f5e,#e11d48)" /></Col>
      </Row>
      </Reveal>

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
      <Reveal>
      <div style={{
        marginTop: 36, borderRadius: 24, padding: isMobile ? '32px 16px' : '52px 32px', textAlign: 'center',
        background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4338ca 100%)', position: 'relative', overflow: 'hidden',
      }}>
        <div aria-hidden style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
          <div style={{ position: 'absolute', top: '-20%', left: '-10%', width: '60%', height: '140%', background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, transparent 100%)', opacity: 0.12, transform: 'rotate(-12deg)' }} />
          <div style={{ position: 'absolute', bottom: '-30%', right: '-5%', width: '50%', height: '120%', background: 'linear-gradient(225deg, #818cf8 0%, transparent 70%)', opacity: 0.08, transform: 'rotate(8deg)' }} />
        </div>
        <div style={{ position: 'relative', zIndex: 2 }}>
          <Title level={2} style={{ color: '#fff', margin: 0, fontSize: isMobile ? 22 : 30 }}>准备好开始了吗？</Title>
          <Text style={{ color: 'rgba(255,255,255,0.82)', fontSize: 15, display: 'block', margin: '8px 0 22px' }}>
            免费注册即享 100 积分，体验全部功能
          </Text>
          <Space size={12} wrap>
            <Button size="large" type="primary" onClick={() => navigate('/register')} style={{ background: '#fff', color: '#6c5ce7', border: 'none', borderRadius: 12, fontWeight: 600, height: 46, paddingInline: 24 }}>免费开始</Button>
            <Button size="large" onClick={() => navigate('/pricing')} style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.25)', color: '#fff', borderRadius: 12, height: 46, paddingInline: 24 }}>查看定价</Button>
            <Button size="large" icon={<TeamOutlined />} onClick={() => window.open('https://work.weixin.qq.com/kfid/kfce20d584b0179916f', '_blank')} style={{ background: 'rgba(7,193,96,0.2)', border: '1px solid rgba(7,193,96,0.4)', color: '#07c160', borderRadius: 12, height: 46, paddingInline: 24, fontWeight: 600 }}>加入交流群</Button>
          </Space>
          <div style={{ marginTop: 18, display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap', color: 'rgba(255,255,255,0.6)', fontSize: 12.5 }}>
            <span><CheckCircleFilled style={{ color: '#07c160' }} /> 无需信用卡</span>
            <span><CheckCircleFilled style={{ color: '#07c160' }} /> 4 个免费 AI 模型</span>
            <span><CheckCircleFilled style={{ color: '#07c160' }} /> 微信 / 支付宝收款</span>
          </div>
        </div>
      </div>
      </Reveal>
      </div>
    </div>
  );
}

