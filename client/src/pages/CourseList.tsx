import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Row, Col, Typography, Tag, Space, Button, Spin, Empty, Select } from 'antd';
import { BookOutlined, ClockCircleOutlined, TeamOutlined, DollarOutlined } from '@ant-design/icons';
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
      if (res.data) {
        setCourses(res.data);
      }
    } catch {
      // 使用模拟数据
      setCourses([
        {
          _id: 'course1',
          title: 'Linux 入门到精通',
          description: '从零开始学习 Linux 系统管理，涵盖文件操作、权限管理、服务配置等核心技能。',
          category: 'Linux',
          level: 'beginner',
          tags: ['Linux', '运维', '命令行'],
          price: 0,
          chaptersCount: 8,
          enrolledCount: 128,
          duration: 3600,
          isPublished: true,
          createdAt: '2025-01-01'
        },
        {
          _id: 'course2',
          title: '云计算架构师 2026',
          description: '面向未来的云原生架构设计，包含 AWS/Azure/GCP 多平台实战。',
          category: '云计算',
          level: 'advanced',
          tags: ['云计算', 'DevOps', '架构'],
          price: 199,
          chaptersCount: 12,
          enrolledCount: 56,
          duration: 7200,
          isPublished: true,
          createdAt: '2025-01-05'
        },
        {
          _id: 'course3',
          title: '大模型部署实战',
          description: '从模型选型到生产部署，掌握 LLM 全生命周期管理。',
          category: 'AI',
          level: 'intermediate',
          tags: ['LLM', '部署', 'AI'],
          price: 99,
          chaptersCount: 6,
          enrolledCount: 89,
          duration: 4800,
          isPublished: true,
          createdAt: '2025-01-08'
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadCourses(); }, [filter]);

  if (loading) {
    return (
      <Card>
        <div style={{ textAlign: 'center', padding: 100 }}>
          <Spin size="large" /><p>加载课程中...</p>
        </div>
      </Card>
    );
  }

  return (
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
              { label: 'Linux', value: 'Linux' },
              { label: '云计算', value: '云计算' },
              { label: 'AI', value: 'AI' }
            ]}
            onChange={(v) => setFilter(f => ({ ...f, category: v }))}
          />
        </Space>
      </Card>

      {courses.length === 0 ? (
        <Card>
          <Empty description="暂无课程，快来创建第一门课程吧！" />
        </Card>
      ) : (
        <Row gutter={[16, 16]}>
          {courses.map(course => (
            <Col xs={24} sm={12} lg={8} key={course._id}>
              <Card
                hoverable
                onClick={() => navigate(`/courses/${course._id}`)}
                cover={
                  <div style={{
                    height: 160,
                    background: course.category === 'Linux' ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                      : course.category === '云计算' ? 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)'
                      : 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
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
      )}
    </div>
  );
}
