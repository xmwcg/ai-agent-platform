import { useState, useRef, useEffect, useCallback } from 'react';
import { Input, Button, Space, Upload, Tooltip, Badge, message } from 'antd';
import {
  SendOutlined, PaperClipOutlined, ThunderboltOutlined,
  ClearOutlined, LoadingOutlined, FileOutlined, CloseOutlined,
} from '@ant-design/icons';
import { useChatStore, UploadedFile } from '@/stores/chat';
import type { UploadFile, RcFile } from 'antd/es/upload/interface';

const { TextArea } = Input;

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const ALLOWED_TYPES = [
  '.pdf', '.doc', '.docx', '.xls', '.xlsx',
  '.ppt', '.pptx', '.txt', '.md', '.csv', '.json', '.xml',
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg',
  '.py', '.js', '.ts', '.jsx', '.tsx', '.java', '.go', '.rs',
  '.c', '.cpp', '.h', '.cs', '.rb', '.php',
  '.mp3', '.wav', '.ogg', '.mp4', '.webm',
];

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface Props {
  onSend: (text: string) => void;
  onPromptOptimize: (text: string) => void;
  disabled?: boolean;
}

export default function ChatInput({ onSend, onPromptOptimize, disabled }: Props) {
  const [input, setInput] = useState('');
  const { files, addFile, removeFile, clearFiles } = useChatStore();
  const textareaRef = useRef<any>(null);

  // 自适应高度
  useEffect(() => {
    const el = textareaRef.current?.resizableTextArea?.textArea;
    if (el) {
      el.style.height = 'auto';
      el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
    }
  }, [input]);

  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text || disabled) return;
    onSend(text);
    setInput('');
    clearFiles();
  }, [input, disabled, onSend, clearFiles]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (e.ctrlKey || e.metaKey) {
          // Ctrl+Enter: 换行
          setInput((prev) => prev + '\n');
        } else {
          handleSend();
        }
      }
    },
    [handleSend]
  );

  const handleFileChange = useCallback(
    (file: File | null) => {
      if (!file) return;
      const ext = '.' + file.name.split('.').pop()?.toLowerCase();
      if (!ALLOWED_TYPES.includes(ext)) {
        message.warning(`不支持的文件格式: ${ext}`);
        return;
      }
      if (file.size > MAX_FILE_SIZE) {
        message.warning(`文件过大（最大 ${formatSize(MAX_FILE_SIZE)}）`);
        return;
      }
      const f: UploadedFile = {
        id: `file_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        name: file.name,
        size: file.size,
        type: file.type,
        progress: 0,
        status: 'uploading',
      };
      addFile(f);

      // 模拟上传进度
      let progress = 0;
      const timer = setInterval(() => {
        progress += Math.random() * 30;
        if (progress >= 100) {
          progress = 100;
          clearInterval(timer);
          useChatStore.getState().updateFile(f.id, { progress: 100, status: 'done' });
        } else {
          useChatStore.getState().updateFile(f.id, { progress: Math.round(progress) });
        }
      }, 200);
    },
    [addFile]
  );

  const hasContent = input.trim().length > 0;

  return (
    <div className="chat-input-area">
      {/* 文件预览 */}
      {files.length > 0 && (
        <div className="file-preview-area">
          <Space size={4} wrap>
            {files.map((f) => (
              <div key={f.id} className="file-tag">
                <FileOutlined />
                <span className="file-name">{f.name}</span>
                <span className="file-size">{formatSize(f.size)}</span>
                {f.status === 'uploading' ? (
                  <LoadingOutlined spin style={{ fontSize: 11 }} />
                ) : (
                  <CloseOutlined
                    style={{ fontSize: 11, cursor: 'pointer' }}
                    onClick={() => removeFile(f.id)}
                  />
                )}
              </div>
            ))}
          </Space>
        </div>
      )}

      {/* 输入行 */}
      <div className="input-row">
        {/* 左侧工具栏 */}
        <div className="input-tools">
          <Tooltip title="上传文件（PDF/Word/Excel/图片/代码，最大50MB）">
            <Upload
              showUploadList={false}
              beforeUpload={(file) => {
                handleFileChange(file as unknown as File);
                return false;
              }}
              accept={ALLOWED_TYPES.join(',')}
            >
              <Button type="text" icon={<PaperClipOutlined />} disabled={disabled} />
            </Upload>
          </Tooltip>
          <Tooltip title="AI 优化提示词">
            <Button
              type="text"
              icon={<ThunderboltOutlined />}
              disabled={!hasContent || disabled}
              onClick={() => onPromptOptimize(input.trim())}
            />
          </Tooltip>
        </div>

        {/* 输入框 */}
        <TextArea
          ref={textareaRef as any}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            disabled
              ? 'AI 正在回复中...'
              : '输入消息，Enter 发送，Shift+Enter 换行，Ctrl+Enter 强制换行'
          }
          rows={1}
          disabled={disabled}
          variant="borderless"
          autoSize={false}
          style={{
            flex: 1,
            resize: 'none',
            fontSize: 14,
            lineHeight: 1.6,
            maxHeight: 160,
            minHeight: 24,
            border: 'none',
            boxShadow: 'none',
            padding: '6px 4px',
          }}
        />

        {/* 发送按钮 */}
        <Button
          type="primary"
          icon={<SendOutlined />}
          onClick={handleSend}
          disabled={!hasContent || disabled}
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: hasContent
              ? 'linear-gradient(135deg, #6366f1, #8b5cf6)'
              : '#d9d9d9',
            border: 'none',
            flexShrink: 0,
          }}
        />
      </div>

      {/* 底部提示 */}
      <div className="input-hint">
        <Space size={16}>
          <span>📎 支持 PDF/Word/Excel/图片/代码（≤50MB）</span>
          <span>⌨️ Enter 发送 · Shift+Enter 换行</span>
        </Space>
      </div>

      <style>{`
        .chat-input-area {
          border-top: 1px solid #eef1f5; padding: 12px 16px 8px;
          background: #fff;
        }
        .file-preview-area {
          margin-bottom: 8px;
        }
        .file-tag {
          display: inline-flex; align-items: center; gap: 4px;
          padding: 3px 8px; background: #f0f4ff; border-radius: 6px;
          font-size: 12px; border: 1px solid #d4dbf8;
        }
        .file-name { max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .file-size { color: #94a3b8; font-size: 11px; }
        .input-row {
          display: flex; align-items: flex-end; gap: 6px;
          background: #f8f9fb; border-radius: 14px;
          padding: 6px 8px; border: 1px solid #e8ecf1;
          transition: border-color 0.2s;
        }
        .input-row:focus-within { border-color: #a5b4fc; }
        .input-tools { display: flex; align-items: center; gap: 2px; padding-bottom: 4px; }
        .input-hint {
          display: flex; justify-content: center; margin-top: 4px;
          font-size: 11px; color: #94a3b8;
        }
        @media (max-width: 768px) {
          .input-hint { display: none; }
        }
      `}</style>
    </div>
  );
}
