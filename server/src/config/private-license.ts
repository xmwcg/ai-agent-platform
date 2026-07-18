export interface PrivateLicensePackage {
  id: string;
  name: string;
  tagline?: string;
  version: string; // 对应金网通 PLATFORM_EDITION_MAP 的 key
  price: number;
  validDays: number;
  offline: boolean;
  seats: number;
  features: string[];
  highlighted?: boolean;
}

// 「大厂 1/10」破局价：对标竞品私有化 ¥2万~¥20万，本档为其 10%~20%
// 单位：分。永久授权用 validDays=-1 表示。
export const PRIVATE_LICENSE_PACKAGES: PrivateLicensePackage[] = [
  {
    id: 'ent-standard',
    name: '专业版（私有化）',
    tagline: '小团队首选，单公司 ≤20 席位永久授权',
    version: 'ent-standard',
    price: 29900, // ¥299
    validDays: -1, // 永久
    offline: true,
    seats: 20,
    features: ['局域网内私有化部署', '全功能 AI 工具箱', '≤20 席位', '邮件工单支持'],
    highlighted: false,
  },
  {
    id: 'ent-pro',
    name: '旗舰版（私有化）',
    tagline: '成长型企业，≤100 席位永久授权',
    version: 'ent-pro',
    price: 59900, // ¥599
    validDays: -1,
    offline: true,
    seats: 100,
    features: ['专业版全部', '≤100 席位', '集中管控与企业后台', '优先技术支持'],
    highlighted: true,
  },
  {
    id: 'ent-ultimate',
    name: '团队版（私有化）',
    tagline: '多分支机构不限席位，专属支持',
    version: 'ent-ultimate',
    price: 99900, // ¥999
    validDays: -1,
    offline: true,
    seats: -1, // 不限
    features: ['旗舰版全部', '不限席位', '多分支机构', '专属技术对接'],
    highlighted: false,
  },
];

export function getPrivateLicensePackage(packageId: string): PrivateLicensePackage | undefined {
  return PRIVATE_LICENSE_PACKAGES.find((p) => p.id === packageId);
}
