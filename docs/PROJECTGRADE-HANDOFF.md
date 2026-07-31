> 全项目长期需求和跨产品约束请先读取：docs/AIBAK-FULL-PROJECT-HANDOFF.md。

# AIbak 智评通 ProjectGrade — 新窗口开发交接

> 更新时间：2026-07-21（Asia/Shanghai）
> 用途：在新的 Codex 窗口中继续开发，避免依赖聊天上下文。
> 安全：本文不记录 API Key、Token、SSH 密钥或密码。

## 1. 项目与仓库

- 产品站：`aibak.site`
- 主项目本地目录：`G:\项目成品及测试\AIBAK\reasoni-deepseek\ai-agent-platform`
- CNB 主仓库：`aibak.site/ai-agent-platform`
- 主开发分支：`main`
- 生产发布分支：`deploy/production`
- GitHub：只作为镜像，不作为生产发布源。
- 生产：Docker Compose；CNB 是正式唯一发布链路，服务器 outbound pull。
- 必须保留现有未提交修改；精确暂存文件，禁止 `git add -A`。

## 2. 用户已确认的总目标

开发并上线一个可独立销售、同时嵌入 AIbak 的通用软件质量评估产品：

- 推荐产品名：**AIbak 智评通 ProjectGrade**
- 定位：面向网站、SaaS、AI 应用和企业软件的智能质量检查与商业就绪度评估平台。
- 不只是代码扫描；必须判断项目是否“能运行、能上线、能收费、能交付、能维护、能持续运营”。
- 首期项目类型：网站、SaaS、AI 应用。
- 后续支持：API 服务、移动应用、桌面软件、企业内网系统、开源项目。
- 开发中遇到不确定项，要优先核验国内外优秀竞品、官方文档和行业标准，再结合 AIbak 实际架构实现。
- 不能只做 DEMO；最终必须具备多租户、套餐、支付、报告、权限、审计、发布门禁和商业交付闭环。

## 3. 已确认评分模型

### 3.1 分制

- 内部 1000 分制；用户展示 100 分制。
- 评分必须绑定证据，不能只靠 LLM 主观打分。
- 完成度：0 / 25% / 50% / 75% / 100%。
- 证据等级：生产自动验证 1.00；CI/集成测试 0.90；源码静态证据 0.75；文档声明 0.40；无证据 0。

### 3.2 十二个维度及权重

1. 开发计划与产品战略：60
2. 需求与产品完整性：80
3. 架构与工程设计：90
4. 代码质量与可维护性：90
5. 功能闭环与真实可用性：110
6. AI 能力质量：90
7. UI/UX 与无障碍：70
8. 安全、隐私与合规：100
9. 收费、交付与商业闭环：100
10. 生产、DevOps 与可靠性：80
11. 性能、容量与成本：60
12. 运营、服务与持续改进：70

合计：1000。

### 3.3 评分等级

- S：95–100，标杆级
- A：85–94，商用级
- B：75–84，有限商用
- C：60–74，测试级
- D：40–59，不可销售
- F：0–39，高风险

### 3.4 红线门禁

- P0：隐私泄露、越权、支付金额可篡改、严重 RCE、生产 Mock 冒充真实等；总分最高 39，禁止上线。
- P1：登录、支付、权益到账、下载/License、AI 核心功能、核心路由等不可用；总分最高 59，禁止收费销售。
- P2：主要功能仍为演示桩、退款售后缺失、移动购买失败、模型配置无法真实测试等；总分最高 69。
- P3：监控、测试、性能、帮助文档等不完整；总分最高 79。

## 4. 产品模块

1. 项目中心
2. 网址快速体检
3. 源码深度扫描
4. 生产链路浏览器验证
5. AI 专项评测
6. 证据中心
7. 问题中心
8. AI 整改助手
9. 竞品基准中心
10. 发布门禁
11. 报告与评分徽章
12. 租户、套餐、订单、支付和管理后台

建议路由：

- `/project-grade`
- `/project-grade/demo`
- `/project-grade/projects`
- `/project-grade/projects/:id`
- `/project-grade/reports/:id`
- `/project-grade/issues`
- `/project-grade/rules`
- `/project-grade/admin`

## 5. 核心数据模型

- `Project`
- `ScanTarget`
- `EvaluationRun`
- `RulePack`
- `EvaluationRule`
- `Evidence`
- `Finding`
- `ScoreSnapshot`
- `ReleaseGate`
- `RemediationTask`
- `BenchmarkDataset`
- `Report`
- `Connector`
- `Subscription`
- `AuditLog`

## 6. 建议技术实现

复用现有栈：

- React + TypeScript + Ant Design
- Express + TypeScript
- MongoDB
- Redis + BullMQ
- Playwright/Puppeteer
- 现有 `sandbox-executor`
- 现有统一 AI 网关
- HTML/PDF/Excel 报告
- Docker + CNB CI/CD

评分引擎必须是“确定性规则 + 自动证据 + LLM 解释”的混合结构。LLM 不得直接决定最终分数。

## 7. 开发批次（按顺序）

### Batch 0：规则引擎与 AIbak 内部基线

- 建立规则、维度、权重、证据、Finding、ScoreSnapshot 和门禁模型。
- 先对 AIbak 自身做第一次正式评分。
- 输出 P0/P1/P2/P3 清单和整改路线。

### Batch 1：网址快速体检 MVP

- URL、页面、路由、404、空链接、控制台错误、API 失败、HTTPS、性能、移动端、SEO、无障碍。
- 形成免费获客入口。

### Batch 2：源码深度扫描

- 首期 TypeScript/JavaScript。
- CNB、GitHub、ZIP。
- 路由/API映射、Mock/TODO、密钥、依赖、Docker、CI、测试、许可证、代码质量。

### Batch 3：生产链路验证

- 注册、登录、AI、表单、订单、支付沙箱、权益、下载、客服。
- 截图和证据留存。

### Batch 4：AI 专项评测

- 测试集、多模型、幻觉、RAG、引用、Prompt 注入、工具安全、延迟、成本。

### Batch 5：商业闭环评分

- 定价、支付、订单、权益、License、下载、退款、客服、发票、转化漏斗。

### Batch 6：AI 整改助手

- 根因、影响、修复步骤、测试、回滚、预计提分、任务生成、复测。
- 初期只能生成建议或修复分支，不得直接修改生产。

### Batch 7：SaaS 商业化

- 多租户、套餐、项目额度、团队、微信支付、订单、报告下载、管理后台。

### Batch 8：CI 门禁与本地 Agent

- CNB、GitHub Actions、Webhook、本地只读扫描 Agent、企业私有化基础。

### Batch 9：生产硬化与发布

- 安全、并发、大仓、恢复、计费幂等、多租户隔离、数据删除、监控、回滚、文档。

## 8. 推荐商业套餐

- 免费版：公开网址快速体检，每月 1 个项目，简版报告。
- 专业版：建议 ¥199/月或 ¥1,999/年，5 个项目，私有仓库和完整报告。
- 团队版：建议 ¥699/月或 ¥6,999/年，20 个项目，CI 门禁与团队协作。
- 企业版：建议 ¥2,999/月或 ¥29,999/年起，本地 Agent、SSO、组织看板、自定义规则。
- 私有化：建议 ¥50,000–200,000/次，按部署和定制范围报价。
- 名称、价格、权重允许在开发中通过竞品和成本数据进一步校准，但变更要保留决策记录。

## 9. 当前生产特别状态

截至 2026-07-20：

- 生产运行镜像 revision：`bd671f7c4f423c9641e0f26a76430cf3a05ee822`。
- CNB `main` 最新已知提交：`7b8361a`，内容为加入 `www.aibak.site` CORS 允许来源。
- CNB 构建 `cnb-43g-1jtvom4mq` 失败不是代码问题，而是根组织构建 CPU 配额不足，停在 Prepare 阶段。
- 已对服务器 `.env` 做紧急配置修复，`CLIENT_URL` 包含根域名与 `www` 域名；API 容器重建后健康。
- `https://www.aibak.site` 的登录 OPTIONS 预检已由 500 恢复为 204。
- 正式代码仍需在 CNB 配额恢复后通过唯一发布链路进入 `deploy/production`。

## 10. 现有 MEMORY.md 的重要纠正

现有 `MEMORY.md` 中大量“✅真实可用”描述是历史声明，不能当作生产事实。新开发必须遵循：

- 源码存在 ≠ 功能完成；
- 测试通过 ≠ 生产可用；
- 页面存在 ≠ 商业闭环；
- 只有生产证据验证成功，才允许标记完成。

## 11. 新窗口启动指令

在新 Codex 窗口中发送：

> 读取 `G:\项目成品及测试\AIBAK\reasoni-deepseek\ai-agent-platform\docs\PROJECTGRADE-HANDOFF.md` 和项目 `MEMORY.md`，以交接文档为最新事实。按照 Batch 0 开始持续开发 AIbak 智评通 ProjectGrade。先检查 git 状态和现有代码，保留未提交修改，不使用 git add -A，不在没有生产证据时宣称完成。

## 12. 开发原则

- 不询问可以通过代码、日志、官方文档或竞品调研自行确认的问题。
- 不复制竞品受版权保护的源码和界面；只参考公开功能、流程和商业模式。
- 技术不确定时优先查官方文档、标准和高质量开源项目。
- 不使用来源不明或高风险 Agent/Skill；安装前审查许可证、权限和代码。
- 不把密钥写进代码、文档、日志或提交。
- 每个 Batch 都要有 TypeScript、单元、集成、构建、安全和生产验收证据。
- 不以“页面已做”“接口已写”作为完成标准。

## 13. Batch 0 当前实现与本地验证证据（截至 2026-07-20）

> 本节仅记录本地源码和命令验证事实；不代表已部署、已上线、生产验收或商业交付验收。

### 13.1 已实现的 Batch 0 范围

- 服务端已有确定性 ProjectGrade 规则、维度、证据、Finding、评分快照、发布门禁、项目、评估运行、整改任务和审计日志模型；`EvaluationRun` 是评分真相源，Evidence / Finding / ScoreSnapshot 是可重建投影。
- 当前持久化评估仅评估 **AIbak 服务端内部仓库**。它不会扫描用户登记的 URL、Git 仓库、CI 或生产环境；`externalScanningEnabled = false`。
- 已提供项目创建、持久化评估、评估历史、报告读取、证据 / Finding / 整改任务投影和整改工作流 API。
- Finding 工作流更新要求非空说明，并受服务端 RBAC 与审计保护；整改标记为 `verified` 时，服务端要求独立且更晚的复测、投影就绪、相同 Finding 指纹消失。
- 审计读取与投影重建均由服务端要求项目 `admin` 角色；投影重建会记录审计，且不会创建新的评估。

### 13.2 前端工作区（未提交源码）

- `client/src/pages/ProjectGradePage.tsx` 已接入内部基线、项目登记、持久化评估、历史报告、Evidence、Finding 与整改任务工作区。
- 用户登记 URL 仍由项目数据模型持久化；Batch 1 新增的“网址快速体检”只使用数据库中的已登记 URL，不接受临时 URL 覆盖，且结果不进入最终评分。
- 管理员审计为按需加载：403 时清空审计数据，且只显示通用的无权限提示，不渲染审计表或泄露旧项目数据。
- 历史评估提供“管理员重建投影”动作。前端不猜测角色，服务端 RBAC 是唯一权限权威；403 会显示通用无权限提示。
- 切换/新建项目和并发审计请求均会使旧请求失效，避免旧项目的审计成功、403 或错误状态覆盖当前项目。
- 页面明确声明：**重建投影不创建新评估，不扫描外部目标，也不构成生产验收。**

### 13.3 本地验证（真实命令结果）

2026-07-20 在 `client` 目录执行并通过：

```powershell
node node_modules/prettier/bin/prettier.cjs --write src/pages/ProjectGradePage.tsx src/services/api.ts src/services/api.project-grade.test.ts
node node_modules/typescript/bin/tsc --noEmit
node node_modules/eslint/bin/eslint.js src/pages/ProjectGradePage.tsx src/services/api.ts src/services/api.project-grade.test.ts
npm test -- --run
npm run build
```

结果：TypeScript 与目标 ESLint 通过；最新 Vitest 为 2 个测试文件、3 个测试通过；Vite 构建通过。`api.project-grade.test.ts` 除覆盖 Evidence / Finding / 整改 / 审计路由、Finding 说明 payload 和投影重建路由外，还验证网址快速体检只能调用登记项目路由，且前端 API 不发送任意 URL 请求体。

已知构建待办：Vite 仍警告 `index`、`antd-vendor`、`react-vendor` 压缩后超过 500 kB；这需要后续代码分割与性能验证，不能被视为生产性能验收。

此前同一工作树的服务端全量 Jest 本地证据为：88 个测试套件、674 个测试全部通过（约 343 秒）；`server/jest.config.cjs` 已移除 `forceExit: true`。这同样只是本地测试证据。

### 13.4 仍未满足的上线阻塞项

```text
productionVerified = false
productionAcceptance = false
externalScanningEnabled = false
```

- 没有 MongoDB replica set / 事务能力的真实环境验证证据。
- 已新增未提交的 ProjectGrade 专属 CNB 确定性测试门禁源码，但没有 CNB 远端运行、Docker 部署、预发布探针、生产日志、生产回滚与监控验收证据。
- 没有真实用户 URL / Git / CI / 生产环境扫描能力；该能力属于后续 Batch，必须在隔离、授权、限流、审计和证据保留设计完成后再启用。
- 没有多租户套餐、支付、报告下载、商业订单和数据删除闭环的生产验收；它们仍属于后续 Batch。
- 生产发布必须继续走 CNB 唯一正式链路，不能以本地构建、GitHub 镜像或页面截图替代。

### 13.5 站内可发现性（2026-07-20，本地源码与构建证据）

- `client/src/config/site-features.ts` 已将 `project-grade` 注册为 **AIbak 智评通**，归入“工具与分析”。因此既有的侧边栏、面包屑与全站搜索会通过同一功能注册表发现 `/project-grade`；未新增独立导航实现或权限旁路。
- 注册文案限定为“AIbak 内部基线、规则快照、证据与发布门禁”，不宣称或启用用户 URL、Git、CI 或生产环境扫描；`authRequired: false` 仅允许未登录用户读取内部基线，项目工作区的账户授权仍由页面和服务端 API 执行。
- 2026-07-20 在 `client` 目录已实际执行并通过：

```powershell
node node_modules/typescript/bin/tsc --noEmit
node node_modules/eslint/bin/eslint.js src/config/site-features.ts src/config/site-features.project-grade.test.ts src/pages/ProjectGradePage.tsx src/services/api.ts src/services/api.project-grade.test.ts
npm test -- --run
npm run build
```

- 初次接线后 Vitest 为 1 个测试文件、1 个测试通过；随后新增 `client/src/config/site-features.project-grade.test.ts`，最终复验为 2 个测试文件、2 个测试通过。两次 TypeScript、目标 ESLint 与 Vite 生产构建均通过。构建仍报告 `index`、`antd-vendor` 与 `react-vendor` 压缩后超过 500 kB，尚未做代码分割或真实性能验收。
- 本项尚无有授权的真实浏览器验收、预发布部署或生产验收证据；不得据此宣称已上线或可生产交付。

### 13.6 CNB ProjectGrade 确定性质量门禁（2026-07-20，未提交源码）

- `.cnb.yml` 在既有完整服务端测试之前新增 `project-grade-batch-0-deterministic-gate` 阶段。它只运行以下 5 个 Batch 0 服务端测试文件，并使用 `--runInBand --detectOpenHandles --no-forceExit`：
  - `src/models/project-grade.models.test.ts`
  - `src/routes/project-grade.test.ts`
  - `src/services/project-grade.service.test.ts`
  - `src/services/project-grade.persistence.test.ts`
  - `src/services/project-grade.workflow.test.ts`
- 门禁注释和命令均限定为 AIbak 服务端内部仓库的确定性规则、证据投影、整改与审计边界；不接收或访问用户 URL、Git、CI 或生产环境扫描目标。
- 2026-07-20 已在本地实际执行同一 5 个测试路径：**5 个测试套件、62 个测试通过**；`--detectOpenHandles --no-forceExit` 未报告阻塞性句柄问题。还使用 PyYAML 成功解析 `.cnb.yml`，并静态确认新增门禁位于完整测试阶段之前且没有 HTTP URL、`curl`、`wget` 或 `git clone` 命令。
- 这只是未提交 CI 配置和本地测试/语法证据，**没有 CNB 远端运行记录、镜像构建、部署、预发布或生产验收记录**。生产发布仍仅能经 CNB 正式链路，在实际流水线成功与环境验收后才能声明任何上线状态。
- 2026-07-20 又新增 `project-grade-batch-1-url-safety-gate`：显式强制 `PROJECT_GRADE_EXTERNAL_SCANNING_ENABLED=false`，只运行 mock DNS / mock HTTP 的网络地址、URL 扫描服务、路由授权与持久化边界测试，不访问真实外部目标。该门禁位于完整服务端测试之前。
- 已使用 PyYAML 再次成功解析 `.cnb.yml`，并静态确认 Batch 0 → Batch 1 → 完整测试的顺序。

### 13.7 Batch 1 网址快速体检当前实现（2026-07-20，未提交源码）

- 新增鉴权路由：`POST /api/project-grade/projects/:projectId/url-scan`。请求体不能覆盖扫描地址；服务端只读取数据库中的 `projectUrl`。
- viewer 被拒绝，owner / member / admin 可进入；归档项目、未登记 URL、非 HTTP(S) URL和带用户名密码的 URL 均被拒绝。
- Feature Flag 默认关闭；关闭时不执行 DNS 或 HTTP。三个示例环境文件均加入：

```env
PROJECT_GRADE_EXTERNAL_SCANNING_ENABLED=false
PROJECT_GRADE_URL_SCAN_TIMEOUT_MS=10000
```

- 网络安全边界包括：DNS 全地址公网校验、DNS pinning、每次重定向重新校验、最多 3 次重定向、默认 10 秒且最多 15 秒、响应体最多 2 MB、`proxy: false`、`maxRedirects: 0`。
- 返回证据中的 URL 会删除用户名、密码、query 与 fragment；失败信息不会暴露内部 IP、查询参数 Token 或原始秘密。
- 返回结果固定声明 `evidenceScope = single_server_http_observation`、`productionAcceptance = false`。当前不执行 JavaScript、浏览器控制台、API 失败监听、Lighthouse、Core Web Vitals、真实移动端渲染、完整无障碍验证、Git/CI 扫描或生产链路验收。
- URL 快速体检不修改最终 `EvaluationRun` 分数；`EvaluationRun` 仍是唯一评分真相源。

### 13.8 Batch 1 最新本地验证证据（2026-07-20）

服务端实际执行并通过：

```powershell
npm run build
npm test -- --runInBand --detectOpenHandles --no-forceExit --runTestsByPath `
  src/models/project-grade.models.test.ts `
  src/lib/network-safety.test.ts `
  src/routes/project-grade.test.ts `
  src/services/project-grade-url-scan.service.test.ts `
  src/services/project-grade.service.test.ts `
  src/services/project-grade.persistence.test.ts `
  src/services/project-grade.workflow.test.ts
```

结果：**7 个测试套件、107 个测试通过**，没有报告阻塞性 open handle。

客户端实际执行并通过：

```powershell
node node_modules/prettier/bin/prettier.cjs --write src/pages/ProjectGradePage.tsx src/services/api.ts src/services/api.project-grade.test.ts
node node_modules/typescript/bin/tsc --noEmit
node node_modules/eslint/bin/eslint.js src/pages/ProjectGradePage.tsx src/services/api.ts src/services/api.project-grade.test.ts
npm test -- --run
npm run build
```

结果：TypeScript、目标 ESLint、**2 个测试文件 / 3 个测试**和 Vite 构建均通过。Vite 仍有大 chunk 警告，尚未完成真实浏览器性能或生产验收。

本节仍只证明本地源码与测试状态：

```text
productionVerified = false
productionAcceptance = false
externalScanningEnabled = false
```

## 14. 2026-07-21 本地全量回归、契约修复与并发提交事实

> 本节仅记录本地源码、测试、构建和静态 CI 核验事实；不代表 CNB 远端门禁成功、预发布验收、生产部署或商业交付完成。

### 14.1 首次全量回归暴露的两个真实缺陷

1. 服务端首次完整回归被 7 个测试套件的同一 TypeScript 契约错误阻断：`server/src/routes/aibak-chat.ts` 仍读取已不存在的 `gatewayInfo.url`，而 `getKnowledgeGatewayInfo()` 当前只返回 CloudBase SDK 契约中的 `method`。修复为返回 `gatewayInfo.method`，并新增 `server/src/routes/aibak-chat.status.test.ts`，覆盖上游成功与失败两个状态路径，确保都返回 `method` 且不再暴露 `url`。
2. 类型阻断解除后，`server/src/routes/project-grade.test.ts` 的 22 个请求全部返回 404。根因是 `server/src/index.ts` 中 ProjectGrade import 和 `/api/project-grade` 挂载被并发部署修复提交按 WIP 注释。当前未提交源码已恢复路由 import 与挂载；对应 22 个路由测试通过。

### 14.2 最终本地验证证据

2026-07-21 在 `server` 目录实际执行完整 Jest 回归：

```powershell
npm test -- --runInBand --detectOpenHandles --no-forceExit
```

结果：**91 个测试套件、730 个测试全部通过**，退出码 0；随后 `npm run build` 通过。

2026-07-21 在 `client` 目录实际执行：

```powershell
npm test
npm run build
```

结果：**2 个测试文件、4 个测试全部通过**，测试与构建退出码均为 0。Vite 仍有真实的大 chunk 警告，不得写成零警告；当次主要产物包括约 569.88 kB 的 `index`、1483.72 kB 的 `antd-vendor` 和 1491.59 kB 的 `react-vendor`。

静态核验还确认 `.cnb.yml` 阶段顺序为：

```text
project-grade-batch-0-deterministic-gate
→ project-grade-batch-1-url-safety-gate
→ unit-integration-and-release-tests
```

Batch 1 门禁显式设置 `PROJECT_GRADE_EXTERNAL_SCANNING_ENABLED=false`；`server/.env.example` 与 `server/.env.production.example` 均保留该默认关闭项和 `PROJECT_GRADE_URL_SCAN_TIMEOUT_MS=10000`。`git diff --check` 退出码为 0；仓库仍有既有 LF/CRLF 提示，但没有 whitespace error。

### 14.3 并发 Git 与发布边界

验证期间另一个 Deploy Bot 将仓库从 `6c93725` 推进到 `4ca52ff`、`c678c7f`；之后又出现与 ProjectGrade 无关的 `df3c45e`（首页悬浮微信按钮和联系页企业微信客服入口）。2026-07-21 本节更新时本地 `HEAD`、`cnb/main` 和 `prod/main` 均显示为 `df3c45e09b451f10133740d6de8d38d68d1f2e80`。不得回滚这些并发提交。

ProjectGrade 主要服务端源码、测试和交接文档仍包含大量未跟踪文件，`server/src/index.ts` 的路由恢复仍是未提交修改；因此远端引用更新不能证明 ProjectGrade 已进入正式发布提交，更不能证明生产验收。

固定状态继续保持：

```text
productionVerified = false
productionAcceptance = false
externalScanningEnabled = false
```

下一开发切片是 Batch 2 的授权本地 TypeScript/JavaScript 源码快照扫描：先建立 realpath/允许根目录/符号链接逃逸/文件与字节上限/确定性哈希/脱敏发现等服务层安全边界，不开放任意外部路径、GitHub/CNB clone、ZIP 上传或网络扫描。

## 15. 2026-07-21 Batch 2 授权本地源码扫描首切片与最新验证事实

> 本节仅记录本地源码、测试、构建和静态 CI 配置核验事实；不代表 CNB 远端门禁成功、预发布验收、生产部署、生产验收或商业交付完成。

### 15.1 已实现范围（纯服务层，尚未开放 API）

Batch 2 已建立首个只读、授权本地 TypeScript/JavaScript 源码快照扫描服务，新增未跟踪源码：

- `server/src/project-grade/source-scan.types.ts`
- `server/src/project-grade/source-scan.config.ts`
- `server/src/services/project-grade-source-scan.service.ts`
- `server/src/services/project-grade-source-scan.service.test.ts`

服务端构造时注入授权根目录；请求只接受服务端注册的 `rootKey` 与可选相对路径，不接收客户端任意绝对路径。扫描通过 `realpath` 校验授权根目录边界，拒绝路径穿越与符号链接逃逸；授权根目录内部符号链接不继续跟随并计数。仅处理 `.ts`、`.tsx`、`.js`、`.jsx`、`.mjs`、`.cjs`，跳过 `node_modules`、`dist`、`build`、`coverage`、`.git`、`vendor` 和伪装源码的二进制文件。

硬限制为最多 5,000 个文件、单文件 1 MB、总计 25 MB、10 秒超时。服务以分块流读取，不执行源码、不安装依赖、不运行 npm scripts、不访问网络、不 clone GitHub/CNB、不接受 ZIP，也不默认保存完整源码。结果仅包含脱敏的路径/行号/规则命中/指纹、文件大小与 SHA-256、静态 Express 路由映射、工程元数据存在性和聚合统计。

目前规则包含 `TODO`、`FIXME`、Mock 标记与疑似硬编码密钥；疑似密钥只返回脱敏消息和稳定指纹，绝不回传秘密值或完整源码。固定返回边界继续为：

```text
productionVerified=false
productionAcceptance=false
externalScanningEnabled=false
evidenceScope=authorized_local_source_snapshot
sourceContentPersisted=false
executedSourceCode=false
installedDependencies=false
networkAccessed=false
```

### 15.2 Batch 2 本地测试与 CI 门禁证据

定向服务测试实际执行：

```powershell
cd server
npm test -- --runInBand --detectOpenHandles --no-forceExit --runTestsByPath src/services/project-grade-source-scan.service.test.ts
```

结果：**1 个测试套件、11 个测试通过**。覆盖绝对路径/路径穿越/未授权 rootKey/符号链接逃逸拒绝、扩展名白名单、忽略目录、文件数/单文件/总字节/超时上限、确定性快照、脱敏发现、静态 Express 路由、工程元数据、二进制跳过与本地非生产边界。

`.cnb.yml` 已新增 `project-grade-batch-2-authorized-source-safety-gate`，顺序为：

```text
project-grade-batch-0-deterministic-gate
→ project-grade-batch-1-url-safety-gate
→ project-grade-batch-2-authorized-source-safety-gate
→ unit-integration-and-release-tests
```

该 Batch 2 门禁仅扫描测试创建的授权临时目录，并显式设置 `PROJECT_GRADE_EXTERNAL_SCANNING_ENABLED=false`；静态核验确认无 `curl`、`wget` 或 `git clone`。实现中曾发现 YAML 阶段换行粘连，已修正；随后 PyYAML 解析、顺序和静态安全检查均通过。这仍不是 CNB 远端流水线证据。

### 15.3 最新完整本地验证与并发 Git 事实

2026-07-21 在 `server` 目录实际执行：

```powershell
npm test -- --runInBand --detectOpenHandles --no-forceExit
npm run build
```

结果：Jest **92 个测试套件、741 个测试全部通过**，退出码 0；服务端构建通过。ProjectGrade 定向回归为 **8 个测试套件、121 个测试通过**。

在 `client` 目录实际执行测试和构建：**2 个测试文件、4 个测试通过**，构建退出码 0。Vite 仍真实警告存在大 chunk；当次主要产物约为 `index` 574.67 kB、`antd-vendor` 1483.72 kB、`react-vendor` 1491.59 kB。因此不能声明零警告、真实性能验收或生产完成。

`git diff --check` 退出码 0；既有 LF/CRLF 提示仍存在，但没有 whitespace error。验证过程中并发分支继续推进：本节更新时本地 `HEAD`、`main`、`prod/main` 与 `cnb/main` 均为 `723d11db6de3ca6f19069a75919eb45f36172968`（`feat: MCP插件管理增强 — 40+国内外主流MCP预设库 + 下拉预设表单`），该提交与 ProjectGrade 无关，必须保留且不得回滚。

### 15.4 下一切片与不可越过的边界

下一步才是 `ProjectGradeSourceScanRun` 的最小持久化模型与 owner/admin 受控路由。持久化只能存储快照哈希、服务端授权 `rootKey`、脱敏文件摘要/发现/统计、扫描版本和证据边界，默认不得存完整源码。路由不得接受客户端绝对路径或任意根目录，不能访问网络、clone GitHub/CNB、接受 ZIP 或修改 `EvaluationRun` 的评分真相源；失败不得影响既有评分。先完成持久化、RBAC、审计与回归测试，再讨论后续证据投影和外部连接器。

## 16. 2026-07-21 Batch 2 SourceScanRun 持久化、受控 API 与模型级安全边界

本节覆盖第 15 节“尚未开放 API / 下一切片”的旧状态，以本节和实时代码、测试、构建结果为最新事实。

### 16.1 已写入工作区的受控执行与历史读取

- 新增独立的 `ProjectGradeSourceScanRun` 历史模型和两条鉴权 API：
  - `POST /api/project-grade/projects/:projectId/source-scan`
  - `GET /api/project-grade/projects/:projectId/source-scans`
- 执行权限为项目 owner / team admin；viewer 只能读取已授权项目的脱敏历史。服务端 RBAC 是权限权威。
- POST 不读取或透传客户端请求体中的 `rootKey`、`relativePath`、`absolutePath`；扫描目标只来自数据库内 active `internal_repository`，且当前只允许服务端注册的 `scopeKey=aibak_server_repository`、`repositoryProvider=internal`。
- 扫描器只接收 `{ rootKey: target.scopeKey }`。仍不接受外部 URL、GitHub、CNB、ZIP、任意服务器目录或客户端绝对路径；仍不执行源码、不安装依赖、不运行 npm scripts、不访问网络。
- SourceScanRun 成功历史只保存文件元数据、脱敏发现、路由证据、项目特征、计数、限制和安全布尔值；不保存完整源码。失败历史只保存脱敏错误，不保存结果正文。
- SourceScan 全流程不创建或更新 `EvaluationRun`；源码快照仍不是最终评分真相源。

### 16.2 审计失败关闭与错误脱敏

- Source scan 在真正扫描前先写 `attempted` 审计；若起始审计不可用，返回 `PROJECT_GRADE_AUDIT_UNAVAILABLE`，扫描器不执行、SourceScanRun 不写入、`EvaluationRun` 不触碰。
- 成功和失败都写终态审计。`AppError` 只持久化 `safeMessage`；未知内部错误统一写固定脱敏摘要，不把 `internalDetail`、数据库连接串或任意未知异常正文写入管理员可读的 `ProjectGradeAuditLog.errorSummary`。
- 已补回归覆盖 attempted 审计失败、历史持久化失败、扫描失败、RBAC、归档项目、缺失/非法 target 以及不触碰 `EvaluationRun`。

### 16.3 扫描器返回值的二次安全边界与真实缺陷修复

- 回归测试曾真实证明：若注入的扫描器返回 `C:\private\apiKey=super-secret.ts`，旧的结果清洗会把绝对路径和秘密样本文本写入成功历史。该测试修复前失败，证明缺陷真实存在。
- 已新增共享 `src/project-grade/source-scan-safety.ts`，并在服务持久化边界和模型字段验证中复用。所有 `files[].path`、`findings[].filePath`、`routes[].filePath` 必须是安全相对路径。
- 拒绝 Windows/Unix 绝对路径、盘符相对路径、UNC、`.` / `..` 段、空段、前后空白、NUL、空字符串、非字符串和超过 1000 字符的路径；安全反斜杠相对路径规范化为 `/`。
- 不安全扫描结果统一失败关闭为 `502 PROJECT_GRADE_SOURCE_SCAN_UNSAFE_RESULT`；只允许写脱敏失败历史与失败审计，不保存不安全结果。
- 独立路径单元测试现为 **1 suite / 22 tests passed**。

### 16.4 SourceScanRun 严格模型防御

- `ProjectGradeSourceScanRun.result` 已由 `Schema.Types.Mixed` 改为严格嵌套 Schema，所有子 Schema 使用 `strict: 'throw'`，避免未来第二写入路径静默保存未知字段（例如 `sourceContent`、秘密或任意绝对路径）。
- 模型验证覆盖：
  - 文件、发现、路由路径共享安全校验；
  - SHA-256 / snapshot hash / fingerprint 形态；
  - severity、framework、evidence scope、当前授权 root key 枚举；
  - 非负整数和扫描限制；
  - `productionAcceptance`、`externalScanningEnabled`、`sourceContentPersisted`、`executedSourceCode`、`installedDependencies`、`networkAccessed` 必须固定为 `false`；
  - 成功记录必须包含 `scanVersion`、`snapshotHash` 和 `result`；失败记录不得包含 `result`，且必须包含脱敏错误字段。
- 新增模型回归时首次运行真实出现 **4 个失败**，随后完成严格模型实现；当前模型测试为 **1 suite / 14 tests passed**。

### 16.5 最新本地验证证据

2026-07-21 在 `server` 目录实际执行：

```powershell
npm test -- --runInBand --detectOpenHandles --no-forceExit --runTestsByPath `
  src/models/project-grade.models.test.ts `
  src/project-grade/source-scan-safety.test.ts `
  src/routes/project-grade.test.ts `
  src/services/project-grade-source-scan.service.test.ts `
  src/services/project-grade-url-scan.service.test.ts `
  src/services/project-grade.persistence.test.ts `
  src/services/project-grade.service.test.ts `
  src/services/project-grade.workflow.test.ts

npm test -- --runInBand --detectOpenHandles --no-forceExit
npm run build
```

真实结果：

- ProjectGrade 定向回归：**8 suites / 132 tests passed**。
- 服务端完整回归：**93 suites / 780 tests passed**。
- TypeScript 构建通过。
- 本轮触及文件 Prettier 检查通过；`git diff --check` 退出码为 0，仅报告既有工作区的 LF/CRLF 提示。
- 静态检查确认 source-scan 路由不包含 `rootKey` / `relativePath` / `absolutePath` 输入；`ProjectGradeSourceScanRun.result` 已无 `Schema.Types.Mixed`。

本节更新时：

```text
branch=main
HEAD=4d8fd79a63a04b8351634132f38de43c1dd991ae
productionVerified=false
productionAcceptance=false
externalScanningEnabled=false
```

工作区仍有大量必须保留的既有未提交和未跟踪修改；ProjectGrade 主要文件仍未提交。没有 CNB 远端门禁运行、镜像构建、预发布探针、生产部署、生产日志、回滚演练或生产验收证据，因此不得宣称功能已上线或生产完成。

### 16.6 后续开发顺序

1. 为 SourceScanRun 增加受控证据投影设计，但在版本化、可重建、幂等规则明确前不得写入 `EvaluationRun`。
2. 补项目详情页 SourceScan 执行状态、历史列表、错误码映射与安全边界提示，继续复用服务端 RBAC，不在前端实现权限权威。
3. 增加保留期、删除/归档策略和审计查询的租户级边界测试。
4. 在 CNB 唯一正式链路获得真实远端测试、构建、预发布与生产探针证据后，再进入发布验收；固定状态在此之前保持 false。

## 17. 2026-07-21 Batch 2 SourceScan 前端工作区、租户绑定历史与保留策略

本节覆盖第 16.6 节中“前端项目详情工作区”和“租户级边界测试”尚待完成的旧状态。以下均为当前工作区和本地自动化证据，不代表 CNB、预发布或生产验收。

### 17.1 SourceScan 前端项目工作区（上一检查点事实）

客户端 API 已接入：

- `runProjectSourceScan(projectId)` → `POST /project-grade/projects/:projectId/source-scan`
- `listProjectSourceScans(projectId, limit)` → `GET /project-grade/projects/:projectId/source-scans`

`ProjectGradePage` 已提供受控 SourceScan 执行、运行状态、错误码映射、历史刷新、脱敏文件/Finding/路由/工程信号展示和历史快照 Modal；异步请求使用 sequence 防止旧响应覆盖新项目状态。页面明确提示只扫描服务端授权本地源码快照，并继续展示：

```text
productionVerified=false
productionAcceptance=false
externalScanningEnabled=false
```

本轮重新运行客户端测试时真实发现 `api.project-grade.test.ts` 对 `antd` 的不完整模块 mock 会在收集阶段缺少 `Typography`，导致 **1 个测试文件失败、1 个通过**。已改为直接 mock `QuotaExceededModal` 的副作用入口，避免 API 客户端单元测试加载整套 UI 依赖。最终客户端为 **2 个测试套件 / 6 个测试通过**；ESLint 退出码 0，但仍有 **152 个既有 warning、0 error**；`tsc --noEmit` 通过。本轮没有执行 Vite build，以避免覆盖开始前已修改且必须保留的 `client/dist/index.html`；最近一次 Vite build 通过仍属于上一检查点证据。

### 17.2 历史查询的 tenant-bound 归属约束

此前 URL scan、SourceScanRun 和 AuditLog 均先经过项目 RBAC，但历史集合查询只使用 `projectId`。本轮已统一为授权项目派生的不可变租户过滤器：

```ts
{
  projectId: project.projectId,
  ownerId: project.ownerId,
  teamId: project.teamId ?? { $exists: false },
}
```

当前行为：

- `listProjectUrlScanRuns`、`listProjectSourceScanRuns`、`listProjectAudit` 都必须先完成 `getProjectForUser` 授权，再执行 tenant-bound 查询；
- 团队项目精确绑定 `projectId + ownerId + teamId`；个人项目精确绑定 `projectId + ownerId + teamId 不存在`；
- 未授权时 URL/SourceScan/Audit 历史集合查询不得执行；
- `ProjectGradeAuditLog` 新增不可变 `ownerId` 和可选不可变 `teamId`，所有 `beginAudit` 调用均从已授权项目写入归属；
- AuditLog 新增 `{ projectId: 1, ownerId: 1, teamId: 1, createdAt: -1 }` 复合索引；
- SourceScan 仍不创建或更新 `EvaluationRun`，本轮没有改变最终评分真相源。

### 17.3 保留与删除策略（当前首期边界）

当前不为 `ProjectGradeAuditLog` 或 `ProjectGradeSourceScanRun` 配置 MongoDB TTL：审计记录和脱敏源码扫描证据暂时保留，避免未经业务、合规和客户合同确认就自动物理删除。首期不开放物理删除 API。后续应在明确套餐、合同、地域合规和客户数据政策后，实现受审计的软归档、租户级导出/删除流程和可配置保留期限；在该规则落地前不得以 TTL 代替业务归档。

模型回归明确断言 AuditLog 当前不存在 `expireAfterSeconds` 索引，防止未来无意加入自动删除。

### 17.4 失败驱动回归与最终本地证据

本切片先收紧测试后运行，真实得到 **3 suites failed，3 tests failed / 51 passed / 54 total**，证明旧实现的 SourceScan 历史、AuditLog 历史只按 `projectId` 查询，且 AuditLog 缺少租户归属字段。实现后首次复测又真实发现 1 个团队所有者测试夹具预期写错，修正测试数据后继续验证，而不是放宽实现。

最终新增个人项目 `teamId: { $exists: false }` 和未授权时集合查询零调用回归后，本地结果为：

```text
最小租户回归：3 suites / 58 tests passed
ProjectGrade 定向回归：8 suites / 136 tests passed
服务端完整回归：93 suites / 784 tests passed
TypeScript build：passed
触及文件 Prettier check：passed
定向 git diff --check：exit 0
```

验证时仓库仍为 `main@4d8fd79a63a04b8351634132f38de43c1dd991ae`，工作区仍有大量必须保留的未提交和未跟踪修改。本轮未执行 `git add -A`、reset、clean 或 stash。

### 17.5 当前不可越过的状态与下一切片

```text
productionVerified=false
productionAcceptance=false
externalScanningEnabled=false
```

没有 CNB 远端流水线、预发布探针、生产部署、生产日志、回滚演练或生产验收证据，不能宣称上线或生产完成。下一切片应先定义 SourceScan → Evidence 的版本化、可重建、幂等投影契约，并继续保证 SourceScanRun 本身不是 `EvaluationRun` 评分真相源；在投影规则和回滚/重建测试完成前不得把源码扫描结果直接计入最终分数。

## 18. 2026-07-21 SourceScan → Evidence 版本化草稿投影契约

### 18.1 规范依据与采用边界

本切片以 NIST SP 800-218 SSDF、SLSA Provenance v1、in-toto Statement v1 和 OWASP SAMM 的可验证来源、摘要绑定、版本化声明与可复核证据原则为参考，形成独立的 SourceScan 证据草稿投影。参考入口：

- https://csrc.nist.gov/pubs/sp/800/218/final
- https://slsa.dev/provenance/v1
- https://in-toto.io/Statement/v1
- https://owaspsamm.org/model/

新增：

```text
server/src/project-grade/source-scan-evidence-projection.ts
server/src/project-grade/source-scan-evidence-projection.test.ts
```

当前投影版本为 `1`，只支持 `authorized-source-snapshot/0.1.0`。它只在内存中生成 `scoringDisposition=draft_only_not_adopted` 的 Evidence Draft Projection；不持久化 MongoDB，不创建或更新 `EvaluationRun`，不输出 `runId`，也不自动改变完成度、维度得分或最终分数。后续如需进入评分，必须由受控评估运行显式采纳，并绑定该评估自己的 `runId`。

### 18.2 稳定身份、租户归属与映射

投影携带 `projectId + ownerId + teamId`；个人项目明确省略 `teamId`。`evidenceId` 由投影版本、租户归属、扫描版本、快照摘要、草稿类型、维度和稳定身份生成，因此不受扫描器数组顺序影响。`draftSetHash` 对完整草稿集合做稳定序列化摘要，重建同一个 SourceScan 记录会得到同一结果；由于草稿元数据绑定 `sourceScanId` 和 `collectedAt`，同一快照的不同扫描记录可以复用稳定 `evidenceId`，但会形成不同的投影实例摘要。

显式映射如下：

```text
source.todo / source.fixme
  → code_maintainability.baseline
source.mock_marker
  → functional_reality.baseline
security.suspected_hardcoded_secret
  → security_compliance.baseline
hasTests
  → code_maintainability.baseline
hasDocker / hasCi
  → devops_reliability.baseline
hasLicense
  → commercial_delivery.baseline
hasPackageManifest
  → architecture_engineering.baseline
route inventory
  → requirements_completeness.baseline
snapshot manifest
  → architecture_engineering.baseline
```

所有草稿当前标记为 `level=source_static`、`factor=0.75`，但这只是证据类型元数据，不构成自动采纳。未知 SourceScan finding 规则失败关闭，不静默归类。

### 18.3 安全与一致性边界

投影会重新校验授权本地只读边界、扫描版本、`rootKey`、快照哈希、文件清单摘要、汇总计数、正整数/非负整数、受控相对路径和 Finding 指纹。扫描器控制的 `message`、路由字面量、完整源码或秘密样本不会进入输出；路由只以稳定 SHA-256 清单摘要参与草稿。输出持续声明：

```text
productionAcceptance=false
externalScanningEnabled=false
sourceContentPersisted=false
```

主要失败关闭错误码包括版本不支持、来源不可投影、扫描版本不支持、安全边界失败、不安全路径、Finding 指纹不匹配、规则未映射和结果不一致。

### 18.4 失败驱动验证与最新本地证据

测试先真实得到模块不存在的红灯；实现后第一次复测为 **1 suite failed / 7 tests passed / 1 test failed**。唯一失败来自测试断言把安全声明字段 `sourceContentPersisted=false` 的字段名误判为源码泄露，而输出中并未出现测试秘密、扫描器消息或路由字面量。随后将断言收紧为精确检查 `metadata.sourceContentPersisted === false`，没有删除安全声明，也没有放宽实现。

最终本地结果：

```text
最小投影回归：1 suite / 8 tests passed
ProjectGrade 定向回归：9 suites / 144 tests passed
服务端完整回归：94 suites / 792 tests passed
服务端 TypeScript build：passed
触及文件 Prettier check：passed
定向 git diff --check：exit 0
仓库根 build（server + client）：passed；Vite 大 chunk 警告仍存在
```

验证时仍为 `main@4d8fd79a63a04b8351634132f38de43c1dd991ae`，大量既有未提交与未跟踪文件继续保留。本切片没有执行 `git add -A`、reset、clean 或 stash。

### 18.5 当前不可越过的状态与下一切片

```text
productionVerified=false
productionAcceptance=false
externalScanningEnabled=false
```

没有 CNB 远端流水线、预发布探针、生产部署、生产日志、回滚演练或生产验收证据，不能宣称上线或生产完成。下一切片应先设计“评估运行显式采纳 Evidence Draft”的版本化命令契约、幂等持久化和回滚/重建测试；在该契约完成前，SourceScan 证据草稿仍不得直接写入最终评分真相源。
## 19. 2026-07-21 Evidence Adoption Manifest、受保护命令与最新回归事实

本节覆盖第 18.5 节“显式采纳 Evidence Draft”尚未实现的旧状态。以下均为当前工作区和本地自动化证据，不代表 CNB、预发布或生产验收。

### 19.1 外部提交回归与路由恢复

本轮开始时实际仓库为：

```text
branch=main
HEAD=2bcfc3f7e2d4b6e31d45f728d853f799a7e7820e
```

`main`、`cnb/main`、`prod/main` 均指向该提交。外部提交 `a39e463` 曾将 `server/src/index.ts` 中 ProjectGrade 路由导入和 `/api/project-grade` 挂载注释为 WIP，导致真实路由回归全部返回 404；本地已恢复路由导入和挂载。该修复只恢复本地开发与自动化回归入口，不构成部署或生产可用证据。

### 19.2 两阶段 Evidence Adoption Manifest

当前采用安全的两阶段契约：

1. SourceScan 先生成纯内存、版本化的 Evidence Draft Projection；
2. 管理员显式提交采纳命令，创建不可变、幂等、可重建的 Adoption Manifest；
3. Manifest 固定为 `scoringDisposition=adopted_pending_evaluation`；
4. Manifest 不创建、不更新任何旧 `EvaluationRun`；
5. 后续新 `EvaluationRun` 必须整体消费 Manifest，并重新计算 Evidence、Finding、Snapshot、Score 和 ReleaseGate。

新增模型：

```text
server/src/models/ProjectGradeEvidenceAdoption.ts
```

模型使用 `strict: 'throw'`，固定租户归属和不可变输入，校验版本、SHA-256、Evidence ID 集合、正整数草稿数，并通过唯一索引约束 `adoptionId` 及 `(projectId,targetId,sourceScanId,adoptionVersion)`。`productionAcceptance` 和 `externalScanningEnabled` 只能为 `false`。

### 19.3 受保护采纳 API 与服务边界

新增命令：

```http
POST /api/project-grade/projects/:projectId/source-evidence-adoptions
```

客户端只允许提交以下三个字段，且三者均必填：

```json
{
  "sourceScanId": "source-scan-123456",
  "expectedDraftSetHash": "sha256:<64 lowercase hex>",
  "adoptionVersion": 1
}
```

未知字段严格拒绝，包括客户端伪造的 `runId`、`targetId`、租户字段、评分字段、源码内容或生产状态字段。服务端重新授权项目、绑定 `projectId + ownerId + teamId`、重新加载 SourceScan 与目标、重建投影并比较 `expectedDraftSetHash`，然后才允许写入 Manifest。个人项目未授权用户、归档项目、跨租户扫描/目标、不安全扫描结果、版本不支持、投影变化和持久化失败均失败关闭。

幂等重放返回同一 Manifest；duplicate-key 并发竞态会重新读取唯一记录。审计遵循 attempted/succeeded/failed，attempted 写入失败时不继续查询或持久化 Manifest。持久化错误对外使用固定安全文本，避免数据库 URI、本地路径或密钥样本泄露。

成功响应明确声明：

```text
persisted=true
scoringDisposition=adopted_pending_evaluation
evaluationRunCreated=false
productionAcceptance=false
externalScanningEnabled=false
```

当前首次创建与幂等重放都返回 HTTP 201；在服务结果显式增加 `created/replayed` 标记前，不根据 Mongoose 文档形态猜测 200/201。

### 19.4 模型、审计与回归覆盖

`ProjectGradeAuditLog` 已增加：

```text
action=source_evidence_adopt
targetType=evidence_adoption
```

新增或加固的回归覆盖：

- Manifest strict schema、不可变字段、唯一索引、版本/hash/Evidence ID/草稿数和安全布尔值；
- 个人项目未授权、归档项目、missing/failed/cross-tenant SourceScan；
- missing/forbidden target、Draft Set 变化、版本不支持和不安全投影；
- 幂等返回、duplicate-key 竞态、attempted 审计失败短路；
- Manifest 持久化 503、失败时不创建或更新 `EvaluationRun`；
- failed audit 错误摘要脱敏、succeeded audit 携带幂等与生产边界元数据；
- API 三字段严格契约、未知字段拒绝和响应不包含 `runId`。

本轮首次真实回归发现两项阻断：ProjectGrade 路由被注释导致接口 404，以及 AuditLog 新枚举未同步模型测试；两项均已修复并有自动化回归保护。

### 19.5 最新本地验证证据

本切片实际获得：

```text
服务层最小回归：1 suite / 32 tests passed
模型与路由局部回归：2 suites / 41 tests passed
ProjectGrade 定向回归：10 suites / 180 tests passed
服务端完整回归：94 suites / 800 tests passed
TypeScript no-emit：passed
触及文件 Prettier：首次发现 8 个文件偏差；仅格式化该 8 个文件后 passed
格式化后关键回归：3 suites / 73 tests passed
定向 git diff --check：exit 0（仅既有 LF/CRLF 提示）
无污染 TypeScript emit 到系统临时目录：passed，临时产物已删除
```

为保护已有未提交的 `server/dist/**`，没有把本轮 emit 写入仓库 dist，也没有把本地测试结果描述为生产构建。工作区中的既有未提交和未跟踪文件全部保留；本轮没有执行 `git add -A`、reset、clean 或 stash。

### 19.6 当前不可越过的状态与下一切片

```text
productionVerified=false
productionAcceptance=false
externalScanningEnabled=false
```

没有可核验的 CNB 流水线、镜像、预发布探针、生产部署、生产日志、回滚演练或生产验收证据，因此不得宣称已上线、生产评分准确或商业闭环完成。

下一切片是“新 `EvaluationRun` 显式消费一个 Adoption Manifest 并整体重算”。开始实现前必须固定评分策略：正向完成度与 finding 扣分/阻断分离；旧运行保持不可变；新运行记录 `adoptionId`、`projectionVersion`、`adoptionVersion`、`sourceScanId`、`draftSetHash`；同一 Manifest 重试幂等；任何投影失败都不得留下半写入的评分真相；attempted/succeeded/failed 必须可审计、可重建、可回滚到同一不可变输入。

## 20. 2026-07-21 Adoption Manifest → EvaluationRun 整体评估、失败补偿与最新回归事实

本节覆盖第 19.6 节“新 `EvaluationRun` 显式消费一个 Adoption Manifest 并整体重算”尚未实现的旧状态。以下结论只来自当前工作区、本地测试和 TypeScript 静态检查，不代表 CNB、预发布或生产验收。

### 20.1 版本化评分策略与不可变运行来源

新增纯确定性评分适配层：

```text
server/src/project-grade/source-evidence-adoption-evaluation.ts
```

当前固定：

```text
sourceEvidenceScoringPolicyVersion=1
evaluationInputKind=source_evidence_adoption
productionVerified=false
```

适配层只接受与 Manifest 完全一致、可重建的 Evidence Draft Projection。它重新核对投影/采纳版本、项目与租户归属、SourceScan、snapshot hash、draft set hash、Evidence ID 集合、草稿数量和每条草稿的安全元数据。正向完成度由受支持的 adopted source-static evidence 显式生成；finding 仍作为独立扣分/阻断输入，不把“发现问题”误当成正向完成度，也不把源码静态证据提升为生产验证。

`EvaluationRun` 已增加严格来源契约和唯一索引。来源证据运行持久化：

```text
adoptionId
sourceScanId
sourceScanVersion
snapshotHash
draftSetHash
sourceEvidenceProjectionVersion
sourceEvidenceAdoptionVersion
sourceEvidenceScoringPolicyVersion
```

baseline 运行必须不含这些字段；`source_evidence_adoption` 运行必须完整包含这些字段且 `productionVerified=false`。同一租户、同一 Manifest 只能存在一个来源证据运行。

### 20.2 受保护评估命令与失败关闭顺序

新增命令：

```http
POST /api/project-grade/projects/:projectId/evaluations/source-evidence
```

请求体只允许：

```json
{
  "adoptionId": "source-adoption:v1:<64 lowercase hex>"
}
```

服务端先重新授权管理员和活动项目，再写 attempted audit；随后按精确租户加载 Manifest、成功 SourceScan 和活动内部仓库目标，重建 Evidence Draft Projection，并重新执行不可变 Manifest 评估。Manifest 缺失、扫描或目标不可用、草稿集合漂移、版本不支持、生产边界违反时均在创建运行前失败关闭。

运行创建发生在完整重算之后。duplicate-key 竞态只恢复唯一 pending 运行；普通持久化失败固定返回 `PROJECT_GRADE_SOURCE_EVIDENCE_EVALUATION_UNAVAILABLE`，不推进项目 latest summary。已有 ready/pending/failed 运行在复用前会重新核对完整 provenance；任一字段漂移固定返回 `PROJECT_GRADE_SOURCE_EVIDENCE_RUN_PROVENANCE_MISMATCH`，不回显具体字段和值。

### 20.3 投影补偿、失败恢复与诊断脱敏

来源证据运行沿用统一投影器，顺序写入 Evidence、Finding、ScoreSnapshot，最后才把 `EvaluationRun.projectionStatus` 标记为 `ready`。项目 `latestRunId/latestScore/latestGrade/latestAssessedAt` 只在投影 ready 后更新。

以下失败阶段已有补偿回归：

```text
初始 projection cleanup
Evidence bulkWrite
Finding bulkWrite
ScoreSnapshot bulkWrite
EvaluationRun ready update
失败后的 compensating cleanup
EvaluationRun failed update
```

投影失败会尽力清除该 run 的派生记录、记录固定 failed 状态，并对外返回 `PROJECT_GRADE_PROJECTION_FAILED`；即使 cleanup 自身失败，也仍尝试记录 run failed，且不更新项目 summary。已有 failed run 可先重置为 pending、清除旧 `projectedAt/projectionError` 后重建。

`projectionError` 和相关内部日志现在会隐藏 MongoDB URI、password/passwd/pwd/secret/token/API key/authorization 值、Windows 盘符绝对路径以及常见 Unix 本地绝对路径。外部错误仍使用固定安全文案，不泄露数据库凭据、令牌或源码路径。

### 20.4 失败驱动回归与最新本地证据

本轮先增加 provenance 漂移、来源对象不可用、Manifest 重建漂移、duplicate-key 恢复、failed retry、普通创建失败、各投影阶段补偿、cleanup 自身失败和敏感诊断回归。provenance 红灯真实得到 **10 tests failed**，证明旧实现会复用已漂移 ready run；修复后该组通过。随后补偿矩阵真实得到 **3 tests failed / 56 passed**，证明旧净化只隐藏 MongoDB URI而仍泄露 token 与 Windows 路径；扩展净化后持久化套件通过。

本检查点最终本地证据：

```text
持久化定向回归：1 suite / 59 tests passed
关键四套件：4 suites / 110 tests passed
ProjectGrade 全部定向回归：11 suites / 217 tests passed
服务端完整回归：95 suites / 837 tests passed
TypeScript no-emit：passed
触及文件 Prettier check：passed
格式修复后关键回归：3 suites / 83 tests passed
定向 git diff --check：exit 0
```

验证仓库位置：

```text
branch=main
HEAD=2bcfc3f7e2d4b6e31d45f728d853f799a7e7820e
```

大量既有未提交和未跟踪文件继续保留；没有执行 `git add -A`、reset、clean 或 stash，也没有覆盖 `client/dist/**` 或 `server/dist/**`。

### 20.5 当前不可越过的状态与下一切片

```text
productionVerified=false
productionAcceptance=false
externalScanningEnabled=false
```

当前只有本地代码、自动化测试和静态检查证据。没有可核验的 CNB 流水线、镜像、预发布探针、生产部署、生产日志、回滚演练或生产验收证据，因此不得宣称已上线、生产评分准确或商业闭环完成。

下一切片应继续加固同一 Manifest 的并发投影互斥与崩溃恢复，避免多个请求同时清理/重写同一 run 的派生投影；随后补齐管理员可操作的 SourceScan → Draft → Adoption → Evaluation 查询与前端闭环，再进入预发布基础设施和真实外部证据接入。任何上线结论仍必须由 CI、预发布和生产证据单独证明。

## 21. 2026-07-21 EvaluationRun 投影租约、并发互斥与崩溃接管

### 21.1 本切片目标与状态机

在 Adoption Manifest → EvaluationRun 整体评估链路中，原有 `pending/failed → ready/failed` 投影没有运行所有权：同一 run 可被并发请求同时清理和写入派生记录，旧请求也可能覆盖新请求结果。本切片为投影增加显式状态和有时限的 attempt 所有权：

```text
pending → projecting → ready/failed
failed → projecting → ready/failed
expired projecting → projecting（新 attempt 接管）
ready → projecting（仅显式管理员 rebuild）
```

`EvaluationRun` 新增 `projectionAttemptId`、`projectionStartedAt`、`projectionLeaseExpiresAt`；attempt 固定为 `projection-attempt:v1:<64 lowercase hex>`，当前租约期限为 10 分钟，并新增 `(projectionStatus, projectionLeaseExpiresAt)` 索引支持过期扫描和接管。`ProjectGradeProjectionStatus` 现为 `pending | projecting | ready | failed`。

### 21.2 CAS 获取、续租与 attempt fencing

投影开始使用条件更新获取租约，只允许以下状态进入 `projecting`：

- `pending`；
- `failed`；
- 已过期的 `projecting`；
- 显式 rebuild 时的 `ready`。

续租、标记 ready 和标记 failed 都必须同时匹配：

```typescript
{
  runId,
  projectionStatus: 'projecting',
  projectionAttemptId,
}
```

若 attempt 已失权，固定失败关闭为：

```text
PROJECT_GRADE_PROJECTION_IN_PROGRESS
HTTP 409
```

旧 attempt 失权后不会继续补偿清理、不会标记 failed、不会推进项目 latest summary，也不会伪报 ready。显式管理员 rebuild 不再无条件重置 ready run，而是通过 `ready → projecting` CAS 保证并发互斥。

### 21.3 投影失败补偿与崩溃恢复边界

投影在各写入阶段前续租；写入失败时只有仍持有 attempt 的请求才能执行补偿清理并标记 failed。若 failed 状态本身写入失败，run 可能暂时保留在 `projecting`，后续请求可在租约过期后接管，这是当前的请求触发恢复设计；本切片尚未增加后台 worker 主动扫描和恢复。

当前仍有一个必须显式保留的架构限制：派生集合的 cleanup 与 bulkWrite 不是 attempt-scoped。阶段前续租可显著缩小竞态窗口，但如果单个数据库操作超过完整 10 分钟租约、租约过期后旧操作又恢复，理论上仍可能与新 attempt 重叠。彻底消除该风险需要真实 MongoDB replica set 上的事务、attempt-scoped staging + 原子发布，或可靠后台 heartbeat；在没有相应集成和生产证据前，不得宣称该极端竞态已完全解决。

### 21.4 失败驱动回归与真实本地证据

修复前新增并发/失权回归真实失败为：

```text
2 suites failed
5 tests failed
76 tests passed
81 tests total
```

修复并补充“写失败后补偿前失权”和“两个管理员并发 rebuild ready run”安全回归后，真实本地结果为：

```text
模型与持久化定向：2 suites passed / 83 tests passed
ProjectGrade 定向：11 suites passed / 223 tests passed
服务端完整 Jest：95 suites passed / 843 tests passed
服务端 TypeScript：npx tsc --noEmit，退出码 0
触及文件 Prettier：通过
定向 git diff --check：退出码 0
```

服务端完整 Jest 仍出现既有的 open-handle 提示：

```text
Jest did not exit one second after the test run has completed
```

本次完整测试最终退出码为 0，但 open-handle 根因尚未定位，仍需后续使用 `--detectOpenHandles` 或分组二分定位。上述均为本地自动化证据，不是预发布或生产证据。

### 21.5 下一开发切片

下一步进入管理员操作闭环，按以下顺序推进：

1. 增加安全的 SourceScan Evidence Draft Preview 读模型；
2. 增加 tenant-bound Evidence Adoption Manifest 列表读模型；
3. 客户端补齐 `SourceScan → Draft Preview → Adoption → Evaluation` 工作流；
4. 对 403 清空旧管理员数据、409 投影进行中、切换项目/扫描的旧响应覆盖增加回归；
5. 再进入后台租约恢复、真实 MongoDB 并发集成、预发布基础设施与外部证据。

固定状态仍为：

```text
productionVerified=false
productionAcceptance=false
externalScanningEnabled=false
```

当前没有服务器部署、镜像上传、CNB、预发布或生产验收证据，不得宣称 ProjectGrade 已上线或生产可用。

## 22. 2026-07-23 正式报告 PDF 下载、交付记录与真实浏览器回归

本节覆盖第 21 节之后的最新 ProjectGrade 交付事实。以下证据均来自当前本地工作区，不代表预发布或生产验收。

### 22.1 客户端 PDF 下载与商业权益反馈

客户端已完成正式报告 PDF 下载闭环：

- `client/src/services/api.ts` 新增报告交付记录查询和 PDF Blob 下载；PDF 请求保留完整 Axios response，以读取文件名、Delivery ID、品牌模式和双指纹响应头；
- JSON 错误以 Blob 返回时会重新解析为结构化 API 错误，套餐缺失、发布额度和下载额度错误可进入统一升级引导；
- 新增 `client/src/pages/ProjectGrade/report-delivery.ts`，负责 RFC 5987 UTF-8 文件名解析、安全文件名、Blob URL 下载和 finally 释放；
- `ProjectGradePage.tsx` 已增加“下载 PDF”、下载 loading、撤销/过期/缺指纹禁用、套餐和日额度前置提示、成功后权益刷新、Delivery ID 回显；
- 新增 PDF 交付记录 Drawer，展示请求人、下载时间、套餐、AIbak/white-label、文件名、大小、内容指纹和 PDF 文档指纹，并支持刷新和再次下载；
- 切换项目或关闭 Drawer 会使旧请求失效，避免陈旧响应覆盖当前项目。

### 22.2 服务端真实 PDF 生成 smoke

新增：

```text
server/src/scripts/project-grade-pdf-smoke.ts
npm run smoke:project-grade-pdf
PROJECT_GRADE_PDF_BROWSER_PATH=
```

真实 Puppeteer/Chrome smoke 已验证 `%PDF-` 文件头、文件大小、SHA-256 文档指纹、页数和中文文本回读。2026-07-23 的本地结果：

```json
{
  "ok": true,
  "fileName": "中文商业项目测试-rpt_smoke_20260723.pdf",
  "byteLength": 276419,
  "pageCount": 3,
  "documentFingerprint": "sha256:0baf19cbd215d3fc20c052868246c95c61d110105d20dfc73d327dd1673b2f13",
  "chineseTextVerified": true,
  "productionAcceptance": false
}
```

### 22.3 最新本地验证事实

```text
客户端 TypeScript：npx tsc --noEmit，passed
客户端 PDF/API 定向：2 files / 14 tests passed
客户端完整回归：7 files / 31 tests passed
客户端生产构建：passed（仅既有大 chunk 警告）
服务端 TypeScript：npx tsc --noEmit，passed
PDF/ProjectGrade 相关定向：9 suites / 137 tests passed
服务端生产构建：passed
真实 Chrome PDF smoke：passed
服务端完整 Jest 首次：103 suites passed / 2 suites failed；931 tests passed / 4 tests failed
服务端完整 Jest 修复后：105 suites / 935 tests passed，退出码 0
定向 git diff --check：退出码 0（仅既有 LF/CRLF 提示）
```

首次完整回归失败不是 PDF 实现缺陷，而是 TranSync 新增 `TRANSYNC_BASE_URL` 和 `TRANSYNC_SSO_CLIENT_SECRET` 生产必填校验后，两个 CI/静态生产配置测试夹具未同步。保持生产校验不放宽，仅补齐非路由占位 URL 和至少 48 字符测试密钥；失败套件单独回归为 2 suites / 8 tests passed，随后全量 935 项通过。

### 22.4 当前完成边界与未完成商业闭环

本切片已完成本地代码层的：

```text
正式报告发布 → PDF 生成 → 浏览器下载 → 额度扣减/升级提示 → 交付记录 → 内容/文档双指纹
```

但 AIbak 智评通仍不是完整生产商业闭环，后续按优先级继续：

1. ProjectGrade 支付沙箱 E2E，验证下单、Webhook、套餐即时生效；
2. 套餐到期、降级和续费失败后的容量/额度处理；
3. 退款后报告发布、PDF 下载、white-label 等权益回退；
4. Team 共享套餐、共享项目容量和共享配额；
5. ProjectGrade 专属客服、售后和退款工单；
6. 匿名体检 → 注册 → 创建项目 → 付费 → 发布/分享报告的转化漏斗与运营自动化；
7. CNB/镜像、预发布、生产 MongoDB/Redis/Chromium、Caddy/SSL、监控、回滚和真实域名验收。

固定状态仍为：

```text
productionVerified=false
productionAcceptance=false
externalScanningEnabled=false
```

不得把本地构建、自动化测试或 PDF smoke 描述为 `aibak.site` 已部署、已完成生产验收或完整商业闭环已完成。

## 23. 2026-07-23 ProjectGrade 支付来源、订单幂等与即时权益闭环

本节覆盖第 22 节之后的支付闭环最新本地事实。所有结论仅代表当前工作区的本地自动化和构建结果，**不代表真实支付、预发布或生产验收**。

### 23.1 已实现的订单与履约边界

ProjectGrade 订阅购买现在携带明确业务来源和安全返回路径：

```text
sourceProduct=project_grade
returnTo=/project-grade/projects
idempotencyKey=<浏览器生成的单次购买键>
```

- `Order` 保存 `sourceProduct`、`returnTo`、履约 attempt、履约开始时间和安全失败摘要，并为 `(userId, idempotencyKey)` 建立部分唯一索引；
- 后端拒绝协议相对 URL、反斜杠、控制字符和跨站 `returnTo`；ProjectGrade 缺省回到 `/project-grade/projects`；
- 同一用户、相同幂等键和相同购买参数返回既有订单；若套餐、周期、来源或返回路径不同，返回 `409 ORDER_IDEMPOTENCY_CONFLICT`；
- Webhook、Mock 主动查单和 Outbox 都调用 `billing-order-fulfillment.service.ts` 的同一权威履约入口，Worker 不再信任可篡改的 Outbox payload；
- 履约按 `subscription`、`credits_pack`、`private_license` 显式分流；年付使用订单真实周期，私有化 License 不会误激活订阅；
- 每笔已支付订单固定使用 `payment-confirmed:<orderNo>` Outbox 键；租约、attempt fencing 和可重试失败状态防止重复履约或过期 worker 覆盖新结果；
- `/api/billing/orders/:orderNo/status` 仅在履约完成后返回 `paid`，进行中返回 `fulfilling`。

### 23.2 前端购买与返回体验

- `PricingPage` 读取 `source=project-grade` 和经过白名单校验的 `returnTo`，订阅下单会透传来源、返回路径和稳定的浏览器幂等键；网络重试复用同一键，订单过期才生成新键；
- 付款完成后，ProjectGrade 订阅读取一次服务端权威权益快照，并显示“返回智评通工作台”；权益刷新暂时网络失败不会把已经支付的用户卡在等待状态；
- 只有订阅订单刷新智评通套餐，积分包和私有化 License 不会误触发订阅状态更新；
- 项目工作台、公开落地页、匿名体检页和额度超限弹窗的升级入口均使用带来源和安全返回路径的 ProjectGrade URL；
- 公开落地页不再硬编码旧的 `¥199/月`、`¥699/月`，而是读取 `/api/billing/plans` 的权威月费；接口短暂不可用时显示“价格以套餐页为准”，不伪造价格。

### 23.3 本次自动化证据

```text
服务端 ProjectGrade 支付 Webhook E2E：1 suite / 15 tests passed
服务端 ProjectGrade 权益中间件：1 suite / 9 tests passed
服务端 TypeScript：npx tsc --noEmit，passed
服务端完整 Jest：105 suites / 938 tests passed，退出码 0
服务端生产构建：npm run build，passed
客户端支付上下文/API 定向：3 files / 15 tests passed
客户端完整 Vitest：8 files / 34 tests passed
客户端 TypeScript：npx tsc --noEmit，passed
客户端生产构建：npm run build，passed（仅 Vite 大 chunk 警告）
```

支付 E2E 已覆盖：ProjectGrade 来源与返回路径、相同键幂等、冲突键 409、Stripe Webhook、Pro 权益即时生效、重复 Webhook 不重复延长/赠送、唯一 Outbox、恶意返回地址拒绝、年付约 365 天、私有化 License 独立签发。

### 23.4 完成边界与后续顺序

本切片仅证明本地的：

```text
智评通升级入口 → 带来源订单 → 支付回调 → 权威履约 → 即时权益 → 安全返回工作台
```

仍必须按优先级完成：

1. 套餐到期、降级、续费失败及退款后的 ProjectGrade 容量、报告发布、PDF 下载和 white-label 权益回退；
2. Team 共享套餐、成员/项目容量与共享配额；
3. 智评通专属客服、售后与退款工单；
4. 匿名体检 → 注册 → 创建项目 → 购买 → 发布/分享报告的转化漏斗、归因和运营自动化；
5. 真实微信/Stripe 小额支付、Webhook 公网回调、预发布/生产 MongoDB、Redis、Chromium、监控、回滚、`aibak.site` 域名与 SSL 的真实验收。

固定状态仍为：

```text
productionVerified=false
productionAcceptance=false
externalScanningEnabled=false
```

不得将本节的 Webhook 模拟、自动化回归或本地构建描述为真实支付完成、`aibak.site` 已上线、生产验收完成或完整商业闭环已完成。


## 24. 2026-07-23 到期取消、退款权益回退与订阅生命周期加固

本节覆盖第 23 节之后的订阅生命周期最新本地事实。所有结论仅代表当前工作区的本地自动化和构建结果，不代表真实支付、预发布或生产验收。

### 24.1 取消续订状态模型

旧代码在 POST /api/billing/subscription/cancel 时把 membershipExpiresAt 直接设为当前时间，等价于已付费周期被立即收回。
本次改为声明式取消：

- schema: User 新增 subscriptionCancelAtPeriodEnd (boolean) 与 subscriptionCanceledAt (Date)
- 激活/续费：统一将 cancelAtPeriodEnd 恢复为 false 并清除 cancelledAt，新周期自动恢复自动续订
- 取消：标记 cancelAtPeriodEnd=true + cancelledAt=now，不篡改 membershipExpiresAt
- 订阅状态接口：返回 cancelAtPeriodEnd 与 cancelledAt，个人中心/App Bar 可用于展示“已取消续订”而非“立即降级”
- 重复取消幂等：再次调用返回相同结果，不回退计划
- 到期收敛：resolveUserPlan 未变，到期自然降级 free

### 24.2 退款权益回退

- 旧 refund service 仅在 orderType=subscription 时把 User.plan 设为 free，遗漏 cancelAtPeriodEnd/cancelledAt 清空
- 现已统一：退款回收 subscription 时重置 plan=free, membershipExpiresAt=now, cancelAtPeriodEnd=false, cancelledAt=now

### 24.3 本次自动化证据

- 服务端 TypeScript: npx tsc --noEmit 通过
- 服务端支付 Webhook E2E: 1 suite / 16 tests passed (新增取消续订 E2E)
- 服务端完整 Jest: 105 suites / 940 tests passed
- 服务端生产构建: npm run build 通过
- 客户端 TypeScript: npx tsc --noEmit 通过
- 客户端完整 Vitest: 8 files / 34 tests passed
- 客户端生产构建: npm run build 通过
- 聚焦差异空白检查: git diff --check 退出码 0

### 24.4 完成边界与后续顺序

本切片仅证明本地的取消与退款生命周期加固，但不覆盖：
- 真实到期后自动降级的系统定时任务/中间件
- 退款后的前端确认、订单状态同步与客服流程
- 续费/重新购买后的状态覆盖
- 生产环境真实验收

固定状态仍为：

productionVerified=false
productionAcceptance=false
externalScanningEnabled=false


## 2026-07-23 客服售后前端闭环与订阅生命周期

以 docs/PROJECTGRADE-HANDOFF.md 第 24 节之前的所有事实为基线。本次新增前端售后体验：

- 个人中心取消订阅按钮接入真实 cancelSubscription API，带确认弹窗和"已取消续订"状态展示
- payment store / subscription 接口新增 cancelAtPeriodEnd 与 membershipExpiresAt 字段
- 新增 /refund-request 退款申请页：列出可退款已支付订单、选择退款原因、提交到后端退款路由
- billingAPI 新增 requestRefund 与 getMyRefunds 端点
- CustomerServiceFab 系统提示中定价从 29/99 更正为 9.9/19.9/99 元
- 后端 refund routes 已挂载至 /api/billing，前端路由注册为 /refund-policy 和 /refund-request

本次本地证据：
  客户端 TypeScript、8/34 Vitest、生产构建通过
  服务端 TypeScript、105 suites / 940 tests Jest、生产构建通过
  聚焦差异空白检查 0

固定状态 productionVerified/productionAcceptance/externalScanningEnabled 仍为 false。
不得宣称生产部署、真实退款验收或完整商业运维闭环已完成。
