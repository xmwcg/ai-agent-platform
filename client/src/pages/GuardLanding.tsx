import { Typography, Button, Row, Col, Card, Tag, Space, Divider } from 'antd';
import {
  RocketOutlined, ShoppingCartOutlined, CheckCircleFilled,
  EyeOutlined, SyncOutlined, SafetyOutlined, ThunderboltOutlined,
  DashboardOutlined, BellOutlined, ToolOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import useSeo from '@/hooks/useSeo';

const { Title, Paragraph, Text } = Typography;

export default function GuardLanding() {
  const navigate = useNavigate();
  useSeo('NexMind Guard — 自托管监控与故障自愈 | AIbak', 'NexMind Guard 提供公共状态页、智能告警、自动修复和故障切换，支持私有化自托管部署与按年订阅。');

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc' }}>
      {/* Hero */}
      <div style={{
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 40%, #6366f1 100%)',
        color: 'white', padding: '80px 24px', textAlign: 'center'
      }}>
        <Tag style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', color: 'white', borderRadius: 20, padding: '4px 16px', fontSize: 13, marginBottom: 20 }}>
          🛡️ NexMind by AIbak 新产品
        </Tag>
        <Title level={1} style={{ color: 'white', fontSize: 44, fontWeight: 800, marginBottom: 16, letterSpacing: -1 }}>
          你的服务器<br />自己会看病
        </Title>
        <Paragraph style={{ color: 'rgba(255,255,255,0.85)', fontSize: 18, maxWidth: 600, margin: '0 auto 32px' }}>
          监控会看病 · 告警会叫人 · 切换会救命<br />
          部署 5 分钟，告别凌晨 3 点的宕机电话
        </Paragraph>
        <Space size="middle">
          <Button type="primary" size="large" icon={<RocketOutlined />}
            onClick={() => navigate('/pricing?source=guard')}
            style={{ background: 'white', color: '#6366f1', border: 'none', borderRadius: 12, fontWeight: 600, height: 48, paddingInline: 28 }}>
            查看套餐
          </Button>
          <Button ghost size="large" icon={<ShoppingCartOutlined />}
            onClick={() => navigate('/contact?product=guard')}
            style={{ borderRadius: 12, height: 48, paddingInline: 28, borderColor: 'rgba(255,255,255,0.4)', color: 'white' }}>
            获取部署包
          </Button>
        </Space>
        <Paragraph type="secondary" style={{ color: 'rgba(255,255,255,0.5)', marginTop: 24, fontSize: 13 }}>
          自托管部署包 · 安装文档 · 技术支持
        </Paragraph>
      </div>

      {/* ROI Hook */}
      <div style={{ maxWidth: 960, margin: '-40px auto 0', padding: '0 24px', position: 'relative', zIndex: 1 }}>
        <Card style={{ borderRadius: 16, border: '1px solid #e2e8f0', boxShadow: '0 12px 40px rgba(0,0,0,0.06)' }}>
          <Row gutter={[16, 16]} align="middle">
            <Col flex="auto">
              <Title level={3} style={{ margin: 0, color: '#1e293b' }}>💰 自己写监控，成本有多高？</Title>
              <Paragraph style={{ color: '#64748b', margin: '12px 0 0', fontSize: 15 }}>
                开发者花 7 天自己写 = 放弃 7 天收入。如果日薪 ¥500，自己做成本 <strong style={{color:'#ef4444'}}>¥3,500</strong>。
                花 <strong style={{color:'#22c55e'}}>¥99/年</strong> 买 NexMind Guard，ROI 35 倍。你会自己写 Webpack 吗？不会——监控也一样。
              </Paragraph>
            </Col>
            <Col>
              <div style={{ textAlign: 'center', padding: '20px 32px', background: '#f0fdf4', borderRadius: 12, border: '1px solid #bbf7d0' }}>
                <Text style={{ fontSize: 36, fontWeight: 800, color: '#16a34a' }}>35x</Text>
                <br />
                <Text style={{ fontSize: 13, color: '#64748b' }}>ROI 回报</Text>
              </div>
            </Col>
          </Row>
        </Card>
      </div>

      {/* Features */}
      <div style={{ maxWidth: 960, margin: '48px auto', padding: '0 24px' }}>
        <Title level={2} style={{ textAlign: 'center', marginBottom: 36 }}>为什么选择 NexMind Guard？</Title>
        <Row gutter={[16, 16]}>
          {[
            { icon: <EyeOutlined />, title: '公共状态页', desc: 'status.你的域名.com，给你的客户看专业 SLA，提升信任。' },
            { icon: <SyncOutlined />, title: '自动故障切换', desc: '检测到宕机 → 自动重启 → 不行就切备用。别人只会叫，我们会救命。' },
            { icon: <BellOutlined />, title: '智能告警', desc: '邮件+企微+钉钉+飞书。宕机第一时间通知你，不是等用户投诉。' },
            { icon: <SafetyOutlined />, title: '数据自控', desc: '本地 Agent，部署过程可核验。业务数据留在你服务器，不上传平台。' },
            { icon: <ToolOutlined />, title: '一键修复', desc: 'Web 面板点一下，自动诊断+修复。不用 SSH 敲命令。' },
            { icon: <DashboardOutlined />, title: '响应趋势', desc: '7天/30天/90天历史。发现性能退化趋势，别等宕机才知变慢了。' },
          ].map((f, i) => (
            <Col xs={24} sm={12} key={i}>
              <Card style={{ borderRadius: 12, border: '1px solid #e2e8f0', height: '100%' }}
                hoverable>
                <div style={{ fontSize: 32, color: '#6366f1', marginBottom: 12 }}>{f.icon}</div>
                <Title level={4} style={{ marginBottom: 8 }}>{f.title}</Title>
                <Paragraph style={{ color: '#64748b', fontSize: 13 }}>{f.desc}</Paragraph>
              </Card>
            </Col>
          ))}
        </Row>
      </div>

      {/* Pricing */}
      <div style={{ background: '#1e293b', color: 'white', padding: '64px 0' }}>
        <div style={{ maxWidth: 960, margin: '0 auto', padding: '0 24px' }}>
          <Title level={2} style={{ textAlign: 'center', color: 'white', marginBottom: 48 }}>简单透明的定价</Title>
          <Row gutter={[16, 16]} justify="center">
            {[
              { plan: 'Free', price: '¥0', period: '永久免费', features: ['无限监控', '基础状态页', '7天记录'], featured: false },
              { plan: 'Pro · 推荐', price: '¥99', period: '/年', features: ['全部 Free +', '品牌定制', '邮件告警', '自动修复', '30天记录'], featured: true },
              { plan: 'Max', price: '¥199', period: '/年', features: ['全部 Pro +', '故障切换', '多地点探测', '电话告警', '90天记录', 'API Token'], featured: false },
            ].map((p, i) => (
              <Col xs={24} sm={8} key={i}>
                <Card style={{
                  borderRadius: 16, border: p.featured ? '2px solid #6366f1' : '2px solid #334155',
                  background: p.featured ? 'linear-gradient(180deg, #1e1b4b, #0f172a)' : '#0f172a',
                  textAlign: 'center', height: '100%'
                }}>
                  <Text style={{ color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, fontSize: 13 }}>{p.plan}</Text>
                  <div style={{ fontSize: 40, fontWeight: 800, margin: '12px 0', color: 'white' }}>{p.price}</div>
                  <Text style={{ color: '#94a3b8', fontSize: 13 }}>{p.period}</Text>
                  <Divider style={{ borderColor: '#334155', margin: '16px 0' }} />
                  <ul style={{ listStyle: 'none', padding: 0, textAlign: 'left', marginBottom: 20 }}>
                    {p.features.map((f, j) => (
                      <li key={j} style={{ padding: '4px 0', color: '#cbd5e1', fontSize: 13 }}>
                        <CheckCircleFilled style={{ color: '#22c55e', marginRight: 8 }} />{f}
                      </li>
                    ))}
                  </ul>
                  <Button type={p.featured ? 'primary' : 'default'} block size="large"
                    onClick={() => navigate('/pricing?source=guard')}
                    style={p.featured ? { borderRadius: 10, background: '#6366f1', border: 'none', fontWeight: 600 } : { borderRadius: 10, fontWeight: 600 }}>
                    {i === 0 ? '免费开始' : '立即订阅'}
                  </Button>
                </Card>
              </Col>
            ))}
          </Row>
        </div>
      </div>

      {/* CTA */}
      <div style={{ textAlign: 'center', padding: '64px 0', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: 'white' }}>
        <Title level={2} style={{ color: 'white' }}>5 分钟，让你的服务器自己会看病</Title>
        <Paragraph style={{ color: 'rgba(255,255,255,0.85)', fontSize: 16, marginBottom: 28 }}>
          私有化部署，自托管。先体验，再按需升级。
        </Paragraph>
        <Button type="primary" size="large" icon={<RocketOutlined />}
          onClick={() => navigate('/contact?product=guard')}
          style={{ background: 'white', color: '#6366f1', border: 'none', borderRadius: 12, fontWeight: 600, height: 48, paddingInline: 32 }}>
          获取部署包 →
        </Button>
        <Paragraph style={{ color: 'rgba(255,255,255,0.5)', marginTop: 16, fontSize: 13 }}>
          提交需求后获取部署包、安装说明与授权方案
        </Paragraph>
      </div>
    </div>
  );
}
