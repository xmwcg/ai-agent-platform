import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Row, Col, Typography, Tag, Space, Button, Select } from 'antd';
import { BookOutlined, ClockCircleOutlined, TeamOutlined, DollarOutlined } from '@ant-design/icons';
import apiClient from '@/services/api';
import { PageContainer } from '@/components/ui-states';

const { Title, Paragraph, Text } = Typography;

interface Course {
  _id: string;
  title: string;
  description: string;
  category?: string;
  level?: string;
  tags?: string[];
  price?: number;
  chaptersCount?: number;
  enrolledCount?: number;
  duration?: number;
  isPublished?: boolean;
  createdAt?: string;
}

const levelMap: Record<string, { label: string; color: string }> = {
  beginner: { label: '入门', color: 'green' },
  intermediate: { label: '进阶', color: 'orange' },
  advanced: { label: '高级', color: 'red' }
};

export default function CourseList() {
  const navigate = useNavigate();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<{ category?: string; level?: string }>({});

  const loadCourses = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (filter.category) params.category = filter.category;
      if (filter.level) params.level = filter.level;
      const res: any = await apiClient.get('/courses', { params });
      const data = res.data?.data || [];
      if (data.length > 0) {
        setCourses(data.map((c: any) => ({
          _id: c._id,
          title: c.title || '',
          description: c.description || '',
          category: c.category || '',
          level: c.level || '',
          tags: c.tags || [],
          price: c.price ?? 0,
          chaptersCount: c.chapters?.length || c.chapterCount || 0,
          enrolledCount: c.enrolledStudents ?? 0,
          duration: c.totalDuration || 0,
          isPublished: c.isPublished,
          createdAt: c.createdAt,
        })));
      } else {
        setCourses([]);
      }
    } catch {
      setCourses([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadCourses(); }, [filter]);

  return (
    <PageContainer
      loading={loading}
      empty={!loading && courses.length === 0}
      skeletonType="cardGrid"
      emptyConfig={{
        title: '暂无课程',
        description: '快来这里创建第一门课程吧',
        action: { text: 'AI 推荐学习路径', onClick: () => navigate('/ai-chat') },
      }}
    >
    <div>
      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <Title level={3} style={{ margin: 0 }}>学习中心</Title>
          <Button type="primary" onClick={() => navigate('/ai-chat')}>
            AI 推荐学习路径
          </Button>
        </div>

        <Space wrap size={[16, 8]}>
          <span>筛选：</span>
          <Select
            placeholder="难度"
            allowClear
            style={{ width: 120 }}
            options={[
              { label: '入门', value: 'beginner' },
              { label: '进阶', value: 'intermediate' },
              { label: '高级', value: 'advanced' }
            ]}
            onChange={(v) => setFilter(f => ({ ...f, level: v }))}
          />
          <Select
            placeholder="分类"
            allowClear
            style={{ width: 140 }}
            options={[
              { label: '操作系统', value: '操作系统' },
              { label: '云计算', value: '云计算' },
              { label: 'AI/ML', value: 'AI/ML' }
            ]}
            onChange={(v) => setFilter(f => ({ ...f, category: v }))}
          />
        </Space>
      </Card>

      <Row gutter={[16, 16]}>
          {courses.map(course => (
            <Col xs={24} sm={12} lg={8} key={course._id}>
              <Card
                hoverable
                onClick={() => navigate(`/courses/${course._id}`)}
                cover={
                  <div style={{
                    height: 160,
                    background: course.category === '操作系统' ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                      : course.category === '云计算' ? 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)'
                      : course.category === 'AI/ML' ? 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)'
                      : 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}>
                    <BookOutlined style={{ fontSize: 48, color: '#fff' }} />
                  </div>
                }
                actions={[
                  <Space key="meta" size={4}>
                    <ClockCircleOutlined />
                    <Text type="secondary">{course.duration ? `${Math.floor(course.duration / 60)}分钟` : '~'}</Text>
                  </Space>,
                  <Space key="students" size={4}>
                    <TeamOutlined />
                    <Text type="secondary">{course.enrolledCount || 0} 人</Text>
                  </Space>,
                  <Space key="price" size={4}>
                    <DollarOutlined />
                    <Text strong type={course.price === 0 ? 'success' : undefined}>
                      {course.price === 0 ? '免费' : `¥${course.price}`}
                    </Text>
                  </Space>
                ]}
              >
                <Card.Meta
                  title={
                    <div>
                      <div>{course.title}</div>
                      {course.level && (
                        <Tag color={levelMap[course.level]?.color} style={{ marginTop: 4 }}>
                          {levelMap[course.level]?.label}
                        </Tag>
                      )}
                    </div>
                  }
                  description={
                    <Paragraph ellipsis={{ rows: 2 }} style={{ marginBottom: 8 }}>
                      {course.description}
                    </Paragraph>
                  }
                />
                <div style={{ marginTop: 8 }}>
                  {course.tags?.slice(0, 3).map(tag => (
                    <Tag key={tag} style={{ marginBottom: 4 }}>{tag}</Tag>
                  ))}
                </div>
              </Card>
            </Col>
          ))}
        </Row>
    </div>
    </PageContainer>
  );
}
