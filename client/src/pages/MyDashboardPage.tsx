import { useEffect, useState } from "react";
import {
  Card, Col, Row, Statistic, Table, Tag, Typography, Spin, Empty, Descriptions, Button, Space,
} from "antd";
import {
  ProjectOutlined, FileTextOutlined, DollarOutlined, CrownOutlined,
  TrophyOutlined, ClockCircleOutlined, CheckCircleOutlined,
} from "@ant-design/icons";
import { Link } from "react-router-dom";
import { opsAPI, extractApiError, type UserMyStats } from "@/services/api";

const { Title, Paragraph, Text } = Typography;

const PLAN_MAP: Record<string, { label: string; color: string }> = {
  free: { label: "免费版", color: "default" },
  pro: { label: "专业版", color: "blue" },
  max: { label: "旗舰版", color: "purple" },
  team: { label: "团队版", color: "gold" },
};

export default function MyDashboardPage() {
  const [stats, setStats] = useState<UserMyStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    opsAPI
      .myStats()
      .then((res: any) => {
        setStats(res?.data?.data ?? null);
        setLoading(false);
      })
      .catch((err: any) => {
        setError(extractApiError(err) || "加载失败");
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: 120 }}>
        <Spin size="large" tip="加载仪表板..." />
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div style={{ maxWidth: 800, margin: "40px auto", padding: 24 }}>
        <Empty description={error || "暂无数据"}>
          <Button onClick={() => window.location.reload()}>重新加载</Button>
        </Empty>
      </div>
    );
  }

  const planInfo = stats.membership ? (PLAN_MAP[stats.membership.plan] || PLAN_MAP.free) : PLAN_MAP.free;

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 16px" }}>
      <Title level={3} style={{ marginBottom: 4 }}>我的工作台</Title>
      <Paragraph type="secondary">项目概览 · 评分历史 · 使用统计</Paragraph>

      {/* 会员卡片 */}
      {stats.membership && (
        <Card style={{ marginBottom: 24 }}>
          <Row gutter={[16, 16]} align="middle">
            <Col>
              <CrownOutlined style={{ fontSize: 40, color: "#f59e0b" }} />
            </Col>
            <Col flex="auto">
              <Space size="middle">
                <Tag color={planInfo.color}>{planInfo.label}</Tag>
                {stats.membership.expiresAt && (
                  <Text type="secondary">
                    <ClockCircleOutlined /> 到期: {new Date(stats.membership.expiresAt).toLocaleDateString("zh-CN")}
                  </Text>
                )}
                <Text strong>剩余积分: {stats.membership.credits}</Text>
              </Space>
            </Col>
            <Col>
              <Link to="/pricing">
                <Button type="primary" ghost>升级套餐</Button>
              </Link>
            </Col>
          </Row>
        </Card>
      )}

      {/* 统计卡片 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="项目总数"
              value={stats.projectStats.total}
              prefix={<ProjectOutlined />}
              suffix={
                <Text type="secondary" style={{ fontSize: 12 }}>
                  活跃 {stats.projectStats.active}
                </Text>
              }
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="报告数量"
              value={stats.reportStats.published}
              prefix={<FileTextOutlined />}
              suffix={
                <Text type="secondary" style={{ fontSize: 12 }}>
                  共 {stats.reportStats.total}
                </Text>
              }
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="平均评分"
              value={stats.reportStats.avgScore}
              prefix={<TrophyOutlined />}
              suffix={<Text type="secondary">/100</Text>}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="累计消费"
              value={stats.orderStats.totalSpentYuan.toFixed(2)}
              prefix={<DollarOutlined />}
              suffix={<Text type="secondary">元</Text>}
            />
          </Card>
        </Col>
      </Row>

      {/* 最近项目 */}
      <Card
        title={<Space><ProjectOutlined />最近项目</Space>}
        style={{ marginBottom: 24 }}
        extra={<Link to="/project-grade/projects">查看全部 →</Link>}
      >
        {stats.recentProjects.length === 0 ? (
          <Empty description="还没有项目，开始你的第一个评估吧">
            <Link to="/project-grade/demo">
              <Button type="primary">免费体检</Button>
            </Link>
          </Empty>
        ) : (
          <Table
            dataSource={stats.recentProjects}
            rowKey={(r: any) => r._id || r.id}
            pagination={false}
            size="small"
            columns={[
              { title: "项目名称", dataIndex: "name", key: "name", render: (name: string) => <Text strong>{name || "未命名"}</Text> },
              { title: "类型", dataIndex: "kind", key: "kind", render: (k: string) => <Tag>{k || "website"}</Tag> },
              {
                title: "评分", dataIndex: "latestScore", key: "score",
                render: (s: number) => s != null ? <Text strong>{s.toFixed(1)}</Text> : <Text type="secondary">—</Text>,
              },
              { title: "更新时间", dataIndex: "updatedAt", key: "updated", render: (d: string) => d ? new Date(d).toLocaleDateString("zh-CN") : "—" },
            ]}
          />
        )}
      </Card>

      {/* 最近报告 */}
      <Card
        title={<Space><FileTextOutlined />最近报告</Space>}
        extra={<Link to="/project-grade/projects">查看全部 →</Link>}
      >
        {stats.recentReports.length === 0 ? (
          <Empty description="还没有发布过报告" />
        ) : (
          <Table
            dataSource={stats.recentReports}
            rowKey={(r: any) => r.publicId || r._id}
            pagination={false}
            size="small"
            columns={[
              {
                title: "报告", dataIndex: "title", key: "title",
                render: (t: string, r: any) => (
                  <Link to={`/project-grade/reports/${r.publicId}`}>
                    <Text strong>{t || "评估报告"}</Text>
                  </Link>
                ),
              },
              {
                title: "等级", dataIndex: "verdict", key: "verdict",
                render: (v: string) => {
                  const colors: Record<string, string> = { S: "green", A: "blue", B: "cyan", C: "orange", D: "volcano", F: "red" };
                  return <Tag color={colors[v] || "default"}>{v}</Tag>;
                },
              },
              {
                title: "分数", dataIndex: "externalScore", key: "externalScore",
                render: (s: number) => s != null ? <Text strong>{s.toFixed(1)}</Text> : "—",
              },
              { title: "发布时间", dataIndex: "publishedAt", key: "publishedAt", render: (d: string) => d ? new Date(d).toLocaleDateString("zh-CN") : "—" },
            ]}
          />
        )}
      </Card>
    </div>
  );
}
