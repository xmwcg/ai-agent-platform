import { useState, useEffect } from "react";
import {
  Card, Typography, Button, Select, Input, message, Descriptions, Table, Tag, Modal, Empty,
} from "antd";
import { useNavigate } from "react-router-dom";
import { billingAPI, extractApiError } from "@/services/api";

const { Title, Paragraph, Text } = Typography;

const REFUND_REASONS: { value: string; label: string }[] = [
  { value: "voluntary_refund", label: "自愿退款 · 产品不满足需求" },
  { value: "duplicate_payment", label: "重复扣款" },
  { value: "service_unavailable", label: "关键功能不可用" },
  { value: "other", label: "其他原因" },
];

const STATUS_MAP: Record<string, { text: string; color: string }> = {
  pending: { text: "待审核", color: "gold" },
  approved: { text: "已批准", color: "blue" },
  rejected: { text: "已拒绝", color: "red" },
  processing: { text: "退款中", color: "orange" },
  success: { text: "已退款", color: "green" },
  failed: { text: "失败", color: "red" },
};

export default function RefundRequestPage() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<any[]>([]);
  const [refunds, setRefunds] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refundsLoading, setRefundsLoading] = useState(true);
  const [selectedOrderNo, setSelectedOrderNo] = useState<string | null>(null);
  const [reason, setReason] = useState<string>("voluntary_refund");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    Promise.all([
      billingAPI.getOrders().catch(() => ({ data: [] })),
      (billingAPI as any).getMyRefunds?.()?.catch(() => ({ data: [] })) ?? Promise.resolve({ data: [] }),
    ]).then(([orderRes, refundRes]) => {
      const paidOrders = (Array.isArray(orderRes?.data) ? orderRes.data : []).filter(
        (o: any) => o.paymentStatus === "paid" && !["refunding", "refunded"].includes(o.paymentStatus)
      );
      setOrders(paidOrders);
      setRefunds(Array.isArray(refundRes?.data) ? refundRes.data : []);
    }).catch(() => {
      message.error("加载订单失败，请刷新重试");
    }).finally(() => {
      setLoading(false);
      setRefundsLoading(false);
    });
  }, []);

  const handleRequest = async () => {
    if (!selectedOrderNo) { message.warning("请选择要退款的订单"); return; }
    setSubmitting(true);
    try {
      const res: any = await (billingAPI as any).requestRefund?.({
        orderNo: selectedOrderNo,
        reason,
        description: description?.trim() || undefined,
      }) ?? Promise.reject(new Error("退款接口不可用"));
      message.success(res?.data?.refundNo ? "退款申请已提交，请等待管理员审核" : "操作成功");
      setSelectedOrderNo(null);
      setDescription("");
      const updated: any = await (billingAPI as any).getMyRefunds?.()?.catch(() => ({ data: [] })) ?? { data: [] };
      setRefunds(Array.isArray(updated?.data) ? updated.data : []);
    } catch (e) {
      message.error(extractApiError(e, "提交失败"));
    } finally {
      setSubmitting(false);
    }
  };

  const formatAmount = (cents: number) => (cents / 100).toFixed(2);

  const refundColumns = [
    { title: "退款编号", dataIndex: "refundNo", ellipsis: true, width: 220 },
    { title: "订单", dataIndex: "orderNo", ellipsis: true, width: 160 },
    { title: "金额 (¥)", render: (_: any, r: any) => formatAmount(r.amount || 0) },
    { title: "状态", dataIndex: "status", render: (s: string) => {
      const st = STATUS_MAP[s] ?? { text: s, color: "default" };
      return <Tag color={st.color}>{st.text}</Tag>;
    } },
    { title: "原因", dataIndex: "reason" },
    { title: "提交时间", dataIndex: "createdAt", render: (v: string) => v ? new Date(v).toLocaleDateString("zh-CN") : "-" },
  ];

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: 24 }}>
      <Title level={3} style={{ marginBottom: 6 }}>退款申请</Title>
      <Paragraph type="secondary">根据《退款政策》，符合条件的订单可在付款后 7 天内申请退款。退款由管理员审核，通过后原路退回。</Paragraph>

      <Card title="提交退款申请" style={{ marginBottom: 24 }}>
        {loading ? (
          <Paragraph type="secondary">加载可退款订单中…</Paragraph>
        ) : orders.length === 0 ? (
          <Empty description="当前没有可退款的已支付订单" />
        ) : (
          <>
            <Descriptions column={1} size="small" style={{ marginBottom: 12 }}>
              <Descriptions.Item label="选择订单">
                <Select
                  style={{ width: "100%", maxWidth: 480 }}
                  placeholder="请选择需要退款的订单"
                  value={selectedOrderNo}
                  onChange={setSelectedOrderNo}
                  options={orders.map((o: any) => ({
                    value: o.orderNo,
                    label: `${o.orderNo} · ${o.plan?.toUpperCase?.() ?? "-"} · ¥${formatAmount(o.amount || 0)}`,
                  }))}
                />
              </Descriptions.Item>
              <Descriptions.Item label="退款原因">
                <Select
                  value={reason}
                  onChange={setReason}
                  style={{ width: "100%", maxWidth: 480 }}
                  options={REFUND_REASONS}
                />
              </Descriptions.Item>
              <Descriptions.Item label="补充说明（可选）">
                <Input.TextArea
                  value={description}
                  onChange={(e) => { if (e.target.value.length <= 500) setDescription(e.target.value); }}
                  rows={2}
                  maxLength={500}
                  showCount
                  placeholder="请简要说明退款原因，便于管理员审核 (最多 500 字)"
                />
              </Descriptions.Item>
            </Descriptions>
            <Button type="primary" loading={submitting} onClick={handleRequest} danger>
              提交退款申请
            </Button>
          </>
        )}
      </Card>

      <Card title="我的退款记录" extra={<Button size="small" onClick={() => { setRefundsLoading(true); (billingAPI as any).getMyRefunds?.()?.then((res: any) => { setRefunds(Array.isArray(res?.data) ? res.data : []); }).catch(() => {}).finally(() => setRefundsLoading(false)); }}>刷新</Button>}>
        <Table
          dataSource={refunds}
          columns={refundColumns}
          rowKey="refundNo"
          loading={refundsLoading}
          scroll={{ x: 720 }}
          pagination={false}
        />
      </Card>
    </div>
  );
}