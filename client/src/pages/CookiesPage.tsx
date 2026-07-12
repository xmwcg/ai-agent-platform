import { Typography, Divider, Table } from 'antd';

const { Title, Paragraph, Text } = Typography;

const COOKIE_TYPES = [
  { key: '1', type: '必要 Cookie', purpose: '维持登录状态、保障安全、记住基础偏好', canDisable: '否' },
  { key: '2', type: '功能 Cookie', purpose: '记住主题、语言、侧边栏折叠等界面设置', canDisable: '是' },
  { key: '3', type: '分析 Cookie', purpose: '统计访问量与功能使用情况，用于优化产品', canDisable: '是' },
  { key: '4', type: '偏好 Cookie', purpose: '记录常用模型、工具等个性化配置', canDisable: '是' },
];

export default function CookiesPage() {
  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: 24 }}>
      <Title level={2}>Cookies 政策</Title>
      <Paragraph type="secondary">最后更新日期：{new Date().getFullYear()}-07-12</Paragraph>
      <Divider />

      <Paragraph>
        本 Cookies 政策说明 <Text strong>AIbak</Text>（域名 aibak.site，以下简称「本平台」）如何在您使用平台时
        使用 Cookie 及类似技术（如 localStorage）。继续使用本平台即表示您同意本政策所述的 Cookie 使用方式。
      </Paragraph>

      <Title level={4}>1. 什么是 Cookie</Title>
      <Paragraph>
        Cookie 是网站在您浏览器中存储的小型文本文件，用于识别您的设备、记住您的偏好、
        保障账户安全以及分析平台使用情况。本平台同时使用浏览器的 localStorage 存储必要的界面偏好与免费额度计数。
      </Paragraph>

      <Title level={4}>2. 我们使用的 Cookie 类型</Title>
      <Table
        size="middle"
        pagination={false}
        style={{ marginBottom: 16 }}
        columns={[
          { title: '类型', dataIndex: 'type', width: 140 },
          { title: '用途', dataIndex: 'purpose' },
          { title: '可否关闭', dataIndex: 'canDisable', width: 100 },
        ]}
        dataSource={COOKIE_TYPES}
      />

      <Title level={4}>3. 第三方 Cookie</Title>
      <Paragraph>
        为提供支付、登录、内容分发等服务，第三方（如微信支付、支付宝、云服务商）可能设置其自身的 Cookie。
        这些 Cookie 受相应第三方隐私政策约束。
      </Paragraph>

      <Title level={4}>4. 如何管理 Cookie</Title>
      <Paragraph>
        您可以通过浏览器设置随时清除或禁用 Cookie。请注意，禁用必要 Cookie 可能导致登录、支付等核心功能无法正常使用。
        您也可以在浏览器中清除本平台的 localStorage 以重置界面偏好。
      </Paragraph>

      <Title level={4}>5. 政策变更</Title>
      <Paragraph>
        我们可能不时更新本政策，更新后将在本页面公布。相关变更自公布之日起生效。
      </Paragraph>

      <Divider />
      <Paragraph type="secondary">
        如对本政策有任何疑问，请通过 <a href="/contact">联系我们</a> 页面与我们取得联系。
      </Paragraph>
    </div>
  );
}
