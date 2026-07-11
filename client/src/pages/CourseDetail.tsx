import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Typography, Tag, Space, Button, Spin, Collapse, Progress, message, Badge } from 'antd';
import {
  ArrowLeftOutlined, BookOutlined, PlayCircleOutlined,
  CheckCircleOutlined, TrophyOutlined, ClockCircleOutlined,
  TeamOutlined
} from '@ant-design/icons';
import apiClient from '@/services/api';

const { Title, Paragraph, Text } = Typography;

interface Course {
  _id: string;
  title: string;
  description: string;
  category?: string;
  level?: string;
  tags?: string[];
  price?: number;
  chapters?: Chapter[];
  enrolledCount?: number;
  duration?: number;
  isPublished?: boolean;
  createdAt?: string;
}

interface Chapter {
  title: string;
  description?: string;
  duration?: number;
  resources?: Resource[];
  quiz?: Quiz;
}

interface Resource {
  title: string;
  type: 'video' | 'article' | 'code';
  url?: string;
}

interface Quiz {
  title: string;
  questions?: Question[];
}

interface Question {
  type: 'single' | 'multi' | 'judge' | 'fill' | 'code';
  question: string;
}

export default function CourseDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [course, setCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(false);
  const [enrolled, setEnrolled] = useState(false);
  const [progress, setProgress] = useState<{ completionPct: number; completedChapters: number[]; totalChapters: number }>({
    completionPct: 0, completedChapters: [], totalChapters: 0,
  });

  const loadCourse = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res: any = await apiClient.get(`/courses/${id}`);
      const data = res.data?.data;
      if (data) {
        setCourse(data);
      }
    } catch {
      // 网络错误静默处理
    } finally {
      setLoading(false);
    }
  };

  /** 加载用户进度 */
  const loadProgress = async () => {
    if (!id) return;
    try {
      const res: any = await apiClient.get(`/courses/${id}/progress`);
      const data = res.data?.data;
      if (data?.enrolled) {
        setEnrolled(true);
        setProgress({
          completionPct: data.completionPct || 0,
          completedChapters: data.completedChapters || [],
          totalChapters: data.totalChapters || 0,
        });
      }
    } catch { /* 未登录或加载失败静默忽略 */ }
  };

  /** 报名课程 */
  const handleEnroll = async () => {
    if (!id || enrolling) return;
    setEnrolling(true);
    try {
      const res: any = await apiClient.post(`/courses/${id}/enroll`);
      if (res.data?.data?.enrolled) {
        setEnrolled(true);
        message.success('已加入学习！');
        await loadProgress();
      }
    } catch (e: any) {
      message.error(e?.response?.data?.error || '报名失败，请先登录');
    } finally {
      setEnrolling(false);
    }
  };

  useEffect(() => {
    loadCourse();
    loadProgress();
  }, [id]);

  if (loading) {
    return (
      <Card>
        <div style={{ textAlign: 'center', padding: 100 }}>
          <Spin size="large" /><p>加载中...</p>
        </div>
      </Card>
    );
  }

  if (!course) {
    return (
      <Card>
        <Title level={3}>课程未找到</Title>
        <Button type="primary" onClick={() => navigate('/courses')}>返回课程列表</Button>
      </Card>
    );
  }

  const levelLabel: Record<string, string> = {
    beginner: '入门', intermediate: '进阶', advanced: '高级'
  };

  return (
    <div>
      {/* 头部 */}
      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ flex: 1 }}>
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/courses')} style={{ marginBottom: 16 }}>
              返回列表
            </Button>
            <Title level={2} style={{ marginBottom: 8 }}>{course.title}</Title>
            <Space size={16} style={{ marginBottom: 16 }}>
              <Tag color="blue">{course.category || '未分类'}</Tag>
              <Tag color={course.level === 'beginner' ? 'green' : course.level === 'advanced' ? 'red' : 'orange'}>
                {levelLabel[course.level || 'beginner']}
              </Tag>
              {course.tags?.map(tag => <Tag key={tag}>{tag}</Tag>)}
            </Space>
            <Paragraph type="secondary" style={{ fontSize: 16, lineHeight: 1.8 }}>
              {course.description}
            </Paragraph>
            <Space size={24}>
              <Text><TeamOutlined /> {course.enrolledCount || 0} 人已学习</Text>
              <Text><ClockCircleOutlined /> {course.duration ? `${Math.floor(course.duration / 60)}分钟` : '~'}</Text>
              <Text>
                <TrophyOutlined /> {course.chapters?.length || 0} 个章节
              </Text>
            </Space>
          </div>
          <div style={{ marginLeft: 32, textAlign: 'center' }}>
            <div style={{ fontSize: 32, fontWeight: 'bold', color: course.price === 0 ? '#52c41a' : '#fa8c16' }}>
              {course.price === 0 ? '免费' : `¥${course.price}`}
            </div>
            <Button
              type="primary" size="large" style={{ marginTop: 16, width: 200 }}
              loading={enrolling}
              onClick={enrolled ? () => message.info('已在学习中') : handleEnroll}
            >
              {enrolled ? '继续学习' : '开始学习'}
            </Button>
          </div>
        </div>
      </Card>

      {/* 学习进度（已加入时显示） */}
      {enrolled && (
        <Card style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text strong>学习进度</Text>
            <Text type="secondary">{progress.completionPct}%</Text>
          </div>
          <Progress
            percent={progress.completionPct}
            status={progress.completionPct === 100 ? 'success' : 'active'}
            style={{ marginTop: 8 }}
          />
        </Card>
      )}

      {/* 章节列表 */}
      <Card title={`课程章节（${course.chapters?.length || 0}章）`}>
        <Collapse
          defaultActiveKey={['0']}
          items={course.chapters?.map((chapter, idx) => ({
            key: String(idx),
            label: (
              <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                <Badge
                  count={progress.completedChapters.includes(idx) ? <CheckCircleOutlined style={{ color: '#52c41a' }} /> : null}
                  offset={[-4, 0]}
                />
                <span style={{ marginLeft: 8, flex: 1 }}>
                  <Text strong>{chapter.title}</Text>
                  {chapter.description && (
                    <Paragraph type="secondary" style={{ margin: '4px 0 0', fontSize: 12 }}>
                      {chapter.description}
                    </Paragraph>
                  )}
                </span>
                <Space size={16}>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    <ClockCircleOutlined /> {chapter.duration || '~'}分钟
                  </Text>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {chapter.resources?.length || 0} 课时
                  </Text>
                </Space>
              </div>
            ),
            children: (
              <div>
                {chapter.resources?.map((res, rIdx) => (
                  <div
                    key={rIdx}
                    style={{
                      display: 'flex', alignItems: 'center', padding: '12px 16px',
                      borderBottom: '1px solid #f0f0f0', cursor: 'pointer'
                    }}
                    onClick={() => message.info(`开始学习：${res.title}`)}
                  >
                    {res.type === 'video' && <PlayCircleOutlined style={{ color: '#1890ff', fontSize: 18, marginRight: 12 }} />}
                    {res.type === 'article' && <BookOutlined style={{ color: '#52c41a', fontSize: 18, marginRight: 12 }} />}
                    {res.type === 'code' && <TrophyOutlined style={{ color: '#722ed1', fontSize: 18, marginRight: 12 }} />}
                    <div style={{ flex: 1 }}>
                      <Text>{res.title}</Text>
                      <Tag style={{ marginLeft: 8 }} color={
                        res.type === 'video' ? 'blue' : res.type === 'article' ? 'green' : 'purple'
                      }>
                        {res.type === 'video' ? '视频' : res.type === 'article' ? '文章' : '实战'}
                      </Tag>
                    </div>
                    <Button type="link" size="small">开始学习</Button>
                  </div>
                ))}
                {/* 章节测验入口 */}
                {chapter.quiz && (
                  <div style={{
                    marginTop: 12, padding: '12px 16px',
                    background: '#f6ffed', borderRadius: 8,
                    border: '1px solid #b7eb8f'
                  }}>
                    <Space>
                      <CheckCircleOutlined style={{ color: '#52c41a' }} />
                      <Text strong>随堂测验：{chapter.quiz.title}</Text>
                      <Button type="link" size="small" onClick={() => navigate('/courses/' + id + '/quiz/' + idx)}>
                        开始答题
                      </Button>
                    </Space>
                  </div>
                )}
              </div>
            )
          })) || []}
        />
      </Card>
    </div>
  );
}
