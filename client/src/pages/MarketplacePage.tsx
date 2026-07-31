import React, { useEffect, useState } from 'react';
import {
  Card, Typography, Button, Table, Tag, Modal, Form, Input, InputNumber, Switch,
  message, Space, Alert, Popconfirm, DatePicker, Spin
} from 'antd';
import {
  ApiOutlined, PlusOutlined, DeleteOutlined, CopyOutlined,
  DownloadOutlined, BarChartOutlined, DollarOutlined
} from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import { marketplaceAPI, extractApiError } from '@/services/api';

const { Title, Text, Paragraph } = Typography;
const { RangePicker } = DatePicker;

interface KeyRow {
  _id: string; name: string; prefix: string; quotaDaily: number;
  usedToday: number; remaining: number; creditsEnabled: boolean; status: string;
}

const MarketplacePage: React.FC = () => {
  const [list, setList] = useState<KeyRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [usage, setUsage] = useState<any>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [plainKey, setPlainKey] = useState<string | null>(null);
  const [form] = Form.useForm();

  // 用量报表状态
  const [reportOpen, setReportOpen] = useState(false);
  const [reportRange, setReportRange] = useState<[Dayjs, Dayjs]>([
    dayjs().subtract(30, 'day'), dayjs(),
  ]);
  const [reportData, setReportData] = useState<any>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [keys, u]: any = await Promise.all([marketplaceAPI.listKeys(), marketplaceAPI.usage()]);
      setList(keys.data || []);
      setUsage(u.data);
    } catch { /* ignore */ }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const createKey = async () => {
    try {
      const v = await form.validateFields();
      const res: any = await marketplaceAPI.createKey(v);
      if (res.data?.plainKey) {
        setPlainKey(res.data.plainKey);
        setCreateOpen(false);
        form.resetFields();
        load();
      } else {
        message.success('已创建');
        setCreateOpen(false);
        form.resetFields();
        load();
      }
    } catch (e) {
      message.error(extractApiError(e, '创建失败'));
    }
  };

  const revoke = async (id: string) => {
    try {
      await marketplaceAPI.revokeKey(id);
      message.success('已吊销');
      load();
    } catch { /* ignore */ }
  };

  const toggleCredits = async (id: string) => {
    try {
      const res: any = await marketplaceAPI.toggleCredits(id);
      if (res.data?.creditsEnabled !== undefined) {
        message.success(res.data.creditsEnabled ? '已开启积分抵扣' : '已关闭积分抵扣');
        load();
      }
    } catch (e) {
      message.error(extractApiError(e, '操作失败'));
    }
  };

  // 加载用量报表
  const loadReport = async () => {
    if (!reportRange || !reportRange[0] || !reportRange[1]) return;
    setReportLoading(true);
    try {
      const from = reportRange[0].format('YYYY-MM-DD');
      const to = reportRange[1].format('YYYY-MM-DD');
      const res: any = await marketplaceAPI.usageReport(from, to);
      setReportData(res.data);
    } catch (e) {
      message.error(extractApiError(e, '加载报表失败'));
    }
    setReportLoading(false);
  };

  // 导出 CSV
  const handleExport = async () => {
    if (!reportRange || !reportRange[0] || !reportRange[1]) return;
    setExporting(true);
    try {
      const from = reportRange[0].format('YYYY-MM-DD');
      const to = reportRange[1].format('YYYY-MM-DD');
      const res: any = await marketplaceAPI.exportUsage(from, to);
      const blob = res instanceof Blob ? res : new Blob([res.data ?? res], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `api-usage-${from}-${to}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      message.success('已导出');
    } catch (e) {
      message.error(extractApiError(e, '导出失败'));
    }
    setExporting(false);
  };

  const columns = [
    { title: '名称', dataIndex: 'name' },
    { title: '前缀', dataIndex: 'prefix', render: (p: string) => <Tag>{p}…</Tag> },
    { title: '日配额', dataIndex: 'quotaDaily' },
    { title: '今日已用', dataIndex: 'usedToday' },
    { title: '剩余', dataIndex: 'remaining', render: (r: number) => <Tag color={r > 0 ? 'success' : 'error'}>{r}</Tag> },
    {
      title: '积分抵扣', dataIndex: 'creditsEnabled',
      render: (e: boolean) => e ? <Tag color="orange"><DollarOutlined /> 已开启</Tag> : <Tag>关闭</Tag>,
    },
    {
      title: '操作', render: (_: any, r: KeyRow) => (
        <Space wrap>
          <Button type="link" size="small" onClick={() => toggleCredits(r._id)}>
            {r.creditsEnabled ? '关闭积分' : '开启积分'}
          </Button>
          <Popconfirm title="确认吊销该密钥？" onConfirm={() => revoke(r._id)}>
            <Button type="link" danger size="small" icon={<DeleteOutlined />}>吊销</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Title level={3}><ApiOutlined /> 开放 API 市场（按量计费）</Title>
      <Paragraph type="secondary">
        为你的应用/第三方开发者签发 API Key，按日配额计量调用。
        开启「积分抵扣」后配额耗尽时自动从会员积分扣减（10 积分 = 1 次调用），真正实现用量→计费→变现闭环。
      </Paragraph>
      {usage && (
        <Alert type="info" showIcon style={{ marginBottom: 16 }}
          message={`密钥总数 ${usage.keys} · 今日累计调用 ${usage.totalUsedToday} 次`} />
      )}

      <Space style={{ marginBottom: 16 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => { setCreateOpen(true); form.resetFields(); }}>创建密钥</Button>
        <Button icon={<BarChartOutlined />} onClick={() => setReportOpen(true)}>用量报表</Button>
      </Space>

      <Card>
        <Table rowKey="_id" loading={loading} dataSource={list} columns={columns} pagination={false} />
      </Card>

      {/* 创建密钥弹窗 */}
      <Modal title="创建 API 密钥" open={createOpen} onOk={createKey} onCancel={() => setCreateOpen(false)} okText="创建">
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="密钥名称" rules={[{ required: true, message: '请输入名称' }]}>
            <Input placeholder="如：官网小程序" />
          </Form.Item>
          <Form.Item name="quotaDaily" label="单日调用配额" initialValue={1000}>
            <InputNumber min={1} max={1000000} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="creditsEnabled" label="配额耗尽后自动使用积分抵扣（10 积分/次）" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>

      {/* 密钥展示弹窗 */}
      <Modal title="密钥已生成（请妥善保存）" open={!!plainKey} footer={null} onCancel={() => setPlainKey(null)}>
        {plainKey && (
          <Space direction="vertical" style={{ width: '100%' }}>
            <Text>明文仅展示一次：</Text>
            <Input readOnly value={plainKey} suffix={<CopyOutlined onClick={() => { navigator.clipboard.writeText(plainKey); message.success('已复制'); }} />} />
            <Text type="secondary">调用时放入请求头：<Tag>X-API-Key: {plainKey}</Tag></Text>
          </Space>
        )}
      </Modal>

      {/* 用量报表弹窗 */}
      <Modal
        title="用量账单报表"
        open={reportOpen}
        onCancel={() => setReportOpen(false)}
        width={760}
        footer={null}
      >
        <Space style={{ marginBottom: 16 }}>
          <RangePicker
            value={reportRange}
            onChange={(v) => v && setReportRange(v as [Dayjs, Dayjs])}
            allowClear={false}
          />
          <Button type="primary" loading={reportLoading} onClick={loadReport}>查询</Button>
          <Button icon={<DownloadOutlined />} loading={exporting} onClick={handleExport}>导出 CSV</Button>
        </Space>

        {reportLoading && <div style={{ textAlign: 'center', padding: 32 }}><Spin /></div>}

        {reportData && !reportLoading && (
          <>
            <Paragraph type="secondary">
              统计区间：{reportData.from} ~ {reportData.to} · 活跃密钥数：{(reportData.items || []).length}
            </Paragraph>
            {(!reportData.items || reportData.items.length === 0) ? (
              <Paragraph type="secondary">该区间暂无调用记录</Paragraph>
            ) : (
              reportData.items.map((item: any) => (
                <Card key={item.keyId} size="small" style={{ marginBottom: 12 }} title={<><ApiOutlined /> {item.prefix}… <Tag>{item.totalCalls} 次调用</Tag></>}>
                  <Table
                    rowKey="date"
                    pagination={false}
                    size="small"
                    dataSource={item.daily || []}
                    columns={[
                      { title: '日期', dataIndex: 'date' },
                      { title: '调用次数', dataIndex: 'calls' },
                      { title: '输入字节', dataIndex: 'promptBytes', render: (v: number) => `${(v / 1024).toFixed(1)} KB` },
                      { title: '输出字节', dataIndex: 'replyBytes', render: (v: number) => `${(v / 1024).toFixed(1)} KB` },
                    ]}
                  />
                </Card>
              ))
            )}
          </>
        )}
      </Modal>
    </div>
  );
};

export default MarketplacePage;
