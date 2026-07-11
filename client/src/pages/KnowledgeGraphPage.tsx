import { useState, useEffect, useCallback } from 'react';
import { Card, Switch, Slider, Button, Spin, Alert, Typography, Drawer, Tag, Space, Empty } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import { knowledgeGraphAPI, extractApiError } from '@/services/api';

const { Title, Text } = Typography;

interface GNode {
  id: string;
  label: string;
  type: 'doc' | 'tag' | 'category';
  weight: number;
  tags?: string[];
  docCount?: number;
}
interface GLink {
  source: string;
  target: string;
  type: string;
  weight: number;
}
interface GraphData {
  nodes: GNode[];
  links: GLink[];
}

export default function KnowledgeGraphPage() {
  const [data, setData] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [includeTags, setIncludeTags] = useState(true);
  const [includeCategories, setIncludeCategories] = useState(true);
  const [minShared, setMinShared] = useState(1);
  const [selected, setSelected] = useState<GNode | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await knowledgeGraphAPI.get({
        includeTags,
        includeCategories,
        minSharedTags: minShared,
        limit: 1000,
      });
      setData((res.data as any)?.data || { nodes: [], links: [] });
    } catch (e: unknown) {
      setError(extractApiError(e, '加载知识图谱失败'));
    } finally {
      setLoading(false);
    }
  }, [includeTags, includeCategories, minShared]);

  useEffect(() => {
    load();
  }, [load]);

  const option: any = data
    ? {
        tooltip: {
          formatter: (p: any) => {
            if (p.dataType === 'edge') return `${p.data.source} → ${p.data.target}`;
            return `名称：${p.data.label}\n类型：${p.data.category}\n权重：${p.data.value}`;
          },
        },
        legend: [{ data: ['文档', '标签', '分类'], top: 8 }],
        series: [
          {
            type: 'graph',
            layout: 'force',
            roam: true,
            draggable: true,
            label: {
              show: true,
              position: 'right',
              fontSize: 11,
              formatter: (p: any) => p.data.label,
            },
            force: { repulsion: 220, edgeLength: [60, 160], gravity: 0.08 },
            emphasis: { focus: 'adjacency' },
            categories: [{ name: '文档' }, { name: '标签' }, { name: '分类' }],
            data: data.nodes.map((n) => ({
              id: n.id,
              name: n.id,
              label: n.label,
              category: n.type === 'doc' ? '文档' : n.type === 'tag' ? '标签' : '分类',
              value: n.weight,
              symbolSize:
                n.type === 'doc'
                  ? Math.min(50, 14 + Math.log(n.weight + 1) * 5)
                  : Math.min(40, 10 + Math.log(n.weight + 1) * 6),
              itemStyle:
                n.type === 'doc'
                  ? { color: '#6366f1' }
                  : n.type === 'tag'
                  ? { color: '#10b981' }
                  : { color: '#f59e0b' },
            })),
            links: data.links.map((l) => ({
              source: l.source,
              target: l.target,
              lineStyle: { width: Math.min(4, l.weight), opacity: 0.6 },
            })),
          },
        ],
      }
    : null;

  const onChartClick = (params: any) => {
    if (params.dataType === 'node' && data) {
      const node = data.nodes.find((n) => n.id === params.data.id);
      if (node) setSelected(node);
    }
  };

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <Title level={3} style={{ margin: 0 }}>
          知识图谱
        </Title>
        <Space wrap>
          <span>
            标签节点 <Switch checked={includeTags} onChange={setIncludeTags} />
          </span>
          <span>
            分类节点 <Switch checked={includeCategories} onChange={setIncludeCategories} />
          </span>
          <span>
            共现阈值
            <Slider
              min={1}
              max={5}
              value={minShared}
              onChange={setMinShared}
              style={{ width: 100, display: 'inline-block', marginLeft: 8 }}
            />
          </span>
          <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>
            刷新
          </Button>
        </Space>
      </div>

      {error && (
        <Alert type="error" message={error} style={{ marginBottom: 12 }} />
      )}

      <Card>
        {loading ? (
          <div style={{ height: 520, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Spin />
          </div>
        ) : data && data.nodes.length > 0 ? (
          <ReactECharts option={option} style={{ height: 560 }} notMerge lazyUpdate onEvents={{ click: onChartClick }} />
        ) : (
          <Empty description="暂无知识文档，请先到「知识中枢」创建文档并打标签" style={{ padding: 80 }} />
        )}
      </Card>

      <Drawer title="节点详情" open={!!selected} onClose={() => setSelected(null)}>
        {selected && (
          <div>
            <p>
              <Text strong>名称：</Text>
              {selected.label}
            </p>
            <p>
              <Text strong>类型：</Text>
              {selected.type === 'doc' ? '文档' : selected.type === 'tag' ? '标签' : '分类'}
            </p>
            <p>
              <Text strong>权重：</Text>
              {selected.weight}
              {selected.type !== 'doc' && `（关联 ${selected.docCount} 篇文档）`}
            </p>
            {selected.tags && selected.tags.length > 0 && (
              <p>
                <Text strong>标签：</Text>
                {selected.tags.map((t) => (
                  <Tag key={t}>{t}</Tag>
                ))}
              </p>
            )}
          </div>
        )}
      </Drawer>
    </div>
  );
}
