import React, { useState } from 'react';
import {
  Card, Typography, Row, Col, Spin, Empty, Input, InputNumber, Select, Button, message,
} from 'antd';
import { ThunderboltOutlined } from '@ant-design/icons';
import { aiAPI, extractApiError } from '@/services/api';

const { Text, Paragraph } = Typography;
const { TextArea } = Input;

// ============ 通用 AI 工具组件（从 ToolsCenterPage 抽取，独立复用） ============
export interface ToolProps {
  icon: React.ReactNode;
  title: string;
  desc: string;
  inputs: {
    label: string;
    key: string;
    type: 'text' | 'textarea' | 'select' | 'number';
    placeholder?: string;
    options?: { label: string; value: string }[];
  }[];
  promptTemplate: (params: Record<string, any>) => string;
}

const AITool: React.FC<ToolProps> = ({ icon, title, desc, inputs, promptTemplate }) => {
  const [params, setParams] = useState<Record<string, any>>({});
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);

  const handleGenerate = async () => {
    const prompt = promptTemplate(params);
    if (!prompt) {
      message.warning('请填写必要参数');
      return;
    }
    setLoading(true);
    try {
      const res: any = await aiAPI.chat({ message: prompt });
      setResult(res?.message || 'AI 返回为空');
    } catch (e) {
      message.error(extractApiError(e, 'AI 请求失败'));
    }
    setLoading(false);
  };

  return (
    <Row gutter={16}>
      <Col xs={24} md={10}>
        <Card size="small" title={<span>{icon} {title}</span>} style={{ height: '100%' }}>
          <Paragraph type="secondary" style={{ fontSize: 13, marginBottom: 12 }}>{desc}</Paragraph>
          {inputs.map((inp) => (
            <div key={inp.key} style={{ marginBottom: 12 }}>
              <Text style={{ fontSize: 13 }}>{inp.label}</Text>
              {inp.type === 'textarea' ? (
                <TextArea rows={4} value={params[inp.key] || ''}
                  onChange={(e) => setParams((p) => ({ ...p, [inp.key]: e.target.value }))}
                  placeholder={inp.placeholder} />
              ) : inp.type === 'select' ? (
                <Select style={{ width: '100%' }} value={params[inp.key]}
                  onChange={(v) => setParams((p) => ({ ...p, [inp.key]: v }))}
                  options={inp.options} />
              ) : inp.type === 'number' ? (
                <InputNumber style={{ width: '100%' }} value={params[inp.key] || 3}
                  onChange={(v) => setParams((p) => ({ ...p, [inp.key]: v }))} min={1} max={20} />
              ) : (
                <Input value={params[inp.key] || ''}
                  onChange={(e) => setParams((p) => ({ ...p, [inp.key]: e.target.value }))}
                  placeholder={inp.placeholder} />
              )}
            </div>
          ))}
          <Button type="primary" block icon={<ThunderboltOutlined />} loading={loading} onClick={handleGenerate}>
            AI 生成
          </Button>
        </Card>
      </Col>
      <Col xs={24} md={14}>
        <Card size="small" title="生成结果">
          <div style={{ minHeight: 240, maxHeight: 500, overflowY: 'auto', whiteSpace: 'pre-wrap', fontSize: 14, lineHeight: 1.8 }}>
            {loading ? <div style={{ textAlign: 'center', padding: 40 }}><Spin size="large" /></div>
              : result || <Empty description="填写左侧参数后点击生成" />}
          </div>
        </Card>
      </Col>
    </Row>
  );
};

export default AITool;
