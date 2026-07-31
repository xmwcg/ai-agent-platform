/**
 * 知识库一键导入组件
 * 对标 Dify 的文档自动处理：拖拽/选择文件 → 自动解析 → 分块 → 向量化
 *
 * 支持格式：PDF、Word (.docx)、Markdown (.md)、纯文本 (.txt)、HTML
 */

import React, { useState, useRef, useCallback } from 'react';
import {
  Upload,
  Button,
  Modal,
  Progress,
  Space,
  Tag,
  Typography,
  message,
  Input,
  Divider,
  Alert,
  Tooltip,
} from 'antd';
import {
  InboxOutlined,
  FilePdfOutlined,
  FileWordOutlined,
  FileTextOutlined,
  FileMarkdownOutlined,
  Html5Outlined,
  LinkOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  LoadingOutlined,
  CloudUploadOutlined,
} from '@ant-design/icons';
import type { UploadFile } from 'antd/es/upload';
import { default as apiClient } from '../services/api';

const { Dragger } = Upload;
const { Text, Title, Paragraph } = Typography;

// ── 类型定义 ──────────────────────────────────────────

interface IngestResult {
  success: boolean;
  file: { name: string; format: string };
  pipeline: {
    chunks: number;
    documentsCreated: number;
    documentIds: string[];
  };
  timing: { parseMs: number; embedMs: number; totalMs: number };
  errors?: string[];
}

interface SupportedFormat {
  ext: string;
  label: string;
  description: string;
}

// ── 格式图标映射 ──────────────────────────────────────

const formatIcons: Record<string, React.ReactNode> = {
  pdf: <FilePdfOutlined style={{ color: '#ff4d4f', fontSize: 40 }} />,
  docx: <FileWordOutlined style={{ color: '#1890ff', fontSize: 40 }} />,
  doc: <FileWordOutlined style={{ color: '#1890ff', fontSize: 40 }} />,
  md: <FileMarkdownOutlined style={{ color: '#722ed1', fontSize: 40 }} />,
  txt: <FileTextOutlined style={{ color: '#52c41a', fontSize: 40 }} />,
  html: <Html5Outlined style={{ color: '#fa8c16', fontSize: 40 }} />,
  htm: <Html5Outlined style={{ color: '#fa8c16', fontSize: 40 }} />,
};

// ── 状态枚举 ──────────────────────────────────────────

type ImportStatus = 'idle' | 'uploading' | 'parsing' | 'embedding' | 'done' | 'error';

const statusLabels: Record<ImportStatus, string> = {
  idle: '等待上传',
  uploading: '上传文件中...',
  parsing: '解析文档内容...',
  embedding: '生成向量嵌入...',
  done: '导入完成',
  error: '导入失败',
};

// ── 组件 Props ────────────────────────────────────────

interface KnowledgeImportProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: (docIds: string[]) => void;
}

// ── 主组件 ────────────────────────────────────────────

const KnowledgeImport: React.FC<KnowledgeImportProps> = ({ visible, onClose, onSuccess }) => {
  const [status, setStatus] = useState<ImportStatus>('idle');
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<IngestResult[]>([]);
  const [urlInput, setUrlInput] = useState('');
  const [importMode, setImportMode] = useState<'file' | 'url'>('file');
  const [supportedFormats, setSupportedFormats] = useState<SupportedFormat[]>([]);
  const abortRef = useRef(false);

  // ── 获取支持的格式 ─────────────────────────────────

  React.useEffect(() => {
    if (visible) {
      apiClient.get('/rag/pipeline/formats')
        .then(res => setSupportedFormats(res.data.formats || []))
        .catch(() => {
          // 使用默认格式列表
          setSupportedFormats([
            { ext: 'pdf', label: 'PDF', description: 'PDF 文档' },
            { ext: 'docx', label: 'Word', description: 'Word 文档' },
            { ext: 'md', label: 'Markdown', description: 'Markdown 文件' },
            { ext: 'txt', label: '纯文本', description: '纯文本文件' },
            { ext: 'html', label: '网页', description: 'HTML 文件' },
          ]);
        });
    }
  }, [visible]);

  // ── 重置状态 ─────────────────────────────────────

  const reset = useCallback(() => {
    setStatus('idle');
    setProgress(0);
    setResults([]);
    setUrlInput('');
    abortRef.current = false;
  }, []);

  // ── 模拟进度（真实管道在服务端执行，前端模拟进度条）───

  const simulateProgress = useCallback((phase: 'uploading' | 'parsing' | 'embedding') => {
    const ranges = {
      uploading: [0, 30],
      parsing: [30, 60],
      embedding: [60, 100],
    };
    const [min, max] = ranges[phase];
    let current = min;
    const interval = setInterval(() => {
      if (abortRef.current) {
        clearInterval(interval);
        return;
      }
      current += Math.random() * 10;
      if (current >= max) {
        current = max;
        clearInterval(interval);
      }
      setProgress(Math.round(current));
    }, 300);
    return interval;
  }, []);

  // ── 文件上传处理 ──────────────────────────────────

  const handleFileUpload = useCallback(async (file: File) => {
    abortRef.current = false;
    setStatus('uploading');
    setProgress(0);
    setResults([]);

    const formData = new FormData();
    formData.append('file', file);

    // 阶段1：上传
    const uploadInterval = simulateProgress('uploading');

    try {
      setStatus('parsing');
      const parseInterval = simulateProgress('parsing');

      const response = await apiClient.post('/rag/pipeline/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      clearInterval(uploadInterval);
      clearInterval(parseInterval);

      setStatus('embedding');
      const embedInterval = simulateProgress('embedding');

      // 短暂延迟模拟向量化
      await new Promise(resolve => setTimeout(resolve, 800));
      clearInterval(embedInterval);

      setProgress(100);
      setStatus('done');
      setResults([response.data]);
      message.success(`成功导入「${file.name}」，创建 ${response.data.pipeline.documentsCreated} 个知识文档`);
      onSuccess?.(response.data.pipeline.documentIds);

    } catch (err: any) {
      clearInterval(uploadInterval);
      setStatus('error');
      const errMsg = err?.response?.data?.error || err?.message || '导入失败';
      message.error(errMsg);
    }
  }, [simulateProgress, onSuccess]);

  // ── URL 导入处理 ──────────────────────────────────

  const handleUrlImport = useCallback(async () => {
    if (!urlInput.trim()) {
      message.warning('请输入网页 URL');
      return;
    }

    // 验证 URL
    try {
      new URL(urlInput);
    } catch {
      message.error('URL 格式不正确');
      return;
    }

    abortRef.current = false;
    setStatus('uploading');
    setProgress(0);
    setResults([]);

    const parseInterval = simulateProgress('parsing');

    try {
      const response = await apiClient.post('/rag/pipeline/ingest-url', { url: urlInput });
      clearInterval(parseInterval);

      setStatus('embedding');
      const embedInterval = simulateProgress('embedding');
      await new Promise(resolve => setTimeout(resolve, 600));
      clearInterval(embedInterval);

      setProgress(100);
      setStatus('done');
      setResults([response.data]);
      message.success(`成功导入网页，创建 ${response.data.pipeline.documentsCreated} 个知识文档`);
      onSuccess?.(response.data.pipeline.documentIds);

    } catch (err: any) {
      clearInterval(parseInterval);
      setStatus('error');
      const errMsg = err?.response?.data?.error || err?.message || '导入失败';
      message.error(errMsg);
    }
  }, [urlInput, simulateProgress, onSuccess]);

  // ── 关闭处理 ──────────────────────────────────────

  const handleClose = useCallback(() => {
    abortRef.current = true;
    reset();
    onClose();
  }, [reset, onClose]);

  // ── 渲染 ──────────────────────────────────────────

  const isProcessing = ['uploading', 'parsing', 'embedding'].includes(status);

  return (
    <Modal
      title={
        <Space>
          <CloudUploadOutlined />
          一键导入文档到知识库
        </Space>
      }
      open={visible}
      onCancel={handleClose}
      width={640}
      footer={null}
      destroyOnClose
    >
      {/* 格式说明 */}
      {status === 'idle' && (
        <>
          <Alert
            message="对标 Dify 的文档自动处理"
            description="上传 PDF/Word/Markdown/HTML/纯文本 文件，或粘贴网页 URL，系统自动完成：解析 → 智能分块 → 向量化 → 存入知识库，即时可用于 RAG 检索。"
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />

          {/* 格式标签 */}
          <div style={{ marginBottom: 16 }}>
            <Text type="secondary">支持格式：</Text>
            <div style={{ marginTop: 8 }}>
              {supportedFormats.map(f => (
                <Tooltip key={f.ext} title={f.description}>
                  <Tag icon={formatIcons[f.ext] ? undefined : undefined} color="blue" style={{ marginBottom: 4 }}>
                    .{f.ext.toUpperCase()} {f.label}
                  </Tag>
                </Tooltip>
              ))}
            </div>
          </div>

          {/* 导入模式切换 */}
          <Space style={{ marginBottom: 16 }}>
            <Button
              type={importMode === 'file' ? 'primary' : 'default'}
              icon={<InboxOutlined />}
              onClick={() => setImportMode('file')}
            >
              上传文件
            </Button>
            <Button
              type={importMode === 'url' ? 'primary' : 'default'}
              icon={<LinkOutlined />}
              onClick={() => setImportMode('url')}
            >
              网址导入
            </Button>
          </Space>

          <Divider style={{ margin: '12px 0' }} />

          {/* 文件拖拽区 */}
          {importMode === 'file' ? (
            <Dragger
              multiple={false}
              accept=".pdf,.docx,.doc,.md,.txt,.html,.htm"
              showUploadList={false}
              beforeUpload={(file) => {
                handleFileUpload(file);
                return false; // 阻止自动上传，手动处理
              }}
              disabled={isProcessing}
            >
              <p className="ant-upload-drag-icon">
                <InboxOutlined />
              </p>
              <p className="ant-upload-text">点击或拖拽文件到此区域上传</p>
              <p className="ant-upload-hint">
                支持 PDF、Word (.docx)、Markdown (.md)、纯文本 (.txt)、HTML (.html)
              </p>
              <p className="ant-upload-hint">
                单个文件最大 20MB，自动分块后每个片段独立存储为知识文档
              </p>
            </Dragger>
          ) : (
            /* URL 导入 */
            <div>
              <Input.Search
                placeholder="粘贴网页 URL，如 https://example.com/article"
                enterButton={
                  <Button type="primary" icon={<LinkOutlined />} loading={isProcessing}>
                    导入网页
                  </Button>
                }
                size="large"
                value={urlInput}
                onChange={e => setUrlInput(e.target.value)}
                onSearch={handleUrlImport}
                disabled={isProcessing}
              />
              <Paragraph type="secondary" style={{ marginTop: 8, fontSize: 12 }}>
                系统将自动抓取网页内容，提取正文，分块并向量化后存入知识库
              </Paragraph>
            </div>
          )}

          {/* 说明 */}
          <div style={{ marginTop: 16, padding: 12, background: '#fafafa', borderRadius: 8 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              💡 <strong>智能分块策略</strong>：基于段落 + 语义边界自动切割，每块最大 1000 字符，块间保留 200 字符重叠确保上下文连贯。
              导入后可在「知识库」中查看和管理所有文档。
            </Text>
          </div>
        </>
      )}

      {/* 处理进度 */}
      {isProcessing && (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <LoadingOutlined style={{ fontSize: 48, color: '#1890ff', marginBottom: 16 }} />
          <Title level={4}>{statusLabels[status]}</Title>
          <Progress
            percent={progress}
            status="active"
            strokeColor={{
              '0%': '#108ee9',
              '100%': '#87d068',
            }}
            style={{ maxWidth: 400, margin: '0 auto' }}
          />
          <Paragraph type="secondary" style={{ marginTop: 16 }}>
            {status === 'uploading' && '正在上传文件到服务器...'}
            {status === 'parsing' && '正在识别文档格式并提取文本...'}
            {status === 'embedding' && '正在生成向量嵌入并存入知识库...'}
          </Paragraph>
        </div>
      )}

      {/* 完成结果 */}
      {status === 'done' && results.length > 0 && (
        <div style={{ padding: '20px 0' }}>
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <CheckCircleOutlined style={{ fontSize: 48, color: '#52c41a', marginBottom: 16 }} />
            <Title level={4}>导入完成</Title>
          </div>

          {results.map((r, i) => (
            <div key={i} style={{
              padding: 16,
              background: '#f6ffed',
              border: '1px solid #b7eb8f',
              borderRadius: 8,
              marginBottom: 12,
            }}>
              <Space direction="vertical" style={{ width: '100%' }}>
                <Text strong>📄 {r.file.name}</Text>
                <Space>
                  <Tag color="blue">{r.file.format.toUpperCase()}</Tag>
                  <Tag color="green">分块数：{r.pipeline.chunks}</Tag>
                  <Tag color="purple">文档数：{r.pipeline.documentsCreated}</Tag>
                </Space>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  解析 {r.timing.parseMs}ms · 嵌入 {r.timing.embedMs}ms · 总计 {r.timing.totalMs}ms
                </Text>
                {r.errors && r.errors.length > 0 && (
                  <Alert
                    type="warning"
                    message="部分分块处理失败"
                    description={r.errors.join('; ')}
                    showIcon
                    style={{ marginTop: 8 }}
                  />
                )}
              </Space>
            </div>
          ))}

          <div style={{ textAlign: 'center', marginTop: 16 }}>
            <Space>
              <Button type="primary" onClick={handleClose}>
                完成
              </Button>
              <Button onClick={() => {
                reset();
                message.info('可以继续导入新文档');
              }}>
                继续导入
              </Button>
            </Space>
          </div>
        </div>
      )}

      {/* 错误状态 */}
      {status === 'error' && (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <CloseCircleOutlined style={{ fontSize: 48, color: '#ff4d4f', marginBottom: 16 }} />
          <Title level={4}>导入失败</Title>
          <Paragraph type="secondary">请检查文件格式是否正确，或网络连接是否正常</Paragraph>
          <Space>
            <Button type="primary" onClick={reset}>
              重试
            </Button>
            <Button onClick={handleClose}>
              取消
            </Button>
          </Space>
        </div>
      )}
    </Modal>
  );
};

export default KnowledgeImport;
