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
  { icon: <SafetyCertificateOutlined style={{ fontSize: 28, color: '#e17055' }} />, title: '患者数据隐私', desc: '医疗数据涉及高度敏感的个人健康信息，HIPAA/GDPR 合规不达标可能导致巨额罚款和信誉损失。' },
  { icon: <CloudServerOutlined style={{ fontSize: 28, color: '#0984e3' }} />, title: '临床系统可靠性', desc: '临床决策支持系统的准确性、响应时间直接影响诊疗质量，系统故障可能危及患者生命安全。' },
  { icon: <ApiOutlined style={{ fontSize: 28, color: '#6c5ce7' }} />, title: '医疗数据互通', desc: 'HL7/FHIR 等医疗数据交换标准的实现质量直接影响跨系统协作效率和诊疗连续性。' },
  { icon: <LockOutlined style={{ fontSize: 28, color: '#00b894' }} />, title: '访问控制合规', desc: '医护人员、患者、管理人员等不同角色的精细化权限管理是医疗系统安全的核心。' },
];

const LandingHealthcare: React.FC = () => {
  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 16px' }}>
      <SeoHelmet
        title="医疗健康项目质量评估 — AIbak 智评通"
        description="为医疗健康产品提供 12 维度量化评分，覆盖数据隐私合规、患者信息安全、HIPAA/GDPR 合规、临床决策支持可靠性等。"
        url="https://healthcare.aibak.site/landing/healthcare"
      />

      <Row justify="center" style={{ textAlign: 'center', marginBottom: 48 }}>
        <Col xs={24} md={18} lg={14}>
          <Tag color="blue" style={{ marginBottom: 16, fontSize: 13, padding: '4px 12px' }}>
            医疗健康行业专属
          </Tag>
          <Title level={1} style={{ fontSize: 36, marginBottom: 16 }}>
            医疗健康项目质量评估
            <br />
            <Text type="secondary" style={{ fontSize: 24 }}>12 维度量化评分，让产品风险一目了然</Text>
          </Title>
          <Paragraph style={{ fontSize: 16, color: 'var(--text-secondary)', maxWidth: 800, margin: '0 auto' }}>
            为医疗健康产品提供 12 维度量化评分，覆盖数据隐私合规、患者信息安全、HIPAA/GDPR 合规、临床决策支持可靠性等。
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
            <Title level={3} style={{ color: '#fff', textAlign: 'center', marginBottom: 24 }}>为什么 医疗健康 行业选择 AIbak 智评通</Title>
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
                  立即开始 医疗健康 项目评估
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

export default LandingHealthcare;
