import { useNavigate } from 'react-router-dom';
import { Typography, Row, Col, Button, Space, Tag } from 'antd';
import {
  ThunderboltOutlined, RobotOutlined, BookOutlined, ToolOutlined,
  TeamOutlined, ApiOutlined, SafetyOutlined, RocketOutlined,
  ArrowRightOutlined, GlobalOutlined,
} from '@ant-design/icons';

const { Title, Paragraph, Text } = Typography;

const HIGHLIGHTS = [
  { icon: <RobotOutlined />, title: '多模型 AI 对话', desc: '接入国内外主流大模型，一键切换，支持自定义 API Key', color: 'linear-gradient(135deg, #10b981, #059669)' },
  { icon: <BookOutlined />, title: '通用知识库', desc: 'RAG 检索 · 知识图谱 · 文件管理 · AI 嵌入式问答', color: 'linear-gradient(135deg, #6c5ce7, #5541d7)' },
  { icon: <ToolOutlined />, title: '智能工具箱', desc: '创作/分析/开发/营销/商务/办公/经典工具七大类', color: 'linear-gradient(135deg, #3b82f6, #2563eb)' },
  { icon: <TeamOutlined />, title: '团队协作', desc: '1-1000 人 RBAC 权限、审计日志、企业级管理', color: 'linear-gradient(135deg, #0ea5e9, #0284c7)' },
  { icon: <ApiOutlined />, title: 'API 变现', desc: 'Key 签发 · 配额计量 · 分销佣金 · 灵活付费', color: 'linear-gradient(135deg, #f43f5e, #e11d48)' },
  { icon: <SafetyOutlined />, title: '企业级安全', desc: '字段加密 · 限流防刷 · 隐私合规 · 审计追溯', color: 'linear-gradient(135deg, #f59e0b, #d97706)' },
];

const STATS = [
  { value: '22+', label: '功能模块' },
  { value: '28+', label: '接入模型' },
  { value: '4', label: '免费大模型额度' },
  { value: '100%', label: '真实数据产出' },
];

export default function AboutPage() {
  const navigate = useNavigate();
  return (
    <div style={{ maxWidth: 1000, margin: '0 auto' }}>
      {/* Hero */}
      <section style={{
        position: 'relative', overflow: 'hidden', borderRadius: 20,
        background: 'linear-gradient(135deg, #0f0c29 0%, #1a1a2e 40%, #0f3460 100%)',
        padding: '48px 32px', textAlign: 'center', marginBottom: 28,
      }}>
        <Tag style={{
          background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)',
          color: '#e2e8f0', borderRadius: 20, padding: '2px 14px', fontSize: 12, marginBottom: 16,
        }}>
          <ThunderboltOutlined style={{ marginRight: 4 }} /> 商业级 AI Agent 平台
        </Tag>
        <h1 style={{
          color: '#fff', fontSize: 38, fontWeight: 800, margin: '0 0 12px',
          background: 'linear-gradient(135deg, #a29bfe, #81ecec, #fdcb6e)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', lineHeight: 1.2,
        }}>
          AIbak · 打造您的全站 AI 应用平台
        </h1>
        <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 16, display: 'block', maxWidth: 640, margin: '0 auto' }}>
          我们致力于把「AI 能力 + 知识管理 + 智能工具 + 商业变现」整合进一个平台，
          让个人与企业都能低门槛、高效率地构建自己的 AI 应用。
        </Text>
        <Space size={12} style={{ marginTop: 24 }} wrap>
          <Button size="large" type="primary" icon={<RocketOutlined />} onClick={() => navigate('/ai-chat')}
            style={{ background: 'linear-gradient(135deg, #6c5ce7, #a29bfe)', border: 'none', borderRadius: 12, fontWeight: 600 }}>
            立即体验
          </Button>
          <Button size="large" ghost icon={<GlobalOutlined />} onClick={() => window.open('https://aibak.site', '_blank')}
            style={{ borderRadius: 12 }}>
            访问官网 aibak.site
          </Button>
        </Space>
      </section>

      {/* 统计 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 32 }}>
        {STATS.map((s) => (
          <Col xs={12} md={6} key={s.label}>
            <div style={{
              background: 'var(--bg-container)', border: '1px solid var(--border)',
              borderRadius: 16, padding: '20px 16px', textAlign: 'center',
            }}>
              <div style={{ fontSize: 30, fontWeight: 800, color: 'var(--brand-primary)' }}>{s.value}</div>
              <Text style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{s.label}</Text>
            </div>
          </Col>
        ))}
      </Row>

      {/* 核心能力 */}
      <div style={{ textAlign: 'center', marginBottom: 20 }}>
        <Title level={3} style={{ margin: 0, color: 'var(--text-primary)' }}>核心能力</Title>
        <Text style={{ color: 'var(--text-secondary)' }}>覆盖 AI 应用全生命周期的一站式能力矩阵</Text>
      </div>
      <Row gutter={[16, 16]} style={{ marginBottom: 32 }}>
        {HIGHLIGHTS.map((h) => (
          <Col xs={24} sm={12} md={8} key={h.title}>
            <div className="hover-lift" style={{
              background: 'var(--bg-container)', border: '1px solid var(--border)',
              borderRadius: 16, padding: '22px 20px', height: '100%',
            }}>
              <div style={{
                width: 44, height: 44, borderRadius: 12, background: h.color,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontSize: 20, marginBottom: 14,
              }}>{h.icon}</div>
              <Title level={5} style={{ margin: '0 0 6px', color: 'var(--text-primary)' }}>{h.title}</Title>
              <Text style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{h.desc}</Text>
            </div>
          </Col>
        ))}
      </Row>

      {/* 使命 */}
      <div style={{
        background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4338ca 100%)',
        borderRadius: 20, padding: '40px 32px', textAlign: 'center',
      }}>
        <Title level={3} style={{ color: '#fff', margin: '0 0 10px' }}>我们的使命</Title>
        <Paragraph style={{ color: 'rgba(255,255,255,0.85)', fontSize: 15, maxWidth: 640, margin: '0 auto 20px' }}>
          让每一个人和企业都能拥有属于自己的 AI 生产力平台 —— 简单、专业、可信赖。
        </Paragraph>
        <Button size="large" onClick={() => navigate('/pricing')}
          style={{ background: '#fff', color: '#6c5ce7', border: 'none', borderRadius: 12, fontWeight: 600 }}
          icon={<ArrowRightOutlined />}>
          查看会员方案
        </Button>
      </div>
    </div>
  );
}
