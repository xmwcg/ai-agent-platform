import { useState, useEffect } from 'react';
import {
  Card, Typography, Calendar, Tag, Badge, Select, Button, Space, Tooltip, Modal, List,
  Form, Input, message, Empty
} from 'antd';
import {
  CalendarOutlined, BellOutlined, RobotOutlined, PlusOutlined
} from '@ant-design/icons';
import axios from 'axios';
import { modelCalendarAPI , extractApiError} from '@/services/api';

const { Title, Paragraph, Text } = Typography;

interface ModelEvent {
  _id?: string;
  id?: string;
  modelName: string;
  vendor: string;
  releaseDate: string;
  type: 'release' | 'update' | 'deprecation';
  description?: string;
  highlights?: string[];
  source?: string;
}

const vendorColors: Record<string, string> = {
  OpenAI: 'green', Anthropic: 'purple', DeepSeek: 'blue', 腾讯: 'blue',
  阿里云: 'orange', Google: 'red', Meta: 'gray',
};

const FALLBACK: ModelEvent[] = [
  { modelName: 'GPT-4o', vendor: 'OpenAI', releaseDate: '2024-05-13', type: 'release', description: 'OpenAI 发布 GPT-4o，支持文本、图像、音频多模态理解。', highlights: ['多模态输入', '128K 上下文', '更快的推理速度'] },
  { modelName: 'Claude 3.5 Sonnet', vendor: 'Anthropic', releaseDate: '2024-06-20', type: 'release', description: 'Anthropic 发布 Claude 3.5 Sonnet，推理能力大幅提升。', highlights: ['Sonnet 级别价格', 'Opus 级别性能', '200K 上下文'] },
  { modelName: 'DeepSeek V3', vendor: 'DeepSeek', releaseDate: '2024-12-26', type: 'release', description: 'DeepSeek 发布 V3 模型，671B MoE 架构，性价比极高。', highlights: ['671B MoE', '128K 上下文', '价格仅为 GPT-4o 的 1/50'] },
  { modelName: '混元 Pro', vendor: '腾讯', releaseDate: '2024-09-01', type: 'update', description: '混元 Pro 更新，中文理解能力大幅提升。', highlights: ['中文优化', '多模态支持'] },
  { modelName: 'Qwen2.5-Max', vendor: '阿里云', releaseDate: '2024-09-19', type: 'release', description: '阿里云发布 Qwen2.5-Max，中文能力全面升级。', highlights: ['全系列', '中文基准第一'] },
  { modelName: 'DeepSeek R1', vendor: 'DeepSeek', releaseDate: '2025-01-20', type: 'release', description: 'DeepSeek R1 正式发布，开源推理模型新标杆。', highlights: ['强化学习训练', '数学推理 SOTA', '完全开源'] },
];

export default function ModelCalendarPage() {
  const [events, setEvents] = useState<ModelEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVendor, setSelectedVendor] = useState<string[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<ModelEvent | null>(null);
  const [vendors, setVendors] = useState<string[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [form] = Form.useForm();

  const loadEvents = async () => {
    setLoading(true);
    try {
      const res: any = await modelCalendarAPI.list(
        selectedVendor.length ? { vendor: selectedVendor.join(',') } : undefined
      );
      const list: ModelEvent[] = res.data || [];
      setEvents(list.length ? list : FALLBACK);
      if (res.vendors) setVendors(res.vendors);
    } catch {
      setEvents(FALLBACK);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadEvents(); }, [selectedVendor]);

  const filteredEvents = selectedVendor.length
    ? events.filter((e) => selectedVendor.includes(e.vendor))
    : events;

  const dateCellRender = (date: any) => {
    const dateStr = date.format('YYYY-MM-DD');
    const dayEvents = filteredEvents.filter((e) => e.releaseDate === dateStr);
    if (dayEvents.length === 0) return null;
    return (
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {dayEvents.map((event) => (
          <li key={event._id || event.id || event.modelName} style={{ marginBottom: 4 }}>
            <Tooltip title={`${event.modelName}（${event.vendor}）`}>
              <Badge
                status={event.type === 'release' ? 'success' : event.type === 'update' ? 'processing' : 'default'}
                text={
                  <span style={{ cursor: 'pointer', fontSize: 12 }} onClick={() => setSelectedEvent(event)}>
                    {event.vendor.slice(0, 2)}… {event.modelName}
                  </span>
                }
              />
            </Tooltip>
          </li>
        ))}
      </ul>
    );
  };

  const handleAdd = async () => {
    try {
      const values = await form.validateFields();
      await modelCalendarAPI.create(values);
      message.success('已提交模型动态');
      setAddOpen(false);
      form.resetFields();
      loadEvents();
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 401) {
        message.warning('请先登录后再提交');
      } else {
        message.error(extractApiError(err, '提交失败'));
      }
    }
  };

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <Space>
            <CalendarOutlined style={{ fontSize: 24, color: '#1890ff' }} />
            <Title level={3} style={{ margin: 0 }}>模型发布日历</Title>
            <Badge count={filteredEvents.length} showZero color="blue" />
          </Space>
          <Space wrap>
            <Select
              mode="multiple"
              placeholder="筛选厂商"
              value={selectedVendor}
              onChange={setSelectedVendor}
              style={{ minWidth: 200 }}
              options={vendors.map((v) => ({ label: v, value: v }))}
              maxTagCount={2}
              allowClear
            />
            <Button icon={<PlusOutlined />} onClick={() => setAddOpen(true)}>添加动态</Button>
            <Button icon={<BellOutlined />} onClick={() => message.info('已开启新模型发布提醒（示例）')}>订阅推送</Button>
          </Space>
        </div>
        <Paragraph type="secondary">
          追踪各 AI 厂商模型发布动态，点击日期查看详情，支持按厂商筛选与自定义关注。
        </Paragraph>
      </Card>

      <Card>
        {loading && events.length === 0 ? (
          <Empty description="加载中…" />
        ) : (
          <Calendar
            dateCellRender={dateCellRender}
            onSelect={(date) => {
              const dateStr = date.format('YYYY-MM-DD');
              const dayEvents = filteredEvents.filter((e) => e.releaseDate === dateStr);
              if (dayEvents.length > 0) setSelectedEvent(dayEvents[0]);
            }}
          />
        )}
      </Card>

      <Modal
        title={
          <Space>
            <RobotOutlined />
            <span>{selectedEvent?.modelName}</span>
            {selectedEvent && (
              <Tag color={vendorColors[selectedEvent.vendor] || 'default'}>{selectedEvent.vendor}</Tag>
            )}
          </Space>
        }
        open={!!selectedEvent}
        onCancel={() => setSelectedEvent(null)}
        footer={[<Button key="close" onClick={() => setSelectedEvent(null)}>关闭</Button>]}
        width={600}
      >
        {selectedEvent && (
          <div>
            <Paragraph>
              <Text type="secondary">发布日期：</Text>
              <Text strong>{selectedEvent.releaseDate}</Text>
            </Paragraph>
            <Paragraph>{selectedEvent.description}</Paragraph>
            {selectedEvent.highlights && (
              <div style={{ marginTop: 16 }}>
                <Text strong>主要亮点：</Text>
                <List
                  size="small"
                  dataSource={selectedEvent.highlights}
                  renderItem={(item: string) => (
                    <List.Item>
                      <BellOutlined style={{ color: '#52c41a', marginRight: 8 }} />
                      {item}
                    </List.Item>
                  )}
                  style={{ marginTop: 8 }}
                />
              </div>
            )}
          </div>
        )}
      </Modal>

      <Modal
        title="添加模型动态"
        open={addOpen}
        onCancel={() => setAddOpen(false)}
        onOk={handleAdd}
        okText="提交"
        cancelText="取消"
      >
        <Form form={form} layout="vertical">
          <Form.Item name="modelName" label="模型名称" rules={[{ required: true, message: '请输入模型名称' }]}>
            <Input placeholder="例如：GPT-5" />
          </Form.Item>
          <Form.Item name="vendor" label="厂商" rules={[{ required: true, message: '请输入厂商' }]}>
            <Input placeholder="例如：OpenAI" />
          </Form.Item>
          <Form.Item name="releaseDate" label="发布日期" rules={[{ required: true, message: '请选择日期' }]}>
            <Input type="date" />
          </Form.Item>
          <Form.Item name="type" label="类型" initialValue="release">
            <Select options={[
              { value: 'release', label: '发布' },
              { value: 'update', label: '更新' },
              { value: 'deprecation', label: '下线' },
            ]} />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
