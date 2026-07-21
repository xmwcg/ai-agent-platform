import React, { useState, useRef } from 'react';
import { Modal, message } from 'antd';
import { useAuthStore } from '@/stores/auth';
import { useNavigate } from 'react-router-dom';
import {
  Card, Typography, Button, Space, Row, Col, Tag, Descriptions, Table,
  Progress, Steps, Divider, Statistic, Tabs, Collapse, Empty, Result
} from 'antd';
import {
  DesktopOutlined, LaptopOutlined, PrinterOutlined, WifiOutlined,
  ScanOutlined, DatabaseOutlined, SafetyOutlined, ThunderboltOutlined,
  PlayCircleOutlined, DownloadOutlined, CrownOutlined, CheckCircleOutlined,
  ClockCircleOutlined, CloseCircleOutlined, ClusterOutlined,
  AppstoreOutlined, CodeOutlined, AuditOutlined, GlobalOutlined,
  FileProtectOutlined, SwapOutlined, ShoppingCartOutlined, WechatOutlined,
} from '@ant-design/icons';
import { QRCodeSVG } from 'qrcode.react';
import { billingAPI, extractApiError } from '@/services/api';

const WEWORK_KF_URL = 'https://work.weixin.qq.com/kfid/kfce20d584b0179916f';
const PERSONAL_WECHAT_QR = '/wechat-qr.png';
const SERVICE_PHONE = '13599530881';

const { Title, Paragraph, Text } = Typography;

// ========== 模拟数据 ==========
const MOCK_HARDWARE = [
  { key: '1', item: 'CPU', detail: 'Intel Core i7-13700', spec: '16核24线程 / 2.1-5.2GHz', source: 'WMI' },
  { key: '2', item: '主板', detail: 'ASUS TUF GAMING B760M-PLUS', spec: 'LGA1700 / DDR5', source: 'WMI' },
  { key: '3', item: '内存', detail: 'Kingston 32GB DDR5-5600', spec: '2×16GB 双通道', source: 'WMI' },
  { key: '4', item: '硬盘', detail: 'Samsung 990 Pro 1TB NVMe', spec: 'PCIe 4.0 / 读取7450MB/s', source: 'WMI' },
  { key: '5', item: '显卡', detail: 'NVIDIA GeForce RTX 4060', spec: '8GB GDDR6 / PCIe 4.0', source: 'WMI' },
  { key: '6', item: '网卡', detail: 'Realtek 2.5GbE + Intel AX211 WiFi6E', spec: '有线/无线双网卡', source: 'WMI' },
  { key: '7', item: '显示器', detail: 'Dell U2723QE 27" 4K', spec: '3840×2160 / IPS', source: 'EDID' },
  { key: '8', item: '系统', detail: 'Windows 11 专业版 23H2', spec: '64位 / Build 22631', source: 'Win32_OperatingSystem' },
];

const MOCK_NETWORK_CHECK = [
  { key: '1', check: 'IP地址获取', status: 'ok', detail: '192.168.1.105 (DHCP)' },
  { key: '2', check: '网关可达', status: 'ok', detail: '192.168.1.1 <1ms' },
  { key: '3', check: 'DNS解析', status: 'ok', detail: '223.5.5.5 正常' },
  { key: '4', check: 'SMB服务', status: 'warn', detail: '未启用（可一键修复）' },
  { key: '5', check: 'RDP远程桌面', status: 'ok', detail: '端口3389 已监听' },
  { key: '6', check: 'WinRM', status: 'warn', detail: '未配置（可一键修复）' },
  { key: '7', check: '防火墙规则', status: 'ok', detail: '入站规则完整' },
  { key: '8', check: 'IP冲突检测', status: 'ok', detail: '未发现冲突' },
];

const MOCK_PRINTERS = [
  { key: '1', name: 'HP LaserJet Pro M404dn', type: '网络打印机', port: '192.168.1.200:9100', status: '在线', shared: false },
  { key: '2', name: 'Canon LBP2900+', type: 'USB打印机', port: 'USB001', status: '在线', shared: false },
];

const MOCK_DISK_CLEAN = [
  { key: '1', category: '临时文件', path: 'C:\\Users\\Admin\\AppData\\Local\\Temp', size: '1.2 GB', safe: true },
  { key: '2', category: 'Windows更新缓存', path: 'C:\\Windows\\SoftwareDistribution\\Download', size: '3.8 GB', safe: true },
  { key: '3', category: '回收站', path: '回收站', size: '256 MB', safe: true },
  { key: '4', category: '缩略图缓存', path: 'C:\\Users\\Admin\\AppData\\Local\\Microsoft\\Windows\\Explorer', size: '180 MB', safe: true },
  { key: '5', category: '休眠文件', path: 'C:\\hiberfil.sys', size: '6.4 GB', safe: false, note: '需确认' },
];

const MOCK_ASSETS = [
  { key: '1', type: '台式机', name: '设计师工作站', spec: 'i7-13700/RTX4060/32GB', dept: '设计部', price: '¥8,499 (京东)', priceDate: '2026-07' },
  { key: '2', type: '笔记本', name: 'ThinkPad X1 Carbon', spec: 'i7-1365U/16GB/512GB', dept: '管理层', price: '¥9,999 (京东)', priceDate: '2026-07' },
  { key: '3', type: '服务器', name: 'Ubuntu 文件服务器', spec: 'Xeon E-2288G/64GB/4TB RAID', dept: 'IT部', price: '¥6,500 (二手参考)', priceDate: '2026-07' },
  { key: '4', type: '打印机', name: 'HP LaserJet Pro M404dn', spec: '黑白激光/自动双面', dept: '共享设备', price: '¥2,399 (京东)', priceDate: '2026-07' },
];

const TABS = [
  { key: 'hardware', label: '硬件扫描', icon: <ScanOutlined /> },
  { key: 'network', label: '网络体检', icon: <WifiOutlined /> },
  { key: 'printer', label: '打印机管理', icon: <PrinterOutlined /> },
  { key: 'disk', label: 'C盘清理', icon: <FileProtectOutlined /> },
  { key: 'assets', label: '资产报表', icon: <DatabaseOutlined /> },
];

export default function JinWangTongDemo() {
  const user = useAuthStore((s) => s.user);
  const nav = useNavigate();
  const [activeTab, setActiveTab] = useState('hardware');
  const [scanProgress, setScanProgress] = useState(0);
  const [scanning, setScanning] = useState(false);
  const [buyLoading, setBuyLoading] = useState(false);
  const [payQr, setPayQr] = useState<{ open: boolean; value: string; orderNo: string } | null>(null);
  const pollRef = useRef<number | null>(null);

  const stopPolling = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  };

  const startPolling = (orderNo: string) => {
    stopPolling();
    pollRef.current = window.setInterval(async () => {
      try {
        const r: any = await billingAPI.getOrderStatus(orderNo);
        if (r?.data?.status === 'paid') {
          stopPolling();
          setPayQr((prev) => prev ? { ...prev, open: false } : null);
          message.success('支付成功！License 已自动签发到您的账号，可前往个人中心下载');
        } else if (r?.data?.status === 'expired') {
          stopPolling();
          message.warning('订单已过期，请重新下单');
          setPayQr(null);
        }
      } catch { /* ignore */ }
    }, 3000);
  };

  const closePayQr = () => {
    stopPolling();
    setPayQr(null);
  };

  const handleBuy = async () => {
    if (!user) {
      Modal.confirm({ title: '请先登录', content: '购买金网通需要登录 AIbak 账号。', okText: '去登录', cancelText: '取消', onOk: () => nav('/login') });
      return;
    }
    setBuyLoading(true);
    try {
      const res: any = await billingAPI.createPrivateLicenseOrder({ packageId: 'ent-standard', provider: 'wechat' as any });
      const payUrl = res?.data?.payParams?.code_url || res?.data?.payParams?.codeUrl || res?.data?.payUrl;
      const orderNo = res?.data?.orderNo as string;
      if (payUrl && orderNo) {
        setPayQr({ open: true, value: payUrl, orderNo });
        startPolling(orderNo);
      } else {
        message.success('已创建订单，请在订单管理中完成支付');
        nav('/profile?tab=orders');
      }
    } catch (err) { message.error(extractApiError(err, '创建订单失败，请稍后重试')); }
    finally { setBuyLoading(false); }
  };

  const openWechatService = () => {
    Modal.info({
      title: '联系客服',
      content: (
        <div style={{ textAlign: 'center' }}>
          <Paragraph>选择您方便的客服方式</Paragraph>
          <Button type="primary" icon={<WechatOutlined />} block size="large"
            onClick={() => window.open(WEWORK_KF_URL, '_blank')}
            style={{ marginBottom: 12, background: '#07c160', borderColor: '#07c160', borderRadius: 10, height: 44 }}>
            打开企业微信客服
          </Button>
          <Paragraph type="secondary" style={{ fontSize: 12, marginBottom: 8 }}>扫码添加个人微信</Paragraph>
          <img src={PERSONAL_WECHAT_QR} alt="个人微信二维码" style={{ width: 180, height: 180, borderRadius: 8, border: '1px solid #eee' }} />
          <Paragraph type="secondary" style={{ marginTop: 8, fontSize: 12 }}>服务热线：{SERVICE_PHONE}</Paragraph>
        </div>
      ),
      width: 340,
      okButtonProps: { style: { display: 'none' } },
      cancelText: '关闭',
      onCancel: () => {},
    });
  };

  const startDemoScan = () => {
    setScanning(true);
    setScanProgress(0);
    const interval = setInterval(() => {
      setScanProgress(prev => {
        if (prev >= 100) { clearInterval(interval); setScanning(false); return 100; }
        return prev + Math.random() * 15 + 3;
      });
    }, 200);
  };

  const renderTab = () => {
    switch (activeTab) {
      case 'hardware':
        return (
          <>
            <Paragraph type="secondary" style={{ marginBottom: 16 }}>
              一键采集本机 CPU、主板、内存、硬盘、显卡、网卡、显示器、BIOS 完整信息。支持 Windows/Linux/macOS，PowerShell 2.0+ 全兼容。
            </Paragraph>
            {!scanning && scanProgress === 0 && (
              <Button type="primary" icon={<PlayCircleOutlined />} onClick={startDemoScan} style={{ borderRadius: 8, marginBottom: 16 }}>
                演示扫描过程
              </Button>
            )}
            {scanning && <Progress percent={Math.min(100, Math.round(scanProgress))} status="active" style={{ marginBottom: 16 }} />}
            {scanProgress >= 100 && (
              <>
                <Tag color="success" style={{ marginBottom: 12 }}>扫描完成 · 共采集 8 项硬件信息</Tag>
                <Table dataSource={MOCK_HARDWARE} columns={[
                  { title: '硬件', dataIndex: 'item', width: 80 },
                  { title: '型号', dataIndex: 'detail' },
                  { title: '规格', dataIndex: 'spec' },
                  { title: '来源', dataIndex: 'source', width: 80, render: (s: string) => <Tag>{s}</Tag> },
                ]} size="small" pagination={false} />
              </>
            )}
            {!scanning && scanProgress === 0 && (
              <Empty description="点击「演示扫描过程」查看模拟硬件扫描结果" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            )}
          </>
        );
      case 'network':
        return (
          <>
            <Paragraph type="secondary" style={{ marginBottom: 16 }}>
              检测 IP 地址、网关、DNS、SMB/RDP/WinRM 服务、防火墙和 IP 冲突。发现问题可一键修复。
            </Paragraph>
            <Table dataSource={MOCK_NETWORK_CHECK} columns={[
              { title: '检测项', dataIndex: 'check', width: 120 },
              {
                title: '状态', dataIndex: 'status', width: 80,
                render: (s: string) => s === 'ok'
                  ? <Tag color="success" icon={<CheckCircleOutlined />}>正常</Tag>
                  : <Tag color="warning" icon={<ClockCircleOutlined />}>待修复</Tag>
              },
              { title: '详情', dataIndex: 'detail' },
            ]} size="small" pagination={false} />
            <div style={{ marginTop: 12, padding: 12, background: '#fffbe6', borderRadius: 8, border: '1px solid #ffe58f' }}>
              <Text strong style={{ color: '#ad6800' }}>⚠ 发现 2 项可自动修复的问题：</Text>
              <br />
              <Text style={{ color: '#ad6800' }}>· SMB服务未启用 — 运行 .\netcheck.ps1 -AutoFix 一键修复</Text>
              <br />
              <Text style={{ color: '#ad6800' }}>· WinRM未配置 — 运行 .\perms-fix.ps1 自动配置</Text>
            </div>
          </>
        );
      case 'printer':
        return (
          <>
            <Paragraph type="secondary" style={{ marginBottom: 16 }}>
              自动发现 USB/LPT/网络打印机，智能配置共享，支持一键打印测试页。
            </Paragraph>
            <Table dataSource={MOCK_PRINTERS} columns={[
              { title: '打印机名称', dataIndex: 'name' },
              { title: '类型', dataIndex: 'type', render: (t: string) => <Tag>{t}</Tag> },
              { title: '端口', dataIndex: 'port' },
              { title: '状态', dataIndex: 'status', render: (s: string) => <Tag color="success">{s}</Tag> },
              {
                title: '操作', dataIndex: 'shared',
                render: (shared: boolean) => shared
                  ? <Tag color="blue">已共享</Tag>
                  : <Button size="small" type="primary" ghost>一键共享</Button>
              },
            ]} size="small" pagination={false} />
            <div style={{ marginTop: 12, textAlign: 'center' }}>
              <Paragraph type="secondary" style={{ fontSize: 12 }}>点击「一键共享」后，同局域网其他电脑即可发现并使用该打印机。</Paragraph>
            </div>
          </>
        );
      case 'disk':
        return (
          <>
            <Paragraph type="secondary" style={{ marginBottom: 16 }}>
              扫描C盘垃圾文件（临时文件/缓存/休眠文件），按安全等级分类，仅清理系统垃圾，不碰个人文件。
            </Paragraph>
            <Table dataSource={MOCK_DISK_CLEAN} columns={[
              { title: '类别', dataIndex: 'category', width: 140 },
              { title: '路径', dataIndex: 'path', ellipsis: true },
              { title: '大小', dataIndex: 'size', width: 80, render: (s: string) => <Text strong>{s}</Text> },
              {
                title: '安全性', dataIndex: 'safe', width: 80,
                render: (s: boolean) => s ? <Tag color="success">可安全清理</Tag> : <Tag color="error">需确认</Tag>
              },
            ]} size="small" pagination={false} />
            <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between' }}>
              <Statistic title="可安全清理" value="5.4 GB" prefix={<FileProtectOutlined />} />
              <Statistic title="需确认后清理" value="6.4 GB" prefix={<ClockCircleOutlined />} valueStyle={{ color: '#faad14' }} />
              <Statistic title="总计可释放" value="11.8 GB" prefix={<ThunderboltOutlined />} valueStyle={{ color: '#52c41a' }} />
            </div>
          </>
        );
      case 'assets':
        return (
          <>
            <Paragraph type="secondary" style={{ marginBottom: 16 }}>
              自动汇总硬件资产，联网对比京东/中关村实时价格。支持手动登记其他 IT 资产，生成报表并导出 Excel。
            </Paragraph>
            <Table dataSource={MOCK_ASSETS} columns={[
              { title: '类型', dataIndex: 'type', width: 80, render: (t: string) => <Tag>{t}</Tag> },
              { title: '名称', dataIndex: 'name' },
              { title: '规格', dataIndex: 'spec', ellipsis: true },
              { title: '归属', dataIndex: 'dept', width: 80 },
              { title: '参考价格', dataIndex: 'price', render: (p: string) => <Text strong style={{ color: '#fa541c' }}>{p}</Text> },
              { title: '日期', dataIndex: 'priceDate', width: 80 },
            ]} size="small" pagination={false} />
            <div style={{ marginTop: 12, textAlign: 'right' }}>
              <Space>
                <Button icon={<DownloadOutlined />}>导出 Excel</Button>
                <Button icon={<AppstoreOutlined />}>手动登记资产</Button>
              </Space>
            </div>
          </>
        );
    }
  };

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '0 8px' }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #1a1a2e 100%)',
        borderRadius: 16, padding: '40px 32px', textAlign: 'center', marginBottom: 24,
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: -40, right: -40, width: 200, height: 200, background: 'radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 70%)', borderRadius: '50%' }} />
        <Title level={2} style={{ color: '#fff', marginBottom: 8, position: 'relative', zIndex: 1 }}>金网通 · 在线体验中心</Title>
        <Paragraph style={{ color: '#94a3b8', fontSize: 15, maxWidth: 600, margin: '0 auto 20px', position: 'relative', zIndex: 1 }}>
          以下是金网通运行后的真实效果演示（演示数据）。安装后即可对本机进行真实扫描和管理。
        </Paragraph>
        <Space size={16} style={{ position: 'relative', zIndex: 1 }}>
          <Button type="primary" size="large" icon={<PlayCircleOutlined />}
            onClick={() => { setActiveTab("hardware"); }}
            style={{ borderRadius: 10, height: 48, padding: "0 28px", fontSize: 16, fontWeight: 600,
              background: "linear-gradient(135deg, #6366f1, #8b5cf6)", border: "none",
              boxShadow: "0 4px 20px rgba(99,102,241,0.4)" }}>
            在线体验（免费演示）
          </Button>
          <Button size="large" icon={<ShoppingCartOutlined />} loading={buyLoading}
            onClick={handleBuy}
            style={{ borderRadius: 10, height: 48, padding: "0 28px", fontSize: 15, fontWeight: 600,
              background: "#fff", color: "#6366f1", border: "2px solid #6366f1" }}>
            立即购买 ¥299起
          </Button>
          <Button size="large" ghost icon={<WechatOutlined />} onClick={openWechatService}
            style={{ borderRadius: 10, height: 48, padding: '0 28px', fontSize: 15, color: '#07c160', borderColor: '#07c160' }}>
            联系客服
          </Button>
        </Space>
      </div>

      {/* Tab demo */}
      <Card styles={{ body: { padding: 16 } }} style={{ borderRadius: 14, marginBottom: 24 }}>
        <Tabs activeKey={activeTab} onChange={setActiveTab} items={TABS.map(t => ({
          key: t.key, label: <span>{t.icon} {t.label}</span>,
        }))} />
        <div style={{ minHeight: 280 }}>{renderTab()}</div>
      </Card>

      {/* How it works */}
      <Card style={{ borderRadius: 14, marginBottom: 24 }} title="📦 如何使用">
        <Steps direction="vertical" current={-1} items={[
          { title: '在线体验（无需下载）', description: '点击上方按钮进入 Web 在线演示，无需安装' },
          { title: '在线购买并支付', description: '点击「立即购买」直接生成订单，扫码完成微信支付' },
          { title: '环境体检', description: '右键 PowerShell → 以管理员运行 .\\compat-check.ps1' },
          { title: '一键修复', description: '如有问题运行 .\\perms-fix.ps1 自动修复' },
          { title: '开始扫描', description: '运行 .\\wizard.ps1 打开交互式配置向导，选择需要的功能' },
        ]} />
      </Card>

      {/* CTA */}
      <div style={{
        background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
        borderRadius: 16, padding: '40px 32px', textAlign: 'center', marginBottom: 24,
      }}>
        <Title level={3} style={{ color: '#fff', marginBottom: 8 }}>购买后即可下载安装包</Title>
        <Paragraph style={{ color: 'rgba(255,255,255,0.8)', fontSize: 15, marginBottom: 20 }}>
          在线体验满意后购买 · 永久买断 ¥299起 · 支付成功自动签发License · 立即下载安装包
        </Paragraph>
        <Space size={16}>
          <Button size="large" icon={<ShoppingCartOutlined />} loading={buyLoading} onClick={handleBuy}
            style={{ borderRadius: 10, height: 48, padding: '0 32px', fontSize: 15, fontWeight: 600, background: '#fff', color: '#6366f1', border: 'none' }}>
            立即购买
          </Button>
          <Button size="large" ghost onClick={() => nav('/jinwangtong')}
            style={{ borderRadius: 10, height: 48, padding: '0 32px', fontSize: 15, color: '#fff', borderColor: 'rgba(255,255,255,0.6)' }}>
            查看完整产品页
          </Button>
        </Space>
      </div>

      {/* 微信支付二维码弹窗 */}
      {payQr?.open && (
        <Modal open={payQr.open} title="微信支付 · 金网通专业版" footer={null} onCancel={closePayQr} width={360} centered>
          <div style={{ textAlign: 'center' }}>
            <Paragraph>请使用微信扫描下方二维码完成支付</Paragraph>
            <QRCodeSVG value={payQr.value} size={200} style={{ margin: '0 auto' }} />
            <Paragraph type="secondary" style={{ marginTop: 12, fontSize: 12 }}>支付完成后 License 将自动签发到您的账号</Paragraph>
            <Paragraph type="secondary" style={{ fontSize: 12 }}>订单号：{payQr.orderNo}</Paragraph>
          </div>
        </Modal>
      )}
    </div>
  );
}
