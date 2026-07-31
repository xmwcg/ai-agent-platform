import React, { useEffect, useState } from 'react';
import { SeoHelmet } from './components/SeoHelmet';
import axios from 'axios';
import { useParams } from 'react-router-dom';
import { Button, Card, Col, Descriptions, Empty, Row, Space, Spin, Tag, Typography } from 'antd';
import {
  ShareAltOutlined,
  ArrowLeftOutlined,
  CodeSandboxOutlined,
  CheckCircleTwoTone,
  CloseCircleTwoTone,
} from '@ant-design/icons';
import { QRCodeSVG } from 'qrcode.react';
import { ScoreGauge } from './components/ScoreGauge';
import { DimensionBars } from './components/DimensionBars';
import { FindingList } from './components/FindingList';
import { EvidenceBadge } from './components/EvidenceBadge';

const { Title, Paragraph, Text } = Typography;

interface PublicReportDetail {
  publicId: string;
  title: string;
  projectName: string;
  projectKind: 'website' | 'saas' | 'ai_application';
  verdict: 'S' | 'A' | 'B' | 'C' | 'D' | 'F';
  externalScore: number;
  internalScore: number;
  gateBlocked: 'P0' | 'P1' | 'P2' | 'P3' | null;
  publishedAt: string;
  expiresAt: string;
  sharedCount: number;
  dimensionSnapshot: Array<{ dimensionKey: string; label: string; weight: number; rawScore: number; normalizedScore: number }>;
  findingHighlights: Array<{ severity: 'P0' | 'P1' | 'P2' | 'P3'; dimensionKey: string; title: string }>;
  assessmentScope?: { mode: string; target?: string; note: string };
  baselineNote?: string;
}

const PublicReport: React.FC = () => {
  const { publicId = '' } = useParams<{ publicId: string }>();
  const [report, setReport] = useState<PublicReportDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [shared, setShared] = useState(false);
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    if (!publicId) {
      setError('缺少 publicId');
      setLoading(false);
      return;
    }
    axios
      .get(`/api/project-grade/public/reports/${encodeURIComponent(publicId)}`)
      .then((res) => {
        setReport(res?.data?.data || null);
        setLoading(false);
      })
      .catch((err) => {
        setError(err?.response?.status === 404 ? '报告不存在或已过期' : err?.message || '加载失败');
        setLoading(false);
      });
  }, [publicId]);

  const handleShare = async () => {
    if (!report || sharing) return;
    setSharing(true);
    try {
      await axios.post(`/api/project-grade/public/reports/${encodeURIComponent(report.publicId)}/share`);
      setShared(true);
    } catch {
      // ignore; counts only
    } finally {
      setSharing(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: 60, textAlign: 'center' }}>
        <Spin />
      </div>
    );
  }

  if (error || !report) {
    return (
      <div style={{ padding: 60, maxWidth: 720, margin: '0 auto' }}>
        <Empty description={error || '报告不存在'} />
        <div style={{ textAlign: 'center', marginTop: 24 }}>
          <Button type="primary" icon={<ArrowLeftOutlined />} onClick={() => (window.location.href = '/project-grade')}>
            返回智评通首页
          </Button>
        </div>
      </div>
    );
  }

  const ogUrl = `https://aibak.site/project-grade/reports/${report.publicId}`;
  const ogShort = ogUrl.replace(/^https?:\/\//, '');

  return (
    <div style={{ padding: '32px 24px', maxWidth: 1280, margin: '0 auto' }}>
      <SeoHelmet
        title={`${report.projectName} · AIbak 智评通 ${report.verdict} · ${report.externalScore.toFixed(1)}/100`}
        description={`${report.title}: 评分 ${report.externalScore.toFixed(1)} / 100 · 等级 ${report.verdict}${report.gateBlocked ? `, 门禁 ${report.gateBlocked}` : `, 可发布`}`}
        url={ogUrl}
        type="article"
        schemaJsonLd={{
          '@context': 'https://schema.org',
          '@type': 'Report',
          headline: report.projectName + ` 智评通评分`,
          datePublished: report.publishedAt,
          url: ogUrl,
          about: report.title,
          inLanguage: 'zh-CN',
          description: report.assessmentScope ? report.assessmentScope.note : "",
        }}
      />

      <div style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => (window.location.href = '/project-grade')}>
          返回智评通
        </Button>
      </div>

      <Row gutter={24}>
        <Col xs={24} md={16}>
          <Card>
            <Row gutter={24} align="middle">
              <Col xs={24} md={8} style={{ textAlign: 'center' }}>
                <ScoreGauge
                  score={report.externalScore}
                  verdict={report.verdict}
                  size="large"
                  title={report.projectName}
                  description={`内部 ${report.internalScore.toFixed(1)} / 1000`}
                />
              </Col>
              <Col xs={24} md={16}>
                <Title level={3} style={{ marginTop: 0 }}>{report.title}</Title>
                <Paragraph>
                  <Space wrap>
                    <Tag color="blue">{report.projectKind.toUpperCase()}</Tag>
                    {report.gateBlocked ? (
                      <Tag color="red">{report.gateBlocked} 门禁生效</Tag>
                    ) : (
                      <Tag color="green" icon={<CheckCircleTwoTone />}>无门禁</Tag>
                    )}
                    <EvidenceBadge level="production_automatic" />
                    <EvidenceBadge level="ci_integration" />
                    <EvidenceBadge level="source_static" />
                    <EvidenceBadge level="documentation" />
                  </Space>
                </Paragraph>
                {report.baselineNote && (
                  <Paragraph type="secondary">{report.baselineNote}</Paragraph>
                )}
                <Descriptions
                  size="small"
                  column={2}
                  items={[
                    { key: 'pid', label: '报告 ID', children: <code>{report.publicId}</code> },
                    {
                      key: 'pub',
                      label: '发布时间',
                      children: new Date(report.publishedAt).toLocaleString('zh-CN'),
                    },
                    {
                      key: 'exp',
                      label: '到期时间',
                      children: new Date(report.expiresAt).toLocaleString('zh-CN'),
                    },
                    { key: 'share', label: '累计分享', children: report.sharedCount + (shared ? 1 : 0) },
                  ]}
                />
              </Col>
            </Row>
          </Card>

          <Card style={{ marginTop: 20 }} title="12 维度评分明细">
            <DimensionBars
              rows={report.dimensionSnapshot.map((d) => ({
                dimensionKey: d.dimensionKey,
                label: d.label,
                weight: d.weight,
                rawScore: d.rawScore,
                normalizedScore: d.normalizedScore,
                gateSeverity: report.gateBlocked,
              }))}
            />
          </Card>

          <Card style={{ marginTop: 20 }} title={
            <Space>
              <CloseCircleTwoTone twoToneColor="#dc2626" />
              关键问题（最多 5 条）
            </Space>
          }>
            <FindingList items={report.findingHighlights} />
          </Card>

          {report.assessmentScope && (
            <Card style={{ marginTop: 20 }} title={
              <Space><CodeSandboxOutlined />评估边界说明</Space>
            }>
              <Descriptions
                column={1}
                items={[
                  { key: 'mode', label: '评估模式', children: report.assessmentScope.mode },
                  { key: 'target', label: '评估目标', children: report.assessmentScope.target || '—' },
                  { key: 'note', label: '边界说明', children: report.assessmentScope.note },
                  { key: 'publish', label: '首发评估时间', children: new Date(report.publishedAt).toLocaleString('zh-CN') },
                ]}
              />
            </Card>
          )}
        </Col>

        <Col xs={24} md={8}>
          <Card title={<Space><ShareAltOutlined />分享评分报告</Space>}>
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              <div style={{ textAlign: 'center', padding: 12 }}>
                <QRCodeSVG value={ogUrl} size={180} level="M" includeMargin={false} />
              </div>
              <Paragraph style={{ wordBreak: 'break-all', fontSize: 12, color: '#475569' }}>
                {ogUrl}
              </Paragraph>
              <Space>
                <Button type="primary" icon={<ShareAltOutlined />} onClick={handleShare} loading={sharing}>
                  我已分享 ({(report.sharedCount + (shared ? 1 : 0))})
                </Button>
                <Button
                  onClick={() => {
                    navigator.clipboard?.writeText(ogUrl);
                  }}
                >
                  复制短链
                </Button>
              </Space>
              <Paragraph type="secondary" style={{ fontSize: 12 }}>
                本二维码与短链接将公开可见。任何人扫码或打开链接都将看到这份完整评分报告，不要求登录。
              </Paragraph>
            </Space>
          </Card>

          <Card style={{ marginTop: 16 }} title="如何引用这份报告">
            <Paragraph style={{ fontSize: 12 }}>
              嵌入到你的网站，使用下方 SVG 徽章：
            </Paragraph>
            <div style={{ marginBottom: 12 }}>
              <img
                src={`/api/project-grade/public/badge/${report.publicId}.svg`}
                alt={`${report.projectName} AIbak 智评通 ${report.verdict} ${report.externalScore.toFixed(1)} / 100`}
                style={{ maxWidth: '100%' }}
                onClick={(e) => {
                  e.preventDefault();
                  navigator.clipboard?.writeText(
                    `![AIbak 智评通](${window.location.origin}/api/project-grade/public/badge/${report.publicId}.svg)`
                  );
                }}
              />
            </div>
            <Paragraph style={{ fontSize: 11, color: '#64748b' }}>
              Markdown：<br />
              <code>{`![AIbak 智评通](${ogShort}/api/project-grade/public/badge/${report.publicId}.svg)`}</code>
            </Paragraph>
          </Card>

          <Card style={{ marginTop: 16 }} title="用智评通评估你自己的项目">
            <Paragraph>免费体验公开网址体检，5 分钟拿到简化评分报告：</Paragraph>
            <Button type="primary" block href="/project-grade/demo">
              立即免费体验
            </Button>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default PublicReport;