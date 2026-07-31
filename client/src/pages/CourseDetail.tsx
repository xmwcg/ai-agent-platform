import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Typography, Tag, Space, Button, Spin, Collapse, Progress, message, Badge, Alert } from 'antd';
import {
  ArrowLeftOutlined, BookOutlined, PlayCircleOutlined,
  CheckCircleOutlined, TrophyOutlined, ClockCircleOutlined,
  TeamOutlined, LockOutlined
} from '@ant-design/icons';
import apiClient from '@/services/api';
import {
  CourseResourceType,
  getCourseResourceLabel,
  renderCourseContent,
  resolveCourseResourceUrl,
} from '@/utils/course-content';

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
  enrolledStudents?: number;
  freePreviewChapters?: number;
  requiredPlan?: 'free' | 'pro' | 'max';
  access?: {
    level: 'full' | 'preview';
    currentPlan: 'free' | 'pro' | 'max' | 'team';
    requiredPlan: 'free' | 'pro' | 'max' | 'team';
    freePreviewChapters: number;
    hasFullAccess: boolean;
  };
  duration?: number;
  isPublished?: boolean;
  createdAt?: string;
}

interface Chapter {
  title: string;
  description?: string;
  content?: string;
  locked?: boolean;
  duration?: number;
  resources?: Resource[];
  quiz?: Quiz;
}

interface Resource {
  title: string;
  type: CourseResourceType;
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

function formatCoursePrice(price?: number): string {
  const yuan = (price || 0) / 100;
  return Number.isInteger(yuan) ? `¥${yuan}` : `¥${yuan.toFixed(2)}`;
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

  const completeChapter = async (chapterIndex: number) => {
    if (!id || !enrolled) {
      message.info('请先登录并加入课程后记录学习进度');
      return;
    }
    try {
      const res: any = await apiClient.post(`/courses/${id}/complete-chapter`, { chapterIndex });
      const data = res.data?.data;
      if (data) {
        setProgress({
          completionPct: data.completionPct || 0,
          completedChapters: data.completedChapters || [],
          totalChapters: data.totalChapters || course?.chapters?.length || 0,
        });
        message.success('章节已完成');
      }
    } catch (e: any) {
      message.error(e?.response?.data?.error || '记录学习进度失败');
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
  const hasFullAccess = course.access?.hasFullAccess ?? (course.price || 0) === 0;
  const previewChapters = course.access?.freePreviewChapters ?? course.freePreviewChapters ?? 2;

  const scrollToChapters = () => document.getElementById('course-chapters')?.scrollIntoView({ behavior: 'smooth' });
  const handlePrimaryAction = () => {
    if (!hasFullAccess || enrolled) {
      scrollToChapters();
      return;
    }
    void handleEnroll();
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
              <Text><TeamOutlined /> {course.enrolledStudents || 0} 人已学习</Text>
              <Text><ClockCircleOutlined /> {course.duration ? `${Math.floor(course.duration / 60)}分钟` : '~'}</Text>
              <Text>
                <TrophyOutlined /> {course.chapters?.length || 0} 个章节
              </Text>
            </Space>
          </div>
          <div style={{ marginLeft: 32, textAlign: 'center' }}>
            <div style={{ fontSize: 32, fontWeight: 'bold', color: course.price === 0 ? '#52c41a' : '#fa8c16' }}>
              {course.price === 0 ? '免费' : formatCoursePrice(course.price)}
            </div>
            <Button
              type="primary" size="large" style={{ marginTop: 16, width: 200 }}
              loading={enrolling}
              onClick={handlePrimaryAction}
            >
              {enrolled ? '继续学习' : hasFullAccess ? '开始学习' : '免费试看'}
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

      {/* 付费墙提示 */}
      {!hasFullAccess && (course.price || 0) > 0 && (
        <Alert
          type="warning" showIcon
          message={course.requiredPlan && course.requiredPlan !== 'free' ? `${course.requiredPlan === 'max' ? '旗舰' : '专业'}会员专享课程` : `付费课程 ${formatCoursePrice(course.price)}`}
          description={<Space wrap><span>免费试看 {previewChapters} 章，升级后解锁全部 {course.chapters?.length || 0} 章并保存完整学习进度</span><Button type="primary" size="small" onClick={() => navigate('/pricing')}>升级会员</Button></Space>}
          style={{ marginBottom: 12 }}
        />
      )}
      <Card id="course-chapters" title={`课程章节（${course.chapters?.length || 0}章）`}>
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
                {chapter.locked ? (
                  <Alert
                    type="warning"
                    showIcon
                    icon={<LockOutlined />}
                    message="本章节为会员内容"
                    description={
                      <Space>
                        <span>升级会员后解锁完整教程、代码和测验。</span>
                        <Button type="primary" size="small" onClick={() => navigate('/pricing')}>查看套餐</Button>
                      </Space>
                    }
                  />
                ) : (
                  <div>
                    {chapter.content ? (
                      <div
                        className="course-content"
                        dangerouslySetInnerHTML={{ __html: renderCourseContent(chapter.content) }}
                      />
                    ) : (
                      <Alert type="info" showIcon message="本章节暂未配置正文" description="管理员可以补充 Markdown 内容后重新发布。" />
                    )}
                    <div style={{ marginTop: 12, textAlign: 'right' }}>
                      <Button
                        type={progress.completedChapters.includes(idx) ? 'default' : 'primary'}
                        icon={<CheckCircleOutlined />}
                        onClick={() => completeChapter(idx)}
                        disabled={progress.completedChapters.includes(idx)}
                      >
                        {progress.completedChapters.includes(idx) ? '已完成' : '标记章节完成'}
                      </Button>
                    </div>
                  </div>
                )}
                {chapter.resources?.map((res, rIdx) => {
                  const resourceUrl = resolveCourseResourceUrl(res.url, window.location.origin);
                  const color = res.type === 'video' ? 'blue' : res.type === 'article' || res.type === 'pdf' ? 'green' : 'purple';
                  return (
                    <div
                      key={rIdx}
                      style={{
                        display: 'flex', alignItems: 'center', padding: '12px 16px',
                        borderBottom: '1px solid #f0f0f0', cursor: resourceUrl ? 'pointer' : 'default'
                      }}
                      onClick={() => resourceUrl && window.open(resourceUrl, '_blank', 'noopener,noreferrer')}
                    >
                      {res.type === 'video' && <PlayCircleOutlined style={{ color: '#1890ff', fontSize: 18, marginRight: 12 }} />}
                      {(res.type === 'article' || res.type === 'pdf' || res.type === 'link' || res.type === 'file') && <BookOutlined style={{ color: '#52c41a', fontSize: 18, marginRight: 12 }} />}
                      {res.type === 'code' && <TrophyOutlined style={{ color: '#722ed1', fontSize: 18, marginRight: 12 }} />}
                      <div style={{ flex: 1 }}>
                        <Text>{res.title}</Text>
                        <Tag style={{ marginLeft: 8 }} color={color}>{getCourseResourceLabel(res.type)}</Tag>
                      </div>
                      <Button type="link" size="small" disabled={!resourceUrl}>打开资源</Button>
                    </div>
                  );
                })}
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
