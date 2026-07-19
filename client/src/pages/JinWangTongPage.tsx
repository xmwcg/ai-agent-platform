import React from 'react';
import { Typography } from 'antd';
import { ShopOutlined } from '@ant-design/icons';

const { Title, Paragraph } = Typography;

/**
 * 金网通 - 企业局域网互联互通产品页面
 * 嵌入独立部署的购买/营销系统（通过 nginx 反代到宿主 store 服务）
 */
const JinWangTongPage: React.FC = () => {
  return (
    <div style={{ padding: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <ShopOutlined style={{ fontSize: 24, color: '#6366f1' }} />
        <Title level={3} style={{ margin: 0 }}>金网通 · 企业局域网互联互通</Title>
      </div>
      <Paragraph type="secondary" style={{ marginBottom: 16 }}>
        面向中小企业的局域网统一管控工具：资产发现、网络体检、上网行为管理、远程协助，一站式交付。
        选购授权后获得 License 文件，导入客户端即可激活使用。
      </Paragraph>
      <div style={{ background: '#fff', borderRadius: 8, overflow: 'hidden', border: '1px solid #eef1f5' }}>
        <iframe
          src="/jinwangtong/"
          title="金网通购买页"
          style={{ width: '100%', height: 'calc(100vh - 200px)', border: 'none' }}
        />
      </div>
    </div>
  );
};

export default JinWangTongPage;

