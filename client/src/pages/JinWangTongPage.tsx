import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Typography, Card, Tag, Button, Space, Row, Col, message, Modal, Divider, Steps, Descriptions } from 'antd';
import {
  ScanOutlined, WifiOutlined, PrinterOutlined,
  FileProtectOutlined, SafetyOutlined, DownloadOutlined, ApiOutlined,
  CloudServerOutlined, ClusterOutlined, AppstoreOutlined, ToolOutlined,
  CrownOutlined, ThunderboltOutlined, LaptopOutlined, CheckCircleOutlined,
  GlobalOutlined, SwapOutlined, DatabaseOutlined, FundOutlined,
  WindowsOutlined, AppleOutlined, LinuxOutlined, SettingOutlined,
  TeamOutlined, AuditOutlined, RadarChartOutlined,
} from '@ant-design/icons';
import { billingAPI, extractApiError } from '@/services/api';
import { useAuthStore } from '@/stores/auth';

const { Title, Paragraph, Text } = Typography;

const FEATURES = [
  { icon: <ScanOutlined />, name: '硬件全扫描', desc: '一键采集CPU/主板/内存/硬盘/GPU/网卡/显示器/BIOS完整资产信息，支持Windows/Linux/macOS', color: '#6366f1' },
  { icon: <WifiOutlined />, name: '网络体检', desc: 'IP冲突检测/网关可达/DNS解析/SMB/RDP/WinRM 8项自动检测+交互式修复', color: '#06b6d4' },
  { icon: <PrinterOutlined />, name: '打印机一键共享', desc: '自动发现USB/LPT/网络打印机，智能配置共享+打印测试页，解决多电脑共享痛点', color: '#8b5cf6' },
  { icon: <FileProtectOutlined />, name: 'C盘安全清理', desc: '8项系统垃圾扫描+安全清理，不碰个人文件，删除走回收站，支持备份后清理', color: '#10b981' },
  { icon: <ClusterOutlined />, name: '资产智能报表', desc: '自动生成硬件资产列表，联网对比京东/中关村/太平洋实时价格，辅助IT采购决策', color: '#f59e0b' },
  { icon: <SwapOutlined />, name: '跨系统文件共享', desc: 'Windows SMB / Linux Samba+NFS / Web HTTP 三种方案，局域网内无缝传文件', color: '#ef4444' },
  { icon: <SafetyOutlined />, name: '权限一键修复', desc: '8项环境检测，管理权限/防火墙/WMI/执行策略问题自动修复，零门槛上手', color: '#3b82f6' },
  { icon: <AppstoreOutlined />, name: 'Web集中控制台', desc: '可视化仪表盘管理所有设备，下发上网管控/远程命令/批量任务，一目了然', color: '#ec4899' },
  { icon: <AuditOutlined />, name: '审计日志追踪', desc: '统一JSONL审计日志，本地+中心双写，操作可追溯，满足合规要求', color: '#14b8a6' },
  { icon: <GlobalOutlined />, name: '上网行为管控', desc: '按主机一键开关上网权限，防火墙规则+网关黑名单，支持定时策略', color: '#f97316' },
  { icon: <ToolOutlined />, name: 'C盘重复文件清理', desc: '按哈希识别重复文件，定位大文件Top20，休眠文件/还原点管理，节省磁盘空间', color: '#a855f7' },
  { icon: <LaptopOutlined />, name: '三大系统兼容', desc: 'Windows 10/11全版本(含家庭版自动配RDP) · Linux扫描 · macOS基础支持', color: '#64748b' },
];

const PRICING = [
  { id: 'free', name: '免费试用版', price: '0', period: '15天', originalPrice: '', features: ['完整硬件扫描', '网络体检(只读)', 'C盘清理(手动确认)', '单机使用', '社区支持'], tag: '推荐试用', tagColor: 'blue', btnText: '免费试用(需登录)', isFree: true, icon: <DownloadOutlined /> },
  { id: 'ent-standard', name: '专业版', price: '299', period: '永久', originalPrice: '¥2,000+/年', packageId: 'ent-standard', features: ['免费版全部功能', '资产报表+实时价格对比', '打印机一键共享', '文件共享SMB配置', '权限自动修复', '3台设备授权', '邮件工单支持'], tag: '性价比之选', tagColor: 'green', btnText: '立即购买', icon: <CrownOutlined /> },
  { id: 'ent-pro', name: '旗舰版', price: '599', period: '永久', originalPrice: '¥5,000+/年', packageId: 'ent-pro', features: ['专业版全部功能', 'Web集中控制台', '批量任务下发', '上网行为管控', '审计日志追踪', '不限设备数', '优先技术支持'], tag: '企业推荐', tagColor: 'orange', btnText: '立即购买', icon: <ThunderboltOutlined />, highlighted: true },
  { id: 'ent-ultimate', name: '团队版', price: '999', period: '永久', originalPrice: '¥10,000+/年', packageId: 'ent-ultimate', features: ['旗舰版全部功能', '不限席位', '多分支机构管理', '专属技术对接', '定制开发支持', 'SLA保障'], tag: '大团队', tagColor: 'red', btnText: '立即购买', icon: <TeamOutlined /> },
];

const ADVANTAGES = [
  { icon: <CheckCircleOutlined />, title: '零服务器成本', desc: '纯内网运行，无需购买服务器。脚本即跑即用，一台普通电脑即可做管理机' },
  { icon: <CheckCircleOutlined />, title: 'Win10/11全兼容', desc: '专业版/企业版/家庭版全支持。家庭版自动配置RDP Wrapper，远程桌面无障碍' },
  { icon: <CheckCircleOutlined />, title: '离线可用', desc: '数据不出公司内网，核心功能不依赖互联网。价格对比等功能离线时使用本地缓存数据' },
  { icon: <CheckCircleOutlined />, title: '永久买断', desc: '一次付费永久授权，无年费/无续费。对比竞品年费¥2,000-10,000+，1-3个月回本' },
];

const INSTALL_STEPS = [
  { step: 1, title: '下载脚本包', desc: '下载 jinwangtong-scripts.zip 解压到任意目录(建议C:\金网通)' },
  { step: 2, title: '环境体检', desc: '右键 PowerShell → 以管理员运行 .\\health-check.ps1，查看环境是否就绪' },
  { step: 3, title: '一键修复', desc: '如有问题，运行 .\\health-check.ps1 -AutoFix 自动修复防火墙/权限/WMI等' },
  { step: 4, title: '开始使用', desc: '运行 .\\scan-hardware.ps1 扫描资产，启动 .\\console.ps1 打开Web控制台' },
];

const FAQ_ITEMS = [
  { q: '软件是否需要联网？', a: '核心功能(扫描、体检、共享、管控)纯内网运行，数据不出公司。价格对比功能需要联网查询，离线时使用本地缓存数据。' },
  { q: 'Windows 家庭版能用吗？', a: '可以。金网通自动检测系统版本，家庭版会自动配置RDP Wrapper以支持远程桌面功能。' },
  { q: '支持多少台电脑？', a: '专业版支持3台，旗舰版不限数量。团队版额外支持多分支机构管理。' },
  { q: 'License如何签发？', a: '购买后系统自动签发License到您的AIbak账号，下载脚本包后在任意电脑运行激活即可，无需人工联系。' },
  { q: '数据安全吗？', a: '所有数据存储在本地SQLite数据库，不上传到任何云端服务器。审计日志本地+中心双写，操作可追溯。' },
  { q: '能否跨网段管理？', a: '当前版本针对同一局域网设计。多分支机构管理请选择团队版，我们将提供定制方案。' },
  { q: '购买后可以退款吗？', a: '免费试用15天，满意再购买。购买后7天内可申请退款，详见退款政策。' },
  { q: '怎么联系技术支持？', a: '专业版及以上用户享受邮件工单支持。旗舰版和团队版享有优先技术支持。也可以在AI对话中联系在线客服。' },
];

const JinWangTongPage: React.FC = () => {
  const [buyLoading, setBuyLoading] = useState<string | null>(null);
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);

  const handleBuy = async (pkgId: string, pkgName: string) => {
    if (!user) {
      Modal.confirm({ title: '请先登录', content: '购买金网通需要登录 AIbak 账号。', okText: '去登录', cancelText: '取消', onOk: () => navigate('/login') });
      return;
    }
    setBuyLoading(pkgId);
    try {
      const res: any = await billingAPI.createPrivateLicenseOrder({ packageId: pkgId, provider: 'wechat' as any });
      const payUrl = (res as any)?.data?.payParams?.code_url || (res as any)?.data?.payUrl;
      if (payUrl) {
        Modal.info({
          title: '请扫码支付',
          content: <div style={{ textAlign: 'center' }}><Paragraph>请使用微信扫描下方二维码完成支付</Paragraph><img src={'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=' + encodeURIComponent(payUrl)} alt="支付二维码" style={{ width: 200, height: 200 }} /><Paragraph type="secondary" style={{ marginTop: 8, fontSize: 12 }}>支付完成后 License 将自动签发到您的账号</Paragraph></div>,
          width: 360,
        });
      } else {
        message.success('已创建 ' + pkgName + ' 订单，请在订单管理中完成支付');
        navigate('/profile?tab=orders');
      }
    } catch (err) { message.error(extractApiError(err, '创建订单失败，请稍后重试')); }
    finally { setBuyLoading(null); }
  };

  const handleFreeDownload = () => {
  if (!user) {
    Modal.confirm({ title: '请先登录', content: '登录后即可免费下载金网通试用版。', okText: '去登录', cancelText: '取消', onOk: () => navigate('/login') });
    return;
  }
  window.open('/api/billing/private-license/download?type=trial', '_blank');
  message.success('正在下载金网通试用版（需登录验证）...');
};
  

  return (
    <div style={{ padding: '0 8px', maxWidth: 1200, margin: '0 auto' }}>
      {/* Hero */}
      <div style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 40%, #1a1a2e 70%, #16213e 100%)', borderRadius: 16, padding: '60px 40px', textAlign: 'center', position: 'relative', overflow: 'hidden', marginBottom: 24 }}>
        <div style={{ position: 'absolute', top: -50, right: -50, width: 300, height: 300, background: 'radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 70%)', borderRadius: '50%' }} />
        <div style={{ position: 'absolute', bottom: -30, left: -30, width: 250, height: 250, background: 'radial-gradient(circle, rgba(6,182,212,0.1) 0%, transparent 70%)', borderRadius: '50%' }} />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <Tag color="purple" style={{ fontSize: 13, padding: '4px 16px', borderRadius: 20, marginBottom: 12 }}><ThunderboltOutlined /> 企业局域网管理 · 一站式解决方案</Tag>
          <Title level={1} style={{ color: '#fff', fontSize: 'clamp(28px, 5vw, 48px)', fontWeight: 800, marginBottom: 16 }}>金网通计算机管理系统</Title>
          <Paragraph style={{ color: '#94a3b8', fontSize: 'clamp(15px, 2vw, 18px)', maxWidth: 700, margin: '0 auto 12px' }}>一套系统管理个人和企业多台电脑设备 · 企业局域网一键互联互通</Paragraph>
          <Paragraph style={{ color: '#64748b', fontSize: 14, maxWidth: 640, margin: '0 auto 24px' }}>一次部署全公司打通：文件共享 · 远程桌面 · 统一管控 · 审计溯源 · 上网管控 · 网络体检 — <Text strong style={{ color: '#818cf8' }}>六合一</Text> · 离线可用 · 数据不出公司</Paragraph>
          <Space size={16} wrap>
            <Button type="primary" size="large" icon={<DownloadOutlined />} onClick={handleFreeDownload} style={{ borderRadius: 10, height: 48, padding: '0 32px', fontSize: 16, fontWeight: 600, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', border: 'none', boxShadow: '0 4px 20px rgba(99,102,241,0.4)' }}>免费下载试用 (15天)</Button>
          </Space>
          <div style={{ marginTop: 32, display: 'flex', justifyContent: 'center', gap: 40, flexWrap: 'wrap' }}>
            {[{ icon: <WindowsOutlined />, label: 'Win10/11全版本' }, { icon: <AppleOutlined />, label: 'macOS支持' }, { icon: <LinuxOutlined />, label: 'Linux扫描' }, { icon: <SafetyOutlined />, label: '离线可用' }, { icon: <ThunderboltOutlined />, label: '永久买断' }].map((item, i) => (<div key={i} style={{ textAlign: 'center' }}><div style={{ fontSize: 22, color: '#818cf8', marginBottom: 4 }}>{item.icon}</div><Text style={{ color: '#94a3b8', fontSize: 12 }}>{item.label}</Text></div>))}
          </div>
        </div>
      </div>

      {/* Advantages */}
      <Row gutter={[16, 16]} style={{ marginBottom: 32 }}>
        {ADVANTAGES.map((a, i) => (<Col xs={24} sm={12} md={6} key={i}><Card size="small" style={{ borderRadius: 12, border: '1px solid #e2e8f0', height: '100%' }} bodyStyle={{ padding: '20px 16px' }} hoverable><div style={{ color: '#6366f1', fontSize: 20, marginBottom: 8 }}>{a.icon}</div><Text strong style={{ fontSize: 14, display: 'block', marginBottom: 4 }}>{a.title}</Text><Text type="secondary" style={{ fontSize: 12, lineHeight: 1.6 }}>{a.desc}</Text></Card></Col>))}
      </Row>

      {/* Features */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}><Title level={2} style={{ marginBottom: 8 }}>核心功能</Title><Paragraph type="secondary" style={{ fontSize: 15 }}>覆盖企业局域网管理与IT资产运维的全场景需求</Paragraph></div>
        <Row gutter={[16, 16]}>
          {FEATURES.map((f, i) => (<Col xs={24} sm={12} md={8} lg={6} key={i}><Card hoverable style={{ borderRadius: 12, height: '100%', border: '1px solid #f1f5f9' }} bodyStyle={{ padding: '24px 20px' }}><div style={{ width: 44, height: 44, borderRadius: 12, background: f.color + '15', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12, fontSize: 20, color: f.color }}>{f.icon}</div><Text strong style={{ fontSize: 15, display: 'block', marginBottom: 6 }}>{f.name}</Text><Text type="secondary" style={{ fontSize: 12, lineHeight: 1.7 }}>{f.desc}</Text></Card></Col>))}
        </Row>
      </div>

      <Divider />

      {/* Pricing */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}><Title level={2} style={{ marginBottom: 8 }}><CrownOutlined style={{ color: '#f59e0b', marginRight: 8 }} />选择适合您的版本</Title><Paragraph type="secondary" style={{ fontSize: 15 }}>一次付费 · 永久授权 · 自动签发 License · 无年费</Paragraph></div>
        <Row gutter={[16, 16]}>
          {PRICING.map((pkg) => (<Col xs={24} sm={12} md={6} key={pkg.id}><Card hoverable style={{ borderRadius: 16, border: pkg.highlighted ? '2px solid #6366f1' : '1px solid #e2e8f0', height: '100%', position: 'relative', overflow: 'hidden', boxShadow: pkg.highlighted ? '0 8px 32px rgba(99,102,241,0.15)' : undefined }} bodyStyle={{ padding: '24px 20px' }}>
            {pkg.highlighted && <div style={{ position: 'absolute', top: 0, right: 0, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#fff', padding: '4px 20px', fontSize: 11, borderBottomLeftRadius: 12, fontWeight: 600 }}>最受欢迎</div>}
            <div style={{ textAlign: 'center', marginBottom: 16 }}><div style={{ fontSize: 28, color: '#6366f1', marginBottom: 8 }}>{pkg.icon}</div><Tag color={pkg.tagColor as any} style={{ marginBottom: 8 }}>{pkg.tag}</Tag><Title level={4} style={{ marginBottom: 4 }}>{pkg.name}</Title><div style={{ margin: '12px 0' }}><Text style={{ fontSize: 36, fontWeight: 800, color: '#1e293b' }}>¥{pkg.price}</Text><Text type="secondary" style={{ fontSize: 14 }}>/{pkg.period}</Text></div>{pkg.originalPrice && <Text delete type="secondary" style={{ fontSize: 12 }}>竞品参考 {pkg.originalPrice}</Text>}</div>
            <div style={{ marginBottom: 16 }}>{pkg.features.map((feat, j) => (<div key={j} style={{ padding: '4px 0', display: 'flex', alignItems: 'flex-start', gap: 8 }}><CheckCircleOutlined style={{ color: '#10b981', marginTop: 3, flexShrink: 0 }} /><Text style={{ fontSize: 13, lineHeight: 1.5 }}>{feat}</Text></div>))}</div>
            <Button type={pkg.highlighted ? 'primary' : 'default'} block size="large" loading={buyLoading === pkg.packageId} onClick={() => pkg.isFree ? handleFreeDownload() : pkg.packageId && handleBuy(pkg.packageId, pkg.name)} style={{ borderRadius: 10, height: 44, fontWeight: 600, ...(pkg.highlighted ? { background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', border: 'none' } : {}) }} icon={pkg.isFree ? <DownloadOutlined /> : <CrownOutlined />}>{pkg.btnText}</Button>
          </Card></Col>))}
        </Row>
        <Paragraph type="secondary" style={{ textAlign: 'center', marginTop: 20, fontSize: 13 }}>购买后自动签发 License · 永久授权 · 支持微信支付/对公转账 · <a onClick={() => navigate('/ai-chat')} style={{ cursor: 'pointer', color: '#6366f1' }}>联系客服</a> 获取发票</Paragraph>
      </div>

      <Divider />

      {/* Install */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}><Title level={2} style={{ marginBottom: 8 }}>快速开始</Title><Paragraph type="secondary" style={{ fontSize: 15 }}>4 步完成部署，无需专业IT背景</Paragraph></div>
        <Card style={{ borderRadius: 16, marginBottom: 24 }}><Steps current={-1} direction="vertical" size="small" items={INSTALL_STEPS.map(s => ({ title: <Text strong>{s.title}</Text>, description: <Text type="secondary">{s.desc}</Text> }))} style={{ maxWidth: 600, margin: '0 auto' }} /></Card>
        <div style={{ textAlign: 'center', marginTop: 24 }}><Button type="primary" size="large" icon={<DownloadOutlined />} onClick={handleFreeDownload} style={{ borderRadius: 10, height: 48, padding: '0 32px', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', border: 'none', fontWeight: 600, fontSize: 15 }}>下载脚本包 (ZIP)</Button><Paragraph type="secondary" style={{ marginTop: 12, fontSize: 13 }}></Paragraph></div>
      </div>

      <Divider />

      {/* Specs */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}><Title level={2} style={{ marginBottom: 8 }}>技术规格</Title></div>
        <Row gutter={[16, 16]}>
          <Col xs={24} md={12}><Card title="系统要求" style={{ borderRadius: 16 }} size="small"><Descriptions column={1} size="small" bordered><Descriptions.Item label="操作系统">Windows 10/11 全版本(含家庭版)</Descriptions.Item><Descriptions.Item label="PowerShell">2.0+ 全兼容(自动降级适配)</Descriptions.Item><Descriptions.Item label="管理员权限">需要(首次部署使用)</Descriptions.Item><Descriptions.Item label="磁盘空间">脚本 &lt; 20MB</Descriptions.Item><Descriptions.Item label="网络">局域网 TCP/IP(无需互联网)</Descriptions.Item><Descriptions.Item label="额外扫描">Linux (bash) · macOS (beta)</Descriptions.Item></Descriptions></Card></Col>
          <Col xs={24} md={12}><Card title="能力边界" style={{ borderRadius: 16 }} size="small"><Descriptions column={1} size="small" bordered><Descriptions.Item label="扫描深度">CPU/主板/内存/硬盘/GPU/网卡/显示器/BIOS/外设</Descriptions.Item><Descriptions.Item label="网络协议">SMB/CIFS、RDP、WinRM、NFS、HTTP</Descriptions.Item><Descriptions.Item label="文件共享">Windows SMB / Linux Samba+NFS / Web HTTP</Descriptions.Item><Descriptions.Item label="打印机">USB/LPT/网络打印机自动发现+共享</Descriptions.Item><Descriptions.Item label="数据存储">SQLite 本地库 + JSON 报表导出</Descriptions.Item><Descriptions.Item label="安全架构">纯内网、数据不出公司、不依赖云服务</Descriptions.Item></Descriptions></Card></Col>
        </Row>
      </div>

      <Divider />

      {/* FAQ */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}><Title level={2} style={{ marginBottom: 8 }}>常见问题</Title></div>
        <Card style={{ borderRadius: 16 }}>
          {FAQ_ITEMS.map((item, i) => (<div key={i} style={{ marginBottom: i < 7 ? 16 : 0, padding: '12px 0', borderBottom: i < 7 ? '1px solid #f1f5f9' : 'none' }}><Text strong style={{ fontSize: 14, display: 'block', marginBottom: 4, color: '#1e293b' }}>Q: {item.q}</Text><Text type="secondary" style={{ fontSize: 13, lineHeight: 1.7 }}>{item.a}</Text></div>))}
        </Card>
      </div>

      {/* CTA */}
      <div style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', borderRadius: 16, padding: '48px 32px', textAlign: 'center', marginBottom: 24 }}>
        <Title level={2} style={{ color: '#fff', marginBottom: 8 }}>开始管理您的企业网络</Title>
        <Paragraph style={{ color: 'rgba(255,255,255,0.85)', fontSize: 16, marginBottom: 24 }}>免费试用 15 天 · 零服务器成本 · 纯内网运行 · 数据不出公司</Paragraph>
        <Space size={16}><Button size="large" icon={<DownloadOutlined />} onClick={handleFreeDownload} style={{ borderRadius: 10, height: 48, padding: '0 32px', fontSize: 16, fontWeight: 600, background: '#fff', color: '#6366f1', border: 'none' }}>免费下载试用</Button><Button size="large" ghost onClick={() => navigate('/customer-service')} style={{ borderRadius: 10, height: 48, padding: '0 32px', fontSize: 15, color: '#fff', borderColor: 'rgba(255,255,255,0.6)' }}>联系客服</Button></Space>
      </div>

      <div style={{ textAlign: 'center', padding: '16px 0 32px' }}>
        <Text type="secondary" style={{ fontSize: 12 }}>金网通计算机管理系统 V2 · AIbak 旗下产品 · <a onClick={() => navigate('/customer-service')} style={{ cursor: 'pointer' }}>技术支持</a> · <a onClick={() => navigate('/pricing')} style={{ cursor: 'pointer' }}>查看定价</a> · </Text>
      </div>
    </div>
  );
};

export default JinWangTongPage;