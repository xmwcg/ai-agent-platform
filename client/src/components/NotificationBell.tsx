import { useEffect, useState, useCallback } from 'react';
import { Badge, Popover, List, Button, Typography, Empty, Spin, Tag, Space } from 'antd';
import { BellOutlined, CheckOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const { Text, Paragraph } = Typography;

interface NotificationItem {
  _id: string;
  type: string;
  title: string;
  body: string;
  link?: string;
  isRead: boolean;
  createdAt: string;
}

const TYPE_TAG: Record<string, { color: string; label: string }> = {
  payment_success: { color: 'green', label: '支付' },
  report_ready: { color: 'blue', label: '报告' },
  refund_update: { color: 'orange', label: '退款' },
  subscription_expiry: { color: 'volcano', label: '到期' },
  commission_settled: { color: 'purple', label: '佣金' },
  system_notice: { color: 'default', label: '系统' },
  referral_bonus: { color: 'gold', label: '推荐' },
};

export default function NotificationBell() {
  const [unreadCount, setUnreadCount] = useState(0);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const fetchUnread = useCallback(async () => {
    try {
      const res = await axios.get('/api/notifications/unread-count');
      setUnreadCount(res?.data?.data?.count ?? 0);
    } catch {
      // 未登录或无网络时静默
    }
  }, []);

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/notifications?pageSize=10');
      setItems(res?.data?.data?.items ?? []);
      setUnreadCount(res?.data?.data?.unreadCount ?? 0);
    } catch {
      // 静默
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUnread();
    const timer = setInterval(fetchUnread, 60_000); // 每分钟轮询
    return () => clearInterval(timer);
  }, [fetchUnread]);

  const handleOpen = (visible: boolean) => {
    setOpen(visible);
    if (visible) fetchList();
  };

  const handleMarkAllRead = async () => {
    try {
      await axios.post('/api/notifications/read-all');
      setItems((prev) => prev.map((i) => ({ ...i, isRead: true })));
      setUnreadCount(0);
    } catch {
      // 静默
    }
  };

  const handleItemClick = async (item: NotificationItem) => {
    if (!item.isRead) {
      try {
        await axios.post(`/api/notifications/${item._id}/read`);
        setItems((prev) => prev.map((i) => (i._id === item._id ? { ...i, isRead: true } : i)));
        setUnreadCount((c) => Math.max(0, c - 1));
      } catch {
        // 静默
      }
    }
    if (item.link) {
      setOpen(false);
      navigate(item.link);
    }
  };

  const tag = TYPE_TAG[items[0]?.type] || { color: 'default', label: '通知' };

  const content = (
    <div style={{ width: 360, maxHeight: 480 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f0f0f0' }}>
        <Text strong>消息中心</Text>
        {unreadCount > 0 && (
          <Button type="link" size="small" icon={<CheckOutlined />} onClick={handleMarkAllRead}>
            全部已读
          </Button>
        )}
      </div>
      {loading ? (
        <div style={{ textAlign: 'center', padding: 24 }}><Spin /></div>
      ) : items.length === 0 ? (
        <Empty description="暂无消息" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      ) : (
        <List
          style={{ maxHeight: 380, overflow: 'auto' }}
          dataSource={items}
          renderItem={(item) => (
            <List.Item
              style={{
                cursor: 'pointer',
                padding: '10px 12px',
                background: item.isRead ? 'transparent' : '#f6f8ff',
                borderBottom: '1px solid #f5f5f5',
              }}
              onClick={() => handleItemClick(item)}
            >
              <List.Item.Meta
                avatar={
                  !item.isRead ? (
                    <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#6c5ce7', marginTop: 6 }} />
                  ) : (
                    <span style={{ display: 'inline-block', width: 8, height: 8, marginTop: 6 }} />
                  )
                }
                title={
                  <Space size={4}>
                    <Tag color={TYPE_TAG[item.type]?.color} style={{ fontSize: 11, lineHeight: '18px' }}>
                      {TYPE_TAG[item.type]?.label || '通知'}
                    </Tag>
                    <Text strong style={{ fontSize: 13 }}>{item.title}</Text>
                  </Space>
                }
                description={
                  <div>
                    <Paragraph ellipsis={{ rows: 1 }} style={{ fontSize: 12, marginBottom: 2, color: '#666' }}>
                      {item.body}
                    </Paragraph>
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      {new Date(item.createdAt).toLocaleString('zh-CN')}
                    </Text>
                  </div>
                }
              />
            </List.Item>
          )}
        />
      )}
    </div>
  );

  return (
    <Popover
      content={content}
      trigger="click"
      open={open}
      onOpenChange={handleOpen}
      placement="bottomRight"
      overlayStyle={{ maxWidth: 380 }}
    >
      <Badge count={unreadCount} size="small" offset={[-4, 4]}>
        <BellOutlined style={{ fontSize: 18, cursor: 'pointer', padding: 4 }} />
      </Badge>
    </Popover>
  );
}
