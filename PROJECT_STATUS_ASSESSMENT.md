# 项目开发评估：本地 / Git / 服务器三维状态

> 评估时间：2026-07-11 ｜ 评估对象：`reasoni-deepseek`（根目录）+ `ai-agent-platform`（Git 仓库）+ 服务器 `159.75.124.59`
> 评估方式：本地文件系统 + Git 元数据 + 无凭证端口/HTTP 探测（未使用 SSH 凭据，未读取服务器内部状态）

---

## 一、核心结论速览

| 维度 | 状态 | 结论 |
|------|------|------|
| 本地项目 | 🟢 健康 | 代码完整、构建产物齐全、上一轮安全改造已落地 |
| Git 仓库 | 🟢 同步 | 本地 `main` 与远程 `prod/main` **完全一致**，工作树干净 |
| 服务器 | 🟡 在线但不可完全验证 | 在线、nginx 运行、部署链路活跃；但**运行时健康度无法从外部确认**（需 SSH/域名） |
| 跨维度一致性 | 🟡 有断点 | 根目录 `reasoni-deepseek` **不是 Git 仓库**，部分交付物游离于版本控制与部署流水线之外 |

---

## 二、本地项目（Local）

### 2.1 目录结构
```
reasoni-deepseek/                      ← 根目录（注意：非 Git 仓库）
├── ai-agent-platform/                 ← 唯一 Git 仓库（monorepo）
│   ├── server/      Express + TS + Mongoose + Redis（dist/.env 已 gitignore）
│   ├── client/      React18 + Vite + AntD（dist/node_modules 已 gitignore）
│   ├── deploy/      一键部署脚本 + CLI + post-receive hook
│   ├── scripts/     auto-deploy.cjs 守护进程 + 各类脚本
│   ├── docs/        方法论/需求文档
│   └── .github/     CI workflow（ci.yml）
├── SECURITY_VERIFICATION.md           ← 上一轮安全交付物（在根目录，未入库！）
├── PRD-综合学习平台.md / 策划方案示例-*.md
├── reasonix.toml / package.json / package-lock.json
```

### 2.2 成熟度（来自 MEMORY.md / TASKS.md）
- 已迭代 **16 轮**，处于 **Phase 3/4 生产化**阶段。
- 后端：`tsc --noEmit` 干净，jest **288 用例 / 39 suite 全过**。
- 前端：`tsc --noEmit` 干净，`eslint` **0 error**（约 70 个既有 warning）。
- 功能覆盖：认证、知识中枢、RAG、课程、MCP、模型配置中心、客服、工具箱、商业变现（套餐/配额/支付验签）、团队 RBAC、开放 API 市场、知识图谱、沙盒、可观测性、向量库抽象、Tauri 桌面端。
- **上一轮安全改造（本轮新增）已出现在本地**：`lib/crypto.ts` 双密钥、`SecretAuditLog` 模型、`secret-audit.service.ts`、`model-config` 四处审计、`scripts/rotate-encryption-key.ts`（`npm run rotate-key`）。

### 2.3 本地待清理项
- 本地存在大量**构建/运行日志**（`client_final.log`、`server_*.log`、`docker_build.log`、`*.log`），已被 `.gitignore` 忽略，不会污染 Git，但建议定期清理。
- `client/dist`、`server/dist`、`node_modules` 已正确忽略。

---

## 三、Git 仓库（Git Remote: `prod`）

### 3.1 仓库事实
- **仓库位置**：`ai-agent-platform/`（根目录 `reasoni-deepseek` 无 `.git`，不是仓库）。
- **分支**：`main`，跟踪 `prod/main`。
- **远程**：`prod` → `ssh://root@159.75.124.59/opt/ai-agent-platform.git`。
- **跟踪文件数**：275（node_modules / dist / .env / *.log 均忽略）。
- **工作树**：`nothing to commit, working tree clean`。
- **本地 vs 远程**：`git diff --stat prod/main HEAD` **为空** → 本地与服务器裸仓库**字节级一致**。
- **无** tag、无其它分支、无 stash。

### 3.2 提交历史特征（⚠️ 治理隐患）
- 全部提交均为 `auto-deploy: 自动同步 2026-07-11-xx-xx-xx` 这类**自动同步消息**（由 `scripts/auto-deploy.cjs` 监听文件变化后自动 commit+push）。
- 上一轮安全改动已通过自动同步进入仓库（最新提交 `8d9977a` 含 `rotate-encryption-key.ts`）。
- **问题**：历史无语义化提交信息、无 PR/Code Review 闸门，全部为自动同步噪声，可追溯性差；CI（`.github/workflows/ci.yml`）面向 GitHub，而实际远程是裸 SSH 仓库，**CI 实际上不会触发**。

### 3.3 安全（Git 侧）
- `.gitignore` 正确排除 `.env` / `.env.*`（保留 `.env.example` / `.env.production.example` 模板）→ 密钥未泄露入库。✅
- 无密钥、无大二进制误提交。✅

---

## 四、服务器（Server @ 159.75.124.59）

### 4.1 可达性探测（无凭证）
| 检查 | 结果 |
|------|------|
| TCP 80 (HTTP) | ✅ 监听 |
| TCP 443 (HTTPS) | ✅ 监听 |
| TCP 22 (SSH) | ✅ 监听 |
| HTTP `GET /` | ↪️ **301 Moved Permanently**（强制跳转 HTTPS） |
| HTTP `GET /api/diagnostics` | ↪️ **301**（同样被 nginx 反代，跳转 HTTPS） |
| Server 响应头 | `nginx/1.31.2` |
| HTTPS 直连 IP | ❌ TLS 握手失败（证书绑定**域名**而非 IP，属预期内） |

**结论**：服务器在线，nginx 正在服务并强制 HTTPS；前端与 `/api` 反代链路均存活。用裸 IP 访问 HTTPS 失败是**正常现象**（Let's Encrypt 证书签发给域名，IP 直连必然证书不匹配）。

### 4.2 部署链路（已确认机制）
```
本地改动 → auto-deploy.cjs 防抖(30s) → git push prod/main
        → 服务器 /opt/ai-agent-platform.git 的 post-receive hook
        → git checkout -f main → /opt/ai-agent-platform
        → nohup deploy/push-deploy.sh（docker compose build + up，日志 /var/log/ai-platform-deploy.log）
```
- 由于本地 `main` == 远程 `prod/main`，且最近一次 push 应已触发 hook，**服务器工作树理论上含有最新代码**。
- docker-compose 编排：`mongodb`(不暴露端口) + `redis`(不暴露) + `server`(127.0.0.1:3000) + `client`(80/443, nginx 反代 /api→server)。

### 4.3 服务器侧**无法从外部确认**的项（需 SSH 凭据）
- docker 容器是否真正 `healthy`（mongo/redis/server/client 四容器状态）。
- `deploy/push-deploy.sh` 最近一次是否构建成功（需读 `/var/log/ai-platform-deploy.log`）。
- 服务器 `server/.env` 是否存在且含真实密钥（JWT_SECRET / 厂商 Key / 支付凭证）——缺失则服务虽起但功能降级。
- MongoDB / Redis 实际连接与数据状态。
- 域名与证书（`/opt/certs`）是否由 `setup-https.sh` 正确签发，HTTPS 是否能经域名正常访问。

---

## 五、风险与改进建议

### 🔴 高优先（一致性断点）
1. **根目录非 Git 仓库**：`SECURITY_VERIFICATION.md`、PRD、策划方案、`reasonix.toml`、根 `package.json` 全部**游离于版本控制与部署流水线之外**。
   - 建议：若这些文档应随项目走，要么 `git init` 根目录并把 `ai-agent-platform` 作为子模块/子目录，要么把它们移入 `ai-agent-platform/` 内（如 `docs/`）。
   - 注意：`auto-deploy.cjs` 监听的是 `ai-agent-platform` 目录，根目录文档改动**不会触发部署**，也不会被备份。

### 🟡 中优先（治理与可观测）
2. **提交历史无语义**：全部 `auto-deploy: 自动同步`，无可追溯性、无回滚锚点。
   - 建议：手动关键节点打 `git tag vX.Y.Z`；或改为「本地开发分支 + PR + 合并后触发部署」，保留可读历史。
3. **CI 未生效**：`.github/workflows/ci.yml` 面向 GitHub，但实际远程是裸 SSH 仓库，CI 不会跑。
   - 建议：在 `post-receive` 或 `push-deploy.sh` 构建前加入 `tsc`/测试门禁，避免坏代码上线；或在服务器侧加 pre-deploy 校验。
4. **服务器运行时不可观测**：无法从外部确认容器健康、`.env` 配置、证书、部署日志。
   - 建议：提供 SSH 凭据或域名，执行一次 `node deploy/cli/cli.js status -H 159.75.124.59 -p <pwd>`，或 SSH 后 `docker ps` / `tail /var/log/ai-platform-deploy.log`。
5. **密钥轮换脚本需在服务器执行**：`npm run rotate-key` 仅验证了算法，未在生产库执行；服务器 `.env` 的 `ENCRYPTION_KEY` 若曾变更，需用该脚本对存量 `ModelConfig.apiKey` 重加密。

### 🟢 低优先（已良好，保持）
6. 安全基座扎实：Helmet/HSTS、CORS 白名单、登录限流、JWT 弱密钥启动拦截、双密钥加密、密钥审计、`.env` 不入库、Docker secret 只读挂载。
7. 测试覆盖充分（288 用例），`tsc`/`eslint` 门禁通过。

---

## 六、建议的下一步动作（待确认）
- [ ] A. 决定根目录文档是否纳入版本控制（git-init 根 / 移入子项目）。
- [ ] B. 提供服务器 SSH 密码或访问域名，做一次**服务器端运行时验证**（容器状态 + 部署日志 + `.env` + 域名 HTTPS）。
- [ ] C. 在部署流水线加入构建前 `tsc`/测试门禁，避免自动同步把坏代码推上线。
- [ ] D. 对生产库执行一次 `npm run rotate-key --dry-run` 预演（确认 `ENCRYPTION_KEY` 轮换闭环）。
