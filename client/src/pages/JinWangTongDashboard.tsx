import React, { useEffect, useState, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  Typography, Card, Table, Tag, Button, Space, message, Modal, Descriptions,
  Tooltip, Empty, Spin, Tabs, Statistic, Row, Col, Alert, QRCode,
} from "antd";
import {
  KeyOutlined, DownloadOutlined, LaptopOutlined, ReloadOutlined,
  CrownOutlined, CopyOutlined, CheckCircleOutlined, CloseCircleOutlined,
  ClockCircleOutlined, ExclamationCircleOutlined, SafetyOutlined,
  AppstoreAddOutlined, QrcodeOutlined,
} from "@ant-design/icons";
import { apiClient, extractApiError } from "@/services/api";
import { useAuthStore } from "@/stores/auth";
import dayjs from "dayjs";

const { Title, Text, Paragraph } = Typography;

// ============== 类型定义 ==============

interface LicenseInfo {
  licenseId: string;
  company: string;
  edition: string;
  maxDevices: number;
  expireDate: string;
  features: string[];
  licenseContent: string;
  orderNo: string;
  issuedAt: string;
  activatedAt?: string;
  status: "active" | "revoked" | "expired";
  devices: string[];
}

interface DeviceInfo {
  deviceId: string;
  licenseId: string;
  hostname: string;
  os: string;
  osVersion: string;
  cpuModel: string;
  totalMemoryGB: number;
  ipAddress: string;
  agentVersion: string;
  lastHeartbeat: string;
  status: "online" | "offline" | "blocked";
}

interface EditionInfo {
  key: string;
  name: string;
  price: number;
  maxDevices: number;
  days: number;
  features: string[];
  highlighted: boolean;
  description: string;
  downloadUrl: string;
}

// ============== 辅助函数 ==============

const EDITION_MAP: Record<string, { label: string; color: string }> = {
  free: { label: "免费版", color: "blue" },
  trial: { label: "试用版", color: "cyan" },
  pro: { label: "专业版", color: "green" },
  enterprise: { label: "企业版", color: "gold" },
};

const STATUS_MAP: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  active: { label: "有效", color: "green", icon: <CheckCircleOutlined /> },
  revoked: { label: "已吊销", color: "red", icon: <CloseCircleOutlined /> },
  expired: { label: "已过期", color: "orange", icon: <ExclamationCircleOutlined /> },
};

// ============== 组件 ==============

const JinWangTongDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [licenses, setLicenses] = useState<LicenseInfo[]>([]);
  const [devices, setDevices] = useState<DeviceInfo[]>([]);
  const [editions, setEditions] = useState<EditionInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLicense, setSelectedLicense] = useState<LicenseInfo | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [downloadQrOpen, setDownloadQrOpen] = useState(false);

  // ========== 数据加载 ==========

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [licRes, devRes, edRes] = await Promise.all([
        apiClient.get("/jinwangtong/license/mine").catch(() => ({ data: { success: false, data: [] } })),
        apiClient.get("/jinwangtong/devices/mine").catch(() => ({ data: { success: false, data: [] } })),
        apiClient.get("/jinwangtong/editions").catch(() => ({ data: { success: false, data: [] } })),
      ]);

      if (licRes.data?.success) setLicenses(licRes.data.data);
      if (devRes.data?.success) setDevices(devRes.data.data);
      if (edRes.data?.success) setEditions(edRes.data.data);
    } catch (err) {
      console.error("加载金网通数据失败", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) loadData();
  }, [user, loadData]);

  // ========== 操作 ==========

  const handleCopyLicense = (content: string) => {
    navigator.clipboard.writeText(content);
    message.success("License 内容已复制到剪贴板");
  };

  const handleShowDetail = (license: LicenseInfo) => {
    setSelectedLicense(license);
    setDetailOpen(true);
  };

  const handleRequestTrial = async () => {
    try {
      const res = await apiClient.post("/jinwangtong/license/trial", { company: user?.name || "个人用户" });
      if (res.data?.success) {
        message.success("试用 License 申请成功！有效期15天");
        loadData();
      }
    } catch (err: any) {
      message.error(extractApiError(err) || "申请失败，请稍后重试");
    }
  };

  const activeLicenses = licenses.filter((l) => l.status === "active");
  const onlineDevices = devices.filter((d) => d.status === "online");

  // ========== 未登录或未购买提示 ==========

  if (!user) {
    return (
      <div style={{ maxWidth: 800, margin: "40px auto", padding: "0 16px" }}>
        <Card>
          <Empty
            image={<SafetyOutlined style={{ fontSize: 64, color: "#6366f1" }} />}
            description={
              <>
                <Title level={4}>请先登录</Title>
                <Paragraph>登录后查看您的金网通 License 和设备管理</Paragraph>
              </>
            }
          >
            <Button type="primary" onClick={() => navigate("/login")}>
              立即登录
            </Button>
          </Empty>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ maxWidth: 1000, margin: "40px auto", padding: "0 16px", textAlign: "center" }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 16px" }}>
      {/* ===== 页头 ===== */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <Title level={2} style={{ margin: 0 }}>
            <KeyOutlined style={{ color: "#6366f1", marginRight: 8 }} />
            金网通 · 我的 License
          </Title>
          <Text type="secondary">管理您的金网通企业网络管理授权与设备</Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadData}>
            刷新
          </Button>
          <Button type="primary" icon={<DownloadOutlined />} onClick={() => setDownloadQrOpen(true)}>
            下载客户端
          </Button>
        </Space>
      </div>

      {/* ===== 统计卡片 ===== */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={6}>
          <Card size="small">
            <Statistic title="有效 License" value={activeLicenses.length} prefix={<KeyOutlined />} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small">
            <Statistic title="在线设备" value={onlineDevices.length} prefix={<LaptopOutlined />} valueStyle={{ color: "#52c41a" }} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small">
            <Statistic title="已注册设备" value={devices.length} prefix={<AppstoreAddOutlined />} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small">
            <Statistic title="总 License" value={licenses.length} prefix={<CrownOutlined />} />
          </Card>
        </Col>
      </Row>

      {/* ===== 暂无 License 提示 ===== */}
      {activeLicenses.length === 0 && (
        <Alert
          type="info"
          showIcon
          message="您还没有有效的 License"
          description={
            <Space>
              <span>免费试用15天，体验全部功能</span>
              <Button size="small" type="primary" onClick={handleRequestTrial}>
                申请试用 License
              </Button>
              <Link to="/jinwangtong">
                <Button size="small">查看购买方案</Button>
              </Link>
            </Space>
          }
          style={{ marginBottom: 24 }}
        />
      )}

      {/* ===== License 列表 ===== */}
      <Tabs
        defaultActiveKey="licenses"
        items={[
          {
            key: "licenses",
            label: `我的 License (${licenses.length})`,
            children: (
              <Card>
                {licenses.length === 0 ? (
                  <Empty description="暂无 License 记录">
                    <Button type="primary" onClick={() => navigate("/jinwangtong")}>
                      前往购买
                    </Button>
                  </Empty>
                ) : (
                  <Table
                    dataSource={licenses}
                    rowKey="licenseId"
                    pagination={false}
                    columns={[
                      {
                        title: "版本",
                        dataIndex: "edition",
                        render: (ed: string) => {
                          const m = EDITION_MAP[ed] || { label: ed, color: "default" };
                          return <Tag color={m.color}>{m.label}</Tag>;
                        },
                      },
                      { title: "公司/团队", dataIndex: "company" },
                      {
                        title: "设备",
                        dataIndex: "devices",
                        render: (devs: string[], record: LicenseInfo) => (
                          <Text>{devs.length} / {record.maxDevices}</Text>
                        ),
                      },
                      {
                        title: "到期",
                        dataIndex: "expireDate",
                        render: (d: string) => (
                          <Text>{d === "永久" ? <Tag color="purple">永久</Tag> : dayjs(d).format("YYYY-MM-DD")}</Text>
                        ),
                      },
                      {
                        title: "状态",
                        dataIndex: "status",
                        render: (s: string) => {
                          const m = STATUS_MAP[s] || { label: s, color: "default", icon: null };
                          return <Tag icon={m.icon} color={m.color}>{m.label}</Tag>;
                        },
                      },
                      {
                        title: "签发时间",
                        dataIndex: "issuedAt",
                        render: (d: string) => dayjs(d).format("YYYY-MM-DD"),
                      },
                      {
                        title: "操作",
                        render: (_: any, record: LicenseInfo) => (
                          <Space>
                            <Button size="small" type="link" onClick={() => handleShowDetail(record)}>
                              详情
                            </Button>
                            {record.status === "active" && (
                              <Tooltip title="复制 License 内容">
                                <Button
                                  size="small"
                                  type="link"
                                  icon={<CopyOutlined />}
                                  onClick={() => handleCopyLicense(record.licenseContent)}
                                />
                              </Tooltip>
                            )}
                          </Space>
                        ),
                      },
                    ]}
                  />
                )}
              </Card>
            ),
          },
          {
            key: "devices",
            label: `我的设备 (${devices.length})`,
            children: (
              <Card>
                {devices.length === 0 ? (
                  <Empty description="暂无注册设备">
                    <Paragraph type="secondary">
                      下载金网通客户端后，运行脚本注册设备即可在此查看
                    </Paragraph>
                  </Empty>
                ) : (
                  <Table
                    dataSource={devices}
                    rowKey="deviceId"
                    pagination={false}
                    columns={[
                      {
                        title: "状态",
                        dataIndex: "status",
                        width: 80,
                        render: (s: string) => {
                          const colors: Record<string, string> = { online: "green", offline: "default", blocked: "red" };
                          return <Tag color={colors[s] || "default"}>{s === "online" ? "在线" : s === "blocked" ? "已封禁" : "离线"}</Tag>;
                        },
                      },
                      { title: "主机名", dataIndex: "hostname" },
                      { title: "操作系统", dataIndex: "os" },
                      { title: "CPU", dataIndex: "cpuModel", ellipsis: true },
                      { title: "内存", dataIndex: "totalMemoryGB", render: (v: number) => `${v}GB` },
                      { title: "IP", dataIndex: "ipAddress" },
                      {
                        title: "最后心跳",
                        dataIndex: "lastHeartbeat",
                        render: (d: string) => dayjs(d).format("MM-DD HH:mm"),
                      },
                    ]}
                  />
                )}
              </Card>
            ),
          },
          {
            key: "versions",
            label: "版本与下载",
            children: (
              <Card>
                {editions.length === 0 ? (
                  <Empty description="暂无版本信息" />
                ) : (
                  <Row gutter={[16, 16]}>
                    {editions.map((ed) => (
                      <Col xs={24} sm={12} md={6} key={ed.key}>
                        <Card
                          size="small"
                          title={
                            <Space>
                              <CrownOutlined style={{ color: ed.highlighted ? "#f59e0b" : "#6366f1" }} />
                              <span>{ed.name}</span>
                              {ed.highlighted && <Tag color="gold">推荐</Tag>}
                            </Space>
                          }
                          style={{ borderColor: ed.highlighted ? "#f59e0b" : undefined }}
                        >
                          <Title level={3} style={{ margin: 0 }}>
                            {ed.price === 0 ? "免费" : `¥${ed.price}`}
                          </Title>
                          <Text type="secondary">{ed.days === 0 ? "永久" : `${ed.days}天`} · {ed.maxDevices}设备</Text>
                          <Paragraph ellipsis={{ rows: 2 }} style={{ marginTop: 8 }}>
                            {ed.description}
                          </Paragraph>
                          {ed.downloadUrl && (
                            <Button
                              type={ed.highlighted ? "primary" : "default"}
                              block
                              icon={<DownloadOutlined />}
                              href={ed.downloadUrl}
                              target="_blank"
                            >
                              下载试用版
                            </Button>
                          )}
                        </Card>
                      </Col>
                    ))}
                  </Row>
                )}
              </Card>
            ),
          },
        ]}
      />

      {/* ===== License 详情弹窗 ===== */}
      <Modal
        title="License 详情"
        open={detailOpen}
        onCancel={() => setDetailOpen(false)}
        footer={[
          <Button key="close" onClick={() => setDetailOpen(false)}>关闭</Button>,
          selectedLicense?.status === "active" && (
            <Button
              key="copy"
              type="primary"
              icon={<CopyOutlined />}
              onClick={() => {
                if (selectedLicense) handleCopyLicense(selectedLicense.licenseContent);
              }}
            >
              复制 License
            </Button>
          ),
        ]}
        width={640}
      >
        {selectedLicense && (
          <Descriptions bordered column={1} size="small">
            <Descriptions.Item label="License ID">{selectedLicense.licenseId}</Descriptions.Item>
            <Descriptions.Item label="版本">
              <Tag color={EDITION_MAP[selectedLicense.edition]?.color}>
                {EDITION_MAP[selectedLicense.edition]?.label}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="公司/团队">{selectedLicense.company}</Descriptions.Item>
            <Descriptions.Item label="设备数">{selectedLicense.devices.length} / {selectedLicense.maxDevices}</Descriptions.Item>
            <Descriptions.Item label="到期时间">
              {selectedLicense.expireDate === "永久" ? (
                <Tag color="purple">永久有效</Tag>
              ) : (
                dayjs(selectedLicense.expireDate).format("YYYY-MM-DD")
              )}
            </Descriptions.Item>
            <Descriptions.Item label="状态">
              <Tag icon={STATUS_MAP[selectedLicense.status]?.icon} color={STATUS_MAP[selectedLicense.status]?.color}>
                {STATUS_MAP[selectedLicense.status]?.label}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="签发时间">{dayjs(selectedLicense.issuedAt).format("YYYY-MM-DD HH:mm")}</Descriptions.Item>
            <Descriptions.Item label="订单号">{selectedLicense.orderNo}</Descriptions.Item>
            <Descriptions.Item label="功能列表">
              <Space wrap>
                {selectedLicense.features.map((f: string) => (
                  <Tag key={f}>{f}</Tag>
                ))}
              </Space>
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>

      {/* ===== 下载二维码弹窗 ===== */}
      <Modal
        title="下载金网通客户端"
        open={downloadQrOpen}
        onCancel={() => setDownloadQrOpen(false)}
        footer={null}
        width={400}
      >
        <div style={{ textAlign: "center", padding: "20px 0" }}>
          <Text strong>扫码下载试用版</Text>
          <div style={{ margin: "16px 0" }}>
            <QRCode
              value="https://aibak.site/download/jinwangtong-trial.zip"
              size={200}
              icon="/favicon.svg"
            />
          </div>
          <Space direction="vertical">
            <Button
              type="primary"
              icon={<DownloadOutlined />}
              href="/download/jinwangtong-trial.zip"
              target="_blank"
              block
            >
              直接下载 (Windows)
            </Button>
            <Link to="/jinwangtong">
              <Button type="link">查看完整功能介绍</Button>
            </Link>
          </Space>
        </div>
      </Modal>
    </div>
  );
};

export default JinWangTongDashboard;

