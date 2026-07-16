import { useState, useEffect } from 'react';
import {
  Card, Typography, Table, Tag, Select, Button, Space, message, Radio, Badge
} from 'antd';
import {
  BarChartOutlined, SwapOutlined, TrophyOutlined,
  CheckCircleOutlined, CloseCircleOutlined
} from '@ant-design/icons';
import apiClient, { extractApiError } from '@/services/api';

const { Title, Paragraph, Text } = Typography;

interface CompareItem {
  id: string;
  name: string;
  type: 'model' | 'tool' | 'framework' | 'language' | 'hardware';
  provider?: string;
  description?: string;
}

interface CompareResult {
  items: CompareItem[];
  dimensions: Dimension[];
  rows: CompareRow[];
  recommendation?: string;
}

interface Dimension {
  key: string;
  label: string;
  unit?: string;
}

interface CompareRow {
  dimension: string;
  values: (string | number | boolean)[];
  winner?: number;
}

type CompareType = 'model' | 'framework' | 'language' | 'all';

export default function ComparePage() {
  const [items, setItems] = useState<CompareItem[]>([]);
  const [selectedType, setSelectedType] = useState<CompareType>('model');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [result, setResult] = useState<CompareResult | null>(null);
  const [generating, setGenerating] = useState(false);

  const loadItems = async () => {
    try {
      const res: any = await apiClient.get('/compare/items', {
        params: { type: selectedType === 'all' ? undefined : selectedType }
      });
      if (!Array.isArray(res?.data)) {
        throw new Error('对比项数据格式无效');
      }
      setItems(res.data);
    } catch (error) {
      setItems([]);
      message.error(extractApiError(error, '加载对比项失败'));
    }
  };

  useEffect(() => {
    loadItems();
    setSelectedIds([]);
    setResult(null);
  }, [selectedType]);

  const handleGenerate = async () => {
    if (selectedIds.length < 2) {
      message.warning('请至少选择 2 个对比项');
      return;
    }
    setGenerating(true);
    try {
      const res: any = await apiClient.post('/compare/generate', { items: selectedIds });
      if (res.data) {
        setResult(res.data);
        message.success('对比生成成功');
      }
    } catch (err) {
      message.error(extractApiError(err, '生成失败'));
    } finally {
      setGenerating(false);
    }
  };

  // 表格列定义
  const columns = result ? [
    {
      title: '对比维度',
      dataIndex: 'dimension',
      key: 'dimension',
      width: 140,
      render: (text: string) => <Text strong>{text}</Text>
    },
    ...result.items.map((item, idx) => ({
      title: () => (
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontWeight: 'bold', marginBottom: 4 }}>{item.name}</div>
          {item.provider && <Tag color="blue">{item.provider}</Tag>}
          {result.rows.some(r => r.winner === idx) && (
            <Badge count="冠军" style={{ marginTop: 4 }} />
          )}
        </div>
      ),
      dataIndex: `value_${idx}`,
      key: item.id,
      align: 'center' as const,
      render: (val: any, record: CompareRow) => {
        const isWinner = record.winner === idx;
        return (
          <div style={{ color: isWinner ? '#52c41a' : undefined, fontWeight: isWinner ? 'bold' : 'normal' }}>
            {typeof val === 'boolean' ? (
              val ? <CheckCircleOutlined style={{ color: '#52c41a' }} /> : <CloseCircleOutlined style={{ color: '#ff4d4f' }} />
            ) : (
              <span>{val}{result.dimensions.find(d => d.key === record.dimension)?.unit || ''}</span>
            )}
          </div>
        );
      }
    }))
  ] : [];

  // 表格数据
  const tableData = result ? result.rows.map(row => {
    const obj: any = { key: row.dimension, dimension: row.dimension };
    row.values.forEach((val, idx) => { obj[`value_${idx}`] = val; });
    return obj;
  }) : [];

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Space>
            <BarChartOutlined style={{ fontSize: 24, color: '#1890ff' }} />
            <Title level={3} style={{ margin: 0 }}>对比分析</Title>
            <Badge count={selectedIds.length} showZero color="blue" />
          </Space>
          <Button
            type="primary"
            icon={<SwapOutlined />}
            loading={generating}
            disabled={selectedIds.length < 2}
            onClick={handleGenerate}
          >
            生成对比（{selectedIds.length}）
          </Button>
        </div>
        <Paragraph type="secondary">
          选择多个模型/工具/框架，AI 自动生成结构化对比表 + 场景推荐。
          已选 <Text strong>{selectedIds.length}</Text> 个对比项。
        </Paragraph>

        {/* 类型筛选 + 选择区 */}
        <div style={{ display: 'flex', gap: 16, marginTop: 16 }}>
          <div style={{ width: 280 }}>
            <Card size="small" title="筛选类型">
              <Radio.Group
                value={selectedType}
                onChange={e => setSelectedType(e.target.value)}
                style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
              >
                <Radio value="model">🤖 AI 模型</Radio>
                <Radio value="framework">🔧 框架/工具</Radio>
                <Radio value="language">💻 编程语言</Radio>
                <Radio value="all">📦 全部</Radio>
              </Radio.Group>
            </Card>

            <Card size="small" title={`选择对比项（${selectedIds.length}）`} style={{ marginTop: 16 }}>
              <Select
                mode="multiple"
                value={selectedIds}
                onChange={setSelectedIds}
                placeholder="选择至少 2 个"
                style={{ width: '100%' }}
                options={items.map(i => ({ label: `${i.name}（${i.provider || i.type}）`, value: i.id }))}
                maxTagCount={3}
              />
              <div style={{ marginTop: 8 }}>
                <Button size="small" onClick={() => setSelectedIds(items.slice(0, 3).map(i => i.id))}>快速选 3 个</Button>
                <Button size="small" style={{ marginLeft: 8 }} onClick={() => setSelectedIds([])}>清空</Button>
              </div>
            </Card>
          </div>

          {/* 对比结果 */}
          <div style={{ flex: 1 }}>
            {result ? (
              <Card
                title={
                  <Space>
                    <SwapOutlined />
                    <Text strong>对比结果</Text>
                    <Tag>{result.items.length} 项对比</Tag>
                  </Space>
                }
                extra={
                  <Button size="small" onClick={() => { setResult(null); setSelectedIds([]); }}>
                    重新选择
                  </Button>
                }
              >
                <Table
                  columns={columns}
                  dataSource={tableData}
                  pagination={false}
                  size="small"
                  bordered
                  style={{ marginBottom: 16 }}
                />

                {result.recommendation && (
                  <Card
                    type="inner"
                    style={{ background: '#f6ffed', border: '1px solid #b7eb8f' }}
                    title={
                      <Space>
                        <TrophyOutlined style={{ color: '#52c41a' }} />
                        <Text strong>AI 推荐总结</Text>
                      </Space>
                    }
                  >
                    <Paragraph style={{ whiteSpace: 'pre-wrap', marginBottom: 0 }}>
                      {result.recommendation}
                    </Paragraph>
                  </Card>
                )}
              </Card>
            ) : (
              <Card>
                <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>
                  <SwapOutlined style={{ fontSize: 48, marginBottom: 16 }} />
                  <div>选择对比项，点击「生成对比」查看结果</div>
                  <div style={{ fontSize: 12, marginTop: 8 }}>
                    支持模型、框架、编程语言等多种类型对比
                  </div>
                </div>
              </Card>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
