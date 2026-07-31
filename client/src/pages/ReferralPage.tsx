import { useEffect, useState } from "react";
import {
  Card, Col, Row, Statistic, Table, Tag, Typography, Spin, Empty,
  Button, Space, Tabs, message, Descriptions, Modal, Form, InputNumber, Select, Input,
} from "antd";
import {
  ShareAltOutlined, CopyOutlined, UserSwitchOutlined, TeamOutlined,
  DollarOutlined, ClockCircleOutlined, WalletOutlined,
  LinkOutlined, SendOutlined, TrophyOutlined,
} from "@ant-design/icons";
import { referralAPI, extractApiError } from "@/services/api";

const { Title, Paragraph, Text } = Typography;
const { Option } = Select;

interface ReferralCodeData {
  code: string;
  link: string;
  qrcode?: string;
}

interface ReferralStats {
  directCount: number;
  totalCount: number;
  pendingCommission: number;
  settledCommission: number;
  monthlyTrend?: Array<{ month: string; commissions: number; referrals: number }>;
}

interface ReferralItem {
  _id: string;
  referredUser?: { email?: string; nickname?: string; avatar?: string };
  referredEmail?: string;
  referredName?: string;
  status: "registered" | "activated" | "paid";
  createdAt: string;
  commission?: number;
}

interface CommissionItem {
  _id: string;
  amount: number;
  status: "pending" | "settled" | "withdrawn";
  type: string;
  createdAt: string;
  settledAt?: string;
  referralUser?: { email?: string; nickname?: string };
}

export default function ReferralPage() {
  const [codeData, setCodeData] = useState<ReferralCodeData | null>(null);
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [referrals, setReferrals] = useState<ReferralItem[]>([]);
  const [commissions, setCommissions] = useState<CommissionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [referralPage, setReferralPage] = useState(1);
  const [commissionPage, setCommissionPage] = useState(1);
  const [referralTotal, setReferralTotal] = useState(0);
  const [commissionTotal, setCommissionTotal] = useState(0);
  const [withdrawModalOpen, setWithdrawModalOpen] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [withdrawForm] = Form.useForm();

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [codeRes, statsRes, listRes, commRes] = await Promise.all([
        referralAPI.code(),
        referralAPI.stats(),
        referralAPI.list({ page: 1, pageSize: 20 }),
        referralAPI.commissions({ page: 1, pageSize: 20 }),
      ]);
      setCodeData((codeRes as any)?.data ?? (codeRes as any) ?? null);
      setStats((statsRes as any)?.data ?? (statsRes as any) ?? null);
      const listData = (listRes as any)?.data ?? listRes;
      const commData = (commRes as any)?.data ?? commRes;
      setReferrals((listData as any)?.items ?? (listData as any)?.data ?? []);
      setReferralTotal((listData as any)?.total ?? 0);
      setCommissions((commData as any)?.items ?? (commData as any)?.data ?? []);
      setCommissionTotal((commData as any)?.total ?? 0);
    } catch (err: any) {
      setError(extractApiError(err) || "加载失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const handleCopyCode = async () => {
    if (!codeData?.code) return;
    try {
      await navigator.clipboard.writeText(codeData.code);
      message.success("推荐码已复制到剪贴板");
    } catch {
      message.error("复制失败，请手动复制");
    }
  };

  const handleCopyLink = async () => {
    if (!codeData?.link) return;
    try {
      await navigator.clipboard.writeText(codeData.link);
      message.success("推荐链接已复制到剪贴板");
    } catch {
      message.error("复制失败，请手动复制");
    }
  };

  const handleShare = async () => {
    const shareText = `快来体验 AIbak 智能平台！使用我的推荐码 ${codeData?.code} 注册，或点击链接：${codeData?.link}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "Aibak 推荐", text: shareText });
      } catch { /* user cancelled */ }
    } else {
      try {
        await navigator.clipboard.writeText(shareText);
        message.success("分享内容已复制到剪贴板");
      } catch {
        message.error("分享失败");
      }
    }
  };

  const handleWithdraw = async (values: { amount: number; method: 'wechat' | 'alipay'; account?: string }) => {
    setWithdrawing(true);
    try {
      await referralAPI.withdraw(values);
      message.success("提现申请已提交，等待审核");
      setWithdrawModalOpen(false);
      withdrawForm.resetFields();
      fetchAll();
    } catch (err: any) {
      message.error(extractApiError(err) || "提现申请失败");
    } finally {
      setWithdrawing(false);
    }
  };

  const fetchReferralPage = async (page: number) => {
    try {
      const res: any = await referralAPI.list({ page, pageSize: 20 });
      const data = res?.data ?? res;
      setReferrals(data?.items ?? data?.data ?? []);
      setReferralPage(page);
    } catch { /* ignore */ }
  };

  const fetchCommissionPage = async (page: number) => {
    try {
      const res: any = await referralAPI.commissions({ page, pageSize: 20 });
      const data = res?.data ?? res;
      setCommissions(data?.items ?? data?.data ?? []);
      setCommissionPage(page);
    } catch { /* ignore */ }
  };

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: 120 }}>
        <Spin size="large" tip="加载推荐数据..." />
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div style={{ maxWidth: 800, margin: "40px auto", padding: 24 }}>
        <Empty description={error || "暂无推荐数据"}>
          <Button onClick={() => window.location.reload()}>重新加载</Button>
        </Empty>
      </div>
    );
  }

  const statusTagMap: Record<string, { label: string; color: string }> = {
    registered: { label: "已注册", color: "blue" },
    activated: { label: "已激活", color: "cyan" },
    paid: { label: "已付费", color: "green" },
    pending: { label: "待结算", color: "orange" },
    settled: { label: "已结算", color: "green" },
    withdrawn: { label: "已提现", color: "purple" },
  };

  const tabItems = [
    {
      key: "referrals",
      label: "推荐列表",
      children: (
        <Table
          dataSource={referrals}
          rowKey={(r: ReferralItem) => r._id}
          pagination={{
            current: referralPage,
            total: referralTotal,
            pageSize: 20,
            onChange: fetchReferralPage,
          }}
          size="small"
          columns={[
            {
              title: "用户",
              dataIndex: "referredEmail",
              key: "user",
              render: (_: string, r: ReferralItem) => (
                <Text>{r.referredUser?.nickname || r.referredUser?.email || r.referredEmail || r.referredName || "未知用户"}</Text>
              ),
            },
            {
              title: "状态",
              dataIndex: "status",
              key: "status",
              render: (s: string) => {
                const tag = statusTagMap[s] || { label: s, color: "default" };
                return <Tag color={tag.color}>{tag.label}</Tag>;
              },
            },
            {
              title: "佣金",
              dataIndex: "commission",
              key: "commission",
              render: (c: number) =>
                c != null ? <Text strong>¥{c.toFixed(2)}</Text> : <Text type="secondary">—</Text>,
            },
            {
              title: "注册时间",
              dataIndex: "createdAt",
              key: "createdAt",
              render: (d: string) => (d ? new Date(d).toLocaleDateString("zh-CN") : "—"),
            },
          ]}
        />
      ),
    },
    {
      key: "commissions",
      label: "佣金记录",
      children: (
        <Table
          dataSource={commissions}
          rowKey={(c: CommissionItem) => c._id}
          pagination={{
            current: commissionPage,
            total: commissionTotal,
            pageSize: 20,
            onChange: fetchCommissionPage,
          }}
          size="small"
          columns={[
            {
              title: "金额",
              dataIndex: "amount",
              key: "amount",
              render: (a: number) => <Text strong style={{ color: "#52c41a" }}>¥{a.toFixed(2)}</Text>,
            },
            {
              title: "类型",
              dataIndex: "type",
              key: "type",
              render: (t: string) => <Tag>{t || "推荐佣金"}</Tag>,
            },
            {
              title: "来源用户",
              dataIndex: "referralUser",
              key: "referralUser",
              render: (u: any) => <Text>{u?.nickname || u?.email || "—"}</Text>,
            },
            {
              title: "状态",
              dataIndex: "status",
              key: "status",
              render: (s: string) => {
                const tag = statusTagMap[s] || { label: s, color: "default" };
                return <Tag color={tag.color}>{tag.label}</Tag>;
              },
            },
            {
              title: "创建时间",
              dataIndex: "createdAt",
              key: "createdAt",
              render: (d: string) => (d ? new Date(d).toLocaleDateString("zh-CN") : "—"),
            },
            {
              title: "结算时间",
              dataIndex: "settledAt",
              key: "settledAt",
              render: (d: string) => (d ? new Date(d).toLocaleDateString("zh-CN") : "—"),
            },
          ]}
        />
      ),
    },
    {
      key: "trend",
      label: "月度趋势",
      children: (
        stats.monthlyTrend && stats.monthlyTrend.length > 0 ? (
          <Table
            dataSource={stats.monthlyTrend}
            rowKey={(t: any) => t.month}
            pagination={false}
            size="small"
            columns={[
              { title: "月份", dataIndex: "month", key: "month", render: (m: string) => <Text strong>{m}</Text> },
              {
                title: "佣金",
                dataIndex: "commissions",
                key: "commissions",
                render: (c: number) => <Text style={{ color: "#52c41a" }}>¥{c.toFixed(2)}</Text>,
              },
              { title: "推荐数", dataIndex: "referrals", key: "referrals", render: (r: number) => <Text>{r}</Text> },
            ]}
          />
        ) : (
          <Empty description="暂无月度趋势数据" />
        )
      ),
    },
  ];

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 16px" }}>
      <Title level={3} style={{ marginBottom: 4 }}>推荐分销</Title>
      <Paragraph type="secondary">推荐码 · 佣金统计 · 提现管理</Paragraph>

      {/* 推荐码卡片 */}
      <Card
        title={<Space><LinkOutlined />我的推荐码</Space>}
        style={{ marginBottom: 24 }}
        extra={
          <Button type="primary" icon={<WalletOutlined />} onClick={() => setWithdrawModalOpen(true)}>
            申请提现
          </Button>
        }
      >
        <Row gutter={[16, 16]} align="middle">
          <Col flex="auto">
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="推荐码">
                <Space>
                  <Text strong copyable style={{ fontSize: 18, letterSpacing: 2 }}>{codeData?.code || "—"}</Text>
                  <Button size="small" icon={<CopyOutlined />} onClick={handleCopyCode}>复制</Button>
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label="推荐链接">
                <Space style={{ width: "100%" }}>
                  <Text
                    ellipsis
                    copyable
                    style={{ maxWidth: 480, display: "inline-block", verticalAlign: "middle" }}
                  >
                    {codeData?.link || "—"}
                  </Text>
                  <Button size="small" icon={<CopyOutlined />} onClick={handleCopyLink}>复制链接</Button>
                </Space>
              </Descriptions.Item>
            </Descriptions>
          </Col>
          <Col>
            <Button
              type="primary"
              size="large"
              icon={<SendOutlined />}
              onClick={handleShare}
            >
              分享推荐
            </Button>
          </Col>
        </Row>
      </Card>

      {/* 统计卡片 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="直推人数"
              value={stats.directCount}
              prefix={<UserSwitchOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="总推荐数"
              value={stats.totalCount}
              prefix={<TeamOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="待结算佣金"
              value={stats.pendingCommission}
              precision={2}
              prefix={<ClockCircleOutlined />}
              suffix={<Text type="secondary">元</Text>}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="已结算佣金"
              value={stats.settledCommission}
              precision={2}
              prefix={<DollarOutlined />}
              suffix={<Text type="secondary">元</Text>}
            />
          </Card>
        </Col>
      </Row>

      {/* Tab 表格区 */}
      <Card>
        <Tabs defaultActiveKey="referrals" items={tabItems} />
      </Card>

      {/* 提现弹窗 */}
      <Modal
        title="申请提现"
        open={withdrawModalOpen}
        onCancel={() => { setWithdrawModalOpen(false); withdrawForm.resetFields(); }}
        onOk={() => withdrawForm.submit()}
        confirmLoading={withdrawing}
        okText="提交申请"
        cancelText="取消"
      >
        <Form
          form={withdrawForm}
          layout="vertical"
          onFinish={handleWithdraw}
          style={{ marginTop: 16 }}
        >
          <Form.Item
            label="提现金额（元）"
            name="amount"
            rules={[
              { required: true, message: "请输入提现金额" },
              { type: "number", min: 10, message: "最低提现 10 元" },
            ]}
          >
            <InputNumber style={{ width: "100%" }} placeholder="请输入提现金额" prefix="¥" min={10} step={10} />
          </Form.Item>
          <Form.Item
            label="提现方式"
            name="method"
            rules={[{ required: true, message: "请选择提现方式" }]}
          >
            <Select placeholder="请选择提现方式">
              <Option value="wechat">微信支付</Option>
              <Option value="alipay">支付宝</Option>
            </Select>
          </Form.Item>
          <Form.Item
            label="收款账户"
            name="account"
            rules={[{ required: true, message: "请输入收款账户" }]}
          >
            <Input placeholder="手机号 / 邮箱 / 账号" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

