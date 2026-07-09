import { useState } from 'react';
import {
  Card, Typography, Button, Space, Tag, Row, Col, Badge, Switch, Tooltip
} from 'antd';
import {
  PictureOutlined, VideoCameraOutlined, FileTextOutlined,
  ThunderboltOutlined, PlayCircleOutlined, RocketOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

const { Title, Paragraph, Text } = Typography;

interface ToolCard {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  bgGradient: string;
  status: 'ready' | 'beta' | 'coming';
  route?: string;
}

const TOOLS: ToolCard[] = [
  {
    id: 'text2img',
    title: '文生图',
    description: '输入文字描述，AI 自动生成高质量图片。支持混元 Image、DALLE 3、Stable Diffusion。',
    icon: <PictureOutlined />,
    color: '#1890ff',
    bgGradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    status: 'ready',
    route: '/text2img',
  },
  {
    id: 'code-gen',
    title: 'AI 代码助手',
    description: '代码解释与示例生成，支持 11 种编程语言，可结合知识库答疑。',
    icon: <ThunderboltOutlined />,
    color: '#13c2c2',
    bgGradient: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
    status: 'ready',
    route: '/code',
  },
  {
    id: 'docgen',
    title: '文档生成工作流',
    description: '基于 AI 对话生成结构化文档，可引用知识库内容作为素材。',
    icon: <FileTextOutlined />,
    color: '#fa8c16',
    bgGradient: 'linear-gradient(135deg, #fdcbf1 0%, #fdcbf1 100%)',
    status: 'ready',
    route: '/ai-chat',
  },
  {
    id: 'video-workflow',
    title: '短视频工作流',
    description: '脚本 → AI 配音 → 字幕 → 合成，一站式短视频生产（规划中）。',
    icon: <VideoCameraOutlined />,
    color: '#eb2f96',
    bgGradient: 'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)',
    status: 'coming',
  },
];

export default function CreativeWorkshop() {
  const navigate = useNavigate();
  const [enabled, setEnabled] = useState<Record<string, boolean>>({
    text2img: true, 'code-gen': true, docgen: true, 'video-workflow': false,
  });

  const enabledCount = Object.values(enabled).filter(Boolean).length;

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <Space>
            <Title level={3} style={{ margin: 0 }}>🎨 创作工坊</Title>
            <Badge count={TOOLS.length} showZero color="blue" />
            <Tag color="green">{enabledCount} 个已启用</Tag>
          </Space>
          <Space>
            <Text type="secondary">已启用：</Text>
            {TOOLS.filter((t) => t.status === 'ready').map((t) => (
              <Tag
                key={t.id}
                color={enabled[t.id] ? 'green' : 'default'}
                style={{ cursor: 'pointer' }}
                onClick={() => setEnabled((p) => ({ ...p, [t.id]: !p[t.id] }))}
              >
                {t.title} {enabled[t.id] ? '✅' : '⬜'}
              </Tag>
            ))}
          </Space>
        </div>
        <Paragraph type="secondary" style={{ marginTop: 8 }}>
          一站式 AI 创作平台：文生图、代码助手、文档工作流等。点击「使用」直达对应工具。
        </Paragraph>
      </Card>

      <Row gutter={[16, 16]}>
        {TOOLS.map((tool) => (
          <Col xs={24} sm={12} lg={8} key={tool.id}>
            <Card
              hoverable
              style={{ overflow: 'hidden', position: 'relative' }}
              cover={
                <div style={{ height: 180, background: tool.bgGradient, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                  <div style={{ fontSize: 56, color: '#fff', opacity: 0.9 }}>{tool.icon}</div>
                  <div style={{ position: 'absolute', top: 12, right: 12 }}>
                    {tool.status === 'ready' && <Tag color="green">已就绪</Tag>}
                    {tool.status === 'beta' && <Tag color="orange">Beta</Tag>}
                    {tool.status === 'coming' && <Tag color="default">即将上线</Tag>}
                  </div>
                  <div style={{ position: 'absolute', bottom: 12, right: 12, display: 'flex', gap: 8 }}>
                    <Tooltip title="使用工具">
                      <Button
                        type="primary"
                        icon={<PlayCircleOutlined />}
                        size="small"
                        disabled={tool.status === 'coming' || !enabled[tool.id]}
                        onClick={() => tool.route && navigate(tool.route)}
                      >
                        使用
                      </Button>
                    </Tooltip>
                  </div>
                </div>
              }
            >
              <Card.Meta
                title={
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>{tool.title}</span>
                    <Switch
                      size="small"
                      checked={enabled[tool.id] || false}
                      onChange={(checked) => setEnabled((p) => ({ ...p, [tool.id]: checked }))}
                    />
                  </div>
                }
                description={
                  <Paragraph style={{ marginBottom: 8, fontSize: 13 }} ellipsis={{ rows: 3 }}>
                    {tool.description}
                  </Paragraph>
                }
              />
            </Card>
          </Col>
        ))}
      </Row>

      <Card title="📌 使用说明" style={{ marginTop: 24 }}>
        <Row gutter={32}>
          <Col span={8}>
            <Title level={5}><RocketOutlined /> 快速开始</Title>
            <Paragraph type="secondary" style={{ fontSize: 13 }}>
              1. 在上方启用需要的创作工具<br />
              2. 点击工具卡片的「使用」按钮<br />
              3. 进入对应工具页输入描述或上传文件<br />
              4. AI 自动生成结果，支持多次迭代
            </Paragraph>
          </Col>
          <Col span={8}>
            <Title level={5}><PictureOutlined /> 文生图</Title>
            <Paragraph type="secondary" style={{ fontSize: 13 }}>
              文生图依赖图像生成 Provider（如混元 / DALLE）。
              未配置 Key 时返回占位图，可在「插件管理」中配置对应 Provider。
            </Paragraph>
          </Col>
          <Col span={8}>
            <Title level={5}><ThunderboltOutlined /> AI 增强</Title>
            <Paragraph type="secondary" style={{ fontSize: 13 }}>
              所有工具均接入 RAG 知识库，可引用知识库内容作为创作素材，
              自动保存历史，支持版本回溯。
            </Paragraph>
          </Col>
        </Row>
      </Card>
    </div>
  );
}
