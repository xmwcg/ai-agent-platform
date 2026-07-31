import { useEffect, useState } from 'react';
import {
  Card, Typography, Input, Button, Space, Spin, Empty,
  Select, Alert, Tag, Divider, InputNumber
} from 'antd';
import {
  EditOutlined, CopyOutlined, ThunderboltOutlined, ReloadOutlined
} from '@ant-design/icons';
import { xhsAPI, extractApiError } from '@/services/api';

const { Title, Paragraph, Text } = Typography;
const { TextArea } = Input;

interface XhsAgentMeta {
  id: 'copywriter' | 'architect' | 'frontend' | 'devops';
  name: string;
  description: string;
}

interface XhsStructured {
  title?: string;
  body?: string;
  hashtags?: string[];
  imageSuggestions?: string[];
}

interface XhsResult {
  role: string;
  agentName: string;
  reply: string;
  structured?: XhsStructured;
}

const STYLE_OPTIONS = [
  { label: '种草分享（推荐）', value: '种草分享' },
  { label: '专业测评', value: '专业测评' },
  { label: '搞笑吐槽', value: '搞笑吐槽' },
  { label: '职场干货', value: '职场干货' },
  { label: '情感故事', value: '情感故事' },
  { label: '极简高级', value: '极简高级' },
];

export default function XiaohongshuGenerator() {
  const [agents, setAgents] = useState<XhsAgentMeta[]>([]);
  const [role, setRole] = useState<XhsAgentMeta['id']>('copywriter');
  const [product, setProduct] = useState('');
  const [audience, setAudience] = useState('');
  const [style, setStyle] = useState<string>('种草分享');
  const [keywords, setKeywords] = useState('');
  const [count, setCount] = useState(1);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<XhsResult | null>(null);

  useEffect(() => {
    xhsAPI.agents()
      .then((res: any) => {
        if (Array.isArray(res?.data)) setAgents(res.data);
      })
      .catch(() => { /* 角色列表获取失败时保留空，不影响核心生成 */ });
  }, []);

  const handleGenerate = async () => {
    if (!product.trim()) {
      setError('请填写产品卖点 / 主题');
      return;
    }
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const res: any = await xhsAPI.generate({
        role,
        product: product.trim(),
        audience: audience.trim() || undefined,
        style: role === 'copywriter' ? style : undefined,
        keywords: keywords.trim() || undefined,
        count: role === 'copywriter' ? count : undefined,
      });
      if (res?.data) {
        setResult(res.data as XhsResult);
      } else {
        setError('未获取到生成结果');
      }
    } catch (err) {
      setError(extractApiError(err, '生成失败，请稍后重试'));
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!result) return;
    const s = result.structured;
    const text = s
      ? `${s.title || ''}\n\n${s.body || ''}\n\n${s.hashtags?.join(' ') || ''}\n\n配图建议：\n${(s.imageSuggestions || []).map((x, i) => `${i + 1}. ${x}`).join('\n')}`
      : result.reply;
    navigator.clipboard?.writeText(text).catch(() => { /* 忽略剪贴板异常 */ });
  };

  const renderResult = () => {
    if (loading) return <Spin tip="专家正在创作中…" style={{ width: '100%', padding: 48 }} />;
    if (error) return <Alert type="error" showIcon message={error} />;
    if (!result) return <Empty description="填写左侧信息后点击「开始生成」" />;

    const s = result.structured;
    return (
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        <Tag color="purple">{result.agentName}</Tag>
        {s?.title && (
          <div>
            <Text strong>标题</Text>
            <Paragraph style={{ fontSize: 18, fontWeight: 600, marginBottom: 0 }}>{s.title}</Paragraph>
          </div>
        )}
        {s?.body && (
          <div>
            <Text strong>正文</Text>
            <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.8 }}>{s.body}</div>
          </div>
        )}
        {s?.hashtags && s.hashtags.length > 0 && (
          <div>
            <Text strong>话题标签</Text>
            <div style={{ marginTop: 6 }}>
              {s.hashtags.map((t, i) => <Tag key={i} color="magenta">{t}</Tag>)}
            </div>
          </div>
        )}
        {s?.imageSuggestions && s.imageSuggestions.length > 0 && (
          <div>
            <Text strong>配图建议</Text>
            <ul style={{ margin: '6px 0 0', paddingLeft: 20 }}>
              {s.imageSuggestions.map((x, i) => <li key={i}>{x}</li>)}
            </ul>
          </div>
        )}
        {!s && (
          <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.8 }}>{result.reply}</div>
        )}
      </Space>
    );
  };

  return (
    <div>
      <Title level={3} style={{ marginBottom: 4 }}>
        <EditOutlined style={{ color: '#eb2f96', marginRight: 8 }} />
        小红书爆款文案生成器
      </Title>
      <Paragraph type="secondary" style={{ marginTop: 0 }}>
        整合自 ADP 应用包「小红书爆款文案生成器」，提供 4 位专家角色协同：文案生成、系统架构、前端组件、部署运维。
      </Paragraph>

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        {/* 左侧：输入表单 */}
        <Card style={{ flex: '1 1 360px', minWidth: 320 }}>
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <div>
              <Text strong>专家角色</Text>
              <Select
                style={{ width: '100%', marginTop: 6 }}
                value={role}
                onChange={setRole}
                options={agents.length
                  ? agents.map((a) => ({ label: a.name, value: a.id }))
                  : [
                      { label: '文案生成专家', value: 'copywriter' },
                      { label: '系统架构师', value: 'architect' },
                      { label: '前端开发助手', value: 'frontend' },
                      { label: '部署运维助手', value: 'devops' },
                    ]}
              />
              <Text type="secondary" style={{ fontSize: 12 }}>
                {agents.find((a) => a.id === role)?.description}
              </Text>
            </div>

            <div>
              <Text strong>产品卖点 / 主题 <Text type="danger">*</Text></Text>
              <TextArea
                rows={3}
                style={{ marginTop: 6 }}
                placeholder="例如：一款轻薄便携的保温杯，6 小时保温，颜值高，适合通勤"
                value={product}
                onChange={(e) => setProduct(e.target.value)}
              />
            </div>

            <div>
              <Text strong>目标受众</Text>
              <Input
                style={{ marginTop: 6 }}
                placeholder="例如：20-30 岁职场女性"
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
              />
            </div>

            {role === 'copywriter' && (
              <>
                <div>
                  <Text strong>风格 / 语气</Text>
                  <Select
                    style={{ width: '100%', marginTop: 6 }}
                    value={style}
                    onChange={setStyle}
                    options={STYLE_OPTIONS}
                  />
                </div>
                <div>
                  <Text strong>生成条数</Text>
                  <InputNumber
                    style={{ marginLeft: 12, width: 120 }}
                    min={1}
                    max={5}
                    value={count}
                    onChange={(v) => setCount(v || 1)}
                  />
                </div>
              </>
            )}

            <div>
              <Text strong>关键词 / 补充卖点</Text>
              <TextArea
                rows={2}
                style={{ marginTop: 6 }}
                placeholder="例如：大容量、食品级材质、送礼佳品"
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
              />
            </div>

            <Space>
              <Button
                type="primary"
                icon={<ThunderboltOutlined />}
                loading={loading}
                onClick={handleGenerate}
              >
                开始生成
              </Button>
              <Button icon={<ReloadOutlined />} onClick={() => { setResult(null); setError(''); }}>
                清空结果
              </Button>
            </Space>
          </Space>
        </Card>

        {/* 右侧：结果展示 */}
        <Card
          style={{ flex: '1 1 420px', minWidth: 320 }}
          title="生成结果"
          extra={result ? <Button size="small" icon={<CopyOutlined />} onClick={handleCopy}>复制</Button> : null}
        >
          {renderResult()}
        </Card>
      </div>

      <Divider />
      <Paragraph type="secondary" style={{ fontSize: 12 }}>
        文案由平台统一 AI 网关生成，走默认模型策略与 fallback；需在服务端配置可用的厂商 Key（如 DEEPSEEK_API_KEY）或启用 ENABLE_MOCK_MODE。
      </Paragraph>
    </div>
  );
}
