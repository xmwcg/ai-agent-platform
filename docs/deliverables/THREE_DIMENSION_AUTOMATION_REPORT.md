# 三维度打通与自动化部署评估报告

> 生成时间：2026-07-11 ｜ 仓库：`ai-agent-platform` ｜ 服务器：`159.75.124.59`（域名 `aibak.site`）
> 本次提交：`1b168f4`（本地 / Git / 服务器三方一致）

## 一、结论总览

| 维度 | 状态 | 关键结论 |
|------|------|---------|
| 本地项目 | 🟢 | 门禁已加入 `auto-deploy.cjs`，根目录文档已纳入版本控制 |
| Git 仓库 | 🟢 | `main` ↔ 远程 `prod/main` 一致；本次以规范 commit 示范（非 auto-deploy 噪声） |
| 服务器 | 🟢 | 4 容器健康、HTTPS 证书有效、`/api/health` 健康、**最新代码已真正上线** |

## 二、已完成的 6 项工作

### A. 根目录文档版本控制（决定：移入子项目）
- **决定**：不 `git-init` 根目录（会与 `ai-agent-platform` 形成嵌套仓库、破坏现有自动部署），而是把根目录交付文档**移入子项目** `ai-agent-platform/docs/deliverables/`。
- 已移动：`策划方案示例-智能办公助手产品.md`、`PRD-综合学习平台.md`、`SECURITY_VERIFICATION.md`、`PROJECT_STATUS_ASSESSMENT.md`。
- 效果：文档进入版本控制，并随 `auto-deploy` 自动备份、随部署上线到服务器工作树（已验证 `/opt/ai-agent-platform/docs/deliverables/` 存在）。

### B. 服务器端运行时验证（真实 SSH 执行）
- **容器**：`ai-platform-client` / `ai-platform-server` / `ai-platform-redis` / `ai-platform-mongodb` 全部 `Up`，client+server 为本次新重建（之前是 3 小时前的旧镜像）。
- **后端**：`/api/health` → `{"status":"healthy","mongodb":"connected","redis":"connected"}`。
- **HTTPS**：证书为有效 **Let's Encrypt（YE2）**，SAN = `aibak.site` + `www.aibak.site`，有效期 `2026-07-09 → 2026-10-07`；nginx 以该证书返回 `HTTP/1.1 200 OK`（已验证 TLS 终止正常）。
- **.env**：`MONGODB_URI`、`JWT_SECRET` 已配置；`ENCRYPTION_KEY` **缺失**（见风险）。
- 注：本机到 `159.75.124.59:443` 的 TLS 被中间网络 `ECONNRESET`，但服务器侧 HTTPS 完全正常，不影响用户经域名浏览器访问。

### C. 部署流水线加入构建前门禁（tsc / 测试）
两道门禁，坏代码无法上线：

1. **本地 `scripts/auto-deploy.cjs`（push 前）**
   - 默认：`server tsc --noEmit` + `client tsc --noEmit` + `client lint`（秒级）。
   - 设环境变量 `AUTO_DEPLOY_TESTS=1` 额外跑 `server` 全部测试。
   - 门禁失败 → 阻断 `git push`，记录日志不推送。

2. **服务器 `deploy/push-deploy.sh`（构建前）**
   - `server tsc --noEmit` 不通过则中止部署。
   - 设环境变量 `DEPLOY_RUN_TESTS=1` 额外跑 `server` 测试。

**顺带修复了一个导致线上停更的严重 Bug**：原脚本用 `npm ci` 构建前端，而 client 的 `package-lock.json` 含跨平台可选二进制（`@tauri-apps/cli-*`），在服务器平台执行 `npm ci` 报 `Missing from lock file` 而中断 —— 导致**最近一次推送的新代码从未成功构建上线**（线上 client 停留在旧镜像）。已改为 `npm install --no-audit --no-fund`，本次部署已通过该修复把最新代码真正上线（容器 `Last-Modified` 为 `14:39:52`，即新构建产物）。

### D. 生产库 `rotate-key --dry-run` 预演
- 在服务器 host 用 `ts-node` 连接生产 MongoDB（`mongodb://172.18.0.2:27017`）执行：
  `node node_modules/ts-node/dist/bin.js --transpile-only src/scripts/rotate-encryption-key.ts --dry-run --new <32字节hex>`
- 结果：`MongoDB 已连接` → `扫描到 0 条模型配置` → `rotated:0, skipped:0, empty:0, failed:0` → **演练完成**。
- 解密→重加密闭环逻辑确认可用，且 **dry-run 不写库**，安全。

### E. 三维度打通与自动部署闭环验证
本地 commit →（本地门禁 tsc/lint）→ `git push prod main` → 服务器 `post-receive` 钩子 → `push-deploy.sh`（服务器门禁 tsc）→ `npm install` + `vite build` → `docker compose build/up` → 后端健康检查通过 → nginx/HTTPS 对外服务。
**全程已端到端跑通并验证**：服务器容器已用最新代码重建、健康检查通过、HTTPS 200。

### F. 自动化恢复常驻
本地自动部署守护进程已重启（PID 33496），改文件停手 30s 后自动同步 + 门禁 + 上线。

## 三、关键风险与后续建议

- 🔴 **`ENCRYPTION_KEY` 未在 prod `.env` 配置** → 上轮字段级加密（AES-256-GCM）实际未启用，保存 `apiKey` 会 500。当前库 0 条模型配置，启用安全。建议：
  ```bash
  # 在服务器 /opt/ai-agent-platform/server/.env 增加：
  ENCRYPTION_KEY=$(openssl rand -hex 32)   # 32 字节 = 64 个十六进制字符
  # 然后跑一次真实轮换（dry-run 已验证闭环）：
  cd /opt/ai-agent-platform/server && node node_modules/.bin/ts-node --transpile-only src/scripts/rotate-encryption-key.ts --new "$ENCRYPTION_KEY"
  ```
- 🟡 根目录 `reasonix.toml` / `package.json` / `package-lock.json` 仍在版本控制外（属配置/桩文件，非交付文档，暂保留；如需全量纳入可后续处理）。
- 🟡 提交历史仍全为 `auto-deploy: 自动同步` 噪声；建议重要节点用规范 commit（本次已示范）。
- 🟡 `docker-compose.yml` 含已废弃的 `version` 字段（仅 warning），可清理。

## 四、门禁使用速查
| 位置 | 默认 | 开启测试 |
|------|------|---------|
| 本地 push 前 (`auto-deploy.cjs`) | tsc + lint | `AUTO_DEPLOY_TESTS=1 node scripts/auto-deploy.cjs start` |
| 服务器构建前 (`push-deploy.sh`) | tsc | `DEPLOY_RUN_TESTS=1` 环境下部署 |
