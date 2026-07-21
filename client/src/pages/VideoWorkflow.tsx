import { useEffect, useState } from 'react';
import {
  Card, Typography, Button, Space, Input, Select, InputNumber, Spin, Alert,
  Steps, Tag, Divider, message, Switch,
} from 'antd';
import {
  VideoCameraOutlined, RocketOutlined, DownloadOutlined, ReloadOutlined,
  ApiOutlined, ShareAltOutlined,
} from '@ant-design/icons';
import { skillsAPI, gatewayAPI, extractApiError } from '@/services/api';
import ModelSelector from '@/components/ModelSelector';
import PageHeader from '@/components/PageHeader';

const { Title, Paragraph, Text } = Typography;
const { TextArea } = Input;

interface StageResult {
  research?: { content: string; provider?: string; model?: string };
  script?: { content: string; provider?: string; model?: string };
  compose?: any;
}
interface GatewayModelGroup {
  provider: string;
  label: string;
  models: string[];
  custom?: boolean;
}

/** 在可用模型列表中定位 Agnes-2.0-Flash（用户自定义的免费第三方模型） */
function findAgnes(groups: GatewayModelGroup[]): string | undefined {
  for (const g of groups) {
    if (/agnes|flash/i.test(g.label)) return `${g.provider}/${g.models[0]}`;
    const m = (g.models || []).find((x) => /agnes|flash/i.test(x));
    if (m) return `${g.provider}/${m}`;
  }
  return undefined;
}

export default function VideoWorkflow() {
  const [topic, setTopic] = useState('');
  const [style, setStyle] = useState('自然专业');
  const [duration, setDuration] = useState(30);
  const [model, setModel] = useState<string>('');
  const [compose, setCompose] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<StageResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string>('');
  const [videoStatus, setVideoStatus] = useState<'idle' | 'processing' | 'completed' | 'failed'>('idle');

  // 加载可用模型（内置 + 用户自定义第三方模型），默认选中 Agnes-2.0-Flash
  useEffect(() => {
    gatewayAPI
      .getModels()
      .then((res: any) => {
        const groups: GatewayModelGroup[] = res?.data;
        if (Array.isArray(groups) && groups.length) {
          const agnes = findAgnes(groups);
          if (agnes) setModel(agnes);
          else {
            const first = groups.find((g) => (g.models || []).length > 0);
            if (first && first.models[0]) setModel(`${first.provider}/${first.models[0]}`);
          }
        }
      })
      .catch(() => { /* 模型列表加载失败不影响主题输入，流水线会用平台默认模型 */ });
  }, []);

  // 成片合成任务提交后，轮询上游状态；完成后拿到可播放/可下载/可分享的成片地址
  useEffect(() => {
    const task = result?.compose;
    if (!task?.taskId || !task?.provider) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    const provider = task.provider;
    const taskId = task.taskId;
    const pollOnce = async () => {
      try {
        const resp = await fetch(`/api/tools/media/task/${provider}/${taskId}`, { credentials: 'include' });
        const json: any = await resp.json();
        const data = json?.data;
        if (!active) return;
        if (data?.status === 'completed' && data?.outputUrl) {
          setVideoUrl(data.outputUrl);
          setVideoStatus('completed');
        } else if (['failed', 'error', 'cancelled'].includes(data?.status)) {
          setVideoStatus('failed');
        } else {
          setVideoStatus('processing');
          timer = setTimeout(pollOnce, 4000);
        }
      } catch {
        if (!active) return;
        setVideoStatus('processing');
        timer = setTimeout(pollOnce, 4000);
      }
    };
    pollOnce();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [result]);

  const handleGenerate = async () => {
    if (!topic.trim()) { message.warning('请先输入视频主题'); return; }
    setLoading(true);
    setError(null);
    setResult(null);
    setVideoUrl('');
    setVideoStatus('idle');
    try {
      const payload: Record<string, any> = {
        topic: topic.trim(),
        duration,
        style,
        compose,
      };
      // 把 "provider/model" 拆成网关可寻址的 provider + model（自定义模型为 mc_<id>/xxx）
      if (model && model.includes('/')) {
        const idx = model.indexOf('/');
        payload.provider = model.slice(0, idx);
        payload.model = model;
      }
      const res: any = await skillsAPI.invoke('video-pipeline', payload, { timeout: 300000 });
      const skillResult = res?.data?.result || res?.result || res?.data || res;
      if (skillResult?.ok === false) {
        setError(skillResult.error || '视频流水线执行失败');
      } else {
        const stages: StageResult = skillResult?.data?.stages || skillResult?.stages || {};
        setResult(stages);
      }
    } catch (err) {
      setError(extractApiError(err, '生成失败，请稍后重试'));
    }
    setLoading(false);
  };

  const handleDownload = () => {
    if (!result) return;
    const content =
      `短视频创作方案\n主题：${topic}\n风格：${style}\n时长：${duration} 秒\n模型：${model || '平台默认'}\n\n` +
      `【调研】\n${result.research?.content || '（无）'}\n\n` +
      `【口播脚本与分镜】\n${result.script?.content || '（无）'}\n`;
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `短视频方案-${topic.slice(0, 12) || 'topic'}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const composeTask = result?.compose;
  const currentStep = loading ? 1 : result ? 2 : 0;

  return (
    <div style={{ maxWidth: 920, margin: '0 auto' }}>
      <PageHeader title="短视频工作流" subtitle="输入主题，AI 完成调研 → 脚本 → 分镜 → 字幕，可一键合成成片" icon={<VideoCameraOutlined />} />

      <Card style={{ marginBottom: 16 }}>
        <Space direction="vertical" style={{ width: '100%' }} size={16}>
          <div>
            <Text strong>视频主题</Text>
            <TextArea
              rows={3}
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="例如：三分钟讲清楚什么是向量数据库"
              style={{ marginTop: 6 }}
            />
          </div>

          <div>
            <Text strong><ApiOutlined /> 生成模型</Text>
            <div style={{ marginTop: 6 }}>
              <ModelSelector
                value={model}
                onChange={setModel}
                placeholder="选择用于调研/脚本的模型"
                style={{ width: '100%' }}
              />
              <Text type="secondary" style={{ fontSize: 12 }}>
                支持内置厂商与你在「模型配置」中添加的免费自定义第三方模型（如 Agnes-2.0-Flash）。
              </Text>
            </div>
          </div>

          <Space wrap>
            <div>
              <Text type="secondary">风格</Text>
              <Select
                value={style}
                onChange={setStyle}
                style={{ width: 160, marginLeft: 8 }}
                options={[
                  { label: '自然专业', value: '自然专业' },
                  { label: '活泼接地气', value: '活泼接地气' },
                  { label: '知识科普', value: '知识科普' },
                  { label: '情感共鸣', value: '情感共鸣' },
                ]}
              />
            </div>
            <div>
              <Text type="secondary">目标时长（秒）</Text>
              <InputNumber
                min={15}
                max={300}
                step={5}
                value={duration}
                onChange={(v) => setDuration(v || 0)}
                style={{ width: 120, marginLeft: 8 }}
              />
            </div>
          </Space>

          <div>
            <Space>
              <Switch checked={compose} onChange={setCompose} />
              <Text>
                生成后合成成片（Agnes 视频模型）
                <Text type="secondary" style={{ fontSize: 12 }}> — 开启后将真实调用视频模型产出成片，可在下方播放、下载与分享</Text>
              </Text>
            </Space>
          </div>

          <Space>
            <Button type="primary" icon={<RocketOutlined />} loading={loading} onClick={handleGenerate}>
              {loading ? '生成中…' : compose ? '生成并合成成片' : '生成短视频方案'}
            </Button>
            {result && (
              <Button icon={<DownloadOutlined />} onClick={handleDownload}>下载方案</Button>
            )}
            {result && (
              <Button icon={<ReloadOutlined />} onClick={() => { setResult(null); setError(null); }}>重新生成</Button>
            )}
          </Space>
        </Space>
      </Card>

      {loading && (
        <Card style={{ textAlign: 'center', padding: 48 }}>
          <Spin size="large" />
          <Paragraph style={{ marginTop: 16, color: 'var(--text-secondary)' }}>
            AI 正在调研并撰写脚本，请稍候…
          </Paragraph>
        </Card>
      )}

      {error && (
        <Alert
          type="error"
          showIcon
          message="生成失败"
          description={error}
          style={{ marginBottom: 16 }}
          action={<Button size="small" onClick={handleGenerate}>重试</Button>}
        />
      )}

      {result && !loading && (
        <Card>
          <Steps
            size="small"
            current={currentStep}
            items={[
              { title: '调研', description: result.research ? `模型 ${result.research.model || result.research.provider || 'AI'}` : '—' },
              { title: '脚本/分镜', description: result.script ? '已生成' : '—' },
              { title: '合成', description: composeTask ? `任务 ${composeTask.taskId || '已提交'}` : '已跳过' },
            ]}
            style={{ marginBottom: 16 }}
          />

          <Title level={5}><Tag color="blue">调研</Tag> 内容依据</Title>
          <Paragraph style={{ whiteSpace: 'pre-wrap', background: 'var(--bg-base)', padding: 12, borderRadius: 8 }}>
            {result.research?.content || '（无调研内容）'}
          </Paragraph>

          <Divider />

          <Title level={5}><Tag color="purple">口播脚本 / 分镜</Tag> 成片文案</Title>
          <Paragraph style={{ whiteSpace: 'pre-wrap', background: 'var(--bg-base)', padding: 12, borderRadius: 8 }}>
            {result.script?.content || '（无脚本内容）'}
          </Paragraph>

          <Divider />

          {composeTask ? (
            <Alert
              type="success"
              showIcon
              message="已提交成片合成任务"
              description={
                <div>
                  <div>任务 ID：<Text code>{composeTask.taskId || '—'}</Text></div>
                  <div style={{ marginTop: 4 }}>
                    生产环境可轮询 <Text code>/api/tools/media/task/{composeTask.provider || 'agnes'}/{composeTask.taskId}</Text> 获取成片地址；
                    状态：{composeTask.status || 'processing'}
                  </div>
                  <video
                    key={videoUrl}
                    src={videoUrl}
                    controls
                    style={{ width: '100%', marginTop: 12, borderRadius: 8, background: '#000', display: videoUrl ? 'block' : 'none' }}
                  />
                  <div style={{ marginTop: 8 }}>
                    <Space>
                      <Button
                        icon={<DownloadOutlined />}
                        href={videoUrl}
                        download
                        target="_blank"
                        disabled={!videoUrl || videoStatus !== 'completed'}
                      >
                        下载成片
                      </Button>
                      <Button
                        icon={<ShareAltOutlined />}
                        disabled={!videoUrl || videoStatus !== 'completed'}
                        onClick={() => {
                          const link = window.location.origin + videoUrl;
                          navigator.clipboard?.writeText(link).then(
                            () => message.success('成片链接已复制到剪贴板'),
                            () => message.info('复制失败，请手动复制：' + link),
                          );
                        }}
                      >
                        复制分享链接
                      </Button>
                      {videoStatus === 'processing' && <Text type="secondary">成片生成中，请稍候……</Text>}
                      {videoStatus === 'failed' && <Text type="danger">成片生成失败，请重试</Text>}
                    </Space>
                  </div>
                </div>
              }
            />
          ) : (
            <Alert
              type="info"
              showIcon
              message="关于成片合成"
              description="本工作流已交付真实可用的调研与脚本方案（可下载）。勾选上方「生成后合成成片」即可调用视频模型产出成片，并在下方播放、下载与分享。"
            />
          )}
        </Card>
      )}
    </div>
  );
}
