import { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Select,
  Button,
  Input,
  Alert,
  Tag,
  Space,
  Typography,
  Spin,
  Badge,
  message as antdMessage,
} from 'antd';
import { PlayCircleOutlined, ReloadOutlined } from '@ant-design/icons';
import { sandboxAPI, extractApiError } from '@/services/api';

const { Title, Text, Paragraph } = Typography;

const LANGUAGES = [
  { value: 'python', label: 'Python' },
  { value: 'javascript', label: 'JavaScript' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'bash', label: 'Bash' },
];

const TEMPLATES: Record<string, string> = {
  python: 'print("Hello, Sandbox!")\n\nfor i in range(3):\n    print(f"count = {i}")\n',
  javascript: 'console.log("Hello, Sandbox!");\n\nfor (let i = 0; i < 3; i++) {\n  console.log("count =", i);\n}\n',
  typescript: 'const greet = (name: string): string => `Hello, ${name}!`;\nconsole.log(greet("Sandbox"));\n',
  bash: 'echo "Hello, Sandbox!"\nfor i in 1 2 3; do\n  echo "count = $i"\ndone\n',
};

interface SandboxResult {
  executionId: string;
  language: string;
  status: 'success' | 'error' | 'timeout' | 'denied';
  stdout: string;
  stderr: string;
  exitCode: number | null;
  durationMs: number;
  mode: string;
  deniedPatterns?: string[];
  note?: string;
}

export default function SandboxPage() {
  const [language, setLanguage] = useState<string>('python');
  const [code, setCode] = useState<string>(TEMPLATES.python);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<SandboxResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [modeInfo, setModeInfo] = useState<{ defaultMode?: string; supportedLanguages?: string[] }>({});
  const [statusError, setStatusError] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    try {
      const res = await sandboxAPI.status();
      const d = (res as any)?.data;
      if (!d?.defaultMode) throw new Error('沙盒状态响应无效');
      setModeInfo({ defaultMode: d.defaultMode, supportedLanguages: d.supportedLanguages });
      setStatusError(null);
    } catch (e: unknown) {
      setModeInfo({});
      setStatusError(extractApiError(e, '无法确认沙盒运行模式'));
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const onRun = useCallback(async () => {
    if (!code.trim()) {
      antdMessage.warning('请输入代码');
      return;
    }
    setRunning(true);
    setError(null);
    try {
      const res = await sandboxAPI.run({ language, code });
      setResult((res as any)?.data ?? null);
    } catch (e: unknown) {
      setError(extractApiError(e, '执行失败'));
    } finally {
      setRunning(false);
    }
  }, [language, code]);

  const onTemplate = (lang: string) => {
    setLanguage(lang);
    setCode(TEMPLATES[lang] ?? '');
    setResult(null);
  };

  const statusColor: Record<string, string> = {
    success: 'green',
    error: 'red',
    timeout: 'orange',
    denied: 'volcano',
  };

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <Title level={3} style={{ margin: 0 }}>
          实践沙盒
        </Title>
        <Space wrap>
          <Text type="secondary">当前模式：</Text>
          <Badge
            status={!modeInfo.defaultMode ? 'warning' : modeInfo.defaultMode === 'mock' ? 'default' : 'processing'}
            text={modeInfo.defaultMode || '状态未知'}
          />
        </Space>
      </div>

      {modeInfo.defaultMode === 'mock' && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 12 }}
          message="演示模式"
          description="当前沙盒为演示模式，仅回显 print/console.log 的模拟输出。在 .env 配置 SANDBOX_MODE=local（本机隔离执行）或 SANDBOX_REMOTE_URL（远程容器执行）即可运行真实代码。"
        />
      )}

      {statusError && <Alert type="error" message={statusError} style={{ marginBottom: 12 }} />}
      {error && <Alert type="error" message={error} style={{ marginBottom: 12 }} />}

      <Card style={{ marginBottom: 16 }}>
        <Space wrap style={{ marginBottom: 12 }}>
          <Select value={language} onChange={onTemplate} options={LANGUAGES} style={{ width: 160 }} />
          <Text type="secondary">选择语言将载入示例模板</Text>
          <Button type="primary" icon={<PlayCircleOutlined />} onClick={onRun} loading={running}>
            运行
          </Button>
          <Button icon={<ReloadOutlined />} onClick={() => onTemplate(language)}>
            重置示例
          </Button>
        </Space>
        <Input.TextArea
          value={code}
          onChange={(e) => setCode(e.target.value)}
          autoSize={{ minRows: 12, maxRows: 24 }}
          style={{ fontFamily: 'monospace', fontSize: 14 }}
          spellCheck={false}
        />
      </Card>

      <Card title="执行结果" loading={running}>
        {result ? (
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            <Space wrap>
              <Tag color={statusColor[result.status]}>{result.status}</Tag>
              <Tag>exitCode: {result.exitCode ?? '—'}</Tag>
              <Tag>{result.durationMs} ms</Tag>
              <Tag color="blue">{result.mode}</Tag>
            </Space>

            {result.deniedPatterns && result.deniedPatterns.length > 0 && (
              <Alert
                type="warning"
                showIcon
                message="检测到高危写法，已拒绝执行"
                description={result.deniedPatterns.join('；')}
              />
            )}

            <div>
              <Text strong>标准输出</Text>
              <Paragraph>
                <pre
                  style={{
                    background: '#0f172a',
                    color: '#e2e8f0',
                    padding: 12,
                    borderRadius: 6,
                    maxHeight: 320,
                    overflow: 'auto',
                    fontFamily: 'monospace',
                    fontSize: 13,
                    margin: '4px 0 0',
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {result.stdout || '（无输出）'}
                </pre>
              </Paragraph>
            </div>

            {result.stderr && (
              <div>
                <Text strong>错误输出</Text>
                <Paragraph>
                  <pre
                    style={{
                      background: '#2b0f0f',
                      color: '#fecaca',
                      padding: 12,
                      borderRadius: 6,
                      maxHeight: 240,
                      overflow: 'auto',
                      fontFamily: 'monospace',
                      fontSize: 13,
                      margin: '4px 0 0',
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    {result.stderr}
                  </pre>
                </Paragraph>
              </div>
            )}

            {result.note && (
              <Text type="secondary">
                <Spin size="small" /> {result.note}
              </Text>
            )}
          </Space>
        ) : (
          !running && <Text type="secondary">点击「运行」查看输出。</Text>
        )}
      </Card>
    </div>
  );
}
