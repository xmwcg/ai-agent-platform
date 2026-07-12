import { Typography, Row, Col, Card, Tag, Button, Space } from 'antd';
import {
  CodeOutlined, BgColorsOutlined, RobotOutlined, SoundOutlined,
  MailOutlined, HeartOutlined, RocketOutlined, TeamOutlined,
} from '@ant-design/icons';

const { Title, Paragraph, Text } = Typography;

const POSITIONS = [
  { icon: <CodeOutlined />, title: '全栈工程师', tags: ['React', 'Node.js', 'TypeScript'], desc: '负责平台前后端功能开发与性能优化', color: '#6c5ce7' },
  { icon: <RobotOutlined />, title: 'AI 算法工程师', tags: ['RAG', 'LLM', 'Agent'], desc: '负责大模型接入、检索增强与智能体编排', color: '#10b981' },
  { icon: <BgColorsOutlined />, title: 'UI/UX 设计师', tags: ['视觉设计', '交互', '动效'], desc: '负责平台视觉体系与用户体验设计', color: '#f43f5e' },
  { icon: <SoundOutlined />, title: '增长/运营', tags: ['内容', '社群', '商业化'], desc: '负责用户增长、内容运营与商业变现', color: '#f59e0b' },
];

const PERKS = [
  { icon: <RocketOutlined />, title: '前沿技术', desc: '接触最新 AI 大模型与 Agent 技术栈' },
  { icon: <HeartOutlined />, title: '弹性工作', desc: '远程友好、结果导向、扁平沟通' },
  { icon: <TeamOutlined />, title: '成长空间', desc: '与平台一同成长，期权与激励' },
];

export default function JoinPage() {
  return (
    <div style={{ maxWidth: 1000, margin: '0 auto' }}>
      <section style={{
        borderRadius: 20, padding: '44px 32px', textAlign: 'center', marginBottom: 28,
        background: 'linear-gradient(135deg, #6c5ce7 0%, #a29bfe 60%, #81ecec 100%)',
      }}>
        <Title level={2} style={{ color: '#fff', margin: '0 0 10px' }}>加入我们</Title>
        <Paragraph style={{ color: 'rgba(255,255,255,0.92)', fontSize: 15, maxWidth: 600, margin: '0 auto' }}>
          与一群热爱 AI 的伙伴一起，打造属于每个人的全站 AI 应用平台。
        </Paragraph>
        <Button size="large" icon={<MailOutlined />} style={{ marginTop: 18, borderRadius: 12, fontWeight: 600 }}
          onClick={() => window.open('mailto:jobs@aibak.site')}>
          投递简历 jobs@aibak.site
        </Button>
      </section>

      {/* 福利 */}
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

      {/* 职位 */}
      <div style={{ textAlign: 'center', marginBottom: 20 }}>
        <Title level={3} style={{ margin: 0 }}>开放职位</Title>
        <Text style={{ color: 'var(--text-secondary)' }}>期待你的加入</Text>
      </div>
      <Row gutter={[16, 16]}>
        {POSITIONS.map((pos) => (
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
    </div>
  );
}
