import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Card, Form, Input, Button, Typography, message, Divider, Checkbox } from 'antd';
import { MailOutlined, LockOutlined, UserOutlined } from '@ant-design/icons';
import apiClient, { extractApiError } from '@/services/api';

const { Title, Text, Link: TextLink } = Typography;

interface RegisterForm {
  email: string;
  password: string;
  confirm: string;
  name: string;
  agreement: boolean;
}

export default function Register() {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const onFinish = async (values: RegisterForm) => {
    setLoading(true);
    try {
      const res: any = await apiClient.post('/auth/register', {
        email: values.email,
        password: values.password,
        name: values.name,
        acceptTerms: true,
        acceptPrivacy: true,
      });
      if (res.token) {
        localStorage.setItem('token', res.token);
        localStorage.setItem('user', JSON.stringify(res.user));
        message.success('注册成功');
        navigate('/');
      }
    } catch (err) {
      message.error(extractApiError(err, '注册失败'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
    }}>
      <Card style={{ width: 420, boxShadow: '0 8px 24px rgba(0,0,0,0.15)' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <Title level={2} style={{ marginBottom: 4 }}>创建账号</Title>
          <Text type="secondary">注册 AIbak · 打造您的全栈 AI 应用平台</Text>
        </div>

        <Form
          name="register"
          onFinish={onFinish}
          layout="vertical"
          size="large"
          initialValues={{ agreement: false }}
        >
          <Form.Item
            name="name"
            rules={[{ required: true, message: '请输入用户名' }]}
          >
            <Input prefix={<UserOutlined />} placeholder="用户名" />
          </Form.Item>

          <Form.Item
            name="email"
            rules={[
              { required: true, message: '请输入邮箱' },
              { type: 'email', message: '邮箱格式不正确' }
            ]}
          >
            <Input prefix={<MailOutlined />} placeholder="邮箱" />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[
              { required: true, message: '请输入密码' },
              { min: 10, message: '密码至少 10 位，建议包含大小写字母和数字' },
              {
                pattern: /^(?=.*[a-zA-Z])(?=.*\d)/,
                message: '密码必须包含至少一个字母和一个数字',
              }
            ]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="密码（至少10位，含字母和数字）" />
          </Form.Item>

          <Form.Item
            name="confirm"
            dependencies={['password']}
            rules={[
              { required: true, message: '请确认密码' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('password') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('两次输入的密码不一致'));
                }
              })
            ]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="确认密码" />
          </Form.Item>

          <Form.Item
            name="agreement"
            valuePropName="checked"
            rules={[
              {
                validator: (_, value) =>
                  value ? Promise.resolve() : Promise.reject(new Error('请阅读并同意服务协议和隐私政策')),
              },
            ]}
          >
            <Checkbox>
              我已阅读并同意{' '}
              <TextLink href="/terms" target="_blank">《服务条款》</TextLink>
              {' '}和{' '}
              <TextLink href="/privacy" target="_blank">《隐私政策》</TextLink>
            </Checkbox>
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" block loading={loading}>
              注册
            </Button>
          </Form.Item>
        </Form>

        <Divider />

        <div style={{ textAlign: 'center' }}>
          <Text>已有账号？</Text>
          <Link to="/login" style={{ marginLeft: 4 }}>立即登录</Link>
        </div>
      </Card>
    </div>
  );
}
