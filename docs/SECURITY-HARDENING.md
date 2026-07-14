# AIBAK ai-agent-platform · 安全加固与运维手册

> 版本：2026-07-15 ｜ 适用范围：ai-agent-platform 服务器（159.75.124.59 / aibak.site）
> 关联文档：`阶段0-测试安全网与质量基线报告.md`（P0 修复详细 diff 与测试）

---

## 1. 背景

2026-07-15 完成 **P0 安全止血**，修复三处 RCE / 服务端命令执行级隐患，已部署上线
（`/api/health` 返回 `healthy`，容器内 `dist` JS 已确认含全部修复标记）。

本手册沉淀：修复清单、已知限制、运维加固清单、应急与后续路线图，供运维与安全审计使用。

---

## 2. P0 修复清单（已上线）

### 2.1 `server/src/services/workflow-engine.service.ts`（工作流 RCE）
- **移除** `new Function('input', ...)` 执行任意 JS（等于工作流作者在服务器执行任意代码，含 `process.exit` / 读写文件）。
- 改用 **`vm` 受限沙盒**：仅暴露 `input` 变量，屏蔽 `process` / `require` / `global` 等宿主全局；加危险标识符黑名单（拦截 `constructor`/`process`/`require`/`Function`/`eval`/`new` 等）。
- `condition` 节点**移除 `{{input}}` 字符串插值**（代码注入点），改用 `input` 变量受限表达式求值。
- `code` 节点**默认禁用**：`WORKFLOW_CODE_NODE_ENABLED` 默认 `false`，需管理员显式开启；开启后仍受黑名单约束。

### 2.2 `server/src/services/mcp.service.ts`（MCP 服务端命令执行）
- `connectStdio` 增加**命令白名单**：`MCP_ALLOWED_STDIO_COMMANDS` 默认 `node,npx`。
- 按 **basename 校验**，防绝对路径绕过（如 `/usr/bin/curl`、`/bin/bash`）。
- 非白名单命令**拒绝连接并置 `error`**，绝不 spawn 进程。

### 2.3 `server/src/services/sandbox.service.ts`（本机无隔离执行）
- `local` 本机执行**默认禁用**：`SANDBOX_LOCAL_ENABLED` 默认 `false`，默认降级为 `mock`。
- `detectDangerousPatterns` 静态拦截在**所有模式**持续生效（兜底）。

---

## 3. 验证状态（部署前门禁）

| 项 | 结果 |
|---|---|
| P0 单元测试 | 三套件 **43 用例全过**（workflow 12 + mcp 7 + sandbox 24） |
| 阶段2/3 新增单测 | **7 套件 59 用例全过**（payment 10 + referral 4 + auth 6 + trace 5 + request-id 2 + external-market 6 + payment.webhook 已含） |
| 类型检查 | `tsc --noEmit` **0 错误**（server 全量） |
| 线上验证 | `/api/health` = `healthy`，`mongodb`/`redis` 均 `connected` |
| 镜像验证 | 容器内 `dist` JS 含 `WORKFLOW_CODE_NODE_ENABLED` / `isAllowedStdioCommand` / `SANDBOX_LOCAL_ENABLED` 标记 |

---

## 4. 已知安全限制（待深度硬化）

1. **`vm` 沙盒标识符黑名单可被 Unicode 转义绕过**（如 `\u0070rocess`）。
   当前为"主防线 + 黑名单"的临时止血；深度硬化应替换为 **`isolated-vm` / 容器隔离 / 专用沙盒服务**。
2. **命令白名单为正向列表**：新增命令需管理员安全评估后显式加入。
3. **`local` 模式即使启用**，静态拦截非银弹，仍需容器隔离兜底。
4. **`any` 类型仍较多（约 358 处，已收敛 3 处关键路径）**：持续在鉴权/支付/沙盒等关键路径收敛。

---

## 5. 运维加固清单

### 5.1 新增环境变量（默认即安全态，无需改动生产 `.env`）
| 变量 | 默认值 | 说明 |
|---|---|---|
| `WORKFLOW_CODE_NODE_ENABLED` | `false` | 工作流 code 节点总开关 |
| `MCP_ALLOWED_STDIO_COMMANDS` | `node,npx` | MCP stdio 命令白名单（逗号分隔） |
| `SANDBOX_LOCAL_ENABLED` | `false` | 沙箱 local 本机执行开关 |

### 5.2 部署纪律
- **外科手术式精准提交**，绝不整推（工作树存在未跟踪半成品，整推会让服务器起不来）。
- `build:` 服务变更后，必须显式 `docker compose build server && docker compose up -d server`（自动部署的 `up -d` 不会重建镜像）。
- 提交前确保 `tsc --noEmit` 0 错误 + 相关 jest 套件通过。

### 5.3 周期性
- 依赖审计：`npm audit`（阶段2 清理未用依赖）。
- 密钥轮换：`rotate-key` 脚本 + 支付/云存储密钥定期更换。
- 最小权限：服务器进程、数据库账户、对象存储桶权限最小化。

---

## 6. 阶段2 / 阶段3 推进记录（2026-07-15）

### 6.1 阶段2-1 补关键模块单元测试（低风险安全网）
| 新增测试 | 用例 | 锁定范围 |
|---|---|---|
| `payment.service.test.ts` | 10 | Stripe/微信/支付宝 **验签、解密、PEM 规范化** 等安全关键纯函数 |
| `referral.service.test.ts` | 4 | 三级分销**佣金结算 / 提现余额校验**商业核心逻辑 |
| `middleware/auth.test.ts` | 6 | JWT **签发/篡改拒绝/非法值拒绝** |
| `lib/trace.test.ts` | 5 | 调用链 `buildTraceEvent` / `selectTracerMode` |
| `middleware/request-id.test.ts` | 2 | 请求关联 ID 生成/透传 |

### 6.2 阶段2-2 清理未用依赖
- 移除运行时依赖 `body-parser`、`node-schedule`、`validator`（`validation.ts` 注释明说用轻量正则"避免引入重依赖"）。
- 移除配套 `@types/validator`；保留 `@types/jest`（depcheck 误报，测试全局类型所必须）。
- `tsc --noEmit` 0 错误验证通过。

### 6.3 阶段2-3 `any` 收敛（关键路径）
- `lib/trace.ts`：`measure` 的 `catch (e: any)` → `catch (e: unknown)` 并安全提取 `message`。
- `payment.service.ts`：`payParams: Record<string, any>` → `unknown`；`bizContent: Record<string, any>` → `unknown`。
- 保留 `decryptWeChatResource` 返回 `any`（外部 JSON 解析边界，调用方需访问属性，改 `unknown` 会破坏编译，属可接受例外）。

### 6.4 阶段2-4 巨型文件安全拆分
- 将 `payment.service.ts` 中 **验签/加解密纯函数（~90 行）抽取至 `payment-crypto.ts`**，原文件改为 `import` + 重导出，billing 路由与既有测试外部 API 不变。
- `tsc --noEmit` 0 错误，payment 相关 16 用例全过。

### 6.5 阶段3-1 可观测性增强
- 新增 `middleware/request-id.ts`：每个请求分配/透传 `X-Request-Id`，响应头回传，慢请求/错误日志带出，实现跨日志串联。
- 既有 APM（`middleware/apm.ts`）：请求延迟分位、慢请求检测、错误率、内存/CPU 快照，`/health/vitals` 端点已就绪。
- 既有 `lib/logger.ts`：结构化日志 + 敏感信息自动掩码；`lib/trace.ts`：Langfuse 调用链上报（可选）。

### 6.6 阶段3-4 开放市场供应链安全
- `skills/external-market.ts` 新增纯函数 `validateExternalMarketEntry`：
  - `command` 必须在白名单（`node`/`npx`）；
  - `args` 禁止 shell 元字符（`; | &` \` $ ( ) < > \`）与危险 flag（`-e`/`--eval`、`rm -rf`）；
  - `officialUrl` 必须为 http(s)。
- `getCatalog()` / `getCatalogEntry()` 均经该校验过滤；新增 `external-market.test.ts` 6 用例覆盖正/负场景。
- 当前策展目录全部通过校验（护栏不误删合法条目），并为未来开放用户提交提供供应链防线。

---

### 6.7 阶段2 质量治理补充（2026-07-15 续）
- **巨型文件拆分（续）**：`skills/external-market.ts`（697 行）的静态 `CATALOG` 数据 + 类型定义抽离至 `skills/external-market-catalog.ts`；主文件仅保留校验/获取逻辑（~70 行），对外 `type ExternalMarketEntry` / `CatalogKind` 与 `getCatalog` / `getCatalogEntry` 导出不变。`tsc` 0 错误，external-market 6 用例全过。
- **`any` 收敛（续）**：`services/sandbox.service.ts` 5 处 `any` 收敛——`catch (e: any)` → `unknown` 并安全提取 `message`；`execFile` 回调去掉 `as any`，直接访问 `ExecFileException` 既有字段（`killed` / `code`），`exitCode` 收敛为 `number`（成功 0 / 数字码原值 / 字符串码归 1）。`tsc` 0 错误，sandbox 24 用例全过。

### 6.8 阶段2 质量治理补充（media-gen 拆分 + any 收敛）
- **巨型文件拆分**：`services/media-gen.service.ts`（612 行）按「共享层 / Provider / 编排层」三层拆分：
  - `services/media-gen.shared.ts`：类型定义、常量、任务存储（`persistTask`/`retrieveTask`）、`params_type_from_status` 等厂商无关辅助。
  - `services/media-providers/{mock,cloudbase,keling,jimeng,hunyuan,moneyprinterturbo}.provider.ts`：各厂商实现独立成文件。
  - `services/media-gen.service.ts` 仅留编排层（`PROVIDERS`/`listMediaProviders`/`selectMediaProvider`/`MediaGenService`），并 `re-export` 原 `type` 与 `CloudbaseImageProvider/HunyuanProvider/KelingProvider/JimengProvider`，**对外 API 完全不变**。
- **`any` 收敛（5 处）**：`CloudbaseImageProvider` 的 `result:any` → `MediaGenResult & {imageBase64?;imageUrl?}`，`queryTask` 用 `CloudbaseStoredTask` 类型替代 `as any`；`HunyuanProvider.body:Record<string,any>` → `Record<string,unknown>`；`params_type_from_status(d:any)` → `unknown` 安全提取；`MoneyPrinterTurboProvider.catch(e:any)` → `unknown` 安全提取 `message`。`tsc` 0 错误，media-gen 相关 5 套件 / 22 用例全过。

### 6.9 阶段2 质量治理补充（rag-pipeline 拆分 + 测试安全网）
- **巨型文件拆分**：`services/rag-pipeline.service.ts`（496 行）按「类型层 / Parser / Chunker / 编排层」四层拆分：
  - `services/rag-pipeline.types.ts`：3 个接口（`ParsedDocument`/`ChunkResult`/`PipelineResult`）+ `DEFAULT_CONFIG`。
  - `services/rag-pipeline.parser.ts`：`DocumentParser`（解析 pdf/docx/html/txt；`mammoth`/`pdf-parse`/`cheerio` 动态导入保留，避免启动期加载）。
  - `services/rag-pipeline.chunker.ts`：`DocumentChunker`（基于段落的语义分块 + 重叠）。
  - `services/rag-pipeline.service.ts` 仅留 `RAGPipelineService` 编排层 + 导出 `ragPipelineService` 单例 + `export default RAGPipelineService`，**对外 API 完全不变**（外部仅 `routes/rag-pipeline.ts` 引用单例）。
- **测试安全网**：新增 `services/rag-pipeline.test.ts`（7 用例）覆盖分块逻辑（maxChunks 上限 / 空文本 / 重叠触发）/ txt 解析 / 不支持格式报错 / `DEFAULT_CONFIG` 默认值。`tsc` 0 错误，rag-pipeline 7 用例全过。
- **依赖澄清**：`mammoth`/`pdf-parse`/`cheerio` 在 RAG 路径中被动态 import 实际使用，**非**无用依赖（纠正此前路线图对它们的猜测）。

## 7. 应急回滚

| 现象 | 处置 |
|---|---|
| 工作流 code 节点被滥用 | 设 `WORKFLOW_CODE_NODE_ENABLED=false` → `docker compose restart server` |
| MCP 异常执行 | 收紧 `MCP_ALLOWED_STDIO_COMMANDS` → `docker compose restart server` |
| 沙箱逃逸可疑 | 设 `SANDBOX_LOCAL_ENABLED=false` → `docker compose restart server` |
| 部署后服务异常 | `docker compose logs -f --tail=100 server` 排查；必要时 `docker compose down && docker compose up -d` 回滚镜像 |

---

## 8. 后续安全路线图（剩余项）

- **阶段2 质量治理（进行中）**
  - `any` 持续收敛（其余约 358 处，按鉴权/支付/沙盒等关键路径推进）。
  - 巨型文件拆分扩展：对 `billing.ts`(627 路由) 做单文件渐进拆分（`external-market.ts` 已拆出 catalog 数据层；`media-gen.service.ts` 已拆为 shared+providers+编排三层；`rag-pipeline.service.ts` 已拆为 types+parser+chunker+编排四层）。
  - 前端巨型组件拆分（`ToolsCenterPage` 754 / `WorkflowEditor` 658 / `App` 563 等，最高风险，需客户端构建验证）。
- **深度硬化**
  - `vm` → `isolated-vm` / 容器隔离 / 专用沙盒微服务。
  - MCP 命令白名单扩充审批流 + 资源配额。
- **阶段3 增强（进行中）**
  - 可观测性：告警阈值（错误率/慢请求占比）与对接外部监控（Prometheus/Grafana）。
  - 开放市场：用户提交外部 skill 的审核流 + 沙盒安装隔离。

---

*本手册随阶段2/3 推进持续更新。任何安全开关变更需记录并说明理由。*
