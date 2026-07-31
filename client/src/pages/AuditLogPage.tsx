import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card, Typography, Button, Table, Tag, Space, Statistic, Row, Col, Empty, message, Spin
} from 'antd';
import { ArrowLeftOutlined, DownloadOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import { customerServiceAPI, extractApiError } from '@/services/api';

const { Title, Text } = Typography;

interface AuditItem {
  _id: string;
  question: string;
  answer: string;
  visitorId: string;
  sources: { title?: string; confidence?: number }[];
  similarityAvg: number;
  escalated: boolean;
  satisfaction?: number;
  createdAt: string;
}

interface AuditStats {
  total: number;
  escalated: number;
  escalatedRate: number;
  rated: number;
  avgSatisfaction: number | null;
  topSources: { title: string; count: number }[];
}

const AuditLogPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [stats, setStats] = useState<AuditStats | null>(null);
  const [logs, setLogs] = useState<AuditItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  const loadStats = useCallback(async () => {
    if (!id) return;
    try {
      const res: any = await customerServiceAPI.auditStats(id);
      setStats(res.data);
    } catch { setLogs([]); }
  }, [id]);

  const loadLogs = useCallback(async (p: number) => {
    if (!id) return;
    setLoading(true);
    try {
      const res: any = await customerServiceAPI.auditLogs(id, { page: p, pageSize: 20 });
      setLogs(res.data.items || []);
      setTotal(res.data.total || 0);
      setPage(p);
    } catch (e) { message.error(extractApiError(e, '加载审计日志失败')); }
    setLoading(false);
  }, [id]);

  useEffect(() => { loadStats(); loadLogs(1); }, [loadStats, loadLogs]);

  const onExport = async () => {
    if (!id) return;
    setExporting(true);
    try {
      const blob: any = await customerServiceAPI.auditExport(id, 'csv');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-${id}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      message.success('已导出 CSV');
    } catch (e) { message.error(extractApiError(e, '导出失败')); }
    setExporting(false);
  };

  const columns = [
    {
      title: '时间', dataIndex: 'createdAt', key: 't', width: 170,
      render: (t: string) => <Text type="secondary">{t ? new Date(t).toLocaleString() : '-'}</Text>
    },
    {
      title: '访客', dataIndex: 'visitorId', key: 'v', width: 120,
      render: (v: string) => <Text code>{v}</Text>
    },
    {
      title: '问题 / 答案', key: 'qa',
      render: (_: any, r: AuditItem) => (
        <div>
          <div><b>问：</b>{r.question}</div>
          <div style={{ color: '#475569' }}><b>答：</b>{(r.answer || '').slice(0, 80)}{(r.answer || '').length > 80 ? '…' : ''}</div>
        </div>
      )
    },
    {
      title: '来源文档', key: 'src', width: 160,
      render: (_: any, r: AuditItem) => (
        <Space direction="vertical" size={0}>
          {(r.sources || []).slice(0, 2).map((s, i) => (
            <Tag key={i} color="blue">{s.title || '未知'}（{((s.confidence || 0) * 100).toFixed(0)}%）</Tag>
          ))}
          {(r.sources || []).length === 0 && <Text type="secondary">无引用</Text>}
        </Space>
      )
    },
    {
      title: '转人工', dataIndex: 'escalated', key: 'e', width: 90,
      render: (e: boolean) => e ? <Tag color="red">已转</Tag> : <Tag>否</Tag>
    },
    {
      title: '满意度', dataIndex: 'satisfaction', key: 's', width: 90,
      render: (s: number) => s ? <Tag color="green">{s} 星</Tag> : <Text type="secondary">-</Text>
    },
  ];

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <Title level={3} style={{ margin: 0 }}><SafetyCertificateOutlined /> 合规审计日志</Title>
          <Text type="secondary">每条问答完整留痕：问题 / 答案 / 来源依据 / 转人工 / 满意度（金融·医疗·政务刚需）</Text>
        </div>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/customer-service')}>返回</Button>
          <Button icon={<DownloadOutlined />} loading={exporting} onClick={onExport}>导出 CSV</Button>
        </Space>
      </div>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}><Card><Statistic title="留痕总量" value={stats?.total || 0} /></Card></Col>
        <Col span={6}><Card><Statistic title="转人工次数" value={stats?.escalated || 0} valueStyle={{ color: '#cf1322' }} /></Card></Col>
        <Col span={6}><Card><Statistic title="转人工率" value={((stats?.escalatedRate || 0) * 100).toFixed(1)} suffix="%" /></Card></Col>
        <Col span={6}><Card><Statistic title="平均满意度" value={stats?.avgSatisfaction ?? '—'} suffix={stats?.avgSatisfaction ? '星' : ''} valueStyle={{ color: '#3f8600' }} /></Card></Col>
      </Row>

      <Card>
        {logs.length === 0 && !loading ? (
          <Empty description="暂无审计记录，先去客服对话测试或嵌入网站产生问答" />
        ) : (
          <Spin spinning={loading}>
            <Table
              rowKey="_id" dataSource={logs} columns={columns}
              pagination={{ current: page, total, pageSize: 20, onChange: loadLogs }}
            />
          </Spin>
        )}
      </Card>
    </div>
  );
};

export default AuditLogPage;
