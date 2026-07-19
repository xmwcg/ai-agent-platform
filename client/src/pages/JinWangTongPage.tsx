import React, { useState } from 'react';
import { Typography, Tabs, Card, Tag, Button, Space, Row, Col, Statistic } from 'antd';
import {
  ShopOutlined, ScanOutlined, WifiOutlined, PrinterOutlined,
  FileProtectOutlined, SafetyOutlined, DownloadOutlined, ApiOutlined,
  CloudServerOutlined, ClusterOutlined, AppstoreOutlined, ToolOutlined,
} from '@ant-design/icons';

const { Title, Paragraph, Text } = Typography;

const features = [
  { icon: <ScanOutlined />, name: '硬件全扫描', desc: '一键采集CPU/主板/内存/硬盘/GPU/网卡/显示器/BIOS完整资产信息' },
  { icon: <WifiOutlined />, name: '网络体检', desc: 'IP冲突检测/网关可达/DNS解析/SMB/RDP/WinRM 8项自动修复' },
  { icon: <PrinterOutlined />, name: '打印机共享', desc: '自动发现USB/LPT/网络打印机，一键共享+打印测试页' },
  { icon: <FileProtectOutlined />, name: 'C盘清理', desc: '8项系统垃圾扫描+安全清理，不碰个人文件，删除前可备份' },
  { icon: <ClusterOutlined />, name: '资产报表', desc: '自动生成硬件资产列表，联网对比京东/中关村实时价格' },
  { icon: <CloudServerOutlined />, name: '跨系统互联', desc: 'Windows SMB / Linux Samba+NFS / Web HTTP 三种文件传输方案' },
  { icon: <SafetyOutlined />, name: '权限一键修', desc: '8项环境检测，管理权限/防火墙/WMI 问题自动修复' },
  { icon: <AppstoreOutlined />, name: '集中控制台', desc: 'Web仪表盘管理所有设备，下发上网管控/远程命令/批量任务' },
];

const versions = [
  { name: '免费试用版', price: '0', period: '15天', features: ['完整硬件扫描', '网络体检(只读)', 'C盘清理(手动确认)', '单机使用'], tag: '推荐试用', tagColor: 'blue' },
  { name: '专业版', price: '299', period: '永久', features: ['免费版全部功能', '资产报表+价格对比', '打印机一键共享', '文件共享配置', '权限自动修复', '3台设备授权'], tag: '性价比之选', tagColor: 'green' },
  { name: '旗舰版', price: '599', period: '永久', features: ['专业版全部功能', '集中Web控制台', '批量任务下发', '上网行为管控', '审计日志追踪', '不限设备数'], tag: '企业推荐', tagColor: 'orange' },
];

const installSteps = [
  { step: 1, title: '下载脚本包', desc: '下载 jinwangtong-scripts.zip 解压到任意目录' },
  { step: 2, title: '运行体检', desc: '右键 PowerShell 以管理员运行 .\\health-check.ps1，查看环境是否就绪' },
  { step: 3, title: '一键修复', desc: '如有问题，运行 .\\health-check.ps1 -AutoFix 自动修复' },
  { step: 4, title: '开始使用', desc: '运行 .\\scan-hardware.ps1 扫描资产，启动 .\\console.ps1 打开控制台' },
];

const JinWangTongPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('intro');

  const tabItems = [
    {
      key: 'intro',
      label: '产品介绍',
      children: (
        <div>
          <div style={{
            background: 'linear-gradient(135deg, #0a0e17 0%, #111827 100%)',
            borderRadius: 14, padding: '48px 32px', color: '#e6e9ef', marginBottom: 24,
            textAlign: 'center', border: '1px solid #1e2d45'
          }}>
            <ShopOutlined style={{ fontSize: 48, color: '#FF5C1A', marginBottom: 16, display: 'block' }} />
            <Title level={1} style={{ color: '#fff', margin: '0 0 8px', fontWeight: 700 }}>
              金网通 · 企业局域网互联互通系统
            </Title>
            <Text style={{ color: '#8b9ab8', fontSize: 18 }}>
              一套系统管理个人/企业多台电脑 &bull; 一键部署集中管控
            </Text>
            <div style={{ marginTop: 24 }}>
              <Space size={16} wrap>
                {['局域网互通', '文件共享', '远程桌面', '统一管控', '审计溯源', '上网管控', '网络体检', '资产报表'].map(t => (
                  <Tag key={t} color="#FF5C1A" style={{ background: 'rgba(255,92,26,0.12)', border: 'none', color: '#ff7a45', fontSize: 13, padding: '5px 12px' }}>{t}</Tag>
                ))}
              </Space>
            </div>
          </div>

          <Row gutter={[16, 16]}>
            {features.map(f => (
              <Col xs={24} sm={12} md={6} key={f.name}>
                <Card hoverable style={{ height: '100%', borderRadius: 10, border: '1px solid #eef1f5' }}>
                  <div style={{ fontSize: 28, color: '#6366f1', marginBottom: 8 }}>{f.icon}</div>
                  <Text strong>{f.name}</Text>
                  <Paragraph type="secondary" style={{ fontSize: 12, marginTop: 4, marginBottom: 0 }}>{f.desc}</Paragraph>
                </Card>
              </Col>
            ))}
          </Row>

          <div style={{ marginTop: 32, textAlign: 'center', padding: '24px', background: '#f8f9fb', borderRadius: 10 }}>
            <Text strong style={{ fontSize: 16 }}>零服务器成本 &bull; 纯内网运行 &bull; Win10/11 全版本兼容 &bull; 离线可用 &bull; 数据不出公司</Text>
          </div>
        </div>
      ),
    },
    {
      key: 'pricing',
      label: '版本与购买',
      children: (
        <div>
          <Row gutter={[16, 16]}>
            {versions.map(v => (
              <Col xs={24} md={8} key={v.name}>
                <Card
                  hoverable
                  style={{ borderRadius: 10, border: v.price === '599' ? '2px solid #FF5C1A' : '1px solid #eef1f5', height: '100%' }}
                  title={<Space><Text strong>{v.name}</Text><Tag color={v.tagColor}>{v.tag}</Tag></Space>}
                >
                  <div style={{ textAlign: 'center', padding: '16px 0' }}>
                    <Text style={{ fontSize: 36, fontWeight: 700, color: '#6366f1' }}>¥{v.price}</Text>
                    <Text type="secondary"> / {v.period}</Text>
                  </div>
                  <div style={{ marginBottom: 16 }}>
                    {v.features.map((f, i) => (
                      <div key={i} style={{ padding: '6px 0', borderBottom: '1px solid #f5f5f5', fontSize: 13 }}>
                        <Text type="secondary">{f}</Text>
                      </div>
                    ))}
                  </div>
                  <Button type={v.price === '599' ? 'primary' : 'default'} block size="large" style={{ borderRadius: 8 }}>
                    {v.price === '0' ? '免费下载' : '立即购买'}
                  </Button>
                </Card>
              </Col>
            ))}
          </Row>
          <Paragraph type="secondary" style={{ textAlign: 'center', marginTop: 16 }}>
            购买后自动签发 License · 永久授权 · 支持对公转账/微信支付 · 联系客服获取发票
          </Paragraph>
        </div>
      ),
    },
    {
      key: 'install',
      label: '安装使用',
      children: (
        <div>
          <Title level={4}>4 步快速开始</Title>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 16 }}>
            {installSteps.map(s => (
              <Card key={s.step} size="small" style={{ borderRadius: 8 }}>
                <Space>
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%', background: '#6366f1',
                    color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 700, fontSize: 14
                  }}>
                    {s.step}
                  </div>
                  <div>
                    <Text strong>{s.title}</Text>
                    <Paragraph type="secondary" style={{ margin: 0, fontSize: 13 }}>{s.desc}</Paragraph>
                  </div>
                </Space>
              </Card>
            ))}
          </div>

          <Card title="脚本清单" style={{ marginTop: 24, borderRadius: 10 }}>
            <Row gutter={[8, 8]}>
              {[
                { name: 'health-check.ps1', desc: '一键体检+自动修复' },
                { name: 'scan-hardware.ps1', desc: '完整硬件扫描' },
                { name: 'scan-linux.sh', desc: 'Linux 硬件扫描' },
                { name: 'diskclean.ps1', desc: 'C盘安全清理' },
                { name: 'fileshare.ps1', desc: '文件共享配置' },
                { name: 'printer-share.ps1', desc: '打印机一键共享' },
                { name: 'netcheck.ps1', desc: '网络体检+修复' },
                { name: 'discover.ps1', desc: '局域网设备发现' },
                { name: 'netpolicy.ps1', desc: '上网管控开关' },
                { name: 'console.ps1', desc: 'Web集中控制台' },
                { name: 'asset-manager.ps1', desc: '资产管理入库' },
                { name: 'check-permissions.ps1', desc: '权限检测修复' },
              ].map(s => (
                <Col xs={24} sm={12} md={6} key={s.name}>
                  <div style={{ padding: '6px 0' }}>
                    <code style={{ background: '#f0f0f0', padding: '2px 6px', borderRadius: 4, fontSize: 12 }}>{s.name}</code>
                    <br />
                    <Text type="secondary" style={{ fontSize: 11 }}>{s.desc}</Text>
                  </div>
                </Col>
              ))}
            </Row>
          </Card>

          <div style={{ marginTop: 24, textAlign: 'center' }}>
            <Button type="primary" size="large" icon={<DownloadOutlined />} style={{ borderRadius: 8, height: 44 }}>
              下载脚本包 (ZIP)
            </Button>
            <Paragraph type="secondary" style={{ marginTop: 8 }}>
              或通过 CNB 仓库直接 clone：git clone https://cnb.cool/aibak.site/enterprise-network-hub.git
            </Paragraph>
          </div>
        </div>
      ),
    },
    {
      key: 'dashboard',

      label: '使用说明',

      children: (

        <div style={{ textAlign: 'center', padding: '40px 0' }}>

          <Title level={4}>金网通控制台（本地运行）</Title>

          <Paragraph type="secondary" style={{ maxWidth: 600, margin: '16px auto' }}>

            金网通是一款本地PowerShell脚本工具，需在Windows电脑上下载运行。

            下载后在管理机以管理员运行 <code>console.ps1</code> 即可打开Web控制台（默认 http://localhost:8080）。

          </Paragraph>

          <Space size={12} style={{ marginTop: 16 }}>

            <Button type="primary" size="large" icon={<DownloadOutlined />} style={{ borderRadius: 8 }}>

              下载脚本包

            </Button>

            <Button size="large" icon={<ApiOutlined />} style={{ borderRadius: 8 }}

              onClick={() => window.open('https://cnb.cool/aibak.site/enterprise-network-hub', '_blank')}>

              查看源码

            </Button>

          </Space>

        </div>

      ),

      },
  ];

  return (
    <div style={{ padding: 0, maxWidth: 1200, margin: '0 auto' }}>
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        size="large"
        tabBarStyle={{ marginBottom: 0 }}
        items={tabItems}
      />
    </div>
  );
};

export default JinWangTongPage;