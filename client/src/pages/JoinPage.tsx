import { Typography, Row, Col, Card, Tag, Button, Space } from 'antd';
import {
  ShareAltOutlined, ApiOutlined, TeamOutlined, FileTextOutlined,
  MailOutlined, HeartOutlined, RocketOutlined, ThunderboltOutlined,
} from '@ant-design/icons';

const { Title, Paragraph, Text } = Typography;

// 合作模式：覆盖分销推广、API/技术、内容渠道、资源素材
const PARTNERSHIPS = [
  { icon: <ShareAltOutlined />, title: '分销推广合作', tags: ['分销佣金', '推广返利', '专属邀请码'], desc: '成为推广伙伴，分享专属邀请码，用户开通会员即可获得佣金返利', color: '#6c5ce7' },
  { icon: <ApiOutlined />, title: 'API / 技术集成', tags: ['模型接入', '私有化', '白标'], desc: '将 AIbak 的 AI 对话 / 文生图能力接入你的产品与业务流程', color: '#10b981' },
  { icon: <TeamOutlined />, title: '内容 / 渠道合作', tags: ['联合运营', '内容共建', '行业方案'], desc: '共建行业知识库、联合举办活动，打通垂直行业落地场景', color: '#f43f5e' },
  { icon: <FileTextOutlined />, title: '资源 / 素材合作', tags: ['知识库共建', '数据集', '模板'], desc: '贡献优质行业文档与模板，共建高质量通用知识库生态', color: '#f59e0b' },
];

const PERKS = [
  { icon: <RocketOutlined />, title: '前沿 AI 能力', desc: '直接调用平台 4 个免费大模型与全套智能工具' },
  { icon: <HeartOutlined />, title: '共赢分润', desc: '透明佣金机制、实时数据看板、T+1 结算' },
  { icon: <ThunderboltOutlined />, title: '专属支持', desc: '一对一对接、技术文档与集成示例' },
];

export default function JoinPage() {
  return (
    <div style={{ maxWidth: 1000, margin: '0 auto' }}>
      <section style={{
        borderRadius: 20, padding: '44px 32px', textAlign: 'center', marginBottom: 28,
        background: 'linear-gradient(135deg, #6c5ce7 0%, #a29bfe 60%, #81ecec 100%)',
      }}>
        <Title level={2} style={{ color: '#fff', margin: '0 0 10px' }}>合作伙伴</Title>
        <Paragraph style={{ color: 'rgba(255,255,255,0.92)', fontSize: 15, maxWidth: 600, margin: '0 auto' }}>
          与 AIbak 一起共建 AI 应用生态 —— 分销推广、技术集成、内容渠道、资源共建，多种合作方式任选。
        </Paragraph>
        <Button size="large" icon={<MailOutlined />} style={{ marginTop: 18, borderRadius: 12, fontWeight: 600 }}
          onClick={() => window.open('mailto:contact@aibak.site')}>
          商务合作 contact@aibak.site
        </Button>
      </section>

      {/* 合作权益 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 32 }}>
        {PERKS.map((p) => (
          <Col xs={24} md={8} key={p.title}>
            <Card style={{ borderRadius: 14, height: '100%' }} styles={{ body: { padding: 20 } }}>
              <Space size={12}>
                <div style={{
                  width: 40, height: 40, borderRadius: 10, background: 'var(--brand-primary-bg)',
                  color: 'var(--brand-primary)', fontSize: 18,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>{p.icon}</div>
                <div>
                  <Text strong>{p.title}</Text>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{p.desc}</div>
                </div>
              </Space>
            </Card>
          </Col>
        ))}
      </Row>

      {/* 合作模式 */}
      <div style={{ textAlign: 'center', marginBottom: 20 }}>
        <Title level={3} style={{ margin: 0 }}>合作模式</Title>
        <Text style={{ color: 'var(--text-secondary)' }}>总有一种适合你</Text>
      </div>
      <Row gutter={[16, 16]}>
        {PARTNERSHIPS.map((pos) => (
          <Col xs={24} sm={12} key={pos.title}>
            <Card className="hover-lift" style={{ borderRadius: 14, height: '100%' }} styles={{ body: { padding: 22 } }}>
              <Space align="start" size={14} style={{ width: '100%' }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 12, background: pos.color, color: '#fff',
                  fontSize: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>{pos.icon}</div>
                <div style={{ flex: 1 }}>
                  <Title level={5} style={{ margin: '0 0 6px' }}>{pos.title}</Title>
                  <Text style={{ fontSize: 13, color: 'var(--text-secondary)', display: 'block', marginBottom: 10 }}>
                    {pos.desc}
                  </Text>
                  <Space wrap size={6}>
                    {pos.tags.map((t) => <Tag key={t} color="purple">{t}</Tag>)}
                  </Space>
                </div>
              </Space>
            </Card>
          </Col>
        ))}
      </Row>

      <div style={{ textAlign: 'center', marginTop: 28 }}>
        <Button type="primary" size="large" icon={<MailOutlined />} style={{ borderRadius: 12, fontWeight: 600 }}
          onClick={() => window.open('mailto:contact@aibak.site')}>
          立即咨询合作
        </Button>
      </div>
    </div>
  );
}
