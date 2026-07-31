import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Row, Col, Typography, Tag, Button, Space, Spin, Input, Empty } from 'antd';
import {
  ShopOutlined, EyeOutlined, DollarOutlined, BookOutlined,
  CrownOutlined, ThunderboltOutlined, UnlockOutlined, SearchOutlined,
} from '@ant-design/icons';
import apiClient, { extractApiError } from '@/services/api';
import useSeo from '@/hooks/useSeo';

const { Title, Paragraph, Text } = Typography;

interface KnowledgeProduct {
  _id: string;
  title: string;
  summary?: string;
  tags: string[];
  categories: string[];
  isPublic: boolean;
  price?: number;
  requiredPlan?: 'free' | 'pro' | 'max';
  creditsCost?: number;
  freePreviewPages?: number;
  viewCount: number;
  likeCount: number;
  createdAt: string;
  readingTime?: number;
}

const PLAN_LABELS: Record<string, { text: string; color: string }> = {
  free: { text: '免费', color: 'green' },
  pro: { text: '专业版', color: 'blue' },
  max: { text: '旗舰版', color: 'gold' },
};

export default function ShopPage() {
  const navigate = useNavigate();
  useSeo('NexMind 知识商城 — 行业知识产品与课程 | AIbak', '精选 NexMind Vault 行业知识产品、课程与模板，支持免费预览、会员解锁和积分购买。');
  const [products, setProducts] = useState<KnowledgeProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const res: any = await apiClient.get('/knowledge', {
          params: { limit: 50, sortBy: 'updatedAt', order: 'desc' },
        });
        const data = res.data?.data || [];
        setProducts(data.filter((p: KnowledgeProduct) => p.isPublic));
      } catch (e) {
        console.error(extractApiError(e, '加载知识商城失败'));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const filtered = search
    ? products.filter((p) =>
        p.title.includes(search) ||
        p.summary?.includes(search) ||
        p.tags?.some((t) => t.includes(search))
      )
    : products;

  if (loading) return <Spin style={{ display: 'block', margin: '60px auto' }} />;

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      {/* Hero */}
      <div style={{
        background: 'linear-gradient(135deg, #1e1b4b 0%, #6c5ce7 50%, #a29bfe 100%)',
        borderRadius: 20, padding: '48px 32px', textAlign: 'center', marginBottom: 28,
      }}>
        <Tag style={{
          background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.2)',
          color: '#e2e8f0', borderRadius: 20, padding: '2px 14px', fontSize: 12, marginBottom: 12,
        }}>
          <ShopOutlined style={{ marginRight: 4 }} />知识商城
        </Tag>
        <Title level={2} style={{ color: '#fff', margin: '0 0 8px' }}>
          NexMind 知识商城
        </Title>
        <Paragraph style={{ color: 'rgba(255,255,255,0.85)', fontSize: 15, maxWidth: 500, margin: '0 auto 20px' }}>
          精选行业知识产品 · 从 Obsidian 知识库精选 · 一次购买永久阅读
        </Paragraph>
        <Input
          prefix={<SearchOutlined />}
          placeholder="搜索知识产品..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          allowClear
          style={{ maxWidth: 400, borderRadius: 10 }}
        />
      </div>

      {/* Product Grid */}
      {filtered.length === 0 ? (
        <Empty description="暂无知识产品" style={{ marginTop: 60 }} />
      ) : (
        <Row gutter={[16, 16]}>
          {filtered.map((product) => (
            <Col xs={24} sm={12} md={8} key={product._id}>
              <Card
                hoverable
                onClick={() => navigate(`/knowledge/${product._id}`)}
                style={{ borderRadius: 14, height: '100%', border: '1px solid var(--border-light)' }}
                styles={{ body: { padding: 20, display: 'flex', flexDirection: 'column', height: '100%' } }}
              >
                {/* Tags row */}
                <div style={{ marginBottom: 12, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {product.requiredPlan && product.requiredPlan !== 'free' && (
                    <Tag color={PLAN_LABELS[product.requiredPlan]?.color || 'default'} style={{ borderRadius: 6 }}>
                      {PLAN_LABELS[product.requiredPlan]?.text || product.requiredPlan}
                    </Tag>
                  )}
                  {product.tags?.slice(0, 3).map((tag: string) => (
                    <Tag key={tag} style={{ borderRadius: 6, fontSize: 11 }}>{tag}</Tag>
                  ))}
                </div>

                {/* Title */}
                <Title level={5} style={{ marginBottom: 8, flex: 0 }}>
                  <BookOutlined style={{ marginRight: 6, color: '#6c5ce7' }} />
                  {product.title}
                </Title>

                {/* Summary */}
                {product.summary && (
                  <Paragraph
                    type="secondary"
                    style={{ fontSize: 13, marginBottom: 12, flex: 1 }}
                    ellipsis={{ rows: 2 }}
                  >
                    {product.summary}
                  </Paragraph>
                )}

                {/* Bottom bar */}
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  marginTop: 'auto', paddingTop: 12, borderTop: '1px solid var(--border-light)',
                }}>
                  <Space size={4}>
                    {product.price != null && product.price > 0 ? (
                      <Tag color="orange" style={{ borderRadius: 6 }}>
                        <DollarOutlined /> ¥{product.price}
                      </Tag>
                    ) : product.creditsCost != null && product.creditsCost > 0 ? (
                      <Tag color="purple" style={{ borderRadius: 6 }}>
                        <ThunderboltOutlined /> {product.creditsCost} 积分
                      </Tag>
                    ) : (
                      <Tag color="green" style={{ borderRadius: 6 }}>免费</Tag>
                    )}
                    {product.freePreviewPages && product.freePreviewPages > 0 && (
                      <Text style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                        试读{product.freePreviewPages}页
                      </Text>
                    )}
                  </Space>
                  <Space size={4}>
                    <Text style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                      <EyeOutlined /> {product.viewCount || 0}
                    </Text>
                    <Button size="small" type="primary" ghost icon={<UnlockOutlined />}
                      style={{ borderRadius: 8 }}>
                      查看
                    </Button>
                  </Space>
                </div>
              </Card>
            </Col>
          ))}
        </Row>
      )}
    </div>
  );
}