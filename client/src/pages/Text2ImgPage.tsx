import { useState, useEffect, useRef } from 'react';
import {
  Card, Typography, Input, Button, Space, Spin, Empty,
  Radio, Select, Slider, Badge, Tooltip, Divider, Alert, Switch
} from 'antd';
import {
  PictureOutlined, ThunderboltOutlined, DownloadOutlined,
  ReloadOutlined, EyeOutlined, KeyOutlined
} from '@ant-design/icons';
import apiClient, { extractApiError, byokAPI } from '@/services/api';

const { Title, Paragraph, Text } = Typography;
const { TextArea } = Input;

interface GeneratedImage {
  url: string;
  b64_json?: string;
}

interface HistoryItem {
  taskId: string;
  prompt: string;
  outputUrl?: string;
  images?: string[];
  status?: string;
  provider?: string;
  createdAt?: string;
}

const POLL_INTERVAL_MS = 2500;
const MAX_POLL_MS = 180000; // 最长轮询 3 分钟

export default function Text2ImgPage() {
  const [prompt, setPrompt] = useState('');
  const [negativePrompt, setNegativePrompt] = useState('');
  const [size, setSize] = useState('1024x1024');
  const [count, setCount] = useState(1);
  const [style, setStyle] = useState('photorealistic');
  const [loading, setLoading] = useState(false);
  const [images, setImages] = useState<GeneratedImage[]>([]);
  const [error, setError] = useState('');
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [progress, setProgress] = useState('');
  /** 匿名用户当日剩余真实生成次数（undefined=已登录或无限制提示） */
  const [anonLeft, setAnonLeft] = useState<number | undefined>(undefined);
  /** BYOK：用户是否有可用的自带 Key（优先使用，平台零垫付） */
  const [byokAvailable, setByokAvailable] = useState(false);
  const [useByok, setUseByok] = useState(true);

  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollStart = useRef<number>(0);

  const sizeOptions = [
    { label: '1024×1024（高清）', value: '1024x1024' },
    { label: '768×768（标准）', value: '768x768' }
  ];

  const styleOptions = [
    { label: '写实照片', value: 'photorealistic' },
    { label: '动漫风格', value: 'anime' },
    { label: '油画风格', value: 'oil_painting' },
    { label: '水彩画', value: 'watercolor' }
  ];

  const stopPolling = () => {
    if (pollTimer.current) {
      clearInterval(pollTimer.current);
      pollTimer.current = null;
    }
  };

  // 组件卸载时清理轮询
  useEffect(() => () => stopPolling(), []);

  // 进入页面加载历史（真实持久化）
  useEffect(() => {
    loadHistory();
    // 检查 BYOK 可用性
    byokAPI.list().then((res: any) => {
      if (Array.isArray(res?.data) && res.data.some((k: any) => k.enabled)) {
        setByokAvailable(true);
      }
    }).catch(() => {});
  }, []);

  const loadHistory = async () => {
    try {
      const res: any = await apiClient.get('/text2img/history');
      if (res?.success && Array.isArray(res.data)) {
        setHistory(res.data);
      }
    } catch {
      /* 历史加载失败不阻断主流程 */
    }
  };

  const handleGenerate = async () => {
    if (!prompt.trim() || loading) return;
    stopPolling();
    setLoading(true);
    setError('');
    setImages([]);
    setProgress('已提交任务，AI 正在作画…');
    try {
      const res: any = await apiClient.post('/text2img/generate', {
        prompt: prompt.trim(),
        negativePrompt: negativePrompt || undefined,
        size,
        n: count,
        style,
        // BYOK：useByok=false 强制走平台额度，未配置或 useByok=true 自动优先 BYOK
        ...(byokAvailable ? { useByok } : {}),
      });
      const taskId: string | undefined = res?.data?.taskId;
      if (!taskId) throw new Error('未返回任务 ID');
      // 透出匿名剩余次数（已登录用户为 undefined）
      setAnonLeft(typeof res?.data?.anonRealLeft === 'number' ? res.data.anonRealLeft : undefined);
      pollStart.current = Date.now();
      pollTimer.current = setInterval(() => pollTask(taskId), POLL_INTERVAL_MS);
      // 立即查一次
      pollTask(taskId);
    } catch (err) {
      setLoading(false);
      setError(extractApiError(err, '生成失败'));
      setProgress('');
    }
  };

  const pollTask = async (taskId: string) => {
    try {
      const res: any = await apiClient.get(`/text2img/query/${taskId}`);
      const data = res?.data;
      if (!data) return;
      if (data.status === 'completed') {
        stopPolling();
        const imgs: GeneratedImage[] = Array.isArray(data.images) && data.images.length
          ? data.images.map((u: string) => ({ url: u }))
          : data.outputUrl
            ? [{ url: data.outputUrl }]
            : [];
        setImages(imgs);
        setProgress('');
        setLoading(false);
        loadHistory();
      } else {
        setProgress(`生成中…（${data.provider || 'AI'}）`);
        // 超时保护
        if (Date.now() - pollStart.current > MAX_POLL_MS) {
          stopPolling();
          setLoading(false);
          setError('生成超时，请稍后在「生成历史」中查看，或重试。');
          setProgress('');
          loadHistory();
        }
      }
    } catch (err) {
      stopPolling();
      setLoading(false);
      setError(extractApiError(err, '查询失败'));
      setProgress('');
    }
  };

  const handleDownload = (url: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = `generated-${Date.now()}.png`;
    link.click();
  };

  const viewHistory = (h: HistoryItem) => {
    const imgs = (h.images && h.images.length ? h.images : (h.outputUrl ? [h.outputUrl] : []))
      .map((u) => ({ url: u }));
    if (imgs.length) setImages(imgs);
    setPrompt(h.prompt);
  };

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Space>
            <PictureOutlined style={{ fontSize: 24, color: '#1890ff' }} />
            <Title level={3} style={{ margin: 0 }}>文生图</Title>
            <Badge count={history.length} showZero color="blue" />
          </Space>
          <Button
            icon={<ReloadOutlined />}
            onClick={() => { stopPolling(); setImages([]); setError(''); setProgress(''); }}
          >
            清空
          </Button>
        </div>
        <Paragraph type="secondary">
          输入文字描述，AI 自动生成高质量图片（真实调用混元等厂商，异步生成，自动落库与对象存储）。
        </Paragraph>
      </Card>

      <div style={{ display: 'flex', gap: 16 }}>
        {/* 左侧：输入区 */}
        <div style={{ flex: 1 }}>
          <Card title="📝 提示词" size="small">
            <TextArea
              value={prompt}
              onChange={(e: any) => setPrompt(e.target.value)}
              placeholder="描述你想生成的图片，例如：一只坐在月亮上的猫，赛博朋克风格"
              rows={4}
              style={{ marginBottom: 12 }}
            />
            <TextArea
              value={negativePrompt}
              onChange={(e: any) => setNegativePrompt(e.target.value)}
              placeholder="不想要的元素（可选），例如：模糊、变形"
              rows={2}
              style={{ marginBottom: 12 }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {prompt.length} 字符
              </Text>
            </div>
          </Card>

          <Card title="⚙️ 参数设置" size="small" style={{ marginTop: 16 }}>
            <div style={{ marginBottom: 16 }}>
              <Text strong>尺寸</Text>
              <Radio.Group
                value={size}
                onChange={e => setSize(e.target.value)}
                options={sizeOptions}
                style={{ marginTop: 8 }}
              />
            </div>
            <div style={{ marginBottom: 16 }}>
              <Text strong>数量</Text>
              <Slider
                min={1}
                max={2}
                value={count}
                onChange={setCount}
                marks={{ 1: '1', 2: '2' }}
                style={{ marginTop: 8 }}
              />
            </div>
            <div style={{ marginBottom: 16 }}>
              <Text strong>风格</Text>
              <Select
                value={style}
                onChange={setStyle}
                options={styleOptions}
                style={{ marginTop: 8, width: '100%' }}
              />
            </div>
            {anonLeft !== undefined && (
              <div style={{ marginBottom: 12, fontSize: 12, color: anonLeft > 0 ? '#8c6d1f' : '#cf1322' }}>
                {anonLeft > 0
                  ? `游客模式：今日还可真实生成 ${anonLeft} 次，超出后将自动切换为演示模式（不消耗算力）`
                  : '今日真实生成次数已用尽，本次将使用演示模式（不消耗算力）。登录可解锁完整额度。'}
              </div>
            )}
            {byokAvailable && (
              <div style={{
                marginBottom: 12, padding: '8px 12px',
                background: useByok ? '#f6ffed' : '#fffbe6',
                border: `1px solid ${useByok ? '#b7eb8f' : '#ffe58f'}`,
                borderRadius: 6, display: 'flex', alignItems: 'center', gap: 8
              }}>
                <KeyOutlined style={{ color: useByok ? '#52c41a' : '#faad14' }} />
                <Text style={{ fontSize: 12, flex: 1, color: useByok ? '#389e0d' : '#ad6800' }}>
                  {useByok ? '使用自带 Key（平台零垫付，不消耗配额）' : '走平台额度（消耗配额/垫付成本）'}
                </Text>
                <Switch
                  size="small"
                  checked={useByok}
                  onChange={setUseByok}
                  checkedChildren="BYOK"
                  unCheckedChildren="平台"
                />
              </div>
            )}
            <Button
              type="primary"
              size="large"
              icon={<ThunderboltOutlined />}
              loading={loading}
              onClick={handleGenerate}
              disabled={!prompt.trim() || loading}
              style={{ width: '100%' }}
            >
              {loading ? '生成中...' : '生成图片'}
            </Button>
          </Card>
        </div>

        {/* 右侧：结果区 */}
        <div style={{ flex: 1 }}>
          {error && (
            <Card size="small" style={{ marginBottom: 16, borderColor: '#ff4d4f' }}>
              <Text type="danger">{error}</Text>
            </Card>
          )}

          {images.length > 0 ? (
            <Card title={`🎨 生成结果（${images.length} 张）`} size="small">
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                {images.map((img, idx) => (
                  <div
                    key={idx}
                    style={{
                      width: images.length > 1 ? '48%' : '100%',
                      border: '1px solid #f0f0f0',
                      borderRadius: 8,
                      overflow: 'hidden',
                      position: 'relative'
                    }}
                  >
                    <img
                      src={img.url}
                      alt={`生成图 ${idx + 1}`}
                      style={{ width: '100%', display: 'block' }}
                    />
                    <div
                      style={{
                        position: 'absolute', bottom: 0, left: 0, right: 0,
                        background: 'rgba(0,0,0,0.5)', padding: '8px 12px',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                      }}
                    >
                      <Text style={{ color: '#fff', fontSize: 12 }}>图 {idx + 1}</Text>
                      <Space>
                        <Tooltip title="查看大图">
                          <EyeOutlined
                            style={{ color: '#fff', cursor: 'pointer' }}
                            onClick={() => window.open(img.url, '_blank')}
                          />
                        </Tooltip>
                        <Tooltip title="下载">
                          <DownloadOutlined
                            style={{ color: '#fff', cursor: 'pointer' }}
                            onClick={() => handleDownload(img.url)}
                          />
                        </Tooltip>
                      </Space>
                    </div>
                  </div>
                ))}
              </div>
              <Button
                style={{ marginTop: 16 }}
                icon={<ReloadOutlined />}
                onClick={handleGenerate}
                loading={loading}
              >
                重新生成
              </Button>
            </Card>
          ) : (
            <Card size="small">
              {loading ? (
                <div style={{ textAlign: 'center', padding: 60 }}>
                  <Spin size="large" />
                  <p style={{ marginTop: 12 }}>{progress || 'AI 正在作画，预计 10~60 秒...'}</p>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    任务已提交，正在轮询结果，请勿关闭页面。
                  </Text>
                </div>
              ) : (
                <Empty description="输入提示词，点击「生成图片」查看结果" />
              )}
            </Card>
          )}

          {progress && !images.length && (
            <Alert style={{ marginTop: 12 }} type="info" showIcon message={progress} />
          )}
        </div>
      </div>

      {/* 历史记录（真实持久化） */}
      {history.length > 0 && (
        <>
          <Divider />
          <Card title="📜 生成历史" size="small">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {history.map((h) => {
                const firstImg = (h.images && h.images[0]) || h.outputUrl;
                return (
                  <div key={h.taskId} style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    {firstImg ? (
                      <img
                        src={firstImg}
                        alt={h.prompt}
                        style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 4, cursor: 'pointer' }}
                        onClick={() => viewHistory(h)}
                      />
                    ) : (
                      <div style={{ width: 80, height: 80, borderRadius: 4, background: '#f0f0f0' }} />
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Text strong ellipsis>{h.prompt}</Text>
                      <br />
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {h.images?.length || (h.outputUrl ? 1 : 0)} 张图片
                        {h.provider ? ` · ${h.provider}` : ''}
                        {h.status === 'processing' ? ' · 生成中' : ''}
                      </Text>
                    </div>
                    <Button
                      size="small"
                      disabled={!firstImg}
                      onClick={() => viewHistory(h)}
                    >
                      查看
                    </Button>
                  </div>
                );
              })}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
