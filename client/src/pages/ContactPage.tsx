import { Typography, Row, Col, Card, Space, Button } from 'antd';
import {
  WechatOutlined, MailOutlined, GlobalOutlined,
  CustomerServiceOutlined, EnvironmentOutlined, ClockCircleOutlined,
} from '@ant-design/icons';

const WEWORK_KF_URL = 'https://work.weixin.qq.com/kfid/kfce20d584b0179916f';

const { Title, Paragraph, Text } = Typography;

const CHANNELS = [
  { icon: <MailOutlined />, title: '商务邮箱', value: 'xmwcg5059@outlook.com', color: '#6c5ce7' },
  { icon: <GlobalOutlined />, title: '官方网站', value: 'aibak.site', color: '#0ea5e9', link: 'https://aibak.site' },
  { icon: <CustomerServiceOutlined />, title: '在线客服', value: '首页左下角 AI 客服', color: '#f59e0b' },
  { icon: <ClockCircleOutlined />, title: '服务时间', value: '周一至周日 9:00 - 21:00', color: '#10b981' },
];

export default function ContactPage() {
  return (
    <div style={{ maxWidth: 960, margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <Title level={2} style={{ marginBottom: 6 }}>联系我们</Title>
        <Text style={{ color: 'var(--text-secondary)' }}>
          无论是产品咨询、商务合作还是售后支持，我们都乐意为您服务
        </Text>
      </div>

      <Row gutter={[20, 20]}>
        <Col xs={24} md={14}>
          <Row gutter={[16, 16]}>
            {CHANNELS.map((c) => (
              <Col xs={24} sm={12} key={c.title}>
                <Card
                  hoverable={!!c.link}
                  onClick={() => c.link && window.open(c.link, '_blank')}
                  styles={{ body: { padding: 20 } }}
                  style={{ height: '100%', borderRadius: 14 }}
                >
                  <Space align="start" size={14}>
                    <div style={{
                      width: 42, height: 42, borderRadius: 12,
                      background: c.color, color: '#fff', fontSize: 19,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>{c.icon}</div>
                    <div>
                      <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>{c.title}</div>
                      <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginTop: 2 }}>
                        {c.value}
                      </div>
                    </div>
                  </Space>
                </Card>
              </Col>
            ))}
          </Row>

          <Card style={{ marginTop: 16, borderRadius: 14 }} styles={{ body: { padding: 20 } }}>
            <Space align="start" size={12}>
              <EnvironmentOutlined style={{ fontSize: 18, color: 'var(--brand-primary)' }} />
              <div>
                <Text strong>企业合作</Text>
                <Paragraph style={{ margin: '6px 0 0', color: 'var(--text-secondary)', fontSize: 13 }}>
                  提供私有化部署、定制开发、行业知识库共建、API 批量采购等企业级服务。
                  欢迎通过邮箱或微信与我们取得联系，我们将在 1 个工作日内回复。
                </Paragraph>
              </div>
            </Space>
          </Card>
        </Col>

        {/* 微信二维码 */}
        <Col xs={24} md={10}>
          <Card style={{ borderRadius: 14, textAlign: 'center' }} styles={{ body: { padding: 28 } }}>
            <WechatOutlined style={{ fontSize: 28, color: '#07c160' }} />
            <Title level={4} style={{ margin: '10px 0 4px' }}>微信扫码联系</Title>
            <Text style={{ color: 'var(--text-secondary)', fontSize: 13 }}>添加专属顾问，获取一对一服务</Text>
            <div style={{
              width: 180, height: 180, margin: '18px auto 0', borderRadius: 14,
              border: '1px solid var(--border)', background: '#fff', overflow: 'hidden',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <img src="/wechat-qr.png" alt="微信二维码"
                style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            </div>
            <Button type="primary" icon={<WechatOutlined />} size="large"
              onClick={() => window.open(WEWORK_KF_URL, '_blank')}
              style={{ marginTop: 14, borderRadius: 12, background: '#07c160', borderColor: '#07c160', fontWeight: 600, height: 44, paddingInline: 28 }}>
              打开企业微信客服
            </Button>
            <Text style={{ display: 'block', marginTop: 10, fontSize: 12, color: 'var(--text-tertiary)' }}>
              扫码添加，工作日 9:00-21:00 在线回复
            </Text>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
