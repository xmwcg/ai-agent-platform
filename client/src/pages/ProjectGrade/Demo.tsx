import React, { useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Col,
  Form,
  Input,
  List,
  Row,
  Space,
  Statistic,
  Tag,
  Typography,
} from 'antd';
import { CheckCircleOutlined, ExclamationCircleOutlined, RocketOutlined } from '@ant-design/icons';
import { Link } from 'react-router-dom';
import { SeoHelmet } from './components/SeoHelmet';
import { buildProjectGradeImportPath } from './project-import';
import { buildLoginPath } from '@/utils/safe-return-to';
import { buildProjectGradeUpgradeUrl } from '../Pricing/payment-context';

const { Title, Paragraph, Text } = Typography;

type CheckStatus = 'pass' | 'warning' | 'fail';

interface PublicUrlScanResult {
  title: string;
  summary: string;
  scan: {
    requestedUrl: string;
    finalUrl: string;
    statusCode: number;
    durationMs: number;
    checks: Array<{ key: string; status: CheckStatus; title: string; detail: string }>;
    metadata: { title?: string };
    evidenceScope: 'single_server_http_observation';
    productionAcceptance: false;
    note: string;
  };
  summaryMetrics: {
    score: number;
    status: 'healthy' | 'needs_review' | 'needs_attention';
    pass: number;
    warning: number;
    fail: number;
  };
  persisted: false;
  productionAcceptance: false;
}

const statusLabel: Record<CheckStatus, string> = {
  pass: '通过',
  warning: '待关注',
  fail: '失败',
};

const statusColor: Record<CheckStatus, string> = {
  pass: 'success',
  warning: 'warning',
  fail: 'error',
};

/**
 * 匿名 URL 体检是公开获客入口：只做一次受限的 HTTP/HTML 观察。
 * 用户登录后可将网址保存为项目，继续使用完整的历史、证据和整改工作台。
 */
const Demo: React.FC = () => {
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<PublicUrlScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attributionSessionId, setAttributionSessionId] = useState<string | null>(null);

  const onFinish = async (values: { url: string }) => {
    setSubmitting(true);
    setResult(null);
    setError(null);
    try {
      const apiBase =
        (typeof window !== 'undefined' &&
          (window as Window & { __AIBAK_API__?: string }).__AIBAK_API__) ||
        '/api/project-grade';
      const response = await fetch(`${apiBase}/public/url-scan`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url: values.url }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.data) {
        const code = String(payload?.code || '');
        setError(
          code === 'PROJECT_GRADE_EXTERNAL_SCANNING_DISABLED'
            ? '免费公开网址体检尚未在生产环境显式开启。你仍可登录创建项目，等待服务端安全评估能力开放。'
            : payload?.message || payload?.error || `HTTP ${response.status}`
        );
        return;
      }
      setResult(payload.data as PublicUrlScanResult);
    } catch (requestError: unknown) {
      setError(requestError instanceof Error ? requestError.message : '网络异常，请稍后重试');
    } finally {
      setSubmitting(false);
    }
  };

  const projectImportPath = result
    ? buildProjectGradeImportPath(result.scan.finalUrl || result.scan.requestedUrl)
    : '/project-grade/projects';
  const authenticated =
    typeof window !== 'undefined' && Boolean(window.localStorage.getItem('token'));
  const saveProjectPath = authenticated ? projectImportPath : buildLoginPath(projectImportPath) + (attributionSessionId ? "&sessionId=" + encodeURIComponent(attributionSessionId) : "");

  return (
    <div style={{ padding: '32px 24px', maxWidth: 960, margin: '0 auto' }}>
      <SeoHelmet
        title="AIbak 智评通 · 免费公开网址体检"
        description="输入公开 URL，获取 AIbak 智评通基于 HTTPS、页面标记、链接与安全响应头的免费快速观察。"
        url="https://aibak.site/project-grade/demo"
        type="website"
      />

      <Title level={2} style={{ marginTop: 0 }}>
        免费公开网址体检
      </Title>
      <Paragraph type="secondary">
        输入一个公开网址，获取一次受限的 HTTP 与静态 HTML 快速观察。无需登录，每个匿名来源每小时最多
        5 次。 该结果不会保存、不会访问私网地址，也不会替代完整的浏览器、性能、支付或生产验收。
      </Paragraph>

      <Card style={{ marginTop: 16 }}>
        <Form layout="vertical" form={form} onFinish={onFinish}>
          <Form.Item
            name="url"
            label="目标网址"
            rules={[
              { required: true, message: '请输入网址' },
              { type: 'url', message: '请输入完整 http/https URL，例如 https://example.com' },
            ]}
          >
            <Input size="large" placeholder="https://example.com" autoComplete="url" />
          </Form.Item>
          <Space wrap>
            <Button
              type="primary"
              htmlType="submit"
              icon={<RocketOutlined />}
              loading={submitting}
              size="large"
            >
              立即免费体检
            </Button>
            <Text type="secondary" style={{ fontSize: 12 }}>
              仅支持公开 HTTP(S) 地址，响应体上限 2MB。
            </Text>
          </Space>
        </Form>
      </Card>

      {error && (
        <Alert
          style={{ marginTop: 16 }}
          showIcon
          type="error"
          message="体检未完成"
          description={error}
        />
      )}

      {result && (
        <Card style={{ marginTop: 16 }}>
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <div>
              <Title level={3} style={{ margin: 0 }}>
                {result.title}
              </Title>
              <Text type="secondary">{result.summary}</Text>
            </div>

            <Alert
              type={
                result.summaryMetrics.fail > 0
                  ? 'error'
                  : result.summaryMetrics.warning > 0
                    ? 'warning'
                    : 'success'
              }
              showIcon
              message={`快速观察指数 ${result.summaryMetrics.score}/100`}
              description="这是本次静态观察的提示指标，不是最终商用评级或生产验收结论。"
            />

            <Row gutter={[16, 16]}>
              <Col xs={12} sm={6}>
                <Statistic title="HTTP 状态" value={result.scan.statusCode} />
              </Col>
              <Col xs={12} sm={6}>
                <Statistic title="耗时" value={result.scan.durationMs} suffix="ms" />
              </Col>
              <Col xs={12} sm={6}>
                <Statistic
                  title="通过"
                  value={result.summaryMetrics.pass}
                  valueStyle={{ color: '#389e0d' }}
                />
              </Col>
              <Col xs={12} sm={6}>
                <Statistic
                  title="待处理"
                  value={result.summaryMetrics.warning + result.summaryMetrics.fail}
                  valueStyle={{ color: '#d46b08' }}
                />
              </Col>
            </Row>

            <List
              size="small"
              bordered
              dataSource={result.scan.checks}
              renderItem={(item) => (
                <List.Item>
                  <Space align="start" style={{ width: '100%', justifyContent: 'space-between' }}>
                    <span>
                      {item.status === 'pass' ? (
                        <CheckCircleOutlined style={{ color: '#389e0d', marginRight: 8 }} />
                      ) : (
                        <ExclamationCircleOutlined style={{ color: '#d46b08', marginRight: 8 }} />
                      )}
                      <strong>{item.title}</strong>
                      <br />
                      <Text type="secondary">{item.detail}</Text>
                    </span>
                    <Tag color={statusColor[item.status]}>{statusLabel[item.status]}</Tag>
                  </Space>
                </List.Item>
              )}
            />

            <Alert
              type="info"
              showIcon
              message="下一步：保存为项目，获得可追踪的商业就绪度评估"
              description={result.scan.note}
            />
            <Space wrap>
              <Link to={saveProjectPath}>
                <Button type="primary">
                  {authenticated ? '保存为项目并由服务端重新体检' : '登录后保存项目与继续评估'}
                </Button>
              </Link>
              <Link to={buildProjectGradeUpgradeUrl()}>
                <Button>查看专业版与团队版</Button>
              </Link>
              <Link to="/customer-service">
                <Button type="link">咨询企业评估服务</Button>
              </Link>
            </Space>
          </Space>
        </Card>
      )}
    </div>
  );
};

export default Demo;
