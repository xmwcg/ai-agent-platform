import React from 'react';
import { SeoHelmet } from '@/pages/ProjectGrade/components/SeoHelmet';
import { Button, Card, Col, Row, Typography, Space, Tag } from 'antd';
import { Link } from 'react-router-dom';
import {
  SafetyCertificateOutlined,
  ApiOutlined,
  CloudServerOutlined,
  TeamOutlined,
  ThunderboltOutlined,
  FileSearchOutlined,
  LockOutlined,
  BarChartOutlined,
  RiseOutlined,
  AlertOutlined,
  CheckCircleOutlined,
  DashboardOutlined,
  GlobalOutlined,
  ControlOutlined,
} from '@ant-design/icons';

const { Title, Paragraph, Text } = Typography;

const painPoints = [
  {
    icon: <LockOutlined style={{ fontSize: 28, color: '#e17055' }} />,
    title: '支付合规风险',
    desc: 'SaaS 产品涉及订阅、发票、退款等支付环节，PCI DSS 合规不达标可能导致严重的法律和财务风险。',
  },
  {
    icon: <ApiOutlined style={{ fontSize: 28, color: '#0984e3' }} />,
    title: 'API 安全漏洞',
    desc: 'API 鉴权、速率限制、数据脱敏等方面的缺陷可能成为攻击者的突破口，造成用户数据泄露。',
  },
  {
    icon: <CloudServerOutlined style={{ fontSize: 28, color: '#6c5ce7' }} />,
    title: 'SLA 可靠性不足',
    desc: '多租户环境下的可用性、灾备恢复、性能隔离直接影响客户信任度与合同履约。',
  },
  {
    icon: <TeamOutlined style={{ fontSize: 28, color: '#00b894' }} />,
    title: '多租户隔离缺陷',
    desc: '数据隔离、权限模型、租户配置的缺陷可能导致租户间数据串扰，这是 SaaS 最致命的安全隐患。',
  },
];

const dimensions = [
  { label: '支付合规', icon: <SafetyCertificateOutlined />, color: '#e17055' },
  { label: 'API 安全', icon: <ApiOutlined />, color: '#0984e3' },
  { label: 'SLA 可靠性', icon: <CloudServerOutlined />, color: '#6c5ce7' },
  { label: '多租户隔离', icon: <TeamOutlined />, color: '#00b894' },
  { label: '认证鉴权', icon: <LockOutlined />, color: '#fdcb6e' },
  { label: '数据隐私', icon: <FileSearchOutlined />, color: '#e17055' },
  { label: '性能容量', icon: <DashboardOutlined />, color: '#0984e3' },
  { label: '灾备恢复', icon: <ControlOutlined />, color: '#6c5ce7' },
  { label: '可观测性', icon: <BarChartOutlined />, color: '#00b894' },
  { label: '安全基线', icon: <AlertOutlined />, color: '#d63031' },
  { label: '合规审计', icon: <CheckCircleOutlined />, color: '#fdcb6e' },
  { label: '全球部署', icon: <GlobalOutlined />, color: '#0984e3' },
];

const LandingSaaS: React.FC = () => {
  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 16px' }}>
      <SeoHelmet
        title="SaaS 项目质量评估 — AIbak 智评通"
        description="为 SaaS 产品提供 12 维度量化评分，覆盖支付合规、API 安全、SLA 可靠性、多租户隔离等。Aibak 智评通帮你发现隐藏风险，提升客户信任。"
        url="https://aibak.site/landing/saas"
      />

      {/* Hero Section */}
      <Row justify="center" style={{ textAlign: 'center', marginBottom: 48 }}>
        <Col xs={24} md={18} lg={14}>
          <Tag color="blue" style={{ marginBottom: 16, fontSize: 13, padding: '4px 12px' }}>
            SaaS 行业专属
          </Tag>
          <Title level={1} style={{ fontSize: 36, marginBottom: 16 }}>
            SaaS 项目质量评估
            <br />
            <Text type="secondary" style={{ fontSize: 24 }}>12 维度量化评分，让产品风险一目了然</Text>
          </Title>
          <Paragraph style={{ fontSize: 16, color: '#64748b', marginBottom: 32, maxWidth: 720, margin: '0 auto 32px' }}>
            为 SaaS 产品提供覆盖支付合规、API 安全、SLA 可靠性、多租户隔离等 12 个维度的专业质量评估。
            5 级证据权重 + P0–P3 门禁红线，帮你精准定位风险，建立客户信任。
          </Paragraph>
          <Space size="middle">
            <Link to="/project-grade/demo">
              <Button type="primary" size="large" icon={<ThunderboltOutlined />}>
                免费体验评分
              </Button>
            </Link>
            <Link to="/project-grade">
              <Button size="large" icon={<RiseOutlined />}>
                了解更多
              </Button>
            </Link>
          </Space>
        </Col>
      </Row>

      {/* Pain Points */}
      <Row gutter={[16, 16]} style={{ marginBottom: 48 }}>
        <Col xs={24}>
          <Title level={2} style={{ textAlign: 'center', marginBottom: 32 }}>
            SaaS 产品面临的典型挑战
          </Title>
        </Col>
        {painPoints.map((item, idx) => (
          <Col xs={24} sm={12} md={6} key={idx}>
            <Card hoverable style={{ height: '100%' }}>
              <div style={{ marginBottom: 12 }}>{item.icon}</div>
              <Title level={4} style={{ marginBottom: 8 }}>{item.title}</Title>
              <Paragraph type="secondary" style={{ fontSize: 13, marginBottom: 0 }}>
                {item.desc}
              </Paragraph>
            </Card>
          </Col>
        ))}
      </Row>

      {/* Scoring Dimensions */}
      <Row gutter={[16, 16]} style={{ marginBottom: 48 }}>
        <Col xs={24}>
          <Card
            title={
              <Space>
                <BarChartOutlined style={{ color: '#6c5ce7' }} />
                12 维度评分体系
              </Space>
            }
          >
            <Row gutter={[8, 12]}>
              {dimensions.map((dim, idx) => (
                <Col xs={12} sm={8} md={6} lg={4} key={idx}>
                  <div
                    style={{
                      padding: '12px 8px',
                      borderRadius: 8,
                      border: '1px solid #e2e8f0',
                      textAlign: 'center',
                      background: '#f8fafc',
                    }}
                  >
                    <div style={{ fontSize: 20, color: dim.color, marginBottom: 4 }}>
                      {dim.icon}
                    </div>
                    <Text strong style={{ fontSize: 13 }}>{dim.label}</Text>
                  </div>
                </Col>
              ))}
            </Row>
            <Paragraph type="secondary" style={{ marginTop: 16, textAlign: 'center' }}>
              每个维度 0–100 分 · 5 级证据权重（生产自动化 &gt; CI 集成 &gt; 源码静态 &gt; 文档声明 &gt; 无证据）
            </Paragraph>
          </Card>
        </Col>
      </Row>

      {/* Why AIbak */}
      <Row gutter={[16, 16]} style={{ marginBottom: 48 }}>
        <Col xs={24}>
          <Card
            title={
              <Space>
                <ThunderboltOutlined style={{ color: '#f59e0b' }} />
                为什么选择 AIbak 智评通？
              </Space>
            }
          >
            <Row gutter={[16, 16]}>
              {[
                {
                  icon: <FileSearchOutlined style={{ fontSize: 32, color: '#6c5ce7' }} />,
                  title: '专业量化',
                  desc: '基于证据等级的量化模型，非主观打分，每个分数都有可追溯的证据支撑。',
                },
                {
                  icon: <SafetyCertificateOutlined style={{ fontSize: 32, color: '#00b894' }} />,
                  title: '红线门禁',
                  desc: 'P0–P3 四级门禁机制，发现致命缺陷立即阻断，防止风险产品上线或收费。',
                },
                {
                  icon: <GlobalOutlined style={{ fontSize: 32, color: '#0984e3' }} />,
                  title: '公开报告',
                  desc: '发布正式报告后生成专属短链和 SVG 徽章，可嵌入官网或分享给客户及投资人。',
                },
                {
                  icon: <DashboardOutlined style={{ fontSize: 32, color: '#e17055' }} />,
                  title: '持续监控',
                  desc: 'CI 集成支持自动化回归评分，每次提交自动触发评估，确保质量不退化。',
                },
              ].map((item, idx) => (
                <Col xs={24} sm={12} md={6} key={idx}>
                  <Card size="small" style={{ textAlign: 'center', height: '100%' }}>
                    <div style={{ marginBottom: 8 }}>{item.icon}</div>
                    <Title level={5} style={{ margin: '8px 0' }}>{item.title}</Title>
                    <Paragraph type="secondary" style={{ fontSize: 13, marginBottom: 0 }}>
                      {item.desc}
                    </Paragraph>
                  </Card>
                </Col>
              ))}
            </Row>
          </Card>
        </Col>
      </Row>

      {/* CTA Section */}
      <Row justify="center" style={{ textAlign: 'center' }}>
        <Col xs={24} md={16}>
          <Card
            style={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              border: 'none',
            }}
          >
            <Title level={2} style={{ color: '#fff', marginBottom: 8 }}>
              立即评估你的 SaaS 项目
            </Title>
            <Paragraph style={{ color: 'rgba(255,255,255,0.85)', fontSize: 15, marginBottom: 24 }}>
              免费体验网址体检和基础评估，专业版 ¥9.9/月起解锁完整 12 维度报告
            </Paragraph>
            <Link to="/project-grade/demo">
              <Button type="primary" size="large" ghost>
                免费开始评分 →
              </Button>
            </Link>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default LandingSaaS;
