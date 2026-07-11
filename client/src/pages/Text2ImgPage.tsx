import { useState, useEffect, useRef } from 'react';
import {
  Card, Typography, Input, Button, Space, Spin, Empty,
  Radio, Select, Slider, Badge, Tooltip, Divider, Alert
} from 'antd';
import {
  PictureOutlined, ThunderboltOutlined, DownloadOutlined,
  ReloadOutlined, EyeOutlined
} from '@ant-design/icons';
import apiClient, { extractApiError } from '@/services/api';

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

  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollStart = useRef<number>(0);

  const sizeOptions = [
    { label: '1024×1024', value: '1024x1024' },
    { label: '512×512', value: '512x512' },
    { label: '768×1344（竖版）', value: '768x1344' },
    { label: '1344×768（横版）', value: '1344x768' }
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
        style
      });
      const taskId: string | undefined = res?.data?.taskId;
      if (!taskId) throw new Error('未返回任务 ID');
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
                max={4}
                value={count}
                onChange={setCount}
                marks={{ 1: '1', 2: '2', 3: '3', 4: '4' }}
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
