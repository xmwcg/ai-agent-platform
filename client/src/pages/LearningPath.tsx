import { useState, useEffect } from 'react';
import {
  Card, Typography, Button, Space, Tag, Spin, Empty,
  Steps, Progress, Badge, Radio, message, Input
} from 'antd';
import {
  CompassOutlined, CheckCircleOutlined, ClockCircleOutlined,
  BookOutlined, RobotOutlined, TrophyOutlined
} from '@ant-design/icons';
import { learningPathAPI } from '@/services/api';

const { Title, Paragraph, Text } = Typography;

interface Milestone {
  week: number;
  title: string;
  description: string;
  courses: { id: string; title: string; completed?: boolean }[];
  quiz?: { title: string; passed?: boolean };
}

interface LearningPath {
  id: string;
  title: string;
  description: string;
  targetLevel: 'beginner' | 'intermediate' | 'advanced';
  estimatedWeeks: number;
  milestones: Milestone[];
  generatedBy?: 'ai' | 'template';
}

// 离线兜底（网络不可用时）
const LOCAL_FALLBACK: Record<string, LearningPath> = {
  beginner: {
    id: 'local-beginner',
    title: 'AI 应用入门路径',
    description: '零基础到能熟练使用 AI 工具完成日常工作与学习。',
    targetLevel: 'beginner',
    estimatedWeeks: 6,
    generatedBy: 'template',
    milestones: [
      { week: 1, title: '第 1-2 周：AI 对话与提示词', description: '掌握与 AI 高效对话的方法。', courses: [] },
      { week: 3, title: '第 3-4 周：知识中枢管理', description: '建立个人知识库，使用 RAG 检索。', courses: [] },
      { week: 5, title: '第 5-6 周：代码助手初探', description: '用 AI 代码解释器读懂脚本。', courses: [] },
    ],
  },
};

export default function LearningPathPage() {
  const [paths, setPaths] = useState<LearningPath[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [selectedPath, setSelectedPath] = useState<LearningPath | null>(null);
  const [level, setLevel] = useState<'beginner' | 'intermediate' | 'advanced'>('beginner');
  const [goal, setGoal] = useState('');

  const fetchPaths = async (useAI = false) => {
    setLoading(true);
    try {
      if (useAI) {
        setGenerating(true);
        const res: any = await learningPathAPI.generate({ level, goal: goal || undefined });
        const p = res.data as LearningPath;
        setPaths([p]);
        setSelectedPath(p);
        message.success(p.generatedBy === 'ai' ? '已生成个性化路径（AI）' : '已生成路径（模板）');
      } else {
        const res: any = await learningPathAPI.templates(level);
        const p = res.data as LearningPath;
        setPaths([p]);
        setSelectedPath(p);
      }
    } catch {
      const fb = LOCAL_FALLBACK[level] || LOCAL_FALLBACK.beginner;
      setPaths([fb]);
      setSelectedPath(fb);
    } finally {
      setLoading(false);
      setGenerating(false);
    }
  };

  useEffect(() => { fetchPaths(false); }, [level]);

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <Space>
            <CompassOutlined style={{ fontSize: 24, color: '#1890ff' }} />
            <Title level={3} style={{ margin: 0 }}>学习路径推荐</Title>
            <Badge count={paths.length} showZero color="blue" />
          </Space>
          <Button
            type="primary"
            icon={<RobotOutlined />}
            loading={generating}
            onClick={() => fetchPaths(true)}
          >
            {generating ? 'AI 生成中...' : 'AI 生成个性化路径'}
          </Button>
        </div>
        <Paragraph type="secondary" style={{ marginTop: 8 }}>
          AI 根据你的水平、目标与兴趣生成学习路径，并尽量引用平台真实课程库。
        </Paragraph>
        <div style={{ marginTop: 16, display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <Text>目标水平：</Text>
          <Radio.Group
            value={level}
            onChange={(e) => setLevel(e.target.value)}
            optionType="button"
            buttonStyle="solid"
          >
            <Radio.Button value="beginner">入门</Radio.Button>
            <Radio.Button value="intermediate">进阶</Radio.Button>
            <Radio.Button value="advanced">高级</Radio.Button>
          </Radio.Group>
          <Input
            placeholder="学习目标（可选，如：转行做 AI 工程师）"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            style={{ maxWidth: 360 }}
          />
        </div>
      </Card>

      {loading ? (
        <Card>
          <div style={{ textAlign: 'center', padding: 100 }}>
            <Spin size="large" />
            <p>AI 正在分析你的学习偏好…</p>
          </div>
        </Card>
      ) : selectedPath ? (
        <Card>
          <Space style={{ marginBottom: 12 }}>
            <CompassOutlined />
            <Text strong style={{ fontSize: 16 }}>{selectedPath.title}</Text>
            <Tag color={
              selectedPath.targetLevel === 'beginner' ? 'green'
                : selectedPath.targetLevel === 'advanced' ? 'red' : 'orange'
            }>
              {selectedPath.targetLevel === 'beginner' ? '入门' : selectedPath.targetLevel === 'advanced' ? '高级' : '进阶'}
            </Tag>
            <Tag><ClockCircleOutlined /> {selectedPath.estimatedWeeks} 周</Tag>
            {selectedPath.generatedBy === 'ai' && <Tag color="blue">AI 生成</Tag>}
          </Space>
          <Paragraph type="secondary">{selectedPath.description}</Paragraph>

          <Steps
            direction="vertical"
            items={selectedPath.milestones.map((m, idx) => ({
              title: `第 ${m.week} 周：${m.title}`,
              description: (
                <div>
                  <Text type="secondary" style={{ fontSize: 12 }}>{m.description}</Text>
                  <div style={{ marginTop: 8 }}>
                    {m.courses.length === 0 ? (
                      <Text type="secondary" style={{ fontSize: 12 }}>（暂无匹配课程，可自行补充）</Text>
                    ) : m.courses.map((c) => (
                      <div key={c.id} style={{ padding: '4px 0' }}>
                        <BookOutlined style={{ marginRight: 8, color: c.completed ? '#52c41a' : '#999' }} />
                        <Text style={{ textDecoration: c.completed ? 'line-through' : 'none' }}>{c.title}</Text>
                        {c.completed && <CheckCircleOutlined style={{ color: '#52c41a', marginLeft: 8 }} />}
                      </div>
                    ))}
                  </div>
                  {m.quiz && (
                    <div style={{ marginTop: 8, padding: '8px 12px', background: '#f6ffed', borderRadius: 4 }}>
                      <TrophyOutlined style={{ color: '#52c41a', marginRight: 8 }} />
                      <Text type="secondary">测验：{m.quiz.title}</Text>
                      {m.quiz.passed && <CheckCircleOutlined style={{ color: '#52c41a', marginLeft: 8 }} />}
                    </div>
                  )}
                </div>
              ),
              status: idx === 0 ? 'process' : 'wait',
            }))}
          />

          <div style={{ marginTop: 24 }}>
            <Text strong>总体进度</Text>
            <Progress percent={Math.round((1 / selectedPath.milestones.length) * 100)} style={{ marginTop: 8 }} />
          </div>
        </Card>
      ) : (
        <Card><Empty description="暂无路径" /></Card>
      )}
    </div>
  );
}
