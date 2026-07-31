import { useState } from 'react';
import { ApiOutlined, BarChartOutlined, BookOutlined, LoginOutlined, SearchOutlined } from '@ant-design/icons';
import { Button, Divider, Drawer, Popover, Skeleton, Space, Statistic, Tag, Typography } from 'antd';
import { useNavigate } from 'react-router-dom';
import apiClient, { extractApiError } from '@/services/api';
import { useAuthStore } from '@/stores/auth';
import { useUIStore } from '@/stores/ui';

const { Text, Title } = Typography;

interface AccountSummary {
  plan: string;
  membershipExpiresAt: string | null;
  credits: {
    free: number;
    paid: number;
    legacyProtected: number;
    total: number;
    reconciled: boolean;
  };
  monthUsage: { calls: number; successRate: number; creditsConsumed: number };
  recentOrder: { orderNo: string; status: string } | null;
}

export default function SiteQueryMenu({ compact = false }: { compact?: boolean }) {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const isMobile = useUIStore((state) => state.isMobile);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<AccountSummary | null>(null);
  const [error, setError] = useState('');

  const loadSummary = async () => {
    if (!user || summary || loading) return;
    setLoading(true);
    setError('');
    try {
      const response: any = await apiClient.get('/query-center/account-summary');
      setSummary(response?.data || null);
    } catch (requestError) {
      setError(extractApiError(requestError, '账户摘要暂不可用'));
    } finally {
      setLoading(false);
    }
  };

  const onOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (nextOpen) void loadSummary();
  };

  const goTo = (path: string) => {
    setOpen(false);
    navigate(path);
  };

  const content = (
    <div style={{ width: isMobile ? '100%' : 360, maxWidth: '100%' }}>
      <Title level={5} style={{ marginTop: 0, marginBottom: 12 }}>本站查询</Title>
      <Space direction="vertical" size={4} style={{ width: '100%' }}>
        <Button block type="text" icon={<ApiOutlined />} style={{ justifyContent: 'flex-start', height: 46 }} onClick={() => goTo('/query-center?tab=providers')}>
          官方 API 接入查询
        </Button>
        <Button block type="text" icon={<BookOutlined />} style={{ justifyContent: 'flex-start', height: 46 }} onClick={() => goTo('/query-center?tab=docs')}>
          模型接入文档参考
        </Button>
        <Button block type="text" icon={<BarChartOutlined />} style={{ justifyContent: 'flex-start', height: 46 }} onClick={() => goTo('/query-center?tab=account')}>
          我的本站统计
        </Button>
      </Space>

      <Divider style={{ margin: '12px 0' }} />
      {!user ? (
        <div style={{ textAlign: 'center', padding: '8px 0 4px' }}>
          <Text type="secondary">登录后可查看免费额度、付费额度、用量与订单。</Text>
          <Button type="primary" icon={<LoginOutlined />} block style={{ marginTop: 12 }} onClick={() => goTo('/login?redirect=/query-center?tab=account')}>
            登录查询
          </Button>
        </div>
      ) : loading ? <Skeleton active paragraph={{ rows: 3 }} /> : summary ? (
        <div>
          <Space wrap style={{ marginBottom: 12 }}>
            <Tag color="blue">{summary.plan.toUpperCase()}</Tag>
            <Tag color={summary.credits.reconciled ? 'green' : 'orange'}>{summary.credits.reconciled ? '额度已对账' : '额度待迁移核对'}</Tag>
          </Space>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
            <Statistic title="总可用额度" value={summary.credits.total} />
            <Statistic title="本月调用" value={summary.monthUsage.calls} />
            <Statistic title="免费额度" value={summary.credits.free} />
            <Statistic title="付费额度" value={summary.credits.paid} />
          </div>
          {summary.credits.legacyProtected > 0 && <Text type="secondary">历史保护额度：{summary.credits.legacyProtected}</Text>}
          {summary.recentOrder && <div style={{ marginTop: 8 }}><Text type="secondary">最近订单：{summary.recentOrder.orderNo} · {summary.recentOrder.status}</Text></div>}
        </div>
      ) : <Text type="warning">{error || '暂无账户摘要'}</Text>}

      <Button type="primary" block icon={<SearchOutlined />} style={{ marginTop: 16 }} onClick={() => goTo('/query-center')}>
        进入完整查询中心
      </Button>
    </div>
  );

  const trigger = (
    <Button
      type={compact ? 'text' : 'default'}
      icon={<SearchOutlined />}
      aria-label="打开本站查询"
      onClick={isMobile ? () => onOpenChange(true) : undefined}
    >
      {compact ? null : '本站查询'}
    </Button>
  );

  if (isMobile) {
    return (
      <>
        {trigger}
        <Drawer title="本站查询" placement="right" width="min(92vw, 420px)" open={open} onClose={() => setOpen(false)}>
          {content}
        </Drawer>
      </>
    );
  }

  return <Popover placement="bottomRight" trigger="click" open={open} onOpenChange={onOpenChange} content={content}>{trigger}</Popover>;
}
