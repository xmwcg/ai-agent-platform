# 私有化授权功能 —— 部署手册（待你确认后再执行）

> 本文档列出的命令**均由你决定是否执行**。下面给出的是「外科手术式精准部署」流程，
> 目的：只上私有化授权相关改动，绝不整推工作区里的大量 `_*.txt` / `patch_*` 半成品与垃圾文件。

---

## 阶段 0：补全漏提交的核心文件（最关键）

之前会话把 `billing.ts` 等 7 个文件 push 到了 cnb/main，但**漏了** 2 个被 import 的核心文件，
导致远程 main 当前编译失败。必须先补上：

```powershell
cd G:\项目成品及测试\AIBAK\reasoni-deepseek\ai-agent-platform

# 本包已含这两个文件，直接复制回仓库（或用工作区已有的也行）
Copy-Item feature-private-license\server\src\config\private-license.ts      server\src\config\private-license.ts
Copy-Item feature-private-license\server\src\services\private-license.service.ts server\src\services\private-license.service.ts
```

本地验证编译（务必通过后再上服务器）：

```powershell
cd server
npm run build        # 或 npx tsc --noEmit
```

---

## 阶段 1：服务器补充环境变量

SSH 到 `159.75.124.59`，编辑 `/opt/ai-agent-platform/server/.env`，追加：

```env
JINWANGTONG_ADMIN_TOKEN=<从 /opt/jinwangtong/store/.env 取 ADMIN_TOKEN>
# JINWANGTONG_BASE_URL=http://127.0.0.1:3100
```

> 前提：金网通 store 服务（`systemd jinwangtong-store`，node :3100）已在同机运行。

---

## 阶段 2：提交（仅本功能相关文件，精准 add）

```powershell
cd G:\项目成品及测试\AIBAK\reasoni-deepseek\ai-agent-platform
git add server/src/config/private-license.ts `
        server/src/services/private-license.service.ts
git commit -m "feat: 补交私有化授权核心文件(修复 main 编译缺失)"
```

> 注意：其余 7 个文件已在 cnb/main，**不要** `git add .` 或 `git add -A`，
> 否则会把工作区一堆 `_*.txt` / `patch_*` / 半成品脚本一起带上去，服务器会起不来。

---

## 阶段 3：推送并触发自动部署

推荐走 cnb 自动部署（push main → 服务器 post-receive 自动 docker build 部署）：

```powershell
git push cnb main
```

或走 GitHub 镜像后由 GitHub Actions 部署（看你当前主用哪条线）。

---

## 阶段 4：服务器构建并重启（若 watcher 未自动重建 build 服务）

```bash
ssh root@159.75.124.59
cd /opt/ai-agent-platform
docker compose build server
docker compose up -d server
# 前端（如需）
docker compose build client
docker compose up -d client
```

---

## 阶段 5：运行时验收

```bash
# 健康
curl -s localhost:3000/api/health

# 公开拉取企业版套餐
curl -s localhost:3000/api/billing/private-license-packages

# Admin 毛利看板（需带管理员 token）
curl -s -H "Authorization: Bearer <ADMIN_TOKEN>" localhost:3000/api/billing/profit-summary?month=2026-07
```

预期：`/private-license-packages` 返回 3 档套餐；`profit-summary` 返回 revenue/cost/grossProfit/margin/dailyCost。

---

## 阶段 6：端到端验证（真实下单 → 自动签发 license）

1. 前台 `/pricing` 选企业版 → 立即购买授权 → 微信扫码支付。
2. 微信公网回调 `/api/billing/webhook/wechat` 履约 → 调 `issuePrivateLicense` → 写 `Order.licensePayload`。
3. 用户控制台可下载 `license.json`。
4. 若 `JINWANGTONG_ADMIN_TOKEN` 未配，订单标记 `paid` 但 license 需人工补发（客服走金网通后台）。

---

## 回滚方案

若上线异常，回退到上一稳定提交：

```powershell
git revert <本次提交sha>      # 或 git reset --hard <上一稳定sha>（谨慎）
git push cnb main
```

服务器重新 `docker compose build server && up -d server`。
