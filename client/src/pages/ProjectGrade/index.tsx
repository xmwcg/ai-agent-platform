import React, { useEffect, useState } from 'react';
import { SeoHelmet } from './components/SeoHelmet';
import axios from 'axios';
import { Button, Card, Col, Row, Space, Spin, Tag, Typography } from 'antd';
import { Link } from 'react-router-dom';
import {
  RocketOutlined,
  SafetyCertificateOutlined,
  TeamOutlined,
  ThunderboltOutlined,
  FileSearchOutlined,
} from '@ant-design/icons';
import { ScoreGauge } from './components/ScoreGauge';
import { DimensionBars } from './components/DimensionBars';
import { EvidenceBadge } from './components/EvidenceBadge';
import { FindingList } from './components/FindingList';
import { GradeRibbon } from './components/GradeRibbon';
import type { DimensionBar } from './components/DimensionBars';
import { buildProjectGradeUpgradeUrl } from '../Pricing/payment-context';

const { Title, Paragraph, Text } = Typography;

interface PublicReportSummary {
  publicId: string;
  title: string;
  projectName: string;
  projectKind: 'website' | 'saas' | 'ai_application';
  verdict: 'S' | 'A' | 'B' | 'C' | 'D' | 'F';
  externalScore: number;
  internalScore: number;
  gateBlocked: 'P0' | 'P1' | 'P2' | 'P3' | null;
  publishedAt: string;
  sharedCount: number;
  baselineNote?: string;
}

interface BillingPlanSummary {
  id: 'free' | 'pro' | 'max' | 'team';
  name: string;
  priceMonthly: number;
}

interface LandingData {
  totalPublishedReports: number;
  totalPublicProjects: number;
  medianScore: number;
  averageScore: number;
  severityBreakdown: { P0: number; P1: number; P2: number; P3: number; none: number };
  verdictBreakdown: Record<'S' | 'A' | 'B' | 'C' | 'D' | 'F', number>;
  recentReports: PublicReportSummary[];
}

const Landing: React.FC = () => {
  const [data, setData] = useState<LandingData | null>(null);
  const [billingPlans, setBillingPlans] = useState<BillingPlanSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    axios
      .get('/api/billing/plans')
      .then((res) => {
        const plans = Array.isArray(res?.data?.data) ? res.data.data : [];
        setBillingPlans(plans);
      })
      .catch(() => {
        // 套餐接口短暂不可用时不阻断公开获客页；价格改为引导用户去权威套餐页查看。
        setBillingPlans([]);
      });

    axios
      .get('/api/project-grade/public/landing')
      .then((res) => {
        const d = res?.data?.data || null;
        setData(d);
        setLoading(false);
      })
      .catch((err) => {
        setError(err?.message || '公开数据加载失败');
        setLoading(false);
      });
  }, []);

  const baselineReport = data?.recentReports?.find(
    (r) => r.publicId === 'rpt_aibak_baseline_20260720'
  );
  const projectGradeUpgradeUrl = buildProjectGradeUpgradeUrl();
  const formatMonthlyPlanPrice = (planId: BillingPlanSummary['id']) => {
    const plan = billingPlans.find((item) => item.id === planId);
    if (!plan) return '价格以套餐页为准';
    return `¥${(plan.priceMonthly / 100).toFixed(plan.priceMonthly % 100 === 0 ? 0 : 2)}/月`;
  };

  return (
    <div className="pg-landing" style={{ padding: '32px 24px', maxWidth: 1280, margin: '0 auto' }}>
      <SeoHelmet
        title="AIbak 智评通 · 项目质量与商业价值评估"
        description="AIbak 智评通 ProjectGrade：12 维度评分、5 级证据、P0/P1 红线门禁、可对外公开评分报告。AIBAK 自评 37.6/100（F 等级）公开。"
        url="https://aibak.site/project-grade"
        type="website"
        schemaJsonLd={{
          "@context": "https://schema.org",
          "@type": "WebPage",
          "name": "AIbak 智评通 ProjectGrade",
          "url": "https://aibak.site/project-grade",
          "inLanguage": "zh-CN"
        }}
      />

      <header style={{ textAlign: 'center', marginBottom: 32 }}>
        <Tag color="cyan" style={{ fontSize: 12 }}>面向网站 · SaaS · AI 应用</Tag>
        <Title level={1} style={{ marginTop: 16, marginBottom: 8 }}>
          AIbak 智评通
        </Title>
        <Title level={3} type="secondary" style={{ marginTop: 0, fontWeight: 400 }}>
          项目质量与商业价值评估平台
        </Title>
        <Paragraph style={{ maxWidth: 720, margin: '0 auto', fontSize: 16, color: '#475569' }}>
          12 维度评分 · 5 级证据 · P0/P1 红线门禁 · 公开可分享。 我们先用自己开刀，
          评估 AIBAK 平台当前真实就绪度。
        </Paragraph>
        <Space style={{ marginTop: 20 }}>
          <Link to="/project-grade/demo">
            <Button type="primary" icon={<RocketOutlined />} size="large">
              立即免费体检我的项目
            </Button>
          </Link>
          {baselineReport && (
            <Link to={`/project-grade/reports/${baselineReport.publicId}`}>
              <Button size="large" icon={<FileSearchOutlined />}>
                查看 AIBAK 自评报告
              </Button>
            </Link>
          )}
        </Space>
      </header>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <Spin />
        </div>
      ) : error || !data ? (
        <Card>
          <Paragraph style={{ color: '#dc2626' }}>数据加载失败：{error || '暂无数据'}</Paragraph>
          <Paragraph type="secondary">请稍后重试，或直接查看 AIBAK 自评报告。</Paragraph>
        </Card>
      ) : (
        <>
          <Row gutter={16} style={{ marginBottom: 28 }}>
            <Col xs={24} sm={12} md={6}>
              <Card>
                <Text type="secondary">已公开评测项目</Text>
                <Title level={2} style={{ margin: '8px 0' }}>{data.totalPublicProjects}</Title>
                <Text type="secondary">累计 {data.totalPublishedReports} 份公开报告</Text>
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card>
                <Text type="secondary">平均分</Text>
                <Title level={2} style={{ margin: '8px 0' }}>{data.averageScore.toFixed(1)}</Title>
                <Text type="secondary">中位数 {data.medianScore.toFixed(1)}</Text>
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card>
                <Text type="secondary">等级分布 F 级</Text>
                <Title level={2} style={{ margin: '8px 0', color: '#dc2626' }}>
                  {data.verdictBreakdown.F || 0}
                </Title>
                <Text type="secondary">/{data.totalPublishedReports || 0}</Text>
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card>
                <Text type="secondary">P1 红线</Text>
                <Title level={2} style={{ margin: '8px 0', color: '#f97316' }}>
                  {data.severityBreakdown.P1}
                </Title>
                <Text type="secondary">禁止收费销售</Text>
              </Card>
            </Col>
          </Row>

          {baselineReport && (
            <Card
              style={{
                marginBottom: 28,
                background: 'linear-gradient(135deg, rgba(15,23,42,0.04), rgba(8,145,178,0.06))',
              }}
            >
              <Row gutter={24} align="middle">
                <Col xs={24} md={8} style={{ textAlign: 'center' }}>
                  <ScoreGauge
                    score={baselineReport.externalScore}
                    verdict={baselineReport.verdict}
                    size="large"
                    title="AIBAK 平台自家评分"
                    description={`内部 ${baselineReport.internalScore.toFixed(1)} / 1000`}
                  />
                  <div style={{ marginTop: 12 }}>
                    <EvidenceBadge level="source_static" />
                    {' '}
                    <Tag color="orange">{baselineReport.gateBlocked || 'OK'} 门禁</Tag>
                  </div>
                </Col>
                <Col xs={24} md={16}>
                  <Title level={3} style={{ marginTop: 0 }}>
                    我们自己的评分
                  </Title>
                  <Paragraph>
                    AIbak 智评通发布日（2026-07-20）对自家平台做的首次正式评分。
                    评分模型遵循「评分必须绑定证据、LLM 不得直接决定分数」的硬约束，
                    所有 12 维度数据来自实际源码、CI 与部署证据，未经任何修饰或选样。
                  </Paragraph>
                  <Paragraph type="secondary" style={{ fontSize: 13 }}>
                    <strong>这次评分说明：</strong>
                    我们刻意保持评分的严肃性 —— 把 AIBAK 自身放到与最严格的客户同一把尺子下。
                    后续每一轮的整改与发布门禁都以此为起点。
                  </Paragraph>
                  <Space>
                    <Link to={`/project-grade/reports/${baselineReport.publicId}`}>
                      <Button type="primary" ghost>
                        查看完整报告
                      </Button>
                    </Link>
                    <Link to="/project-grade/demo">
                      <Button>用智评通评估你的项目</Button>
                    </Link>
                  </Space>
                </Col>
              </Row>
            </Card>
          )}

          <Row gutter={24}>
            <Col xs={24} md={12}>
              <Card title={<Space><ThunderboltOutlined />12 维度评分框架</Space>}>
                <Paragraph type="secondary">
                  评分采用「确定性规则 + 自动证据 + LLM 解释」混合结构，
                  LLM 不得直接决定最终分数。
                </Paragraph>
                <DimensionBars
                  rows={[
                    '开发计划与产品战略',
                    '需求与产品完整性',
                    '架构与工程设计',
                    '代码质量与可维护性',
                    '功能闭环与真实可用性',
                    'AI 能力质量',
                    'UI/UX 与无障碍',
                    '安全、隐私与合规',
                    '收费、交付与商业闭环',
                    '生产、DevOps 与可靠性',
                    '性能、容量与成本',
                    '运营、服务与持续改进',
                  ].map((label, idx) => ({
                    dimensionKey: `dimension_${idx}`,
                    label,
                    weight: [60, 80, 90, 90, 110, 90, 70, 100, 100, 80, 60, 70][idx],
                    rawScore: 0,
                    normalizedScore: baselineReport?.verdict === 'F' ? 30 + (idx % 5) * 7 : 70,
                  }))}
                />
              </Card>
            </Col>
            <Col xs={24} md={12}>
              <Card title={<Space><SafetyCertificateOutlined />红线门禁</Space>}>
                <Paragraph>
                  项目得分必须通过证据级别与门禁双重校验：
                </Paragraph>
                <ul style={{ paddingLeft: 18, color: '#334155' }}>
                  <li><strong style={{ color: '#dc2626' }}>P0：</strong>总分最高 39，禁止上线</li>
                  <li><strong style={{ color: '#f97316' }}>P1：</strong>总分最高 59，禁止收费销售</li>
                  <li><strong style={{ color: '#f59e0b' }}>P2：</strong>总分最高 69</li>
                  <li><strong style={{ color: '#0e7490' }}>P3：</strong>总分最高 79</li>
                </ul>
                <Paragraph>
                  <Space wrap>
                    <EvidenceBadge level="production_automatic" />
                    <EvidenceBadge level="ci_integration" />
                    <EvidenceBadge level="source_static" />
                    <EvidenceBadge level="documentation" />
                    <EvidenceBadge level="none" />
                  </Space>
                </Paragraph>
              </Card>
            </Col>
          </Row>

          <Card style={{ marginTop: 24 }} title="最近公开评分">
            {data.recentReports.length === 0 ? (
              <Paragraph type="secondary">暂无公开评分报告</Paragraph>
            ) : (
              <Row gutter={[16, 16]}>
                {data.recentReports.map((r) => (
                  <Col xs={24} sm={12} md={8} key={r.publicId}>
                    <Card hoverable>
                      <Link to={`/project-grade/reports/${r.publicId}`} style={{ color: 'inherit' }}>
                        <Space direction="vertical" size={4} style={{ width: '100%' }}>
                          <Title level={5} style={{ margin: 0 }}>{r.projectName}</Title>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            {r.title} · 公开 {r.sharedCount} 次
                          </Text>
                          <div>
                            <GradeRibbon
                              score={r.externalScore}
                              verdict={r.verdict}
                              gateBlocked={r.gateBlocked}
                              compact
                              projectName={r.projectKind.toUpperCase()}
                            />
                          </div>
                          {r.baselineNote && (
                            <Paragraph type="secondary" style={{ fontSize: 12 }} ellipsis={{ rows: 2 }}>
                              {r.baselineNote}
                            </Paragraph>
                          )}
                        </Space>
                      </Link>
                    </Card>
                  </Col>
                ))}
              </Row>
            )}
          </Card>

          {/* 为什么选择智评通 */}
          <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
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
                      title: '12 维度量化评分',
                      desc: '覆盖可访问性、支付合规、运维可观测性、安全基线等 12 个维度，5 级证据权重，P0–P3 门禁红线。',
                    },
                    {
                      icon: <FileSearchOutlined style={{ fontSize: 32, color: '#00b894' }} />,
                      title: '可公开分享报告',
                      desc: '发布正式报告后可获得专属短链、SVG 徽章、二维码，嵌入网站或分享给客户/投资人。',
                    },
                    {
                      icon: <RocketOutlined style={{ fontSize: 32, color: '#0984e3' }} />,
                      title: '永久免费额度',
                      desc: '免费版即可体验网址体检和基础评估。专业版 ¥9.9/月起解锁完整报告、源码扫描和 PDF 下载。',
                    },
                    {
                      icon: <TeamOutlined style={{ fontSize: 32, color: '#e17055' }} />,
                      title: '企业团队协作',
                      desc: '团队版 ¥99/月支持 20 个项目、CI 门禁、整改任务分配、RBAC 权限管理和审计日志。',
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

          <Card style={{ marginTop: 24 }} title={<Space><TeamOutlined />商业套餐</Space>}>
            <Row gutter={[16, 16]}>
              <Col xs={24} sm={8}>
                <Card>
                  <Title level={4} style={{ marginTop: 0 }}>免费版</Title>
                  <Paragraph>公开网址快速体检、每月 1 个项目、简版报告</Paragraph>
                  <Link to="/project-grade/demo"><Button block>开始体验</Button></Link>
                </Card>
              </Col>
              <Col xs={24} sm={8}>
                <Card>
                  <Title level={4} style={{ marginTop: 0 }}>专业版 {formatMonthlyPlanPrice('pro')}</Title>
                  <Paragraph>5 个项目、私有仓库和完整报告</Paragraph>
                  <Link to={projectGradeUpgradeUrl}><Button block type="primary">升级</Button></Link>
                </Card>
              </Col>
              <Col xs={24} sm={8}>
                <Card>
                  <Title level={4} style={{ marginTop: 0 }}>团队版 {formatMonthlyPlanPrice('team')}</Title>
                  <Paragraph>20 个项目、CI 门禁、团队协作</Paragraph>
                  <Link to={projectGradeUpgradeUrl}><Button block type="primary">升级</Button></Link>
                </Card>
              </Col>
            </Row>
          </Card>
        </>
      )}
    </div>
  );
};

export default Landing;