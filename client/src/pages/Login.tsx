import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Card, Form, Input, Button, Typography, message, Divider, Tabs, Alert,
} from 'antd';
import {
  MailOutlined, LockOutlined, MobileOutlined, WechatOutlined, SafetyOutlined,
} from '@ant-design/icons';
import apiClient, { extractApiError } from '@/services/api';
import { useAuthStore } from '@/stores/auth';

const { Title, Text } = Typography;

interface LoginForm { email: string; password: string; }
interface SmsForm { phone: string; code: string; }

/** 检测移动端浏览器（用于抖音 H5 跳转授权） */
function isMobile(): boolean {
  return /Mobile|Android|iPhone|iPod|Windows Phone/i.test(navigator.userAgent);
}

/** 统一收口：拿到 token+user 后写入 store 并跳转 */
function useFinishLogin() {
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);
  return (token: string, user: any) => {
    login(token, user);
    message.success('登录成功');
    navigate('/');
  };
}

export default function Login() {
  const [emailLoading, setEmailLoading] = useState(false);
  const [smsLoading, setSmsLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [wxLoading, setWxLoading] = useState(false);
  const [wxNotice, setWxNotice] = useState<string | null>(null);
  const [dyLoading, setDyLoading] = useState(false);

  const finishLogin = useFinishLogin();
  const popupRef = useRef<Window | null>(null);
  // 后端下发的可用登录方式（缺密钥的渠道自动隐藏，配置即生效）
  const [methods, setMethods] = useState<{
    email: boolean; wechat: boolean; sms: boolean; douyin: boolean;
    wechatMock: boolean; douyinMock: boolean;
  }>({
    email: true, wechat: false, sms: false, douyin: false,
    wechatMock: false, douyinMock: false,
  });

  useEffect(() => {
    apiClient.get('/auth/login-methods').then((r: any) => {
      if (r?.data) setMethods({
        email: true,
        wechat: !!r.data.wechat,
        sms: !!r.data.sms,
        douyin: !!r.data.douyin,
        wechatMock: !!r.data.wechatMock,
        douyinMock: !!r.data.douyinMock,
      });
    }).catch(() => { /* 探测失败则用默认（仅邮箱） */ });
  }, []);

  // ─── 第三方扫码弹窗回调监听（微信 + 抖音统一处理） ───
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      // 微信回调
      if (e.data?.type === 'wechat_login' && e.data?.token) {
        handleOAuthCallback(e.data.token);
      }
      // 抖音回调
      if (e.data?.type === 'douyin_login' && e.data?.token) {
        handleOAuthCallback(e.data.token);
      }
    };
    const handleOAuthCallback = (token: string) => {
      apiClient.get('/auth/profile', { headers: { Authorization: `Bearer ${token}` } })
        .then((res: any) => finishLogin(token, res.user ?? res.data ?? res))
        .catch(() => { message.error('第三方登录校验失败'); });
      try { popupRef.current?.close(); } catch { /* noop */ }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [finishLogin]);

  // 手机号验证码 60s 倒计时
  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  // ─── 邮箱密码登录 ───
  const onEmailFinish = async (values: LoginForm) => {
    setEmailLoading(true);
    try {
      const res: any = await apiClient.post('/auth/login', values);
      if (res.token) finishLogin(res.token, res.user);
    } catch (err) {
      message.error(extractApiError(err, '登录失败'));
    } finally {
      setEmailLoading(false);
    }
  };

  // ─── 手机号 + 验证码 ───
  const sendSms = async (phone: string) => {
    if (!/^1[3-9]\d{9}$/.test(phone)) { message.warning('请输入正确的手机号'); return; }
    setSending(true);
    try {
      await apiClient.post('/auth/sms/send', { phone });
      setCountdown(60);
      message.success('验证码已发送，请查收短信');
    } catch (err) {
      message.error(extractApiError(err, '发送失败'));
    } finally {
      setSending(false);
    }
  };

  const onSmsFinish = async (values: SmsForm) => {
    setSmsLoading(true);
    try {
      const res: any = await apiClient.post('/auth/sms/login', values);
      if (res.token) finishLogin(res.token, res.user);
    } catch (err) {
      message.error(extractApiError(err, '登录失败'));
    } finally {
      setSmsLoading(false);
    }
  };

  // ─── 微信扫码登录（仅后端确认真实配置可用时展示） ───
  const startWechatLogin = async () => {
    setWxLoading(true);
    setWxNotice(null);
    try {
      const res: any = await apiClient.get('/auth/wechat/qr');
      const { mock, authorizeUrl } = res;
      if (mock || typeof authorizeUrl !== 'string' || !authorizeUrl.startsWith('https://open.weixin.qq.com/')) {
        throw new Error('微信登录未配置真实授权地址');
      }
      // 已配置：打开微信授权页（自带二维码），扫码后回调页 postMessage 回传 token
      const popup = window.open(
        authorizeUrl, 'wechat_login',
        'width=420,height=540,menubar=no,toolbar=no,location=no,status=no',
      );
      popupRef.current = popup;
      if (!popup) message.warning('浏览器拦截了弹窗，请允许本站点弹窗后重试');
    } catch (err) {
      message.error(extractApiError(err, '微信登录启动失败'));
    } finally {
      setWxLoading(false);
    }
  };

  // ─── 抖音扫码/H5 登录（PC 弹窗 + 移动端 H5 跳转） ───
  const startDouyinLogin = async () => {
    setDyLoading(true);
    try {
      // 移动端：H5 跳转授权（不弹窗，直接跳转）；PC 端：弹窗扫码
      const endpoint = isMobile() ? '/auth/douyin/h5' : '/auth/douyin/qr';
      const res: any = await apiClient.get(endpoint);
      const { mock, authorizeUrl } = res;

      if (mock) {
        // Mock 模式：直接模拟回调（便于前端开发，无需真实抖音 App）
        message.info('抖音登录 Mock 模式：未配置 DOUYIN_CLIENT_KEY，模拟登录流程');
        // 模拟 postMessage 回调
        setTimeout(() => {
          const mockEvent = new MessageEvent('message', {
            data: { type: 'douyin_login', token: 'mock_token_placeholder' },
          });
          window.dispatchEvent(mockEvent);
        }, 500);
        return;
      }

      if (typeof authorizeUrl !== 'string' || !authorizeUrl.startsWith('https://open.douyin.com/')) {
        throw new Error('抖音登录未配置真实授权地址');
      }

      if (isMobile()) {
        // 移动端：直接跳转到抖音授权页（授权后回调会带 code 重定向回来）
        window.location.href = authorizeUrl;
      } else {
        // PC 端：弹窗扫码
        const popup = window.open(
          authorizeUrl, 'douyin_login',
          'width=420,height=540,menubar=no,toolbar=no,location=no,status=no',
        );
        popupRef.current = popup;
        if (!popup) message.warning('浏览器拦截了弹窗，请允许本站点弹窗后重试');
      }
    } catch (err) {
      message.error(extractApiError(err, '抖音登录启动失败'));
    } finally {
      setDyLoading(false);
    }
  };

  const emailPanel = (
    <Form name="login" onFinish={onEmailFinish} layout="vertical" size="large">
      <Form.Item name="email" rules={[
        { required: true, message: '请输入邮箱' },
        { type: 'email', message: '邮箱格式不正确' },
      ]}>
        <Input prefix={<MailOutlined />} placeholder="邮箱" />
      </Form.Item>
      <Form.Item name="password" rules={[{ required: true, message: '请输入密码' }]}>
        <Input.Password prefix={<LockOutlined />} placeholder="密码" />
      </Form.Item>
      <Form.Item>
        <Button type="primary" htmlType="submit" block loading={emailLoading}>登录</Button>
      </Form.Item>
    </Form>
  );

  const smsPanel = (
    <Form name="sms" onFinish={onSmsFinish} layout="vertical" size="large">
      <Form.Item name="phone" rules={[
        { required: true, message: '请输入手机号' },
        { pattern: /^1[3-9]\d{9}$/, message: '手机号格式不正确' },
      ]}>
        <Input prefix={<MobileOutlined />} placeholder="手机号" maxLength={11} />
      </Form.Item>
      <Form.Item name="code" rules={[{ required: true, message: '请输入验证码' }]}>
        <Input
          prefix={<SafetyOutlined />}
          placeholder="短信验证码"
          maxLength={6}
          addonAfter={
            <span
              onClick={() => {
                const phone = (document.querySelector('input[placeholder="手机号"]') as HTMLInputElement)?.value || '';
                if (!countdown) sendSms(phone);
              }}
              style={{ cursor: countdown ? 'not-allowed' : 'pointer', color: countdown ? '#bbb' : '#6c5ce7', userSelect: 'none' }}
            >
              {countdown ? `${countdown}s` : '获取验证码'}
            </span>
          }
        />
      </Form.Item>
      <Form.Item>
        <Button type="primary" htmlType="submit" block loading={smsLoading}>登录 / 注册</Button>
      </Form.Item>
    </Form>
  );

  const wechatPanel = (
    <div style={{ textAlign: 'center', padding: '8px 0' }}>
      {wxNotice && <Alert type="info" showIcon message={wxNotice} style={{ marginBottom: 16, textAlign: 'left' }} />}
      <Button
        type="primary"
        block
        size="large"
        icon={<WechatOutlined />}
        loading={wxLoading}
        onClick={startWechatLogin}
        style={{ background: '#07c160', borderColor: '#07c160', height: 48 }}
      >
        微信扫码登录
      </Button>
      <Text type="secondary" style={{ display: 'block', marginTop: 12, fontSize: 12 }}>
        扫码后自动创建/绑定账号，安全便捷
      </Text>
    </div>
  );

  const douyinPanel = (
    <div style={{ textAlign: 'center', padding: '8px 0' }}>
      <Button
        type="primary"
        block
        size="large"
        loading={dyLoading}
        onClick={startDouyinLogin}
        style={{ background: '#000', borderColor: '#000', height: 48, color: '#fff' }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 20 }}>🎵</span>
          {isMobile() ? '抖音授权登录' : '抖音扫码登录'}
        </span>
      </Button>
      <Text type="secondary" style={{ display: 'block', marginTop: 12, fontSize: 12 }}>
        {isMobile() ? '点击后跳转抖音 App 授权' : '扫码后自动创建/绑定账号'}
      </Text>
    </div>
  );

  // 按后端可用登录方式动态组装（缺密钥的渠道自动隐藏，Mock 模式也展示便于开发）
  const showWechat = methods.wechat || methods.wechatMock;
  const showDouyin = methods.douyin || methods.douyinMock;
  const tabs = [
    { key: 'email', label: '邮箱登录', children: emailPanel },
    ...(methods.sms ? [{ key: 'sms', label: '手机号', children: smsPanel }] : []),
    ...(showWechat ? [{ key: 'wechat', label: '微信扫码', children: wechatPanel }] : []),
    ...(showDouyin ? [{ key: 'douyin', label: '抖音', children: douyinPanel }] : []),
  ];

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: 16,
    }}>
      <Card style={{ width: 440, maxWidth: '100%', boxShadow: '0 8px 24px rgba(0,0,0,0.15)' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <Title level={2} style={{ marginBottom: 4 }}>欢迎回来</Title>
          <Text type="secondary">登录到 AIbak · 全站 AI 应用平台</Text>
        </div>

        {tabs.length > 1 ? (
          <Tabs centered items={tabs} />
        ) : (
          emailPanel
        )}

        <Divider />

        <div style={{ textAlign: 'center' }}>
          <Text>还没有账号？</Text>
          <Link to="/register" style={{ marginLeft: 4 }}>立即注册</Link>
        </div>
      </Card>
    </div>
  );
}
