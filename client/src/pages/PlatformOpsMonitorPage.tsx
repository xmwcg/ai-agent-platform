import React, { useCallback, useEffect, useState } from "react";
// ─── NexMind 全域实时监控大屏 v3 — 暗色主题 · 故障预警 · 一键修复 ───
import {
  Alert, Button, Card, Col, Empty, List, Row, Space, Spin, Statistic, Tag, Typography, message,
} from "antd";
import {
  ReloadOutlined, ToolOutlined,
} from "@ant-design/icons";
import { extractApiError, opsAPI, type OpsDashboardData } from "@/services/api";

const { Text } = Typography;

function statusColor(status: string) {
  if (status === "healthy" || status === "operational") return "green";
  if (status === "degraded" || status === "warning") return "orange";
  return "red";
}

function formatUptime(seconds: number) {
  const total = Math.max(0, Math.floor(seconds || 0));
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  return days ? `${days}天 ${hours}小时` : `${hours}小时 ${minutes}分钟`;
}

const darkCard = {
  background: "rgba(16,23,40,.75)",
  border: "1px solid rgba(99,102,241,.22)",
  borderRadius: 14,
};

const mutedText = { color: "#93a1bd" };
const brightText = { color: "#eaf0fb" };

export default function PlatformOpsMonitorPage() {
  const [data, setData] = useState<OpsDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [repairing, setRepairing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const response = await opsAPI.dashboard();
      setData(response.data?.data ?? null);
      setError("");
    } catch (err) {
      setError(extractApiError(err, "运维数据暂时不可用，请确认管理员权限。"));
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(true), 15000);
    return () => window.clearInterval(timer);
  }, [load]);

  const safeRecheck = async () => {
    setRepairing(true);
    await load(true);
    setRepairing(false);
    message.success("已完成安全重检；未执行服务器重启、DNS 切换或支付相关操作。");
  };

  if (loading && !data) return <Spin style={{ display: "block", margin: "80px auto" }} />;

  return (
    <div style={{
      minHeight: "100vh",
      background: "radial-gradient(1400px 700px at 82% -12%, rgba(99,102,241,.16), transparent 58%), radial-gradient(1100px 620px at 8% -6%, rgba(139,92,246,.14), transparent 55%), #070a12",
      color: "#eaf0fb",
    }}>
      <div style={{ maxWidth: 1920, margin: "0 auto", padding: "16px 22px 26px" }}>
        {/* ═══ 顶部品牌栏 ═══ */}
        <header style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap", marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 52, height: 52, borderRadius: 14, background: "linear-gradient(135deg, #6366f1, #8b5cf6)", display: "grid", placeItems: "center", fontSize: 24, color: "#fff", boxShadow: "0 4px 18px rgba(99,102,241,.5)" }}>N</div>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, background: "linear-gradient(100deg,#c7d2fe,#a5b4fc 30%,#67e8f9 70%,#c4b5fd)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>NexMind by AIbak · 全域实时监控</h1>
              <div style={{ fontSize: 12, color: "#93a1bd", marginTop: 3 }}>前后端 · 模型 · 会员 · 积分 · 链路 · <b style={{ color: "#38bdf8" }}>告警预警</b></div>
            </div>
          </div>
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: "12.5px", background: "rgba(16,23,40,.66)", border: "1px solid rgba(99,102,241,.22)", padding: "7px 13px", borderRadius: 999, color: "#93a1bd" }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: data?.alerts?.length ? "#f5a623" : "#10b981", boxShadow: data?.alerts?.length ? "0 0 8px rgba(245,166,35,.5)" : "0 0 8px rgba(16,185,129,.5)" }} />
              <b style={{ color: "#eaf0fb" }}>{data?.alerts?.length ? `${data.alerts.length} 告警` : "运行正常"}</b>
            </span>
            <Button icon={<ReloadOutlined />} onClick={() => void load()} loading={loading} style={{ background: "rgba(16,23,40,.66)", border: "1px solid rgba(99,102,241,.22)", color: "#eaf0fb", borderRadius: 999 }}>刷新</Button>
            <Button icon={<ToolOutlined />} onClick={() => void safeRecheck()} loading={repairing} style={{ background: "rgba(239,68,68,.18)", border: "1px solid rgba(239,68,68,.35)", color: "#fca5a5", borderRadius: 999, fontWeight: 600 }}>一键修复 / 安全重检</Button>
          </div>
        </header>

        {error && <Alert type="warning" showIcon message={error} style={{ marginBottom: 14, background: "rgba(245,166,35,.12)", border: "1px solid rgba(245,166,35,.3)", color: "#fcd34d" }} />}

        {!data ? <Empty description="暂无监控数据" /> : <>
          {/* ═══ KPI 面板 ═══ */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 14 }}>
            {[
              { label: "WAU 周活", value: data.ops?.northStar?.wau ?? 0, color: "#6366f1" },
              { label: "24h AI 请求", value: data.usage?.requests ?? 0, color: "#8b5cf6" },
              { label: "24h Token", value: (data.usage?.totalTokens ?? 0) >= 1000 ? `${((data.usage?.totalTokens ?? 0) / 1000).toFixed(1)}k` : data.usage?.totalTokens ?? 0, color: "#38bdf8" },
              { label: "AI 成本 ¥", value: `${((data.usage?.costFen ?? 0) / 100).toFixed(2)}`, color: "#10b981" },
              { label: "成功率 %", value: `${(data.traffic?.successRate ?? 100).toFixed(1)}`, color: "#34d399" },
              { label: "P95 ms", value: data.traffic?.p95Ms ?? 0, color: "#f5a623" },
              { label: "CPU %", value: data.system?.cpu?.toFixed(1), color: "#ec4899" },
              { label: "内存 %", value: data.system?.memory?.usedPercent, color: "#a78bfa" },
              { label: "5xx/日", value: data.traffic?.errors5xxToday ?? 0, color: "#ef4444" },
              { label: "付费/总", value: `${data.members?.paidUsers ?? 0}/${data.members?.totalUsers ?? 0}`, color: "#c084fc" },
            ].map((kpi, i) => (
              <div key={i} style={{ position: "relative", overflow: "hidden", padding: "13px 14px 12px", borderRadius: 14, background: "linear-gradient(165deg, rgba(24,33,58,.9), rgba(11,17,32,.86))", border: "1px solid rgba(148,163,184,.12)", boxShadow: "0 10px 30px rgba(0,0,0,.35)" }}>
                <div style={{ position: "absolute", left: 0, top: 0, height: 2, width: "100%", background: `linear-gradient(90deg,${kpi.color},transparent)`, opacity: .85 }} />
                <div style={{ fontSize: "11.5px", color: "#93a1bd" }}>{kpi.label}</div>
                <div style={{ fontSize: 24, fontWeight: 800, marginTop: 6, color: "#eaf0fb" }}>{kpi.value}</div>
              </div>
            ))}
          </div>

          {/* ═══ 双栏 ═══ */}
          <Row gutter={[14, 14]} style={{ marginBottom: 14 }}>
            <Col xs={24} lg={12}>
              <Card title="🖥️ 服务与基础设施" style={darkCard} styles={{ header: brightText }}>
                <List size="small" dataSource={Object.entries(data.services || {})}
                  renderItem={([name, svc]: any) => (
                    <List.Item style={{ borderBottom: "1px solid rgba(148,163,184,.08)" }}>
                      <span style={brightText}>{name}</span>
                      <Tag color={statusColor(svc.status)}>{svc.status}</Tag>
                    </List.Item>
                  )} />
                <div style={{ marginTop: 12, display: "flex", gap: 16, flexWrap: "wrap" }}>
                  <Statistic title="CPU" value={data.system?.cpu} precision={1} suffix="%" valueStyle={{ color: "#eaf0fb", fontSize: 16 }} />
                  <Statistic title="内存" value={data.system?.memory?.usedPercent} suffix="%" valueStyle={{ color: "#eaf0fb", fontSize: 16 }} />
                  <Statistic title="磁盘" value={(data.system?.disk as any)?.usedPercent ?? "--"} suffix="%" valueStyle={{ color: (data.system?.disk as any)?.usedPercent >= 90 ? "#ef4444" : "#eaf0fb", fontSize: 16 }} />
                  <Statistic title="运行时长" value={formatUptime(data.system?.uptime)} valueStyle={{ color: "#eaf0fb", fontSize: 16 }} />
                </div>
              </Card>
            </Col>
            <Col xs={24} lg={12}>
              <Card title="🤖 模型与 Token 用量" style={darkCard} styles={{ header: brightText }}>
                <Space wrap style={{ marginBottom: 12 }}>
                  {data.models?.providers?.map((p: string) => <Tag key={p} color="geekblue">{p}</Tag>)}
                </Space>
                <Row gutter={12}>
                  <Col span={8}><Statistic title="输入 Token" value={data.usage?.promptTokens ?? 0} valueStyle={{ color: "#eaf0fb" }} /></Col>
                  <Col span={8}><Statistic title="输出 Token" value={data.usage?.completionTokens ?? 0} valueStyle={{ color: "#eaf0fb" }} /></Col>
                  <Col span={8}><Statistic title="Fallback" value={data.usage?.fallbackRequests ?? 0} valueStyle={{ color: data.usage?.fallbackRequests ? "#f5a623" : "#10b981" }} /></Col>
                </Row>
              </Card>
            </Col>
          </Row>

          {/* ═══ 会员与流量 ═══ */}
          <Row gutter={[14, 14]} style={{ marginBottom: 14 }}>
            <Col xs={24} lg={12}>
              <Card title="👤 会员与积分" style={darkCard} styles={{ header: brightText }}>
                <div style={{ marginBottom: 12 }}><Text style={brightText}>全平台积分余额：<b>{data.members?.creditsBalance ?? 0}</b></Text></div>
                <Space wrap>
                  {(data.members?.planBreakdown || []).map((item: any) => (
                    <Tag key={item.plan} color={item.plan === "free" ? "default" : "gold"} style={{ fontSize: 14, padding: "4px 12px" }}>
                      {item.plan === "free" ? "免费版" : item.plan === "pro" ? "专业版" : item.plan === "max" ? "旗舰版" : item.plan === "team" ? "团队版" : item.plan}: {item.count}
                    </Tag>
                  ))}
                </Space>
                <div style={{ marginTop: 12 }}><Text style={mutedText}>免费 {data.members?.freeUsers ?? 0} · 付费 {data.members?.paidUsers ?? 0} · WAU {data.ops?.northStar?.wau ?? 0} · MRR ¥{(data.ops?.revenue?.mrr ?? 0).toFixed(2)}</Text></div>
              </Card>
            </Col>
            <Col xs={24} lg={12}>
              <Card title="📊 流量与 API" style={darkCard} styles={{ header: brightText }}>
                <Row gutter={12}>
                  <Col span={8}><Statistic title="成功率" value={data.traffic?.successRate ?? 100} precision={1} suffix="%" valueStyle={{ color: "#10b981" }} /></Col>
                  <Col span={8}><Statistic title="P95 延迟" value={data.traffic?.p95Ms ?? 0} suffix="ms" valueStyle={{ color: "#eaf0fb" }} /></Col>
                  <Col span={8}><Statistic title="今日 5xx" value={data.traffic?.errors5xxToday ?? 0} valueStyle={{ color: data.traffic?.errors5xxToday ? "#ef4444" : "#10b981" }} /></Col>
                </Row>
                <div style={{ marginTop: 12 }}><Text style={mutedText}>24h API 请求 {data.traffic?.apiRequests24h ?? 0} · 进程请求 {data.traffic?.processRequests?.total ?? 0}</Text></div>
              </Card>
            </Col>
          </Row>

          {/* ═══ 拓扑 ═══ */}
          <Card title="🔗 服务调用拓扑 · 实时数据流" style={darkCard} styles={{ header: brightText }}>
            <Text style={{ color: "#93a1bd", display: "block", marginBottom: 10 }}>用户访问 → NexMind 前端 → API 网关 → 模型池 → MongoDB / Redis · 异常时进入云端备用节点</Text>
            <Space wrap>{(data.topology?.nodes || []).map((node: any) => <Tag key={node.id} color={statusColor(node.status)} style={{ fontSize: 13 }}>{node.label} · {node.status}</Tag>)}</Space>
            <div style={{ marginTop: 10 }}><Text style={{ color: "#5c6a86", fontSize: 12 }}>链路：{(data.topology?.edges || []).map((e: any) => e.join(" → ")).join(" ｜ ") || "暂无链路数据"}</Text></div>
          </Card>

          {/* ═══ 故障预警 ── ═══ */}
          <Card title="⚠️ 故障预警与一键修复" style={{ ...darkCard, border: "1px solid rgba(239,68,68,.25)", marginTop: 14 }} styles={{ header: { color: "#fca5a5" } }}>
            {(!data.alerts || data.alerts.length === 0) ? (
              <Alert type="success" showIcon message="✅ 当前没有已发现的告警" description="监控页面每 15 秒自动刷新；发现问题后可点击「一键修复/安全重检」。"
                style={{ background: "rgba(16,185,129,.08)", border: "1px solid rgba(16,185,129,.2)" }} />
            ) : (
              <List dataSource={data.alerts} renderItem={(alert: any) => (
                <List.Item style={{ borderBottom: "1px solid rgba(148,163,184,.08)", padding: "12px 0" }}
                  actions={[<Button key="fix" size="small" type="primary" danger onClick={() => void safeRecheck()} loading={repairing} style={{ borderRadius: 8 }}>🔧 一键修复</Button>]}>
                  <List.Item.Meta
                    title={<Space><Tag color={alert.level === "critical" ? "red" : alert.level === "warning" ? "orange" : "blue"}>{alert.level}</Tag><span style={brightText}>{alert.message}</span></Space>}
                    description={<span style={mutedText}>{alert.fix || "点击「一键修复」执行安全重检。不会修改支付或服务器配置。"}</span>}
                  />
                </List.Item>
              )} />
            )}
          </Card>
        </>}
      </div>
    </div>
  );
}
