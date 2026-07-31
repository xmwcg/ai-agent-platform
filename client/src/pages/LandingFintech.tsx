import React from 'react';
import { SeoHelmet } from '@/pages/ProjectGrade/components/SeoHelmet';
import { Button, Card, Col, Row, Typography, Space, Tag } from 'antd';
import { Link } from 'react-router-dom';
import {
  SafetyCertificateOutlined,
  LockOutlined,
  AuditOutlined,
  ThunderboltOutlined,
  FileSearchOutlined,
  BarChartOutlined,
  RiseOutlined,
  AlertOutlined,
  CheckCircleOutlined,
  DashboardOutlined,
  GlobalOutlined,
  SwapOutlined,
  CloudServerOutlined,
  ControlOutlined,
  KeyOutlined,
  EyeOutlined,
} from '@ant-design/icons';

const { Title, Paragraph, Text } = Typography;

const painPoints = [
  {
    icon: <SafetyCertificateOutlined style={{ fontSize: 28, color: '#e17055' }} />,
    title: '等保合规压力',
    desc: '金融科技产品须满足等保 2.0 三级要求，合规成本高、整改周期长，不达标面临监管处罚。',
  },
  {
    icon: <LockOutlined style={{ fontSize: 28, color: '#0984e3' }} />,
    title: '数据加密与隐私',
    desc: '金融交易数据、用户身份信息等敏感数据的加密存储与传输若不达标，将引发严重安全事故。',
  },
  {
    icon: <AuditOutlined style={{ fontSize: 28, color: '#6c5ce7' }} />,
    title: '审计追踪缺失',
    desc: '缺乏完整的操作审计日志和不可篡改的审计追踪链，无法满足监管检查要求。',
  },
  {
    icon: <SwapOutlined style={{ fontSize: 28, color: '#00b894' }} />,
    title: '交易一致性风险',
    desc: '分布式交易系统中的资金差错、重复扣款、事务回滚失败等可能导致重大财务损失。',
  },
];

const dimensions = [
  { label: '等保合规', icon: <SafetyCertificateOutlined />, color: '#e17055' },
  { label: '数据加密', icon: <LockOutlined />, color: '#0984e3' },
  { label: '审计追踪', icon: <AuditOutlined />, color: '#6c5ce7' },
  { label: '交易一致性', icon: <SwapOutlined />, color: '#00b894' },
  { label: '风控完备性', icon: <AlertOutlined />, color: '#fdcb6e' },
  { label: '认证鉴权', icon: <KeyOutlined />, color: '#e17055' },
  { label: 'API 安全', icon: <GlobalOutlined />, color: '#0984e3' },
  { label: '灾备恢复', icon: <CloudServerOutlined />, color: '#6c5ce7' },
  { label: '可观测性', icon: <BarChartOutlined />, color: '#00b894' },
  { label: '访问控制', icon: <ControlOutlined />, color: '#d63031' },
  { label: '安全基线', icon: <EyeOutlined />, color: '#fdcb6e' },
  { label: '数据隐私', icon: <FileSearchOutlined />, color: '#0984e3' },
];

const LandingFintech: React.FC = () => {
  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 16px' }}>
      <SeoHelmet
        title="金融科技项目质量评估 — AIbak 智评通"
        description="覆盖等保合规、数据加密、审计追踪、交易一致性、风控完备性。Aibak 智评通为金融科技项目提供 12 维度量化评分。"
        url="https://aibak.site/landing/fintech"
      />

      {/* Hero Section */}
      <Row justify="center" style={{ textAlign: 'center', marginBottom: 48 }}>
        <Col xs={24} md={18} lg={14}>
          <Tag color="gold" style={{ marginBottom: 16, fontSize: 13, padding: '4px 12px' }}>
            金融科技行业专属
          </Tag>
          <Title level={1} style={{ fontSize: 36, marginBottom: 16 }}>
            金融科技项目质量评估
            <br />
            <Text type="secondary" style={{ fontSize: 24 }}>12 维度量化评分，严守合规底线与资金安全</Text>
          </Title>
          <Paragraph style={{ fontSize: 16, color: '#64748b', marginBottom: 32, maxWidth: 720, margin: '0 auto 32px' }}>
            覆盖等保合规、数据加密、审计追踪、交易一致性、风控完备性等金融科技关键维度的专业质量评估。
            5 级证据权重 + P0–P3 门禁红线，为金融项目构筑坚实的安全防线。
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
            金融科技项目面临的典型挑战
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
                  icon: <SafetyCertificateOutlined style={{ fontSize: 32, color: '#6c5ce7' }} />,
                  title: '等保合规对标',
                  desc: '12 维度评分对标等保 2.0 三级要求，量化合规差距，明确整改优先级。',
                },
                {
                  icon: <AuditOutlined style={{ fontSize: 32, color: '#00b894' }} />,
                  title: '审计追踪完备',
                  desc: '自动检测日志完整性、不可篡改性、操作追溯能力，确保监管检查无忧。',
                },
                {
                  icon: <LockOutlined style={{ fontSize: 32, color: '#0984e3' }} />,
                  title: '全链路加密评估',
                  desc: '覆盖传输加密、存储加密、密钥管理等环节，发现数据泄露风险敞口。',
                },
                {
                  icon: <DashboardOutlined style={{ fontSize: 32, color: '#e17055' }} />,
                  title: '红线条纹门禁',
                  desc: 'P0 级缺陷（如资金安全漏洞）直接阻断，总分最高 39 分，禁止任何形式上线。',
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
              background: 'linear-gradient(135deg, #0c3483 0%, #a2b6df 100%)',
              border: 'none',
            }}
          >
            <Title level={2} style={{ color: '#fff', marginBottom: 8 }}>
              立即评估你的金融科技项目
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

export default LandingFintech;
