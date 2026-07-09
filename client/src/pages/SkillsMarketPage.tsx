import React, { useEffect, useState } from 'react';
import {
  Card,
  Typography,
  Tag,
  Modal,
  Input,
  Button,
  message,
  Spin,
  Empty,
  Divider,
  Space,
  Select,
  List,
} from 'antd';
import { AppstoreOutlined, ThunderboltOutlined, CopyOutlined } from '@ant-design/icons';
import { skillsAPI , extractApiError} from '@/services/api';

const { Title, Text, Paragraph } = Typography;

interface SkillManifest {
  id: string;
  name: string;
  description: string;
  division: string;
  color: string;
  coreMission: string;
  criticalRules: string[];
  successMetrics: string[];
  quotaResource?: string;
  minRole: string;
  requireAuth: boolean;
  marketable: boolean;
  userStory?: string;
  acceptanceCriteria?: string[];
}

const DIVISION_LABEL: Record<string, string> = {
  knowledge: '知识中枢',
  ai: 'AI 对话',
  media: '媒体生产',
  'customer-service': '智能客服',
  engineering: '工程',
  productivity: '生产力',
};

const SkillsMarketPage: React.FC = () => {
  const [skills, setSkills] = useState<SkillManifest[]>([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState<SkillManifest | null>(null);
  const [invokeOpen, setInvokeOpen] = useState(false);
  const [input, setInput] = useState('');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<any>(null);
  // skill-authoring 引导式表单状态
  const [authoring, setAuthoring] = useState<{ goal: string; division: string; name: string; description: string }>({
    goal: '',
    division: 'productivity',
    name: '',
    description: '',
  });
  // summarize 引导式表单状态
  const [summarizeForm, setSummarizeForm] = useState<{ text: string; length: string; lang: string }>({
    text: '',
    length: 'brief',
    lang: 'zh',
  });

  const isAuthoring = active?.id === 'skill-authoring';
  const isSummarize = active?.id === 'summarize';

  const load = async () => {
    setLoading(true);
    try {
      const res: any = await skillsAPI.list();
      setSkills(res.skills || []);
    } catch {
      message.error('技能名册加载失败');
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const openInvoke = (s: SkillManifest) => {
    setActive(s);
    setResult(null);
    if (s.id === 'skill-authoring') {
      setAuthoring({ goal: '', division: 'productivity', name: '', description: '' });
      setInput('');
      setInvokeOpen(true);
      return;
    }
    if (s.id === 'summarize') {
      setSummarizeForm({ text: '将以下长文提炼为要点：人工智能正在重塑知识工作……', length: 'brief', lang: 'zh' });
      setInput('');
      setInvokeOpen(true);
      return;
    }
    // 预填常见字段示例
    const sample: Record<string, any> = { teamId: '' };
    if (s.division === 'media') {
      sample.type = 'text2video';
      sample.prompt = '请输入生成描述';
      sample.duration = 5;
    } else if (s.id === 'video-pipeline') {
      sample.topic = '人工智能如何改变教育';
      sample.duration = 30;
    } else if (s.division === 'ai') {
      sample.message = '你好，介绍一下你自己';
    } else if (s.id === 'knowledge') {
      sample.action = 'search';
      sample.query = '';
    }
    setInput(JSON.stringify(sample, null, 2));
    setInvokeOpen(true);
  };

  const copyTs = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      message.success('已复制 TS 骨架到剪贴板');
    } catch {
      message.error('复制失败，请手动选择复制');
    }
  };

  const doInvoke = async () => {
    if (!active) return;
    let payload: any;
    if (isAuthoring) {
      if (!authoring.goal.trim()) {
        message.error('请先描述要沉淀的能力目标（goal）');
        return;
      }
      payload = {
        goal: authoring.goal.trim(),
        division: authoring.division,
        ...(authoring.name.trim() ? { name: authoring.name.trim() } : {}),
        ...(authoring.description.trim() ? { description: authoring.description.trim() } : {}),
      };
    } else if (isSummarize) {
      if (!summarizeForm.text.trim()) {
        message.error('请先粘贴待摘要的文本（text）');
        return;
      }
      payload = {
        text: summarizeForm.text.trim(),
        length: summarizeForm.length,
        lang: summarizeForm.lang,
      };
    } else {
      try {
        payload = JSON.parse(input || '{}');
      } catch {
        message.error('输入不是合法 JSON');
        return;
      }
    }
    setRunning(true);
    setResult(null);
    try {
      const res: any = await skillsAPI.invoke(active.id, payload);
      setResult(res);
      if (res.ok) message.success('调用成功');
      else message.warning(res.error || '调用返回异常');
    } catch (e) {
      message.error(extractApiError(e, '调用失败'));
    }
    setRunning(false);
  };

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      <Title level={3}>
        <AppstoreOutlined /> 技能市场
      </Title>
      <Paragraph type="secondary">
        基于 agency-agents 协议的能力名册：每个技能可声明、可插拔、可经配额网关与团队 RBAC 守卫调用。
        标注「可上架」的技能已对接开放 API 市场按量计费。
      </Paragraph>

      <Spin spinning={loading}>
        {skills.length === 0 && !loading ? (
          <Empty description="暂无技能" />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
            {skills.map((s) => (
              <Card
                key={s.id}
                hoverable
                title={
                  <Space>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: s.color, display: 'inline-block' }} />
                    {s.name}
                  </Space>
                }
                extra={<Tag color={s.marketable ? 'green' : 'default'}>{s.marketable ? '可上架' : '内部'}</Tag>}
              >
                <Paragraph style={{ minHeight: 44 }}>{s.description}</Paragraph>
                <Tag color="blue">{DIVISION_LABEL[s.division] || s.division}</Tag>
                {s.quotaResource && <Tag>配额:{s.quotaResource}</Tag>}
                <Divider style={{ margin: '12px 0' }} />
                <Text type="secondary" style={{ fontSize: 12 }}>
                  核心使命：{s.coreMission}
                </Text>
                {s.userStory && (
                  <div style={{ marginTop: 8 }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      用户故事：{s.userStory}
                    </Text>
                  </div>
                )}
                {s.acceptanceCriteria && s.acceptanceCriteria.length > 0 && (
                  <div style={{ marginTop: 8 }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      验收标准：
                    </Text>
                    <ul style={{ margin: '4px 0 0 18px', padding: 0, fontSize: 12, color: 'rgba(0,0,0,0.55)' }}>
                      {s.acceptanceCriteria.map((c, i) => (
                        <li key={i}>{c}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <div style={{ marginTop: 12 }}>
                  <Button type="primary" icon={<ThunderboltOutlined />} onClick={() => openInvoke(s)} block>
                    {s.id === 'skill-authoring' ? '描述目标并生成' : '调用技能'}
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </Spin>

      <Modal
        title={`调用技能：${active?.name}`}
        open={invokeOpen}
        onCancel={() => setInvokeOpen(false)}
        footer={[
          <Button key="cancel" onClick={() => setInvokeOpen(false)}>
            关闭
          </Button>,
          <Button key="run" type="primary" loading={running} onClick={doInvoke}>
            {isAuthoring ? '生成技能骨架' : isSummarize ? '生成摘要' : '执行'}
          </Button>,
        ]}
        width={680}
      >
        {active && (
          <>
            <Paragraph type="secondary">关键规则：{active.criticalRules.join('；')}</Paragraph>

            {isSummarize ? (
              <Space direction="vertical" style={{ width: '100%' }} size="middle">
                <div>
                  <Text strong>待摘要文本（text）</Text>
                  <Input.TextArea
                    value={summarizeForm.text}
                    onChange={(e) => setSummarizeForm((a) => ({ ...a, text: e.target.value }))}
                    autoSize={{ minRows: 4, maxRows: 10 }}
                    placeholder="粘贴需要提炼为要点的长文"
                    style={{ marginTop: 8 }}
                  />
                </div>
                <div>
                  <Text strong>摘要长度（length）</Text>
                  <Select
                    value={summarizeForm.length}
                    onChange={(v) => setSummarizeForm((a) => ({ ...a, length: v }))}
                    style={{ width: '100%', marginTop: 8 }}
                    options={[
                      { value: 'brief', label: '简明（默认）' },
                      { value: 'detailed', label: '详细' },
                    ]}
                  />
                </div>
                <div>
                  <Text strong>输出语种（lang）</Text>
                  <Select
                    value={summarizeForm.lang}
                    onChange={(v) => setSummarizeForm((a) => ({ ...a, lang: v }))}
                    style={{ width: '100%', marginTop: 8 }}
                    options={[
                      { value: 'zh', label: '中文' },
                      { value: 'en', label: '英文' },
                    ]}
                  />
                </div>
                <Paragraph type="secondary" style={{ fontSize: 12, marginBottom: 0 }}>
                  将调用统一 AI 网关把长文压缩为 <Text code>summary</Text> + <Text code>bullets</Text> 要点，无 Key 自动走 Mock。
                </Paragraph>
              </Space>
            ) : isAuthoring ? (
              <Space direction="vertical" style={{ width: '100%' }} size="middle">
                <div>
                  <Text strong>能力目标（goal）</Text>
                  <Input.TextArea
                    value={authoring.goal}
                    onChange={(e) => setAuthoring((a) => ({ ...a, goal: e.target.value }))}
                    autoSize={{ minRows: 3, maxRows: 6 }}
                    placeholder="例如：把用户上传的 PDF 自动总结为带要点的知识卡片"
                    style={{ marginTop: 8 }}
                  />
                </div>
                <div>
                  <Text strong>分类（division）</Text>
                  <Select
                    value={authoring.division}
                    onChange={(v) => setAuthoring((a) => ({ ...a, division: v }))}
                    style={{ width: '100%', marginTop: 8 }}
                    options={Object.entries(DIVISION_LABEL).map(([value, label]) => ({ value, label }))}
                  />
                </div>
                <div>
                  <Text strong>期望名称（可选）</Text>
                  <Input
                    value={authoring.name}
                    onChange={(e) => setAuthoring((a) => ({ ...a, name: e.target.value }))}
                    placeholder="留空则由模型生成 id/name"
                    style={{ marginTop: 8 }}
                  />
                </div>
                <div>
                  <Text strong>补充说明（可选）</Text>
                  <Input
                    value={authoring.description}
                    onChange={(e) => setAuthoring((a) => ({ ...a, description: e.target.value }))}
                    placeholder="额外的约束或上下文"
                    style={{ marginTop: 8 }}
                  />
                </div>
                <Paragraph type="secondary" style={{ fontSize: 12, marginBottom: 0 }}>
                  将调用统一 AI 网关生成 manifest + invoke 骨架，复制结果到 <Text code>server/src/skills/defs/</Text> 并注册即可上架。
                </Paragraph>
              </Space>
            ) : (
              <>
                <Text strong>输入参数（JSON）</Text>
                <Input.TextArea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  autoSize={{ minRows: 8, maxRows: 16 }}
                  style={{ fontFamily: 'monospace', marginTop: 8 }}
                />
              </>
            )}

            {result && (
              <div style={{ marginTop: 16 }}>
                <Text strong>返回结果</Text>
                <pre
                  style={{
                    background: '#0d1117',
                    color: '#c9d1d9',
                    padding: 12,
                    borderRadius: 6,
                    maxHeight: 320,
                    overflow: 'auto',
                    fontSize: 12,
                  }}
                >
                  {JSON.stringify(result, null, 2)}
                </pre>
                {isAuthoring && result?.data?.draft?.invokeSkeleton && (
                  <List
                    size="small"
                    header={<Text strong>生成产物</Text>}
                    dataSource={[
                      { k: 'manifest.id', v: result.data.draft.manifest?.id },
                      { k: 'manifest.name', v: result.data.draft.manifest?.name },
                      { k: 'manifest.division', v: result.data.draft.manifest?.division },
                    ].filter((x) => x.v)}
                    renderItem={(item) => (
                      <List.Item>
                        <Text code>{item.k}</Text>：{String(item.v)}
                      </List.Item>
                    )}
                  />
                )}

                {isAuthoring && result?.data?.tsFile && (
                  <div style={{ marginTop: 12 }}>
                    <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                      <Text strong>TS 骨架（一键复制）</Text>
                      <Button size="small" icon={<CopyOutlined />} onClick={() => copyTs(result.data.tsFile)}>
                        复制
                      </Button>
                    </Space>
                    <pre
                      style={{
                        background: '#0d1117',
                        color: '#c9d1d9',
                        padding: 12,
                        borderRadius: 6,
                        maxHeight: 280,
                        overflow: 'auto',
                        fontSize: 12,
                        marginTop: 8,
                      }}
                    >
                      {result.data.tsFile}
                    </pre>
                  </div>
                )}

                {isSummarize && result?.ok && result?.data && (
                  <div style={{ marginTop: 12 }}>
                    <Text strong>摘要</Text>
                    <Paragraph style={{ marginTop: 8, background: '#f6ffed', border: '1px solid #b7eb8f', padding: 12, borderRadius: 6 }}>
                      {result.data.summary}
                    </Paragraph>
                    {Array.isArray(result.data.bullets) && result.data.bullets.length > 0 && (
                      <>
                        <Text strong>要点</Text>
                        <ul style={{ margin: '8px 0 0 18px', padding: 0 }}>
                          {result.data.bullets.map((b: string, i: number) => (
                            <li key={i}>{b}</li>
                          ))}
                        </ul>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </Modal>
    </div>
  );
};

export default SkillsMarketPage;
