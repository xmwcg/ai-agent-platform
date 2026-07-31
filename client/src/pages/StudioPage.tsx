import React, { useEffect, useRef, useState } from 'react';
import {
  Card, Tabs, Input, Select, Button, Progress, Tag, message, Spin, Empty, Typography, Divider, Alert,
} from 'antd';
import { studioApi } from '@/services/studio';

const { TextArea } = Input;
const { Title, Paragraph, Text } = Typography;

interface SceneDef {
  id: string;
  name: string;
  tagline: string;
  description: string;
  tier: string;
  steps: string[];
  inputs: any[];
}
interface JobOut {
  videoUrl?: string;
  images?: string[];
  copy?: string;
  creditsCost?: number;
}

const TIER_TAG: Record<string, { color: string; text: string }> = {
  free: { color: 'green', text: '免费可用' },
  pro: { color: 'gold', text: 'Pro 及以上' },
  max: { color: 'purple', text: 'Max' },
};

export default function StudioPage() {
  const [scenes, setScenes] = useState<SceneDef[]>([]);
  const [balance, setBalance] = useState<{ credits: number; plan: string }>({ credits: 0, plan: 'free' });
  const [activeScene, setActiveScene] = useState<string>('');
  const [form, setForm] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(false);
  const [cost, setCost] = useState<number | null>(null);
  const [job, setJob] = useState<any>(null);
  const [outputs, setOutputs] = useState<JobOut | null>(null);
  const timer = useRef<any>(null);

  useEffect(() => {
    loadMeta();
    return () => timer.current && clearInterval(timer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadMeta() {
    const [s, b] = await Promise.all([studioApi.scenes(), studioApi.balance()]);
    if (s.ok) {
      const list: SceneDef[] = s.data.data || [];
      setScenes(list);
      if (list.length) setActiveScene(list[0].id);
    }
    if (b.ok) setBalance(b.data.data || { credits: 0, plan: 'free' });
  }

  function onField(key: string, val: any) {
    setForm((f) => ({ ...f, [key]: val }));
    setCost(null);
  }

  async function submit() {
    const scene = scenes.find((x) => x.id === activeScene);
    if (!scene) return;
    for (const inp of scene.inputs) {
      if (inp.required && !String(form[inp.key] || '').trim()) {
        message.warning(`请填写：${inp.label}`);
        return;
      }
    }
    setLoading(true);
    setOutputs(null);
    setJob(null);
    setCost(null);
    const r = await studioApi.create({ sceneId: activeScene, fields: form });
    setLoading(false);
    if (!r.ok) {
      message.error(r.data?.error || '创建失败');
      if (r.data?.code === 'INSUFFICIENT_CREDITS') {
        message.info('可前往「我的密钥」绑定 DeepSeek / 火山 Ark 自带 Key 免算力，或充值积分');
      }
      return;
    }
    const { jobId, creditsCost } = r.data.data;
    setCost(creditsCost);
    setBalance((b) => ({ ...b, credits: Math.max(0, b.credits - creditsCost) }));
    poll(jobId);
  }

  function poll(jobId: string) {
    if (timer.current) clearInterval(timer.current);
    timer.current = setInterval(async () => {
      const r = await studioApi.job(jobId);
      if (r.ok) {
        setJob(r.data.data);
        if (['success', 'failed'].includes(r.data.data.status)) {
          clearInterval(timer.current);
          if (r.data.data.status === 'success') setOutputs(r.data.data.outputs || {});
          else message.error('任务失败：' + (r.data.data.error || ''));
        }
      }
    }, 3000);
  }

  const scene = scenes.find((x) => x.id === activeScene);
  const doneSteps = (job?.steps || []).filter((s: any) => s.status === 'done').length;
  const totalSteps = (job?.steps || []).length || 1;
  const pct = Math.round((doneSteps / totalSteps) * 100);

  const renderField = (inp: any) => {
    const common = { value: form[inp.key], onChange: (v: any) => onField(inp.key, v), placeholder: inp.placeholder, style: { width: '100%' } };
    if (inp.type === 'textarea')
      return <TextArea rows={3} {...common} />;
    if (inp.type === 'select')
      return <Select {...common} options={(inp.options || []).map((o: string) => ({ label: o, value: o }))} />;
    if (inp.type === 'number')
      return <Input type="number" min={inp.min} max={inp.max} {...common} />;
    return <Input {...common} />;
  };

  return (
    <div style={{ maxWidth: 1080, margin: '0 auto', padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 8 }}>
        <img src="/brand/NexMind-LOGO-深色底.svg" alt="NexMind" style={{ height: 36 }} />
        <Title level={3} style={{ margin: 0 }}>
          NexMind 创作工坊
        </Title>
        <div style={{ flex: 1 }} />
        <Tag color="blue">积分余额：{balance.credits}</Tag>
        <Tag color={balance.plan === 'free' ? 'default' : 'gold'}>会员：{balance.plan}</Tag>
      </div>
      <Paragraph type="secondary">
        脚本 → 配音 → 字幕 → 配乐 → 竖屏成片；数字人；电商图文。生产即扣积分，自带 Key 免算力。
      </Paragraph>

      <Tabs
        activeKey={activeScene}
        onChange={(k) => {
          setActiveScene(k);
          setForm({});
          setOutputs(null);
          setJob(null);
          setCost(null);
        }}
        items={scenes.map((s) => ({
          key: s.id,
          label: (
            <span>
              {s.name}
              {TIER_TAG[s.tier] && (
                <Tag color={TIER_TAG[s.tier].color} style={{ marginLeft: 6 }}>
                  {TIER_TAG[s.tier].text}
                </Tag>
              )}
            </span>
          ),
          children: (
            <Card>
              <Paragraph type="secondary">{s.description}</Paragraph>
              <Divider style={{ margin: '12px 0' }} />
              {s.inputs.map((inp: any) => (
                <div key={inp.key} style={{ marginBottom: 14 }}>
                  <Text strong>
                    {inp.label}
                    {inp.required && <span style={{ color: '#ff4d4f' }}> *</span>}
                  </Text>
                  <div style={{ marginTop: 6 }}>{renderField(inp)}</div>
                  {inp.help && (
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {inp.help}
                    </Text>
                  )}
                </div>
              ))}
              <Divider style={{ margin: '12px 0' }} />
              <Button type="primary" loading={loading} onClick={submit} block>
                生成（消耗约 {cost ?? '?'} 积分）
              </Button>
              <Alert
                style={{ marginTop: 12 }}
                type="info"
                showIcon
                message="没有积分？"
                description="在「我的密钥」中绑定自己的 DeepSeek / 火山 Ark Key，即可免平台算力积分；或前往定价页充值。"
              />
            </Card>
          ),
        }))}
      />

      {job && (
        <Card title={`任务进度（${job.status}）`} style={{ marginTop: 16 }}>
          <Progress percent={pct} status={job.status === 'failed' ? 'exception' : job.status === 'success' ? 'success' : 'active'} />
          {(job.steps || []).map((s: any) => (
            <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '4px 0' }}>
              <Tag color={s.status === 'done' ? 'green' : s.status === 'error' ? 'red' : 'blue'}>{s.label}</Tag>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {s.status === 'error' ? s.message : s.status}
              </Text>
            </div>
          ))}
        </Card>
      )}

      {outputs && (
        <Card title="生成结果" style={{ marginTop: 16 }}>
          {outputs.videoUrl && (
            <video src={outputs.videoUrl} controls style={{ width: '100%', maxHeight: 520, background: '#000' }} />
          )}
          {outputs.images && outputs.images.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
              {outputs.images.map((u: string, i: number) => (
                <img key={i} src={u} alt={`img-${i}`} style={{ width: 160, borderRadius: 8, border: '1px solid #303030' }} />
              ))}
            </div>
          )}
          {outputs.copy && (
            <pre style={{ whiteSpace: 'pre-wrap', background: '#141414', padding: 12, borderRadius: 8, marginTop: 8 }}>
              {outputs.copy}
            </pre>
          )}
          {!outputs.videoUrl && !(outputs.images && outputs.images.length) && !outputs.copy && (
            <Empty description="无产物" />
          )}
        </Card>
      )}
    </div>
  );
}
