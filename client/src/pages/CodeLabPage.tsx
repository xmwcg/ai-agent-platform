import { useState, useEffect, useCallback } from 'react';
import {
  Card, Select, Button, Input, Alert, Tag, Space, Typography,
  Spin, Badge, Tabs, Radio, Divider, message as antdMessage, Empty,
} from 'antd';
import {
  PlayCircleOutlined, ReloadOutlined, ThunderboltOutlined,
  CodeOutlined, CopyOutlined, DownloadOutlined, BulbOutlined,
  HistoryOutlined, ExperimentOutlined,
} from '@ant-design/icons';
import { sandboxAPI, codeAPI, extractApiError } from '@/services/api';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

// ─── 常量区 ───────────────────────────────────────
const LANGUAGES = [
  { value: 'python', label: 'Python' },
  { value: 'javascript', label: 'JavaScript' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'java', label: 'Java' },
  { value: 'cpp', label: 'C++' },
  { value: 'go', label: 'Go' },
  { value: 'rust', label: 'Rust' },
  { value: 'bash', label: 'Bash' },
  { value: 'html', label: 'HTML' },
  { value: 'css', label: 'CSS' },
  { value: 'sql', label: 'SQL' },
  { value: 'shell', label: 'Shell' },
];

const TEMPLATES: Record<string, string> = {
  python: 'print("Hello, Code Lab!")\n\nfor i in range(3):\n    print(f"count = {i}")\n',
  javascript: `function fib(n) {\n  if (n < 2) return n;\n  return fib(n - 1) + fib(n - 2);\n}\n\nconsole.log("Hello, Code Lab!");\nconsole.log("fib(5) =", fib(5));\n`,
  typescript: 'const greet = (name: string): string => `Hello, ${name}!`;\nconsole.log(greet("Code Lab"));\n',
  bash: 'echo "Hello, Code Lab!"\nfor i in 1 2 3; do\n  echo "count = $i"\ndone\n',
  java: 'public class Main {\n  public static void main(String[] args) {\n    System.out.println("Hello, Code Lab!");\n  }\n}',
  cpp: '#include <iostream>\n\nint main() {\n  std::cout << "Hello, Code Lab!" << std::endl;\n  return 0;\n}',
  go: 'package main\n\nimport "fmt"\n\nfunc main() {\n  fmt.Println("Hello, Code Lab!")\n}',
  rust: 'fn main() {\n  println!("Hello, Code Lab!");\n}',
  html: '<!DOCTYPE html>\n<html>\n<body>\n  <h1>Hello, Code Lab!</h1>\n</body>\n</html>',
  css: 'body {\n  font-family: sans-serif;\n  background: #0f172a;\n  color: #e2e8f0;\n}',
  sql: 'SELECT "Hello, Code Lab!" AS greeting;',
  shell: '#!/bin/bash\necho "Hello, Code Lab!"\n',
};

const LEVELS = [
  { value: 'brief', label: '简略' },
  { value: 'detailed', label: '详细' },
  { value: 'teaching', label: '教学' },
];

// ─── 类型 ─────────────────────────────────────────
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

interface ExecutionRecord {
  id: string;
  language: string;
  code: string;
  result: SandboxResult | null;
  error: string | null;
  timestamp: number;
}

// ─── 终端输出组件 ─────────────────────────────────
function TerminalOutput({ content, variant = 'stdout' }: { content: string; variant?: 'stdout' | 'stderr' }) {
  const bgColor = variant === 'stderr' ? '#2b0f0f' : '#0d1117';
  const textColor = variant === 'stderr' ? '#fecaca' : '#c9d1d9';
  return (
    <pre style={{
      background: bgColor, color: textColor, padding: 12, borderRadius: 6,
      maxHeight: 360, overflow: 'auto', fontFamily: '"Fira Code", "Cascadia Code", "Consolas", monospace',
      fontSize: 13, margin: '4px 0 0', whiteSpace: 'pre-wrap', lineHeight: 1.6,
    }}>
      {content || '（无输出）'}
    </pre>
  );
}

// ─── 复制 & 下载工具函数 ──────────────────────────
function useClipboard() {
  const copy = (text: string) => {
    navigator.clipboard.writeText(text)
      .then(() => antdMessage.success('已复制到剪贴板'))
      .catch(() => antdMessage.error('复制失败'));
  };
  const download = (text: string, filename: string) => {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
    antdMessage.success('下载已开始');
  };
  return { copy, download };
}

// ─── 主组件 ───────────────────────────────────────
export default function CodeLabPage() {
  // 共享状态
  const [language, setLanguage] = useState<string>('python');
  const [code, setCode] = useState<string>(TEMPLATES.python);
  const [activeTab, setActiveTab] = useState<'explain' | 'run' | 'history'>('explain');

  // 沙盒状态
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState<SandboxResult | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [modeInfo, setModeInfo] = useState<{ defaultMode?: string; supportedLanguages?: string[] }>({});
  const [statusError, setStatusError] = useState<string | null>(null);

  // 代码解释状态
  const [level, setLevel] = useState<'brief' | 'detailed' | 'teaching'>('detailed');
  const [explainLoading, setExplainLoading] = useState(false);
  const [explanation, setExplanation] = useState('');
  const [concepts, setConcepts] = useState<string[]>([]);
  const [explainError, setExplainError] = useState<string | null>(null);

  // 概念生成示例状态
  const [concept, setConcept] = useState('');
  const [example, setExample] = useState('');
  const [exampleLoading, setExampleLoading] = useState(false);

  // AI 分析输出状态
  const [outputAnalysis, setOutputAnalysis] = useState('');
  const [analyzingOutput, setAnalyzingOutput] = useState(false);

  // 执行历史
  const [executionHistory, setExecutionHistory] = useState<ExecutionRecord[]>([]);

  const { copy, download } = useClipboard();

  // ─── 初始化 ─────────────────────────────────────
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

  useEffect(() => { loadStatus(); }, [loadStatus]);

  // ─── 模板切换 ───────────────────────────────────
  const onTemplate = (lang: string) => {
    setLanguage(lang);
    setCode(TEMPLATES[lang] ?? '');
    setRunResult(null);
    setExplanation('');
    setConcepts([]);
  };

  // ─── 运行代码 ───────────────────────────────────
  const onRun = useCallback(async () => {
    if (!code.trim()) { antdMessage.warning('请输入代码'); return; }
    setRunning(true);
    setRunError(null);
    try {
      const res = await sandboxAPI.run({ language, code });
      const data = (res as any)?.data ?? null;
      setRunResult(data);
      // 保存执行历史
      const record: ExecutionRecord = {
        id: data?.executionId || `exec_${Date.now()}`,
        language, code,
        result: data, error: null,
        timestamp: Date.now(),
      };
      setExecutionHistory(prev => [record, ...prev].slice(0, 50));
    } catch (e: unknown) {
      const errMsg = extractApiError(e, '执行失败');
      setRunError(errMsg);
      setExecutionHistory(prev => [{
        id: `err_${Date.now()}`, language, code,
        result: null, error: errMsg, timestamp: Date.now(),
      }, ...prev].slice(0, 50));
    } finally {
      setRunning(false);
    }
  }, [language, code]);

  // ─── 解释代码 ───────────────────────────────────
  const handleExplain = async () => {
    if (!code.trim()) { antdMessage.warning('请输入要解释的代码片段'); return; }
    setExplainLoading(true);
    setExplainError(null);
    setExplanation('');
    setConcepts([]);
    try {
      const res: any = await codeAPI.explain({ code, language, level });
      setExplanation(res.explanation || '（无返回）');
      setConcepts(res.concepts || []);
    } catch (err) {
      setExplainError(extractApiError(err, '解释失败，请稍后重试'));
    } finally {
      setExplainLoading(false);
    }
  };

  // ─── 生成代码示例 ───────────────────────────────
  const handleExample = async () => {
    if (!concept.trim()) { antdMessage.warning('请输入要生成示例的概念'); return; }
    setExampleLoading(true);
    try {
      const res: any = await codeAPI.example({ concept, language });
      setExample(res.example || '（无返回）');
    } catch (err) {
      antdMessage.error(extractApiError(err, '生成示例失败'));
    } finally {
      setExampleLoading(false);
    }
  };

  // ─── AI 分析沙盒输出（串联工作流）───────────────
  const handleAnalyzeOutput = async () => {
    if (!runResult) return;
    const outputText = [
      runResult.stdout ? `标准输出:\n${runResult.stdout}` : '',
      runResult.stderr ? `错误输出:\n${runResult.stderr}` : '',
    ].filter(Boolean).join('\n\n');

    if (!outputText.trim()) { antdMessage.warning('没有输出可分析'); return; }

    setAnalyzingOutput(true);
    setOutputAnalysis('');
    try {
      const analysisCode = `// 以下代码的执行输出需要分析:\n// 语言: ${runResult.language}\n// 状态: ${runResult.status}, 退出码: ${runResult.exitCode}, 耗时: ${runResult.durationMs}ms\n// 输出:\n/*\n${outputText}\n*/`;
      const res: any = await codeAPI.explain({
        code: analysisCode,
        language: runResult.language,
        level: 'detailed',
      });
      setOutputAnalysis(res.explanation || 'AI 无法分析此输出');
    } catch (err) {
      setOutputAnalysis('分析失败：' + extractApiError(err));
    } finally {
      setAnalyzingOutput(false);
    }
  };

  // ─── 状态颜色映射 ───────────────────────────────
  const statusColor: Record<string, string> = {
    success: 'green', error: 'red', timeout: 'orange', denied: 'volcano',
  };

  // ─── UI ─────────────────────────────────────────
  return (
    <div>
      {/* 页面标题区 */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: 20, flexWrap: 'wrap', gap: 12,
      }}>
        <Space align="center">
          <ExperimentOutlined style={{ fontSize: 28, color: '#13c2c2' }} />
          <div>
            <Title level={3} style={{ margin: 0 }}>代码实验室</Title>
            <Paragraph type="secondary" style={{ margin: '4px 0 0' }}>
              写代码 → 运行 → AI 解释 → 验证，一站完成学习闭环
            </Paragraph>
          </div>
        </Space>
        <Badge
          status={!modeInfo.defaultMode ? 'warning' : modeInfo.defaultMode === 'mock' ? 'default' : 'processing'}
          text={`沙盒: ${modeInfo.defaultMode || '状态未知'}`}
        />
      </div>

      {/* Mock 模式 & 错误提示 */}
      {modeInfo.defaultMode === 'mock' && (
        <Alert type="info" showIcon style={{ marginBottom: 16 }}
          message="沙盒演示模式"
          description="当前为演示模式，仅回显模拟输出。配置 SANDBOX_MODE=local 可启用真实代码执行。" />
      )}
      {statusError && <Alert type="error" message={statusError} style={{ marginBottom: 16 }} />}

      {/* 共享代码编辑器 */}
      <Card style={{ marginBottom: 16 }}>
        <Space wrap style={{ marginBottom: 12 }}>
          <Select
            value={language}
            onChange={onTemplate}
            options={LANGUAGES}
            style={{ width: 160 }}
            showSearch
            popupMatchSelectWidth={false}
          />
          <Text type="secondary">选择语言自动载入示例</Text>
          <Button icon={<ReloadOutlined />} onClick={() => onTemplate(language)}>
            重置示例
          </Button>
        </Space>
        <TextArea
          value={code}
          onChange={(e) => setCode(e.target.value)}
          autoSize={{ minRows: 10, maxRows: 22 }}
          style={{ fontFamily: '"Fira Code", "Cascadia Code", "Consolas", monospace', fontSize: 13, lineHeight: 1.6 }}
          spellCheck={false}
        />
      </Card>

      {/* ── 功能选项卡 ────────────────────────────── */}
      <Card>
        <Tabs
          activeKey={activeTab}
          onChange={(key) => setActiveTab(key as typeof activeTab)}
          items={[
            // ── Tab 1：解释代码 ───────────────────
            {
              key: 'explain',
              label: <span><BulbOutlined /> 解释代码</span>,
              children: (
                <div>
                  <Space style={{ marginBottom: 16 }} wrap>
                    <Radio.Group
                      value={level}
                      onChange={(e) => setLevel(e.target.value)}
                      optionType="button" buttonStyle="solid"
                    >
                      {LEVELS.map(l => (
                        <Radio.Button key={l.value} value={l.value}>{l.label}</Radio.Button>
                      ))}
                    </Radio.Group>
                    <Button type="primary" icon={<ThunderboltOutlined />}
                      loading={explainLoading} onClick={handleExplain}>
                      AI 解释代码
                    </Button>
                  </Space>

                  {explainError && <Alert type="error" message={explainError} style={{ marginBottom: 12 }} />}

                  {explainLoading ? (
                    <div style={{ textAlign: 'center', padding: 60 }}>
                      <Spin size="large" />
                      <p>AI 正在分析代码…</p>
                    </div>
                  ) : explanation ? (
                    <>
                      <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.8, background: '#fafafa', padding: 16, borderRadius: 8, marginBottom: 12 }}>
                        {explanation}
                      </div>
                      <Space wrap style={{ marginBottom: 12 }}>
                        <Button size="small" icon={<CopyOutlined />} onClick={() => copy(explanation)}>复制解释</Button>
                        <Button size="small" icon={<DownloadOutlined />} onClick={() => download(explanation, 'code-explanation.txt')}>下载 TXT</Button>
                      </Space>
                      {concepts.length > 0 && (
                        <div>
                          <Text type="secondary">关键概念：</Text>
                          <div style={{ marginTop: 8 }}>
                            {concepts.map((c) => <Tag key={c} color="cyan" style={{ marginBottom: 6 }}>{c}</Tag>)}
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <Empty description="点击「AI 解释代码」让 AI 分析你在上方编辑器中写的代码，了解其逻辑、关键概念与优化建议。" />
                  )}

                  <Divider>或生成代码示例</Divider>
                  <Space.Compact style={{ width: '100%' }}>
                    <Input
                      placeholder="输入概念，例如：闭包、排序算法、装饰器"
                      value={concept}
                      onChange={(e) => setConcept(e.target.value)}
                      onPressEnter={handleExample}
                    />
                    <Button icon={<CodeOutlined />} loading={exampleLoading} onClick={handleExample}>
                      生成示例
                    </Button>
                  </Space.Compact>
                  {example && (
                    <TerminalOutput content={example} variant="stdout" />
                  )}
                </div>
              ),
            },
            // ── Tab 2：运行代码 ───────────────────
            {
              key: 'run',
              label: <span><PlayCircleOutlined /> 运行代码</span>,
              children: (
                <div>
                  <div style={{ marginBottom: 16 }}>
                    <Button type="primary" size="large" icon={<PlayCircleOutlined />}
                      onClick={onRun} loading={running}>
                      执行代码
                    </Button>
                    <Text type="secondary" style={{ marginLeft: 12 }}>
                      {running ? '代码执行中…' : '点击按钮在沙盒中运行上方代码'}
                    </Text>
                  </div>

                  {runError && <Alert type="error" message={runError} style={{ marginBottom: 16 }} showIcon />}

                  {runResult ? (
                    <Space direction="vertical" style={{ width: '100%' }} size="middle">
                      {/* 状态标签 */}
                      <Space wrap>
                        <Tag color={statusColor[runResult.status]}>{runResult.status}</Tag>
                        <Tag>exitCode: {runResult.exitCode ?? '—'}</Tag>
                        <Tag>{runResult.durationMs} ms</Tag>
                        <Tag color="blue">{runResult.mode}</Tag>
                      </Space>

                      {runResult.deniedPatterns && runResult.deniedPatterns.length > 0 && (
                        <Alert type="warning" showIcon
                          message="检测到高危写法，已拒绝执行"
                          description={runResult.deniedPatterns.join('；')} />
                      )}

                      {/* stdout */}
                      <div>
                        <Text strong>标准输出</Text>
                        <TerminalOutput content={runResult.stdout} variant="stdout" />
                      </div>

                      {/* stderr */}
                      {runResult.stderr && (
                        <div>
                          <Text strong>错误输出</Text>
                          <TerminalOutput content={runResult.stderr} variant="stderr" />
                        </div>
                      )}

                      {runResult.note && <Text type="secondary">ℹ {runResult.note}</Text>}

                      {/* 串联工作流：AI 分析结果 */}
                      <Divider />
                      <div style={{
                        background: 'linear-gradient(135deg, #e6f7ff, #f0f5ff)',
                        padding: 16, borderRadius: 8, border: '1px solid #bae7ff',
                      }}>
                        <Space align="center" style={{ marginBottom: 8 }}>
                          <BulbOutlined style={{ color: '#1677ff', fontSize: 18 }} />
                          <Text strong style={{ fontSize: 15 }}>串联工作流</Text>
                        </Space>
                        <Paragraph type="secondary" style={{ marginBottom: 12 }}>
                          让 AI 分析执行输出，帮你理解程序的运行结果和潜在问题
                        </Paragraph>
                        <Button icon={<ThunderboltOutlined />}
                          onClick={handleAnalyzeOutput} loading={analyzingOutput}
                          disabled={!runResult.stdout && !runResult.stderr}>
                          AI 分析这段输出
                        </Button>
                        {outputAnalysis && (
                          <div style={{
                            marginTop: 12, whiteSpace: 'pre-wrap', lineHeight: 1.8,
                            background: '#fff', padding: 12, borderRadius: 6,
                            border: '1px solid #d9d9d9',
                          }}>
                            {outputAnalysis}
                          </div>
                        )}
                      </div>
                    </Space>
                  ) : (
                    <Empty description={running ? '执行中…' : '点击「执行代码」在安全沙盒中运行上方代码，查看输出结果'} />
                  )}
                </div>
              ),
            },
            // ── Tab 3：执行历史 ───────────────────
            {
              key: 'history',
              label: <span><HistoryOutlined /> 执行历史</span>,
              children: (
                <div>
                  {executionHistory.length === 0 ? (
                    <Empty description="暂无执行记录，在上方点击「执行代码」后，每次运行都会记录在这里" />
                  ) : (
                    executionHistory.map((record) => (
                      <Card
                        key={record.id}
                        size="small"
                        style={{ marginBottom: 8 }}
                        title={
                          <Space>
                            <Tag>{record.language}</Tag>
                            <Text type="secondary">{new Date(record.timestamp).toLocaleString()}</Text>
                            {record.result && (
                              <Tag color={statusColor[record.result.status] || 'default'}>
                                {record.result.status}
                              </Tag>
                            )}
                            {record.error && <Tag color="red">error</Tag>}
                          </Space>
                        }
                        extra={
                          <Space>
                            <Button size="small" type="link"
                              onClick={() => {
                                setLanguage(record.language);
                                setCode(record.code);
                                if (record.result) setRunResult(record.result);
                                setActiveTab('run');
                              }}>
                              重新加载
                            </Button>
                          </Space>
                        }
                      >
                        <div style={{ maxHeight: 200, overflow: 'auto' }}>
                          <pre style={{
                            background: '#0d1117', color: '#c9d1d9',
                            padding: 10, borderRadius: 4, fontSize: 11,
                            fontFamily: 'monospace', whiteSpace: 'pre-wrap', margin: 0,
                          }}>
                            {record.result?.stdout || record.error || '（无输出）'}
                          </pre>
                        </div>
                      </Card>
                    ))
                  )}
                </div>
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
}
