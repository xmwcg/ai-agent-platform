import { useState } from 'react';
import { Modal, Select, Button, Space, Typography, message, Spin } from 'antd';
import { SwapOutlined, DownloadOutlined } from '@ant-design/icons';

const { Text } = Typography;

const CONVERSION_MAP: Record<string, string[]> = {
  'md': ['html', 'pdf', 'docx', 'txt'],
  'html': ['md', 'pdf', 'txt'],
  'txt': ['md', 'html', 'pdf', 'docx'],
  'pdf': ['docx', 'txt', 'html'],
  'docx': ['pdf', 'txt', 'md', 'html'],
  'xlsx': ['csv', 'pdf'],
  'csv': ['xlsx', 'json'],
  'json': ['csv', 'xml', 'yaml'],
  'xml': ['json'],
  'yaml': ['json'],
};

const FORMAT_LABELS: Record<string, string> = {
  md: 'Markdown', html: 'HTML', pdf: 'PDF', docx: 'Word',
  txt: '纯文本', xlsx: 'Excel', csv: 'CSV', json: 'JSON',
  xml: 'XML', yaml: 'YAML',
};

interface Props {
  open: boolean;
  onClose: () => void;
  fileName: string;
  content?: string;
  onConvert?: (sourceFormat: string, targetFormat: string) => void;
}

export default function FileConverter({ open, onClose, fileName, content, onConvert }: Props) {
  const [targetFormat, setTargetFormat] = useState<string>('');
  const [converting, setConverting] = useState(false);

  const ext = fileName.split('.').pop()?.toLowerCase() || 'txt';
  const sourceFormat = ext === 'markdown' ? 'md' : ext;
  const availableTargets = CONVERSION_MAP[sourceFormat] || ['txt'];
  const sourceLabel = FORMAT_LABELS[sourceFormat] || sourceFormat.toUpperCase();

  const handleConvert = async () => {
    if (!targetFormat) {
      message.warning('请选择目标格式');
      return;
    }
    setConverting(true);
    try {
      onConvert?.(sourceFormat, targetFormat);
      message.success('格式转换已开始下载');
      onClose();
    } catch {
      message.error('转换失败，请重试');
    } finally {
      setConverting(false);
    }
  };

  return (
    <Modal
      title={
        <Space>
          <SwapOutlined style={{ color: '#6366f1' }} />
          <span>格式转换下载</span>
        </Space>
      }
      open={open}
      onCancel={onClose}
      footer={null}
      width={420}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{
          background: '#f8f9fb', borderRadius: 10, padding: 14,
          display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'center',
        }}>
          <div style={{ textAlign: 'center' }}>
            <Text type="secondary" style={{ fontSize: 11 }}>源格式</Text>
            <div style={{
              background: '#e0e7ff', color: '#4f46e5', padding: '4px 14px',
              borderRadius: 8, fontWeight: 600, fontSize: 14, marginTop: 4,
            }}>
              {sourceLabel}
            </div>
          </div>
          <SwapOutlined style={{ color: '#94a3b8', fontSize: 18 }} />
          <div style={{ textAlign: 'center' }}>
            <Text type="secondary" style={{ fontSize: 11 }}>目标格式</Text>
            <Select
              value={targetFormat || undefined}
              onChange={setTargetFormat}
              placeholder="选择格式"
              style={{ width: 140, marginTop: 4 }}
              options={availableTargets.map((f) => ({
                label: FORMAT_LABELS[f] || f.toUpperCase(),
                value: f,
              }))}
            />
          </div>
        </div>

        <Text type="secondary" style={{ fontSize: 12, textAlign: 'center' }}>
          文件: {fileName}
        </Text>

        <Button
          type="primary"
          icon={converting ? <Spin size="small" /> : <DownloadOutlined />}
          onClick={handleConvert}
          block
          disabled={!targetFormat || converting}
          style={{
            background: !targetFormat ? undefined : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            border: 'none', height: 38,
          }}
        >
          {converting ? '转换中...' : '转换并下载'}
        </Button>
      </div>
    </Modal>
  );
}
