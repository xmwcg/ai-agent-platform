import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Card, Col, Row, Spin, Statistic, Tag, Typography, Alert, Button, Space } from 'antd';
import { BarChartOutlined } from '@ant-design/icons';
import { SeoHelmet } from './components/SeoHelmet';

const { Title, Paragraph, Text } = Typography;

interface PublicReportSummary {
  publicId: string;
  title: string;
  projectName: string;
  projectKind: string;
  verdict: string;
  externalScore: number;
  internalScore: number;
  gateBlocked: string | null;
  publishedAt: string;
  sharedCount: number;
}

interface AdminOverview {
  totalPublishedReports: number;
  totalPublicProjects: number;
  medianScore: number;
  averageScore: number;
  recentReports: PublicReportSummary[];
  severityBreakdown: Record<string, number>;
  verdictBreakdown: Record<string, number>;
}

const Admin: React.FC = () => {
  const [data, setData] = useState<AdminOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    axios
      .get('/api/project-grade/public/landing')
      .then((res) => {
        setData(res?.data?.data || null);
        setLoading(false);
      })
      .catch((e) => {
        setError(e?.response?.data?.message || e?.message || '加载失败');
        setLoading(false);
      });
  }, []);

  return (
    <div style={{ padding: '32px 24px', maxWidth: 1280, margin: '0 auto' }}>
      <SeoHelmet
        title="AIbak 智评通 · 管理后台"
        description="AIBAK 智评通 ProjectGrade 管理后台：评测次数、评分分布、公开报告、运营指标。"
        url="https://aibak.site/project-grade/admin"
      />
      <Title level={2} style={{ marginTop: 0 }}>智评通运营看板</Title>
      <Paragraph type="secondary">
        S8 切片将接入 ops.ts 全面的子卡片与生产硬化检查。当前页面展示基于
        /api/project-grade/public/landing 的实时聚合数据，仅面向已登录管理员。
      </Paragraph>

      {loading ? (
        <Spin />
      ) : error ? (
        <Alert type="error" message={error} showIcon />
      ) : data ? (
        <>
          <Row gutter={16}>
            <Col xs={24} sm={12} md={6}>
              <Card><Statistic title="公开报告累计" value={data.totalPublishedReports} /></Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card><Statistic title="已公开项目" value={data.totalPublicProjects} /></Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card><Statistic title="平均评分" value={data.averageScore.toFixed(1)} suffix="/ 100" /></Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card>
                <Statistic
                  title="中位评分"
                  value={data.medianScore.toFixed(1)}
                  suffix="/ 100"
                />
              </Card>
            </Col>
          </Row>

          <Row gutter={16} style={{ marginTop: 16 }}>
            <Col xs={24} md={12}>
              <Card title={<Space><BarChartOutlined />等级分布</Space>}>
                <Space wrap>
                  {(['S', 'A', 'B', 'C', 'D', 'F'] as const).map((v) => (
                    <Tag key={v} color={v === 'F' ? 'red' : 'blue'} style={{ fontSize: 14, padding: '4px 10px' }}>
                      {v} · {data.verdictBreakdown[v] || 0}
                    </Tag>
                  ))}
                </Space>
              </Card>
            </Col>
            <Col xs={24} md={12}>
              <Card title="门禁分布">
                <Space wrap>
                  {(['P0', 'P1', 'P2', 'P3', 'none'] as const).map((s) => (
                    <Tag key={s} color={s === 'none' ? 'green' : 'volcano'} style={{ fontSize: 14, padding: '4px 10px' }}>
                      {s === 'none' ? '无门禁' : s} · {data.severityBreakdown[s] || 0}
                    </Tag>
                  ))}
                </Space>
              </Card>
            </Col>
          </Row>

          <Card style={{ marginTop: 16 }} title="最近公开评分">
            {data.recentReports.length === 0 ? (
              <Text type="secondary">暂无公开报告</Text>
            ) : (
              <Space direction="vertical" style={{ width: '100%' }}>
                {data.recentReports.map((r) => (
                  <Card key={r.publicId} size="small">
                    <Space>
                      <Tag color="blue">{r.projectKind.toUpperCase()}</Tag>
                      <Text strong>{r.projectName}</Text>
                      <Tag color={r.verdict === 'F' ? 'red' : 'blue'}>{r.verdict}</Tag>
                      <Text>{r.externalScore.toFixed(1)} / 100</Text>
                      {r.gateBlocked && <Tag color="volcano">{r.gateBlocked} 门禁</Tag>}
                      <a href={`/project-grade/reports/${r.publicId}`} target="_blank" rel="noopener noreferrer">
                        公开报告
                      </a>
                    </Space>
                  </Card>
                ))}
              </Space>
            )}
          </Card>
        </>
      ) : (
        <Alert type="warning" message="暂无数据" />
      )}

      <Card style={{ marginTop: 16 }} title="S8 切片规划（待完成）">
        <ul style={{ paddingLeft: 18 }}>
          <li>对接 ops.ts：今日扫描次数、平均分、公开报告数、订单数、退款数</li>
          <li>对接 diagnostics.ts：/api/project-grade/rules 与前端契约一致性校验</li>
          <li>对接 cron-reconciliation.sh：日终订单对账</li>
          <li>SSRF / DNS 重新绑定回归</li>
          <li>Lighthouse ≥ 90 + CSP 通过</li>
        </ul>
      </Card>
    </div>
  );
};

export default Admin;