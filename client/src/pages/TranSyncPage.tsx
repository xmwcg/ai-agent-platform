import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Button, Card, Divider, Result, Space, Spin, Tag, Typography } from 'antd';
import {
  CustomerServiceOutlined,
  GlobalOutlined,
  LoginOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  SwapOutlined,
} from '@ant-design/icons';
import { Link, useLocation } from 'react-router-dom';
import { TRANSYNC_BASE_URL, transyncAssetUrl } from '@/config/transync';
import apiClient, { extractApiError } from '@/services/api';
import { useAuthStore } from '@/stores/auth';

const { Title, Paragraph, Text } = Typography;
const CONTAINER_ID = 'aibak-transync-workbench';

type EmbedStatus = 'loading' | 'ready' | 'error';
type SsoStatus = 'idle' | 'exchanging' | 'error';

function safeTranSyncAuthorizeUrl(value: unknown): string | null {
  if (!TRANSYNC_BASE_URL || typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    if (url.origin !== TRANSYNC_BASE_URL || url.pathname !== '/api/auth/aibak/callback') return null;
    return url.toString();
  } catch {
    return null;
  }
}

export default function TranSyncPage() {
  const location = useLocation();
  const authStatus = useAuthStore((state) => state.status);
  const user = useAuthStore((state) => state.user);
  const fetchProfile = useAuthStore((state) => state.fetchProfile);
  const [status, setStatus] = useState<EmbedStatus>('loading');
  const [reloadKey, setReloadKey] = useState(0);
  const [ssoStatus, setSsoStatus] = useState<SsoStatus>('idle');
  const [ssoError, setSsoError] = useState<string | null>(null);
  const ssoStarted = useRef(false);

  const query = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const ssoState = query.get('transync_sso_state');
  const ssoNext = query.get('transync_sso_next') || '/app';
  const translatorUrl = useMemo(
    () => (TRANSYNC_BASE_URL ? transyncAssetUrl(TRANSYNC_BASE_URL, '/app?mode=voice') : null),
    [],
  );
  const ssoStartUrl = useMemo(
    () => (TRANSYNC_BASE_URL
      ? transyncAssetUrl(TRANSYNC_BASE_URL, `/api/auth/aibak/start?next=${encodeURIComponent('/app?mode=voice')}`)
      : null),
    [],
  );

  useEffect(() => {
    if (authStatus === 'idle') void fetchProfile();
  }, [authStatus, fetchProfile]);

  useEffect(() => {
    if (!ssoState || authStatus !== 'authenticated' || !user || ssoStarted.current) return;
    ssoStarted.current = true;
    setSsoStatus('exchanging');
    setSsoError(null);

    void apiClient.post('/integrations/transync/tickets', { state: ssoState, next: ssoNext })
      .then((response: any) => {
        const authorizeUrl = safeTranSyncAuthorizeUrl(response?.data?.authorizeUrl);
        if (!authorizeUrl) throw new Error('服务端返回了无效的 TranSync 授权地址');
        window.location.replace(authorizeUrl);
      })
      .catch((error) => {
        ssoStarted.current = false;
        setSsoStatus('error');
        setSsoError(extractApiError(error, '统一登录暂时失败，请稍后重试'));
      });
  }, [authStatus, ssoNext, ssoState, user]);

  useEffect(() => {
    document.title = '实时翻译 · AIbak × TranSync';
    if (!TRANSYNC_BASE_URL) return;

    const container = document.getElementById(CONTAINER_ID);
    if (!container) return;
    container.innerHTML = '';
    container.removeAttribute('data-transync-mounted');
    setStatus('loading');

    const onReady = () => setStatus('ready');
    const onError = () => setStatus('error');
    window.addEventListener('transync:ready', onReady as EventListener);
    window.addEventListener('transync:error', onError as EventListener);

    const script = document.createElement('script');
    script.id = `aibak-transync-script-${reloadKey}`;
    script.src = transyncAssetUrl(TRANSYNC_BASE_URL, '/embed.js?v=0.3');
    script.async = true;
    script.dataset.mode = 'inline';
    script.dataset.container = `#${CONTAINER_ID}`;
    script.dataset.locale = 'zh-CN';
    script.dataset.source = 'auto';
    script.dataset.target = 'en';
    script.dataset.title = 'AIbak 多语言实时翻译';
    script.onerror = onError;
    document.body.appendChild(script);

    const timeout = window.setTimeout(() => {
      if (container.getAttribute('data-transync-mounted') !== 'true') setStatus('error');
    }, 12_000);

    return () => {
      window.clearTimeout(timeout);
      window.removeEventListener('transync:ready', onReady as EventListener);
      window.removeEventListener('transync:error', onError as EventListener);
      script.remove();
      container.innerHTML = '';
      container.removeAttribute('data-transync-mounted');
      container.classList.remove('ts-embed-root', 'ts-embed-inline');
    };
  }, [reloadKey]);

  if (!TRANSYNC_BASE_URL) {
    return (
      <div style={{ maxWidth: 980, margin: '0 auto', padding: '28px 16px 72px' }}>
        <Result
          status="warning"
          title="实时翻译服务暂未配置"
          subTitle="部署管理员需要在 AIBAK 前端构建环境设置 VITE_TRANSYNC_URL，然后重新构建客户端。"
          extra={[
            <Button type="primary" key="contact" icon={<CustomerServiceOutlined />}>
              <Link to="/contact">联系平台运营</Link>
            </Button>,
            <Button key="home"><Link to="/">返回首页</Link></Button>,
          ]}
        />
      </div>
    );
  }

  const loginRedirect = `/login?redirect=${encodeURIComponent(`${location.pathname}${location.search}`)}`;

  return (
    <div style={{ maxWidth: 1180, margin: '0 auto', padding: '24px 16px 72px' }}>
      <Card
        variant="borderless"
        style={{
          marginBottom: 18,
          background: 'linear-gradient(135deg, rgba(37,99,235,.14), rgba(14,165,233,.06))',
          border: '1px solid rgba(96,165,250,.24)',
        }}
      >
        <Space direction="vertical" size={10} style={{ width: '100%' }}>
          <Space wrap>
            <Tag color="blue" icon={<GlobalOutlined />}>AIbak × TranSync</Tag>
            <Tag color="cyan" icon={<SwapOutlined />}>实时多语言翻译</Tag>
            <Tag color="green" icon={<SafetyCertificateOutlined />}>一次性授权码登录</Tag>
          </Space>
          <Title level={2} style={{ margin: 0 }}>多语言实时翻译工作台</Title>
          <Paragraph style={{ maxWidth: 820, margin: 0, fontSize: 16 }}>
            在 AIbak 内直接调用 TranSync 文本翻译服务，并可通过完整工作台进入连续语音识别、自动翻译与语音播报。翻译引擎、限流与服务状态由 TranSync 统一维护，
            AIBAK 不复制支付密钥或翻译供应商密钥。
          </Paragraph>
          <Space wrap>
            {authStatus === 'authenticated' && ssoStartUrl ? (
              <Button type="primary" href={ssoStartUrl} icon={<CustomerServiceOutlined />}>
                使用 AIbak 账号进入实时语音与完整翻译器
              </Button>
            ) : (
              <Button type="primary" icon={<LoginOutlined />}>
                <Link to={loginRedirect}>登录后同步翻译账号</Link>
              </Button>
            )}
            <Button href={translatorUrl || undefined} target="_blank" rel="noopener noreferrer">
              访客打开翻译器
            </Button>
            <Button href="/pricing?source=transync" target="_blank" rel="noopener noreferrer">
              查看翻译套餐
            </Button>
          </Space>
        </Space>
      </Card>

      {ssoState && authStatus === 'unauthenticated' && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 18 }}
          message="登录 AIbak 后继续"
          description={<span>TranSync 正在等待账号授权。<Link to={loginRedirect}>立即登录</Link>，登录后会自动继续。</span>}
        />
      )}
      {ssoStatus === 'exchanging' && (
        <Alert type="info" showIcon style={{ marginBottom: 18 }} message="正在安全连接 TranSync 账号…" />
      )}
      {ssoStatus === 'error' && (
        <Alert
          type="error"
          showIcon
          closable
          style={{ marginBottom: 18 }}
          message="统一登录失败"
          description={ssoError}
          action={<Button size="small" onClick={() => window.location.reload()}>重试</Button>}
        />
      )}

      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 18 }}
        message="跨产品账号桥接已接入"
        description="点击“使用 AIbak 账号进入实时语音与完整翻译器”时，会使用 90 秒一次性授权码建立 TranSync 会话；不会把 AIbak JWT、Cookie、微信支付私钥或翻译供应商密钥发送到浏览器或另一个产品。"
      />

      <div style={{ position: 'relative', minHeight: 520 }}>
        {status === 'loading' && (
          <div style={{ position: 'absolute', inset: 0, zIndex: 2, display: 'grid', placeItems: 'center', background: 'rgba(255,255,255,.72)', borderRadius: 16 }}>
            <Space direction="vertical" align="center"><Spin size="large" /><Text>正在连接实时翻译服务…</Text></Space>
          </div>
        )}
        {status === 'error' && (
          <Card style={{ marginBottom: 16, borderColor: '#ffccc7' }}>
            <Result
              status="error"
              title="翻译组件加载失败"
              subTitle="可能是服务暂时不可用、生产 CSP 未放行翻译域名，或 VITE_TRANSYNC_URL 配置错误。你仍可打开完整翻译器。"
              extra={[
                <Button key="retry" type="primary" icon={<ReloadOutlined />} onClick={() => setReloadKey((value) => value + 1)}>重新连接</Button>,
                <Button key="external" href={translatorUrl || undefined} target="_blank" rel="noopener noreferrer">打开完整翻译器</Button>,
              ]}
            />
          </Card>
        )}
        <div id={CONTAINER_ID} aria-busy={status === 'loading'} />
      </div>

      <Divider />
      <Text type="secondary">
        使用此服务即表示翻译内容将按 TranSync 的服务条款和隐私政策处理；请勿提交密码、私钥或其他高敏感信息。
      </Text>
    </div>
  );
}
