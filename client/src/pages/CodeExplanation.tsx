import { useState } from 'react';
import {
  Card, Typography, Button, Space, Select, Radio, Input, Tag, Spin, message, Divider
} from 'antd';
import { ThunderboltOutlined, CodeOutlined, CopyOutlined, DownloadOutlined } from '@ant-design/icons';
import { codeAPI , extractApiError} from '@/services/api';

const { Title, Paragraph, Text } = Typography;
const { TextArea } = Input;

const LANGS = [
  { value: 'javascript', label: 'JavaScript' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'python', label: 'Python' },
  { value: 'java', label: 'Java' },
  { value: 'cpp', label: 'C++' },
  { value: 'go', label: 'Go' },
  { value: 'rust', label: 'Rust' },
  { value: 'html', label: 'HTML' },
  { value: 'css', label: 'CSS' },
  { value: 'sql', label: 'SQL' },
  { value: 'shell', label: 'Shell' },
];

const SAMPLE = `function fib(n) {
  if (n < 2) return n;
  return fib(n - 1) + fib(n - 2);
}`;

export default function CodeExplanation() {
  const [code, setCode] = useState(SAMPLE);
  const [language, setLanguage] = useState('javascript');
  const [level, setLevel] = useState<'brief' | 'detailed' | 'teaching'>('detailed');
  const [loading, setLoading] = useState(false);
  const [explanation, setExplanation] = useState('');
  const [concepts, setConcepts] = useState<string[]>([]);
  const [concept, setConcept] = useState('');
  const [example, setExample] = useState('');
  const [exampleLoading, setExampleLoading] = useState(false);

  const handleExplain = async () => {
    if (!code.trim()) {
      message.warning('请输入要解释的代码片段');
      return;
    }
    setLoading(true);
    try {
      const res: any = await codeAPI.explain({ code, language, level });
      setExplanation(res.explanation || '（无返回）');
      setConcepts(res.concepts || []);
    } catch (err) {
      message.error(extractApiError(err, '解释失败，请稍后重试'));
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text).then(() => message.success("已复制到剪贴板"), () => message.error("复制失败"));
  };
  const handleDownload = (text: string, filename: string) => {
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
    message.success("下载已开始");
  };

  const handleExample = async () => {
    if (!concept.trim()) {
      message.warning('请输入要生成示例的概念');
      return;
    }
    setExampleLoading(true);
    try {
      const res: any = await codeAPI.example({ concept, language });
      setExample(res.example || '（无返回）');
    } catch (err) {
      message.error(extractApiError(err, '生成示例失败'));
    } finally {
      setExampleLoading(false);
    }
  };

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <Space>
          <CodeOutlined style={{ fontSize: 22, color: '#13c2c2' }} />
          <Title level={3} style={{ margin: 0 }}>代码解释器</Title>
        </Space>
        <Paragraph type="secondary" style={{ marginTop: 8 }}>
          粘贴任意代码片段，AI 将逐行解释其逻辑、关键概念与优化建议。支持 11 种编程语言与三种讲解深度。
        </Paragraph>
      </Card>

      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <Card style={{ flex: 1, minWidth: 360 }}>
          <Space style={{ marginBottom: 12 }}>
            <Select
              value={language}
              onChange={setLanguage}
              options={LANGS}
              style={{ width: 160 }}
            />
            <Radio.Group
              value={level}
              onChange={(e) => setLevel(e.target.value)}
              optionType="button"
              buttonStyle="solid"
            >
              <Radio.Button value="brief">简略</Radio.Button>
              <Radio.Button value="detailed">详细</Radio.Button>
              <Radio.Button value="teaching">教学</Radio.Button>
            </Radio.Group>
          </Space>
          <TextArea
            value={code}
            onChange={(e) => setCode(e.target.value)}
            autoSize={{ minRows: 12, maxRows: 24 }}
            style={{ fontFamily: 'monospace', fontSize: 13 }}
          />
          <Button
            type="primary"
            icon={<ThunderboltOutlined />}
            loading={loading}
            onClick={handleExplain}
            style={{ marginTop: 12 }}
            block
          >
            解释代码
          </Button>

          <Divider>或生成代码示例</Divider>
          <Space.Compact style={{ width: '100%' }}>
            <Input
              placeholder="概念，例如：闭包"
              value={concept}
              onChange={(e) => setConcept(e.target.value)}
              onPressEnter={handleExample}
            />
            <Button
              icon={<CodeOutlined />}
              loading={exampleLoading}
              onClick={handleExample}
            >
              生成
            </Button>
          </Space.Compact>
          {example && (
            <pre style={{ background: '#0d1117', color: '#c9d1d9', padding: 12, borderRadius: 6, marginTop: 12, overflow: 'auto', fontSize: 12 }}>
              {example}
            </pre>
          )}
        </Card>

        <Card style={{ flex: 1, minWidth: 360 }}>
          <Title level={5}>解析结果</Title>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 60 }}>
              <Spin size="large" />
              <p>AI 正在分析代码…</p>
            </div>
          ) : explanation ? (
            <>
              <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.8 }}>{explanation}</div>
              <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Button size="small" icon={<CopyOutlined />} onClick={() => handleCopy(explanation)}>复制解释</Button>
                <Button size="small" icon={<DownloadOutlined />} onClick={() => handleDownload(explanation, "code-explanation.txt")}>下载 TXT</Button>
              </div>
              {concepts.length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <Text type="secondary">关键概念：</Text>
                  <div style={{ marginTop: 8 }}>
                    {concepts.map((c) => (
                      <Tag key={c} color="cyan" style={{ marginBottom: 6 }}>{c}</Tag>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <Paragraph type="secondary">在左侧输入代码并点击「解释代码」。</Paragraph>
          )}
        </Card>
      </div>
    </div>
  );
}
