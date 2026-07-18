# 私有化授权（企业版）功能包

> 本文件夹是「全复用现有 billing + 私有化授权」任务的**独立归档包**。
> 所有源码按原仓库相对路径放置，便于整体对比 / 合并 / 部署。
> **本包不自动部署到服务器**，是否上服务器由你决定（见 `DEPLOY.md`）。

## 功能定位

- 废弃独立商城：企业版（私有化授权）**完全复用现有 billing**（微信支付网关、webhook 履约、Order 模型、credit-ledger 积分账本）。
- 私有化授权走独立的 `orderType = 'private_license'`，履约时调用同机金网通 license 签发接口，**不进积分账本**（避免双账本冲突）。
- 毛利看板（`ProfitDashboard`）仅 Admin 后台可见，**绝不对客户展示**。
- New API 网关仅作私有化交付物，不挂主站（见 `docs/ai-gateway-部署与渠道配置.md`）。
- 小程序引流方案见 `docs/小程序引流方案.md`。

## 文件清单

### 后端（`server/src/`）

| 文件 | 状态 | 改动说明 |
|------|------|----------|
| `models/Order.ts` | 已提交 cnb/main | `OrderType` 增加 `"private_license"`；schema enum 同步；新增 `licenseVersion` / `licensePayload` 字段 |
| `config/private-license.ts` | **未提交（核心遗漏）** | 3 档企业套餐定义（¥1999/¥4999/¥19999）+ 金网通签发配置 `JINWANGTONG_ISSUE` |
| `services/private-license.service.ts` | **未提交（核心遗漏）** | `issuePrivateLicense()` 调 `POST http://127.0.0.1:3100/api/admin/issue` 签发 license |
| `routes/billing.ts` | 已提交 cnb/main | 新增 `GET /private-license-packages`、`POST /private-license/order`、mock/轮询分支的 private_license 处理、`GET /profit-summary`（Admin 双守卫） |
| `routes/billing/webhook.routes.ts` | 已提交 cnb/main | 新增 `fulfillPrivateLicense()`，履约分支处理 `private_license`（写 licensePayload，不进积分账本） |
| `services/cost-control.service.ts` | 已提交 cnb/main | 增加全局成本键 `ai_cost:global:{date}` + `getGlobalCost(date)` 供毛利看板使用 |

### 前端（`client/src/`）

| 文件 | 状态 | 改动说明 |
|------|------|----------|
| `services/api.ts` | 已提交 cnb/main | `billingAPI` 增加 `getPrivateLicensePackages` / `createPrivateLicenseOrder` / `getProfitSummary` |
| `pages/PricingPage.tsx` | 已提交 cnb/main | 新增企业版分段与卡片（EnterprisePackage），购买按钮「立即购买授权」 |
| `pages/AdminDashboardPage.tsx` | 已提交 cnb/main | 新增 `ProfitDashboard` 组件（月份选择 + 四宫格 + 每日成本 ECharts，内部警告 Alert） |

### 文档（`docs/`）

- `私有化授权接入金网通.md`
- `小程序引流方案.md`
- `融合方案-与你现有项目整合.md`
- `ai-gateway-部署与渠道配置.md` + `ai-gateway-docker-compose.yml` + `ai-gateway-nginx.conf`

## ⚠️ 重要部署须知（必读）

### 1. 当前 cnb/main 处于「编译会失败」状态（之前会话漏提交）

`billing.ts` 已 `import ... from '../config/private-license'`，但 **`config/private-license.ts` 与 `services/private-license.service.ts` 两个核心文件之前没有提交到 cnb/main**。
因此远程 main 当前 `tsc` 会因找不到模块而失败。

**修复方法（二选一）：**
- **方案 A（推荐，本包即为此准备）**：把本文件夹 `server/src/config/private-license.ts` 与 `server/src/services/private-license.service.ts` 复制到仓库对应路径，再提交。
- 方案 B：直接 `git add` 仓库内磁盘上已有的这两个文件（它们已在项目工作区，只是未 `git add`）。

> 其余 7 个文件已在 cnb/main，无需再动。

### 2. 服务器 `.env` 必须补充环境变量

在 `server/.env` 增加：

```env
# 金网通 License 签发管理令牌（必须与 /opt/jinwangtong/store/.env 的 ADMIN_TOKEN 一致）
JINWANGTONG_ADMIN_TOKEN=<从 /opt/jinwangtong/store/.env 取 ADMIN_TOKEN 的值>

# 可选：金网通签发地址（默认 http://127.0.0.1:3100，仅当不在同机时改）
# JINWANGTONG_BASE_URL=http://127.0.0.1:3100
```

未配置时：`issuePrivateLicense` 会抛 `LICENSE_ISSUER_NOT_CONFIGURED`，订单仍标记 `paid`，但 license 需**人工补发**（客服用金网通后台发货）。

### 3. 金网通 License 密钥一致性

`scripts/license.ps1`（客户端）与金网通 `license-issuer.js` 的 HMAC-SHA256 密钥默认均为 `JinWangTong-2026-Local-Key`，本平台仅调用其 `issue` 接口，不直接参与验签，故无需改动密钥。

## 后端接口速查

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/billing/private-license-packages` | 拉取企业版套餐列表（公开） |
| POST | `/api/billing/private-license/order` | 创建私有化授权订单（复用现有支付网关） |
| GET | `/api/billing/profit-summary?month=YYYY-MM` | 毛利汇总（requireAuth + requireAdmin） |

## 部署步骤

见同目录 `DEPLOY.md`。本包**未执行任何部署命令**。
