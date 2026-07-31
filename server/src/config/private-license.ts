/**
 * NexMind Platform — 私有授权配置（金网通 License）
 *
 * 定义金网通产品的版本、定价、有效期和设备数上限。
 * 定价与前端 JinWangTongPage 保持一致：¥299/¥599/¥999 永久买断。
 *
 * @author NexMind Team
 * @license MIT
 */

export interface LicenseEdition {
  key: string;
  name: string;
  price: number;            // 价格（分）
  maxDevices: number;       // 设备数上限（0=不限）
  days: number;             // 有效天数（0=永久）
  features: string[];       // 功能列表
  highlighted: boolean;     // 是否推荐
  downloadUrl: string;      // 安装包下载地址
  description: string;
}

export const LICENSE_EDITIONS: LicenseEdition[] = [
  {
    key: "free",
    name: "免费版",
    price: 0,
    maxDevices: 3,
    days: 15,
    features: ["interconnect", "list", "diskclean"],
    highlighted: false,
    downloadUrl: "/download/jinwangtong-trial.zip",
    description: "15 天免费试用，支持 3 台设备。基础互联 + 主机列表 + 磁盘清理。适合个人体验。",
  },
  {
    key: "trial",
    name: "试用版",
    price: 0,
    maxDevices: 25,
    days: 30,
    features: ["interconnect", "list", "diskclean", "inventory", "netpolicy", "netcheck", "remotemgmt"],
    highlighted: false,
    downloadUrl: "/download/jinwangtong-trial.zip",
    description: "30 天全功能试用，支持 25 台设备。适合企业评估。",
  },
  {
    key: "pro",
    name: "专业版",
    price: 29900,           // ¥299.00
    maxDevices: 50,
    days: 0,                // 永久
    features: ["interconnect", "list", "diskclean", "inventory", "netpolicy", "netcheck", "remotemgmt"],
    highlighted: true,
    downloadUrl: "/download/jinwangtong-pro.zip",
    description: "永久买断 ¥299，支持 50 台设备。包含资产管理、网络策略、远程管控等全部功能。",
  },
  {
    key: "ent-premium",
    name: "旗舰版",
    price: 59900,           // ¥599.00
    maxDevices: 100,
    days: 0,                // 永久
    features: ["interconnect", "list", "diskclean", "inventory", "netpolicy", "netcheck", "remotemgmt", "support"],
    highlighted: false,
    downloadUrl: "/download/jinwangtong-pro.zip",
    description: "永久买断 ¥599，支持 100 台设备。含全部功能 + 优先技术支持。",
  },
  {
    key: "enterprise",
    name: "企业版",
    price: 99900,           // ¥999.00
    maxDevices: 0,          // 不限
    days: 0,                // 永久
    features: ["interconnect", "list", "diskclean", "inventory", "netpolicy", "netcheck", "remotemgmt", "support"],
    highlighted: false,
    downloadUrl: "/download/jinwangtong-enterprise.zip",
    description: "永久买断 ¥999，不限设备数。含企业白标授权 + 专属技术支持 + SSO 集成。",
  },
];

export function getLicenseEdition(key: string): LicenseEdition | undefined {
  return LICENSE_EDITIONS.find((e) => e.key === key);
}

// ===== 兼容 billing 路由的授权包导出 =====
export interface PrivateLicensePackage {
  version: string;
  id: string;
  name: string;
  price: number;
  edition: string;
  features: string[];
}
export const PRIVATE_LICENSE_PACKAGES: PrivateLicensePackage[] = [
  { version: "1.0", id: "free", name: "金网通 免费试用版", price: 0, edition: "free", features: ["基础网络扫描", "15天试用"] },
  { version: "2.0", id: "pro", name: "金网通 专业版", price: 29900, edition: "pro", features: ["完整网络扫描", "License管理", "50设备", "永久买断"] },
  { version: "2.5", id: "ent-premium", name: "金网通 旗舰版", price: 59900, edition: "ent-premium", features: ["全部功能", "优先支持", "100设备", "永久买断"] },
  { version: "3.0", id: "enterprise", name: "金网通 企业版", price: 99900, edition: "enterprise", features: ["全部功能", "API接口", "不限设备", "优先支持", "企业白标"] },
];
export function getPrivateLicensePackage(id: string): PrivateLicensePackage | undefined {
  return PRIVATE_LICENSE_PACKAGES.find(p => p.id === id);
}
