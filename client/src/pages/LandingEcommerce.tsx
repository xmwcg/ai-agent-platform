import React from 'react';
import { SeoHelmet } from '@/pages/ProjectGrade/components/SeoHelmet';
import { Button, Card, Col, Row, Typography, Space, Tag } from 'antd';
import { Link } from 'react-router-dom';
import {
  SafetyCertificateOutlined,
  ShoppingCartOutlined,
  DatabaseOutlined,
  ThunderboltOutlined,
  FileSearchOutlined,
  LockOutlined,
  BarChartOutlined,
  RiseOutlined,
  AlertOutlined,
  CheckCircleOutlined,
  DashboardOutlined,
  GlobalOutlined,
  AuditOutlined,
  SwapOutlined,
  TeamOutlined,
  CloudServerOutlined,
} from '@ant-design/icons';

const { Title, Paragraph, Text } = Typography;

const painPoints = [
  {
    icon: <LockOutlined style={{ fontSize: 28, color: '#e17055' }} />,
    title: '支付安全风险',
    desc: '支付通道劫持、金额篡改、支付回调伪造等问题可能导致直接的经济损失和用户信任崩塌。',
  },
  {
    icon: <DatabaseOutlined style={{ fontSize: 28, color: '#0984e3' }} />,
    title: '库存数据不一致',
    desc: '高并发场景下的超卖、库存负数、缓存与 DB 不一致等问题影响用户体验和商家利益。',
  },
  {
    icon: <SwapOutlined style={{ fontSize: 28, color: '#6c5ce7' }} />,
    title: '订单一致性缺陷',
    desc: '订单状态流转异常、退款链路断裂、分布式事务失败等可能导致财务对账偏差。',
  },
  {
    icon: <FileSearchOutlined style={{ fontSize: 28, color: '#00b894' }} />,
    title: '数据隐私泄露',
    desc: '用户个人信息、交易记录、收货地址等敏感数据保护不当可能违反《个人信息保护法》。',
  },
];

const dimensions = [
  { label: '支付安全', icon: <SafetyCertificateOutlined />, color: '#e17055' },
  { label: '库存管理', icon: <DatabaseOutlined />, color: '#0984e3' },
  { label: '订单一致性', icon: <SwapOutlined />, color: '#6c5ce7' },
  { label: '性能容量', icon: <DashboardOutlined />, color: '#00b894' },
  { label: '数据隐私', icon: <LockOutlined />, color: '#fdcb6e' },
  { label: 'API 安全', icon: <GlobalOutlined />, color: '#e17055' },
  { label: '认证鉴权', icon: <TeamOutlined />, color: '#0984e3' },
  { label: '灾备恢复', icon: <CloudServerOutlined />, color: '#6c5ce7' },
  { label: '可观测性', icon: <BarChartOutlined />, color: '#00b894' },
  { label: '合规审计', icon: <AuditOutlined />, color: '#d63031' },
  { label: '安全基线', icon: <AlertOutlined />, color: '#fdcb6e' },
  { label: '供应链安全', icon: <CheckCircleOutlined />, color: '#0984e3' },
];

const LandingEcommerce: React.FC = () => {
  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 16px' }}>
      <SeoHelmet
        title="电商项目质量评估 — AIbak 智评通"
        description="覆盖支付安全、库存管理、订单一致性、性能容量、数据隐私等高危维度。Aibak 智评通为电商项目提供 12 维度量化评分。"
        url="https://aibak.site/landing/ecommerce"
      />

      {/* Hero Section */}
      <Row justify="center" style={{ textAlign: 'center', marginBottom: 48 }}>
        <Col xs={24} md={18} lg={14}>
          <Tag color="orange" style={{ marginBottom: 16, fontSize: 13, padding: '4px 12px' }}>
            电商行业专属
          </Tag>
          <Title level={1} style={{ fontSize: 36, marginBottom: 16 }}>
            电商项目质量评估
            <br />
            <Text type="secondary" style={{ fontSize: 24 }}>12 维度量化评分，守护交易安全与用户体验</Text>
          </Title>
          <Paragraph style={{ fontSize: 16, color: '#64748b', marginBottom: 32, maxWidth: 720, margin: '0 auto 32px' }}>
            覆盖支付安全、库存管理、订单一致性、性能容量、数据隐私等高危维度的专业质量评估。
            5 级证据权重 + P0–P3 门禁红线，让电商项目的每个风险点都无处遁形。
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
            电商项目面临的典型挑战
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
                  icon: <ShoppingCartOutlined style={{ fontSize: 32, color: '#6c5ce7' }} />,
                  title: '交易链路覆盖',
                  desc: '从下单到退款全链路评估，覆盖支付、库存、订单、物流等关键环节。',
                },
                {
                  icon: <SafetyCertificateOutlined style={{ fontSize: 32, color: '#00b894' }} />,
                  title: '红线门禁',
                  desc: 'P0–P3 四级门禁机制，发现致命缺陷立即阻断，防止风险产品上线或收费。',
                },
                {
                  icon: <DatabaseOutlined style={{ fontSize: 32, color: '#0984e3' }} />,
                  title: '数据一致性校验',
                  desc: '自动检测缓存与数据库不一致、分布式事务异常等数据一致性问题。',
                },
                {
                  icon: <DashboardOutlined style={{ fontSize: 32, color: '#e17055' }} />,
                  title: '性能压测集成',
                  desc: '与 CI 流水线集成，每次提交自动评估性能容量，确保大促期间系统稳定。',
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
              background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
              border: 'none',
            }}
          >
            <Title level={2} style={{ color: '#fff', marginBottom: 8 }}>
              立即评估你的电商项目
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

export default LandingEcommerce;
