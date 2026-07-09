import React, { useEffect, useState } from 'react';
import { Card, Typography, Button, Row, Col, Tag, message, Empty, Spin, Tabs } from 'antd';
import {
  RocketOutlined, CustomerServiceOutlined, VideoCameraOutlined, ReadOutlined, CodeOutlined,
  MedicineBoxOutlined, BankOutlined, ToolOutlined, ShopOutlined,
} from '@ant-design/icons';
import { quickstartAPI, extractApiError } from '@/services/api';

const { Title, Text, Paragraph } = Typography;

const ICON_MAP: Record<string, React.ReactNode> = {
  CustomerService: <CustomerServiceOutlined />,
  VideoCamera: <VideoCameraOutlined />,
  Read: <ReadOutlined />,
  Code: <CodeOutlined />,
  MedicineBox: <MedicineBoxOutlined />,
  Bank: <BankOutlined />,
  Tool: <ToolOutlined />,
  Shop: <ShopOutlined />,
};

interface Tpl {
  id: string;
  name: string;
  desc: string;
  icon: string;
  modelHint: string;
  category?: 'generic' | 'industry';
  vertical?: string;
}

const VERTICAL_LABEL: Record<string, string> = {
  clinic: '诊所 / 卫生站',
  law: '律师事务所',
  training: '培训机构',
  factory: '工厂 / 车间',
};

const QuickstartPage: React.FC = () => {
  const [list, setList] = useState<Tpl[]>([]);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState<string | null>(null);
  const [tab, setTab] = useState<string>('all');

  const load = async () => {
    setLoading(true);
    try {
      const res: any = await quickstartAPI.templates();
      setList(res.data || []);
    } catch { /* ignore */ }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const apply = async (id: string) => {
    setApplying(id);
    try {
      const res: any = await quickstartAPI.apply(id);
      if (res.success) {
        message.success('模板已应用：已为你创建知识文档与合规客服机器人');
      } else {
        message.warning(res.error || '应用失败');
      }
    } catch (e) {
      message.error(extractApiError(e, '应用失败'));
    }
    setApplying(null);
  };

  const visible = tab === 'all' ? list : list.filter((t) => t.category === tab);

  return (
    <div>
      <Title level={3}><RocketOutlined /> 快速启动模板</Title>
      <Paragraph type="secondary">
        选择模板，一键生成「行业知识文档 + 智能客服机器人」，大幅降低上手门槛。
        <b>行业垂直模板</b>内置合规触发词（如诊所「胸痛」、律所「起诉」自动转人工），让诊所 / 律所 / 培训机构 / 工厂零技术即可上线可信客服。
      </Paragraph>
      <Tabs
        activeKey={tab}
        onChange={setTab}
        items={[
          { key: 'all', label: `全部 (${list.length})` },
          { key: 'generic', label: '通用场景' },
          { key: 'industry', label: `行业垂直 (${list.filter((t) => t.category === 'industry').length})` },
        ]}
      />
      <Spin spinning={loading}>
        {visible.length === 0 && !loading ? (
          <Empty description="暂无模板" />
        ) : (
          <Row gutter={[16, 16]}>
            {visible.map((t) => (
              <Col xs={24} sm={12} lg={6} key={t.id}>
                <Card
                  hoverable
                  title={<span>{ICON_MAP[t.icon] || <RocketOutlined />} {t.name}</span>}
                  extra={
                    t.category === 'industry'
                      ? <Tag color="orange">行业垂直{t.vertical ? ` · ${VERTICAL_LABEL[t.vertical] || t.vertical}` : ''}</Tag>
                      : <Tag color="blue">场景模板</Tag>
                  }
                  actions={[
                    <Button type="link" key="apply" loading={applying === t.id} onClick={() => apply(t.id)}>
                      一键应用
                    </Button>,
                  ]}
                >
                  <Paragraph style={{ minHeight: 44 }}>{t.desc}</Paragraph>
                  {t.category === 'industry' && (
                    <Tag color="green" style={{ marginBottom: 8 }}>合规触发词转人工</Tag>
                  )}
                  <br />
                  <Text type="secondary" style={{ fontSize: 12 }}>建议：{t.modelHint}</Text>
                </Card>
              </Col>
            ))}
          </Row>
        )}
      </Spin>
    </div>
  );
};

export default QuickstartPage;
