# 当前任务状态

**项目**: NexMind Platform (ai-agent-platform)
**分支**: main（代码提交 c625ffb；本地工作树仅保留审计生成的未跟踪文件）
**日期**: 2026-07-31

## 当前任务
✅ 全站 AI 默认模型与三端一致性审计完成；代码已部署到生产 c625ffb，但生产仍需注入 AGNES25_API_KEY 才能真正调用 Agnes 2.5

## 最新进度

### 2026-07-31 全站默认模型收敛与三端生产烟测
- 本地 `main` / CNB `main` / CNB `deploy/production` 均为 `c625ffb`；生产源码、镜像 revision、`/opt/.cnb-deploy-sha` 均为 `c625ffb`。
- GitHub `main`=`4493b870`、`deploy/production`=`f990d57c`，两分支 tree 均与本地 `HEAD` tree=`b8d29ce8` 完全一致；使用无父安全内容快照，避免历史密钥触发 GitHub Push Protection。
- 生产 Docker server/client 均健康，Caddy 配置校验通过，`aibak.site` 与 `www.aibak.site` 首页和 86 个前端路由均 HTTP 200。
- 三端源码默认文本模型固定为 `agnes25/agnes-2.5-flash`；新增 19 个关键入口一致性门禁 `scripts/verify-default-ai-model.mjs`。
- CNB 构建 `cnb-e96-1jusmmjn8` 的代码、测试和配置门禁通过，但镜像推送阶段因 `docker.cnb.cool` 返回 403 失败；生产使用同一 c625ffb 在服务器本地构建镜像完成部署。
- **阻塞项**：本地与生产 `/etc/aibak/server.env` 均未配置 `AGNES25_API_KEY`/`AGNES_25_API_KEY`。Agnes 2.5 真实烟测因此按设计降级到 CloudBase：`/api/aibak/chat` 返回 `provider=cloudbase-free-fallback, model=hy3`，`/api/ai/chat` 返回 `provider=cloudbase, model=hy3`；当前不能宣称生产已实际使用 Agnes 2.5。
- 生产旧工作树保存在 `/opt/ai-agent-platform-dirty-backup-20260731-agnes-default`，已移除未提交的硬编码 Cloudflare Token 热修复；部署树和备份树均完成 token 扫描。


### 2026-07-31 Agnes AI 2.5 增量接入
- 新增独立 `agnes25` provider，默认端点为 `https://api.agnes-ai.cn/v1`，模型为 `agnes-2.5-flash`。
- 原有 `agnes` provider、旧端点、`agnes-2.0-flash`、图片/视频模型未删除或替换。
- 已覆盖统一 AI Gateway、AIModelManager、免费层路由、代码解释、模型配置中心、AI 对话、首页体验、智能客服、知识库 AI 解读、短视频工作流。
- 文本专用 Agnes 2.5 模型配置不会抢占 Agnes 图片/视频 Provider。
- 真实 Key 未写入仓库；运行时使用 `AGNES25_API_KEY`（兼容 `AGNES_25_API_KEY`）。
- 验证：服务端全量 Jest 128/128、1046/1046；客户端 Vitest 22/22、166/166；前后端构建通过。

### 修复内容（2 commits）
1. **603904e**: 删除 client/public/ai-chat/ CloudBase云函数文件 + Caddyfile备用配置SPA安全化
2. **c4ccb81**: nginx try_files 移除 `$uri/` → 修复生产环境实际生效的目录斜杠重定向

### 根因分析
nginx 配置 `try_files $uri $uri/ /index.html` 中的 `$uri/` 在发现同名目录（dist/ai-chat/）时
自动301重定向加斜杠 → 重定向用HTTP生成Location → Cloudflare阻止 → 403。
修复：改为 `try_files $uri /index.html`（跳过目录检测，直接回退SPA）

### 生产环境架构
- 远程服务器运行 Docker（mongodb/redis/sandbox/server/client 5容器）
- client 容器内 nginx 挂载 `client/nginx.ssl.runtime.conf`
- Cloudflare CDN 前置

### 三端一致性
> main(c625ffb) = CNB main/deploy(c625ffb)；生产源码/镜像/部署标记(c625ffb)；GitHub 两分支 tree 一致（提交历史为安全镜像快照）

## 最近会话
2026-07-31: 全站默认模型收敛与三端生产烟测；CNB registry 403 导致流水线镜像阶段失败，已用同一 SHA 本地构建部署；生产待注入 Agnes 2.5 Key
2026-07-31: Agnes AI 2.5 增量接入，保留旧 Agnes 模型与端点；新增运行时密钥模板、模型选择入口及全量测试记录
2026-07-30: 全站 86 路由/163 链接/支付闭环审计，修复并推送 main 与 deploy/production；线上 /ai-chat 仍受旧部署配置阻断；新增手动审计流水线入口

## 指向详细记忆
- 详细记忆: .codex-memory/PROGRESS.md
- AGENTS.md: C:\Users\Administrator\.codex\AGENTS.md
- Obsidian: G:/项目成品及测试/Obsidian 知识库/04 资源/自动同步/