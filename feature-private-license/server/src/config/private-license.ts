/**
 * 私有化授权（企业版）套餐定义 —— 复用金网通 License 机制
 *
 * 与现有 billing.ts 的订阅/积分包完全平行，互不干扰：
 * - 订阅、积分包仍走 credit-ledger 积分账本；
 * - 私有化订单走独立 orderType='private_license'，履约时调金网通签发 License，
 *   不进积分账本（避免双账本冲突）。
 *
 * 金额单位统一为「分（cent）」。
 * License 签发对接：同机 /opt/jinwangtong/store（license-issuer 的 POST /api/admin/issue）。
 */

export interface PrivateLicensePackage {
  id: string;
  name: string;
  tagline: string;
  /** 授权版本标识，将原样传给金网通 issue 接口作为 license 的 product/version */
  version: string;
  /** 价格（分） */
  price: number;
  /** 授权有效期（天），-1 表示永久 */
  validDays: number;
  /** 是否允许私有化部署（离线激活） */
  offline: boolean;
  /** 最大并发/坐席数（企业版意义） */
  seats: number;
  features: string[];
  highlighted?: boolean;
}

export const PRIVATE_LICENSE_PACKAGES: PrivateLicensePackage[] = [
  {
    id: 'ent-standard',
    name: '企业标准版',
    tagline: '私有化部署 · 数据不出内网',
    version: 'ai-agent-platform-ent-standard',
    price: 199900, // ¥1999/套（一次性授权 + 1 年更新）
    validDays: 365,
    offline: true,
    seats: 20,
    features: [
      '完整平台私有化部署（Docker 一键包）',
      '20 席位企业授权',
      '金网通 License 离线激活',
      '1 年版本更新与技术支持',
      '标准 API 网关接入',
    ],
    highlighted: true,
  },
  {
    id: 'ent-pro',
    name: '企业旗舰版',
    tagline: '高并发 · 专属模型通道',
    version: 'ai-agent-platform-ent-pro',
    price: 499900, // ¥4999/套
    validDays: 365,
    offline: true,
    seats: 100,
    features: [
      '包含企业标准版全部权益',
      '100 席位企业授权',
      '专属模型微调通道',
      '高可用集群部署脚本',
      '优先工单 + 专属客户成功',
    ],
  },
  {
    id: 'ent-ultimate',
    name: '企业定制版',
    tagline: '源码级 · 无限席位',
    version: 'ai-agent-platform-ent-ultimate',
    price: 1999900, // ¥19999/套（含源码授权）
    validDays: -1, // 永久
    offline: true,
    seats: -1,
    features: [
      '包含企业旗舰版全部权益',
      '无限席位 + 源码授权',
      '永久有效 License',
      '定制集成与现场交付',
      '联合品牌与 OEM 授权',
    ],
  },
];

export function getPrivateLicensePackage(id: string): PrivateLicensePackage | undefined {
  return PRIVATE_LICENSE_PACKAGES.find((p) => p.id === id);
}

/**
 * 金网通 License 签发服务配置（同机 localhost:3100）。
 * 复用金网通 store 的 ADMIN_TOKEN 鉴权，密钥一致性由其保障。
 */
export const JINWANGTONG_ISSUE = {
  /** 金网通 license 签发管理接口（POST /api/admin/issue） */
  baseUrl: process.env.JINWANGTONG_BASE_URL || 'http://127.0.0.1:3100',
  issuePath: '/api/admin/issue',
  /** 管理令牌，从金网通 .env 的 ADMIN_TOKEN 读取（必须一致） */
  adminToken: process.env.JINWANGTONG_ADMIN_TOKEN || '',
  /** 签发超时（ms），避免阻塞 webhook */
  timeoutMs: 8000,
};
