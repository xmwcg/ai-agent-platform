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
  PlaySquareOutlined,
  CodeOutlined,
} from '@ant-design/icons';

const { Title, Paragraph, Text } = Typography;

const painPoints = [
  { icon: <SafetyCertificateOutlined style={{ fontSize: 28, color: '#e17055' }} />, title: '工控系统安全', desc: 'SCADA/DCS 等工控系统一旦被攻击，可能导致生产线停摆甚至物理安全事故。' },
  { icon: <ControlOutlined style={{ fontSize: 28, color: '#0984e3' }} />, title: '边缘计算可靠性', desc: '工业现场的边缘节点需要在恶劣环境下稳定运行，对设备、网络、数据的容错能力要求极高。' },
  { icon: <CloudServerOutlined style={{ fontSize: 28, color: '#6c5ce7' }} />, title: 'OT/IT 融合安全', desc: '运营技术与信息技术的融合带来了新的攻击面，需要分层防护和纵深防御策略。' },
  { icon: <DashboardOutlined style={{ fontSize: 28, color: '#00b894' }} />, title: '预测性维护精度', desc: '基于 AI 的设备故障预测模型准确率直接影响维护策略和生产效率。' },
];

const LandingIndustry: React.FC = () => {
  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 16px' }}>
      <SeoHelmet
        title="工业制造项目质量评估 — AIbak 智评通"
        description="为工业制造产品提供 12 维度量化评分，覆盖工业物联网安全、边缘计算可靠性、工控系统防护、OT/IT 融合安全等。"
        url="https://industry.aibak.site/landing/industry"
      />

      <Row justify="center" style={{ textAlign: 'center', marginBottom: 48 }}>
        <Col xs={24} md={18} lg={14}>
          <Tag color="blue" style={{ marginBottom: 16, fontSize: 13, padding: '4px 12px' }}>
            工业制造行业专属
          </Tag>
          <Title level={1} style={{ fontSize: 36, marginBottom: 16 }}>
            工业制造项目质量评估
            <br />
            <Text type="secondary" style={{ fontSize: 24 }}>12 维度量化评分，让产品风险一目了然</Text>
          </Title>
          <Paragraph style={{ fontSize: 16, color: 'var(--text-secondary)', maxWidth: 800, margin: '0 auto' }}>
            为工业制造产品提供 12 维度量化评分，覆盖工业物联网安全、边缘计算可靠性、工控系统防护、OT/IT 融合安全等。
          </Paragraph>
          <Space size={12} style={{ marginTop: 24 }}>
            <Link to="/project-grade">
              <Button type="primary" size="large" icon={<ThunderboltOutlined />}>
                免费体验智评通
              </Button>
            </Link>
            <Link to="/register">
              <Button size="large" icon={<RiseOutlined />}>
                注册获取报告
              </Button>
            </Link>
          </Space>
        </Col>
      </Row>

      <Row gutter={[24, 24]} style={{ marginBottom: 48 }}>
        {painPoints.map((point, idx) => (
          <Col xs={24} sm={12} md={6} key={idx}>
            <Card hoverable style={{ height: '100%', borderRadius: 12, border: '1px solid var(--border)' }}>
              <div style={{ textAlign: 'center', marginBottom: 16 }}>{point.icon}</div>
              <Title level={5} style={{ textAlign: 'center', marginBottom: 8 }}>{point.title}</Title>
              <Text type="secondary" style={{ fontSize: 13, display: 'block', textAlign: 'center' }}>{point.desc}</Text>
            </Card>
          </Col>
        ))}
      </Row>

      <Row justify="center" style={{ marginBottom: 60 }}>
        <Col xs={24} md={16} lg={12}>
          <Card style={{ borderRadius: 16, background: 'linear-gradient(135deg, #1e1b4b, #4338ca)', border: 'none' }}>
            <Title level={3} style={{ color: '#fff', textAlign: 'center', marginBottom: 24 }}>为什么 工业制造 行业选择 AIbak 智评通</Title>
            <Row gutter={[16, 16]}>
              {[
                { label: '量化评分', desc: '12 维度标准化评分，可横向对比' },
                { label: '证据驱动', desc: '每个评分项附带具体证据与截图' },
                { label: 'AI 分析', desc: '自动生成 SWOT 分析与优化建议' },
                { label: '持续追踪', desc: '定期复检 + 趋势分析 + 整改跟踪' },
              ].map((item, i) => (
                <Col xs={12} key={i}>
                  <div style={{ color: '#fff', padding: '8px 0' }}>
                    <CheckCircleOutlined style={{ color: '#34d399', marginRight: 8 }} />
                    <Text strong style={{ color: '#fff' }}>{item.label}</Text>
                    <br />
                    <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, marginLeft: 24 }}>{item.desc}</Text>
                  </div>
                </Col>
              ))}
            </Row>
            <div style={{ textAlign: 'center', marginTop: 24 }}>
              <Link to="/project-grade">
                <Button type="primary" size="large" style={{ borderRadius: 8, background: '#fff', color: '#4338ca', border: 'none', fontWeight: 600 }}>
                  立即开始 工业制造 项目评估
                </Button>
              </Link>
            </div>
          </Card>
        </Col>
      </Row>

      <div style={{ textAlign: 'center', padding: '40px 0' }}>
        <Title level={4}>更多行业方案</Title>
        <Space wrap size={[8, 8]} style={{ marginTop: 16 }}>
          {[
            { label: 'SaaS', path: '/landing/saas' },
            { label: '电商零售', path: '/landing/ecommerce' },
            { label: '金融科技', path: '/landing/fintech' },
            { label: '医疗健康', path: '/landing/healthcare' },
            { label: '教育', path: '/landing/education' },
            { label: '互联网科技', path: '/landing/internet' },
            { label: '工业制造', path: '/landing/industry' },
            { label: '企业服务', path: '/landing/enterprise' },
            { label: '政府公共', path: '/landing/government' },
            { label: '媒体通信', path: '/landing/media' },
            { label: '专业服务', path: '/landing/professional' },
            { label: '开源社区', path: '/landing/opensource' },
          ].map((item) => (
            <Link to={item.path} key={item.path}>
              <Tag style={{ padding: '4px 12px', borderRadius: 12, cursor: 'pointer', fontSize: 13 }}>
                {item.label}
              </Tag>
            </Link>
          ))}
        </Space>
      </div>
    </div>
  );
};

export default LandingIndustry;
