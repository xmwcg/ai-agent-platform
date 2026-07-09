# AI Agent Platform — 项目记忆

## 项目概览

基于 React + Node.js + MongoDB 的全栈 AI 学习与生产力平台。集成知识管理、AI 对话、RAG、课程、模型对比、MCP 插件、文生图，并内置**完整商业变现能力（套餐 / 配额 / 订单 / 支付）**。

> 注意：旧的 `PHASE1-COMPLETION-REPORT.md` 已过时（声称 Phase 1 70%、认证未做），以本文件与 `README.md` 为准。当前处于 **Phase 3（生产化与差异化增强已交付）**。详见 `docs/PAIN-POINTS.md`。

## 技术栈

- **前端**：React 18 + TypeScript + Vite + Ant Design 5
- **后端**：Express + TypeScript + Mongoose(MongoDB) + Redis(ioredis)
- **AI**：多 Provider（OpenAI / Anthropic / DeepSeek / 混元 / 自定义），统一客户端 + Mock 模式
- **认证**：JWT + bcrypt
- **扩展**：MCP 真实 SDK（stdio / SSE）
- **支付**：可扩展抽象层 —— 微信支付 v3 / Stripe / Mock
- **质量**：ESLint + Prettier + Jest

## 架构决策

1. **MongoDB**：MVP 阶段保持；专业向量检索长期可迁移 Qdrant/Pinecone。
2. **Mock 模式优先**：`ENABLE_MOCK_MODE=true` 时无需任何 API Key 即可运行（AI 返回模拟响应）。
3. **JWT 认证**：`requireAuth` / `optionalAuth` 中间件；无 Token 走匿名。
4. **商业变现基座**：
   - 套餐定义集中在 `config/billing.ts`（金额以「分」为单位）。
   - 配额闸门 `middleware/subscription.ts`：按套餐对资源做「日维度」Redis 限流，超阈值返回 402 + 升级链接。
   - 支付抽象 `services/payment.service.ts`：`PaymentGateway` 接口 + 工厂，新增渠道只需实现接口并注册。
   - 会员态在 `User` 模型（`plan` / `membershipExpiresAt` / `credits`），过期自动降级 free。
5. **MCP 配置持久化**：`MCPServer` 模型持久化，服务启动时 `loadFromDB()` 恢复，重启不丢。

## 已完成功能（真实可用）

| 功能 | 状态 | 说明 |
|------|------|------|
| 用户认证 | ✅ | JWT 注册/登录/资料，全链路打通 |
| 知识中枢 | ✅ | Markdown CRUD + 标签 + 全文搜索 |
| AI 对话 | ✅ | 多 Provider + 会话 + Redis |
| RAG 检索 | ✅ | 向量嵌入 + 余弦相似度 + 增强生成 |
| 课程框架 | ✅ | 课程 + 章节 + 测验 + 前端页 |
| 模型对比 | ✅ | 真实 AI 生成（无 Key 回退内置数据） |
| MCP 插件 | ✅ | 真实连接 + 持久化 + 增删改 / 启停 |
| 文生图 | 🟢 | 接口就绪 + 独立页 `/text2img`，无 Key 返回占位图 |
| 代码解释 | ✅ | 后端完整 + 独立页 `/code`（解释 / 生成示例）|
| 模型日历 | ✅ | 后端 `ModelEvent` 持久化 + 种子数据 + 前端日历页 |
| 学习路径 | ✅ | 后端 AI 生成（引用课程库，无 Key 回退模板）+ 前端页 |
| 创作工坊 | ✅ | 真实工具入口（文生图 / 代码 / 文档）统一跳转 |
| 大模型配置中心 | ✅ | 独立模块 `/model-config`，接入各厂商模型并持久化，统一驱动全平台 |
| 智能客服系统 | ✅ | RAG 知识库支撑 + 对话 + 嵌入码生成 + 后台会话，完整客服生态 |
| 智能工具箱 | ✅ | 翻译 / 文档转换 / 方案生成 / 内容生产（图生图·文生视频·图生视频）|
| 个人中心 | ✅ | `/profile` 会员态 / 配额用量 / 订单 / 升级取消 |
| **部署自检** | ✅ | `/api/diagnostics` 检测 DB/Redis/厂商密钥状态（无明文泄露），前端「部署自检」页 |
| **快速启动模板** | ✅ | `/api/quickstart` 4 套场景模板，一键生成「知识库+客服」，前端「快速启动」页 |
| **客服可追溯闭环** | ✅ | RAG 答案来源引用 + 转人工 + 满意度评分（前端客服页已支持）|
| **团队 RBAC** | ✅ | `/api/team` owner/admin/member/viewer 角色，前端「团队权限」页 |
| **团队资源级隔离** | ✅ | 知识库/客服可归属团队，按成员角色控制读写；快速启动可归属团队 |
| **开放 API 市场** | ✅ | `/api/marketplace` API Key 签发 + 日配额计量 + 超限 429，前端「开放API市场」页 |
| **媒体多厂商抽象** | ✅ | 混元/可灵/即梦/Mock 统一 Provider，配置即切换；混元 TC3 真实验签 + 异步任务轮询 |
| **技能协议层(agency-agents)** | ✅ | `skills/` 把核心能力封装为可声明/可插拔/可上架的 Skill（manifest+invoke），路由 `/api/skills` 暴露名册与调用；前端 `/skills` 技能市场页可浏览+invoke |
| **AI 网关(OmniRoute 式)** | ✅ | `gateway/` 统一多厂商路由（前缀寻址+fallback），混元大模型对话复用 TC3 签名作为 provider；`ai-agent.sendMessage` 已统一走 `gateway.route()` |
| **视频生产集成** | ✅ | 媒体生成新增 `moneyprinterturbo` provider（对接 harry0703/MoneyPrinterTurbo FastAPI 视频工厂）；新增 `video-pipeline` 技能（借鉴 Open-Montage pipeline 范式：research→script→assets→compose）|
| **参考项目补** | - | 新增 MoneyPrinterTurbo（视频工厂，可 API 化）、Open-Montage（agent-first 视频 pipeline，理念借鉴非直接集成）|
| **superpowers 方法论安装** | ✅ | `docs/SUPERPOWERS.md` 把 obra/superpowers 工程纪律安装为项目开发铁律；仓库已 vendored 核心技能参考到 `.superpowers/skills/`（using-superpowers/brainstorming/writing-skills/test-driven-development/verification-before-completion）；技能 manifest 新增 superpowers 风格声明字段（userStory/acceptanceCriteria/qualityCriteria/references）|
| **技能编写元技能** | ✅ | 新增 `skill-authoring` 技能（division=engineering，marketable），调用统一 AI 网关生成新技能的 manifest+invoke 骨架，是 superpowers `writing-skills` 在本平台的工程化映射；名册现 8 个技能 |
| **技能 spec 规范化** | ✅ | 全部 8 个技能均补齐 `userStory` + `acceptanceCriteria`（评审锚点）；`skills.test.ts` 增加断言强制所有技能含声明字段，名册评审更规范 |
| **技能市场页引导式表单** | ✅ | 前端 `SkillsMarketPage.tsx` 为 `skill-authoring` 增加「描述目标 → 生成技能骨架」引导表单（goal/division/name/description），并展示各技能 userStory/acceptanceCriteria；卡片与弹窗均透出验收标准 |
| **技能骨架一键复制** | ✅ | `skill-authoring` 后端返回可直接粘贴的 `tsFile` 字符串（manifest+invoke 骨架）；前端新增「复制」按钮一键复制到剪贴板 |
| **superpowers CI 同步校验** | ✅ | 新增 `scripts/check-superpowers-sync.cjs` 校验 `.superpowers/skills/*/SKILL.md` frontmatter 完整性与 writing-skills 引用一致性；根 `package.json` 增加 `check:superpowers`，`.github/workflows/ci.yml` 在 push/PR 跑 server tsc+test / client tsc+lint / superpowers-sync |
| **新增 summarize 技能** | ✅ | 第 9 个技能 `summarize`（productivity，marketable），复用统一 AI 网关把长文提炼为 summary+bullets，支持 length/lang；Mock 模式零依赖可跑通 |
| **superpowers 校验接入主测试** | ✅ | 根 `package.json` 的 `npm test` 现串联 `test:server → check:superpowers → test:client`，方法论文档与代码漂移会被阻断；CI 已覆盖 |
| **summarize 前端引导表单** | ✅ | 前端技能市场页给 `summarize` 增加专用引导式表单（text/length/lang），结果区结构化渲染 summary+bullets；与 skill-authoring 同款体验；补参数透传与可上架测试断言 |
| **安全加固第一轮（S1–S7）** | ✅ | 路由层鉴权系统性补全：mcp 写操作(put/patch/delete/connect/disconnect/call)挂 requireAuth + 配额；billing mock-pay 补 requireAuth+订单归属校验；courses 增改/发布/章节挂 requireAuth+instructor 归属；rag embed 三接口+/status 挂 requireAuth；ai 会话读/清/删挂 requireAuth+归属；diagnostics 挂 requireAuth；skills invoke 配额竞态 Bug 修复（await 中间件完成再判 headersSent） |
| **混元环境变量统一（M1）** | ✅ | 统一为 HUNYUAN_SECRET_ID/SECRET_KEY（兼容旧名 HUNYUAN_API_KEY 退化）；修正 ai-models/text2img.service/text2img 路由/.env/.env.example 全链路命名；新增 mcp_call 配额资源 |
| **微信 env 命名修正（M2 部分）** | ✅ | .env/.env.example 的 WECHAT_MCH_ID/APP_ID/CERT_SERIAL/PRIVATE_KEY 对齐 payment.service 实际读取字段 |
| **支付真实验签** | ✅ | Stripe HMAC-SHA256、微信 AES-256-GCM + RSA 验签（Webhook 验签）|
| **商业变现** | ✅ | 套餐 / 配额(12 项) / 订单 / 支付(Mock+微信+Stripe 抽象+真实验签) / 定价页 / 个人中心 / 商业方案文档 / 开放API市场 |

## 目录结构

```
ai-agent-platform/
├── server/src/
│   ├── config/      # database(含 Redis 内存降级) / ai-models / billing
│   ├── models/      # User / Course / KnowledgeDocument / Order / MCPServer / ModelEvent / ModelConfig / CustomerService
│   ├── routes/      # auth/knowledge/ai/rag/courses/code/compare/mcp/text2img/billing/model-calendar/learning-path/model-config/customer-service/tools
│   ├── services/    # ai-agent / rag / embedding / mcp / compare / payment / translation / plan-generator / file-convert / media-gen
│   ├── middleware/  # auth(JWT) / subscription(配额,12 项)
│   └── index.ts
├── client/src/
│   ├── pages/       # 22 页（含 Pricing / Profile / CodeExplanation / Text2Img / ModelConfig / CustomerService / ToolsCenter）
│   ├── services/    # api.ts（含 billing/modelCalendar/learningPath/code/profile/modelConfig/customerService/tools API）
│   └── router.tsx / App.tsx（分组侧边栏 + 渐变品牌头）
├── docker-compose.yml
└── README.md
```

## 关键命令

```bash
docker-compose up -d                  # 一站式启动（含前端 nginx）
npm install && cd server && npm i && cd ../client && npm i && cd ..
npm run dev                          # 前后端同时启动（5173 / 3000）
npm run lint / npm run test          # 质量与测试
cd server && npm run seed            # 种子数据
```

## 环境变量

必填：`MONGODB_URI`、`REDIS_URL`、`JWT_SECRET`。
AI Key 可选（缺省走 Mock）。支付：`DEFAULT_PAY_PROVIDER`(mock/wechat/stripe) + 对应渠道密钥。详见 `server/.env.example`。

## 扩展点

- 新 AI Provider → `config/ai-models.ts`（用户也可在 `/model-config` 运行时自助接入）
- 新支付渠道 → 实现 `PaymentGateway` 并在工厂注册
- 新受限资源 → `billing.ts` 的 `QuotaResource` + 路由 `enforceQuota(...)`
- 新 MCP 工具 → `/api/mcp` 动态注册
- 无 Redis 环境 → `database.ts` 自动降级为内存 Map，配额/限流仍可用
- 团队权限 → `middleware/rbac.ts` `requireTeamRole(role)` + `models/Team.ts`
- 团队资源级隔离 → `middleware/resourceAccess.ts` 纯函数 `canAccessResource`（owner/团队成员角色判定），知识库/客服路由按 teamId 校验
- 开放 API 计量 → `services/apikey.service.ts`（密钥哈希/日配额重置/计量）+ `models/ApiKey.ts`
- 技能协议层（agency-agents 风格）→ `skills/`：`types.ts`(Skill/Manifest 定义) + `registry.ts`(名册) + `defs/*.skill.ts`(6 个核心能力封装)；路由 `routes/skills.ts` 提供 `/api/skills` 名册与 `/invoke`（经配额网关+RBAC 守卫），可上架开放 API 市场
- AI 网关（OmniRoute 风格）→ `gateway/ai-gateway.service.ts`：`route()` 统一入口 + provider 注册表 + 前缀寻址 + priority fallback；复用媒体服务的 TC3 签名作为 `hunyuan` provider（大模型对话也走真实验签）；路由 `routes/ai-gateway.ts` 提供 `/api/gateway/chat` 与 `/providers`
- 参考项目：Dify(工作流/RAG/模型管理)、LibreChat(多模型/Artifacts)、LobeChat(多模态)、FastGPT(知识库客服)、n8n(模板市场/自动化)、GPT Researcher(方案生成)、agency-agents(技能协议/名册)、OmniRoute(多厂商网关/前缀寻址/fallback)、superpowers(编码代理工程方法论/writing-skills 元技能，见 docs/SUPERPOWERS.md)

## 优化修复记录（2026-07-09 第三轮）

### M8 compare 路由鉴权 ✅
- `routes/compare.ts`：`POST /generate` 挂 `optionalAuth + enforceQuota('ai_chat')`；成功后对登录用户 `quotaIncrement('ai_chat')`。匿名仍可调（optionalAuth 放行），登录用户受配额约束，杜绝匿名高频消耗真实 AI。

### M7 路由鉴权集成测试 + 测试基建 ✅
- 新增 `server/src/test/setup.ts`：固定 `JWT_SECRET`、mock `ioredis`（内存桩）、mock `mongoose.connect`（仅避免真实连接），保留真实模型（既有 customer-service 测试依赖 `schema.paths`）。
- `jest.config.cjs`：增加 `setupFilesAfterEnv` + `forceExit`。
- 新增 `routes/auth.integration.test.ts`（supertest + 真实路由 + 真实 `requireAuth`）：覆盖 S1–S6 + M8 共 26 个用例。
  - 匿名写操作必须 401（核心回归，在 requireAuth 被拦，不触 DB）。
  - 登录用户归属校验：courses/ai 的他人资源返回 403、billing 他人订单 403、不存在订单 404、ai 不存在会话 404。
  - M8：匿名/登录均可调 compare/generate（optionalAuth），缺参数 400。
- 验证：`tsc --noEmit` 干净；全量 `jest` **107 用例全过**（原 81 + 新增 26）。

### 待办（下一轮）
- 其余 L1（输入校验强化，可引入 zod/joi 或统一校验中间件）、L9（依赖审计 npm audit / 升级）可选打磨；L2/L3/L4/L5/L6/L7/L8 已完成。

### 第四轮（质量债收尾）✅ 已落地，tsc 干净 + 全量 111 测试通过
- **L8** TC3 签名抽公共库：新增 `server/src/lib/tc3.ts`（`signTencentTC3` / `sha256Hex` / `hmacHex`），`media-gen.service.ts` 与 `ai-gateway.service.ts` 改为引用，删除两份复制实现；既有 `media-gen.tc3.test.ts` import 同步到 `lib/tc3`；新增独立单测覆盖（幂等/不同密钥/payload/action 无关）。
- **L4** JWT_SECRET 弱值启动拦截：新增 `server/src/config/env-check.ts` `validateStartupEnv()`；`index.ts` 在 `app.listen` 前调用。`NODE_ENV==='test'` 豁免；`production` 弱值直接 `exit(1)`；`development` 仅 `console.warn` 不阻断；强密钥放行。配套单测覆盖。
- **M4** 前端 `mcpAPI` 封装：`client/src/services/api.ts` 新增 `mcpAPI`（list/create/update/setEnabled/remove/connect/disconnect/callTool/tools），`PluginManager.tsx` 7 处裸调全部替换为 `mcpAPI`，移除未用 `apiClient` 导入；前端 eslint 0 error。
- **M3** README 收敛：阶段口径统一为 Phase 3；RAG「真实向量嵌入」收敛为「需配置，未配置降级关键词检索」；文生图补充「配置 HUNYUAN_SECRET_ID/KEY 后真实生成」；`video-pipeline` 标注 ⚠️ experimental（research 阶段占位、compose 依赖外部服务）；路由数「15」→「20+」并补全目录树；路线图 Phase 3 标记已交付并补充本轮成果。
- 验证：`tsc --noEmit` 干净；server `jest` **111 用例全过**（19 suite）；client eslint 0 error。

### 第五轮（M5/M6/L2/L3 收尾）✅ 已落地，tsc 干净 + 全量 116 测试通过
- **M6** Mock 模式默认 provider 跟随平台配置：`ai-models.ts` `initializeProviders()` 不再在 Mock 模式提前 return，仍注册所有已配置真实 provider（可用但不强制默认）；默认 provider 决策：① `DEFAULT_AI_PROVIDER` 显式指定且已注册优先；② 非 Mock 取首个真实 provider；③ Mock 且未指定仍默认 `mock`（零依赖可跑）。`.env.example` 补充 `DEFAULT_AI_PROVIDER` 说明。
- **L2** 统一错误透传（防敏感泄露）：新增 `server/src/lib/http-error.ts`（`AppError` 安全文案 + `sendError` 统一响应）；`routes/tools.ts` 5 处裸 `err.message` 透传改为 `sendError`；`index.ts` 全局错误处理同步改用 `sendError`。production 仅返回通用语「服务器内部错误，请稍后重试」，dev/test 透传 message。配套 `http-error.test.ts` 5 例全过。
- **L3** 结构化日志（轻量自研，零新依赖）：新增 `server/src/lib/logger.ts`（ISO 时间戳 + [LEVEL] + module 结构化输出，兼容 jest 静音）；`ai-models.ts` / `database.ts` / `index.ts` 核心启动与错误日志改为 `logger` 统一输出。
- **M5** README 安全边界收敛：在「核心功能」与「快速开始」间新增「安全边界与鉴权模型」小节，明确匿名/登录/optionalAuth 边界、12 项配额闸门、L4 启动期弱密钥拦截、L2 错误不泄露、M6 Mock 默认 provider 行为；路线图 Phase 3 已含本轮成果。
- 验证：server `tsc --noEmit` 干净；server `jest` **116 用例全过**（20 suite，原 111 + 新增 5）；`check:superpowers` 通过；client eslint 0 error（9 warning 为既有 react-hooks 提示，非本轮引入）。注意：client `vitest` 在本机未安装，`npm run test:client` 无法运行（环境依赖缺失，非本轮改动所致）。

### 第六轮（L5/L6/L7 安全加固）✅ 已落地，tsc 干净 + 全量 130 测试通过
- **L5** 敏感端点限流：新增 `server/src/middleware/rate-limit.ts`（`apiLimiter` 迁移自 index 内联 + `authLimiter` 登录/注册严格限流，默认 10 次/15min，`test` 环境 `skip` 放行不误拦集成测试）；`index.ts` 改用 `apiLimiter`；`auth.ts` 的 `/login`、`/register` 挂 `authLimiter`。`.env.example` 补 `AUTH_RATE_LIMIT_*`。配套 `rate-limit.test.ts` 3 例。顺带把 `auth.ts` 4 处裸 `error.message` 收敛为 `sendError`（L2 收尾）。
- **L6** CORS 白名单化：新增 `server/src/middleware/cors-config.ts`（`parseAllowedOrigins` 支持逗号分隔多来源 + `isOriginAllowed` 无 origin 放行/白名单校验 + `buildCorsOptions` 限制 methods/allowedHeaders、credentials）；`index.ts` 用 `buildCorsOptions(CLIENT_URL)` 替换单域名配置。配套 `cors-config.test.ts` 7 例。
- **L7** 安全头审查+收紧：新增 `server/src/middleware/security-headers.ts`（`buildHelmetOptions`：production 开启 HSTS 1 年+子域+preload、非生产关闭；referrerPolicy no-referrer；hidePoweredBy；frameguard deny；xContentTypeOptions）；`index.ts` 用 `helmet(buildHelmetOptions(NODE_ENV))`。配套 `security-headers.test.ts` 4 例。
- 验证：server `tsc --noEmit` 干净；server `jest` **130 用例全过**（23 suite，原 116 + 新增 14：rate-limit 3 + cors-config 7 + security-headers 4）；`check:superpowers` 通过。本轮仅改后端，client 未动。

### 第七轮（L1 输入校验强化 + L2 收尾）✅ 已落地，tsc 干净 + 全量 143 测试通过
- **L1 零依赖校验工具**：新增 `server/src/lib/validation.ts`（`isNonEmptyString` / `isStringArray` / `isEmail` / `isObjectId` 纯函数 + `validateObject` + `validate(schema)` 中间件工厂，校验失败统一 400 + `VALIDATION_ERROR` 码，不泄露内部信息）；配套 `validation.test.ts` **13 例全过**。
- **L2 收尾（消除生产敏感泄露）**：`knowledge.ts` / `ai.ts` / `rag.ts` / `billing.ts` / `mcp.ts` 共约 18 处 catch 由 `console.error` + 裸 `error.message` 透传统一改为 `sendError`（生产仅返回通用语，结构 `{success:false,error,code}`），消除内部路径/密钥泄露面。
- **L1 关键入口校验加固**：
  - `auth.ts`：`/register`、`/login` 接入 `validate` 中间件，补 email 格式（轻量正则）+ 密码 6–64 + name 1–50 长度约束；保留「邮箱已注册 409」「密码错误 401」业务判定。
  - `knowledge.ts`：创建补 `teamId` 合法 ObjectId（24 位十六进制）校验，非法提前 400，避免 Mongoose 抛 500。
  - `billing.ts`：`/orders` 接入 `validate`，`plan`/`period`/`provider` 限定枚举（如 `free|pro|enterprise|team`），非法值 400。
  - `rag.ts`：`/embed/documents` 接入 `validate`，`documentIds` 必须为非空字符串数组，避免非字符串进 Mongoose 抛 500。
- 验证：server `tsc --noEmit` 干净；server `jest` **143 用例全过**（24 suite，原 130 + 新增 13 validation）；`check:superpowers` 通过。本轮仅改后端，client 未动。
- **L9 依赖审计 ✅（server 已修复，client 已评估分级）**：
  - 关键发现：原镜像 `registry.npmmirror.com` 不支持 audit 端点（`NOT_IMPLEMENTED`），切官方 `registry.npmjs.org` 后跑通。
  - **server 初始 9 漏洞（8 high + 1 moderate）**，根因是 `package.json` 声明了**未使用的 `langchain@0.0.207`**（业务代码零 import，仅作为文案字符串出现），其传递链 `@langchain/*`、`expr-eval`、`langsmith`、`uuid` 引入全部高危。
    - **修复**：从 `server/package.json` 移除 `langchain` 并 `npm install`（官方 registry，移除 64 包）→ 漏洞降至 **2 high**（仅 `tar`，经 `@mapbox/node-pre-gyp`→`bcrypt` 编译期，运行时不可达；非破坏性 `audit fix` 在 node-pre-gyp@1.0.11 约束下无安全升级路径，标记为构建期低风险，不强推 `--force` 以免破坏 bcrypt 安装）。
  - **client 初始 11 漏洞（7 high + 3 moderate + 1 low）**，风险分层：
    - 7 high 全部在 ESLint/构建链（`minimatch`/`@typescript-eslint` ReDoS）→ **运行时不可达**，低风险。
    - `esbuild`/`vite`（dev server 泄露）moderate → **仅开发期**，生产构建不受影响。
    - `dompurify`/`echarts` moderate（XSS）→ 运行时展示库；修复需 force 升 `monaco` 内联 dompurify 或 `echarts@6`（breaking），会击穿 client 构建（本机 vitest 未装仅 eslint 可验）。标记为"待大版本迁移专项"。
    - 结论：client **运行时 zero high**，剩余 moderate 为前端展示组件库，非 forced upgrade 不推进。
  - 验证：`server tsc` 干净；`server jest` **143 全过**（移除 langchain 无回归）；`client eslint` 0 error；`check:superpowers` 通过。
  - 注意：本机 npm registry 现指向官方 `registry.npmjs.org`（为完成 audit 临时切换），如后续需回镜像源请留意 `npm config get registry`。

### 第九轮（L3 日志收尾 + 依赖审计复核）✅ 已落地，tsc 干净 + 全量 143 测试通过
- **L3 结构化日志收尾（消除裸 console 噪音）**：第五轮已建 `lib/logger.ts`（带 module 标记、可静音、生产 debug 降级），但仅 startup 用。本轮把核心服务层散落的裸 `console.*` 统一收敛到 `logger`：
  - `services/rag.ts`：检索/命中/嵌入/错误 → `logger.(info|warn|error)('rag', ...)`，增量嵌入未实现降为 `logger.debug`（仅非生产输出）。
  - `services/embedding.ts`：生成/批量/单文档/搜索 → `logger.(info|error)('embedding', ...)`，`error` 改用 `error?.message` 避免打印整对象。
  - `services/ai-agent.ts`：sendMessage/Redis 存读 → `logger.(info|error)('ai-agent', ...)`。
  - `services/mcp.service.ts`：loadFromDB/persist/delete/connectStdio/connectSSE/callTool → `logger.(info|warn|error)('mcp', ...)`。
  - `gateway/ai-gateway.service.ts`：fallback 降级日志 → `logger.warn('ai-gateway', ...)`。
  - `services/compare.service.ts`：AI 对比失败回退 → `logger.warn('compare', ...)`。
  - `config/ai-models.ts`：provider 连接测试失败 → `logger.error('ai-models', ...)`。
  - 输出范式统一为 `<ISO> [LEVEL] <module> <msg>`，jest 中验证可见 `[INFO] ai-agent`、`[WARN] ai-models` 等带域标记行。
- **依赖审计复核（L9 收尾澄清）**：
  - 再次切官方 `registry.npmjs.org` 复核：server 仍 **2 high（tar，经 bcrypt→@mapbox/node-pre-gyp→tar@6.2.1 编译链，运行时不可达）**；非破坏 `npm audit fix` 报告 "up to date"（node-pre-gyp@1.0.11 约束无安全升级路径），不强推 --force 以免破坏 bcrypt 安装。
  - client 仍 **11 漏洞（1 low + 3 moderate + 7 high）**：`npm audit fix`（非破坏）亦 "up to date"——dompurify 被 `monaco-editor@0.55.1` 内联固定、echarts 需 --force 升 6.x、minimatch/esbuild/vite 全在 ESLint/构建链。已确认 **client 源码零直接引用 dompurify/echarts/innerHTML/dangerouslySetInnerHTML**，所有风险仅停留在构建/编辑器内部，运行时不可达。结论：依赖死胡同，**不盲目 --force**（会击穿 client 构建且本机 vitest 缺失无法验证运行时），保持观察。
- 验证：server `tsc --noEmit` 干净；server `jest` **143 用例全过**（24 suite）；`check:superpowers` 通过；client eslint 0 error（9 warning 为既有 react-hooks）。

### 第十轮（L2 收尾补全：消除全部裸 err.message 透传）✅ 已落地，tsc 干净 + 全量 143 测试通过
- **L2 收尾补全（消除生产敏感信息泄露面）**：将 routes 层剩余全部 34 处裸 `res.status(500).json({ ...error: err.message })` 统一改为 `sendError(res, err)`（production 仅返回通用语「服务器内部错误，请稍后重试」，结构与既有响应一致 `{success:false,error,code}`），并同步去除 `catch (err: any)` 的冗余 `any` 标注，回归到本轮前已建的统一安全响应路径。
  - 涉及文件与处数：`compare.ts`(1)、`learning-path.ts`(1)、`text2img.ts`(1，顺带将裸 `console.error` 收敛为 `logger.error('text2img', ...)` 再 `sendError`)、`quickstart.ts`(1)、`model-config.ts`(7)、`model-calendar.ts`(3)、`marketplace.ts`(5，含开放端点 `/v1/chat` 原 `{error:err.message}` 无 success 字段，统一升级为 `sendError`)、`team.ts`(7)、`customer-service.ts`(8)。
  - 现 routes 层已**零处**裸 `err.message` 透传（grep `res.status(500).json(...err.message)` 与 `err.message` 在 routes 下均 0 命中）。
- 说明：前七/九轮已覆盖 L2 在 tools/auth/knowledge/ai/rag/billing/mcp 等文件，本轮补齐剩余 route handlers，使 L2 在 routes 层 100% 收敛；`marketplace` 配额非原子、`team.ts` 角色枚举未校验、`scopes` 未校验等输入校验问题属 L1 范畴，未在本轮改动（保持单一职责、不串轮次）。
- 验证：server `tsc --noEmit` 干净；server `jest` **143 用例全过**（24 suite）；client eslint 未动（本轮仅改后端 routes）。

### 第十一轮（L1 输入校验 + 配额原子化 + any 收紧 + routes console 收尾 + 占位实现）✅ 已落地，tsc 干净 + 全量 143 测试通过
- **A. team/marketplace 输入校验 + 配额原子化（堵 RBAC 与超发漏洞）**
  - `team.ts`：邀请成员（`POST /:teamId/members`）与修改角色（`PUT /:teamId/members/:userId`）接入 `validate` 中间件，对 `role` 做 `oneOf: ['owner','admin','member','viewer']` 枚举校验，非法角色 400 拦截（此前 `role || 'member'` 任意字符串可越权写入非枚举角色）。复用第七轮已建 `lib/validation.ts`。
  - `marketplace.ts`：**配额原子化**——`enforceApiKey` 中间件原 `isWithinQuota(key)` 读内存 + `applyUsage` + `key.save()` 两步非原子，并发下可超发；改为 `consumeQuotaAtomically()` 用 `ApiKey.findOneAndUpdate({ $expr: { $lt: ['$usedToday','$quotaDaily'] } }, { $inc: { usedToday: 1 } })` 单文档原子校验+扣减，返回 null 即 429。同时 `POST /api-keys` 增加 `validate(createKeySchema)`，`quotaDaily` 校验为正整数、`scopes` 按 `ALLOWED_SCOPES=['chat','embed','compare','image']` 白名单过滤（此前未校验可越权授予任意 scope）；`/v1/chat` 增加 `validate(chatSchema)`（prompt 必填）并收紧 `req.apiKey` 类型。
  - 注：marketplace 配额与用户套餐配额（`enforceQuota`/Redis）是两套独立体系，本轮仅修 API Key 自有日配额原子性，不触碰套餐闸门。
- **B. any 类型收紧（customer-service / team 限定范围）**
  - `team.ts`：引入 `ITeam/ITeamMember/TeamRole`，定义 `TeamRequest extends AuthRequest { team; teamRole }`，消除全部 `(req as any).team` / `(m: any)`；`requireTeamRole` 中间件挂的 team/role 在 team.ts 内以具体类型断言承接。
  - `customer-service.ts`：导入 `ICustomerService/ICustomerServiceSession/ITeam/ITeamMember`；`resolveCsMemberRole(cs: any)` → `cs: ICustomerService`；`extractSources(scoped: any[]): any[]` → 导出 `ScoredDoc`/`SourceRef` 具体类型；chat 路由 `sources/used/searchResults` 的 `any[]` 全部收敛；feedback `update: any` → `Partial<ICustomerServiceSession>`。
- **C. routes 层 console 收尾 + 占位功能实现**
  - `courses.ts`（7 处）、`code-explanation.ts`（路由 2 + service 2 共 4 处）、`rag.ts`（1 处）全部裸 `console.error('❌...')` + 裸 `error.message` 透传收敛为 `logger.error('<module>', ...)` + `sendError(res, err)`（生产不再泄露内部 message）。grep `console.` 在 routes 下现仅剩 `auth.integration.test.ts` 内 stub 注释与测试相关，业务路由 0 处裸 console。
  - **占位实现**：`models/KnowledgeDocument.ts` 原 `pre('save')` 中 `// TODO: 调用 AI 生成摘要` 实现为本地轻量摘要 `buildLocalSummary()`（去 Markdown 标记取纯文本前 200 字截断），零外部依赖、无超时风险；保留「配置 AI Key 后可替换为 AI 摘要」的扩展说明。其余占位（video-pipeline research、translation mock、file-convert URL、tools 下载占位）属设计性 Mock，已在 README 标注，本轮不强行实现以免引入外部依赖/构建风险。
- 验证：server `tsc --noEmit` 干净；server `jest` **143 用例全过**（24 suite）；client eslint 未动（本轮仅改后端）。

### 待办
- client 运行时 moderate（dompurify/echarts XSS）：待大版本迁移专项评估（非破坏性无法修，force 会击穿构建，且前端源码零直接引用，运行时不可达）。
- server `tar` 构建期 high：受 bcrypt 编译链约束，运行时不可达，保持观察。
- 可选后续：client 端 `const res: any = await apiClient.xxx`（响应拦截器已解包为后端返回体）如需全类型化，需为各 API 定义返回 interface；属更深类型补全，非本轮范围。
- **复核加固（验证阶段发现）**：第十二轮部分 `catch (error: any)` 改动（services/rag.ts、services/embedding.ts 3 处、routes/rag.ts 5 处、routes/team.ts 1 处 `(req as any).teamRole`）曾被还原/未持久化，已在验证阶段重新修复并复跑 tsc+jest 确认通过。`middleware/rbac.ts` 的 `(req as any).teamRole/.team` 是中间件向 req 挂载团队上下文的桥接断言（下游 `TeamRequest` 已强类型承接），属必要桥接，本轮不扩张修改。最终：server tsc 干净 + jest 143 全过；client tsc 干净。

### 第十二轮（全局 any 收紧续：server rag/embedding/marketplace + client 统一错误提示）✅ 已落地，server tsc 干净 + jest 143 全过；client tsc 干净
- **A. server 端 any 收紧（marketplace / rag / embedding）**
  - `rag.ts`：`ragChat` 返回 `sources: any[]` → 导出 `RAGSource` 强类型（`{id:string;title:string;similarity:number;snippet:string}`）；`buildContext(searchResults)` 的 `document: any` → `IKnowledgeDocument`；两处 `catch (error: any)` → `catch (error)`（`logger.error` 改用 `error instanceof Error ? error.message : error`）。`sources` 中 `r.document._id` 显式 `String()` 以匹配 `id: string`。
  - `embedding.ts`：**用户点名的 `filter: any`** 收敛为 `FilterQuery<IKnowledgeDocument>`（Mongoose 查询条件类型）；`searchSimilarDocuments` 返回 `Array<{ document: any; similarity }>` → `Array<{ document: IKnowledgeDocument; similarity }>`；`catch (error: any)` → `catch (error)`。引入 `FilterQuery` 与 `IKnowledgeDocument`。
  - `marketplace.ts`：`(req as any).apiKey` / `(req as unknown as {...}).apiKey` → 定义 `ApiKeyRequest extends AuthRequest { apiKey: IApiKey }` 并以具体类型断言承接；`listKeys` 与 `usage` 路由的 `.map((k: any) => ...)` → 去掉 `: any`（lean 推断类型）；`k as ApiKeyQuotaState` 仅保留 `k as unknown as ApiKeyQuotaState`（v1/chat 处 key 为完整 IApiKey 实例，需窄化到子集接口）。引入 `IApiKey`。
  - 验证：`server tsc --noEmit` 干净；`jest` **143 用例 / 24 suite 全过**。grep 确认 rag/embedding/marketplace 三文件 0 处 `: any` / `as any` / `filter: any` 残留。
- **B. client 端统一错误提示（核心交付）**
  - `services/api.ts`：新增 `extractApiError(err: unknown, fallback?): string`——优先取后端统一错误体 `{error}` / `{message}`，其次 axios `message`，再 `Error.message`，最后兜底文案；响应拦截器改用 `console.error('❌ API Error:', extractApiError(error))`（仅安全文本，无堆栈/密钥泄露）。
  - 批量收敛 17 个页面（CodeExplanation/Compare/CustomerService/KnowledgeEditor/Login/ModelCalendar/ModelConfig/PluginManager/Pricing/Profile/Quickstart/Register/SkillsMarket/Team/ToolsCenter/Text2Img/Marketplace）中散落的 `err?.response?.data?.error || 'xxx失败'` / `e.response.data?.error || 'xxx'` / `setError(err?.response?.data?.error || '...')` 为 `extractApiError(err, 'xxx失败')`，并注入 `extractApiError` import；原 `catch (x: any)` 一并收紧为 `catch (x)`（配合 `extractApiError` 接受 `unknown`）。
  - 边界修正：ModelCalendar 的 `401` 特判改用 `axios.isAxiosError(err) && err.response?.status === 401`（保留「请先登录」语义）；PluginManager/TeamPage/MarketplacePage 原 `if (e?.response) message.error(e.response.data?.error || ...)` 直接收敛为 `extractApiError`。
  - 验证：`client tsc --noEmit` 干净；grep 确认 pages 下 `response?.data?.error` 残留 0 处。
- 质量闸门（按工作流）：每步 tsc + 全量 jest 串行通过后才进入下一步，无跳步、无回归。

### 第十三轮（routes 层 catch (err/error: any) 全量收紧）✅ 已落地，tsc 干净 + 全量 143 测试通过
- **A. catch 标注收紧（消除 routes 层最后残留 any）**：将 `billing.ts`(6)、`mcp.ts`(8)、`knowledge.ts`(6)、`ai.ts`(6) 共 **26 处** `catch (err: any)` / `catch (error: any)` 统一收紧为无标注 `catch (err)` / `catch (error)`。这些 catch 块内部**早已**统一走 `sendError(res, err)`（`sendError(error: unknown)` 天然接受无标注 catch 绑定），故为零风险纯类型收紧，不改运行时行为。
- grep 复核：`routes/` 下 `catch ((err|error): any)` 现 **0 命中**；routes 层 catch 绑定已 100% 无 any。
- 验证：server `tsc --noEmit` 干净；server `jest` **143 用例 / 24 suite 全过**；`routes/` read_lints 0 error。本轮仅改后端 routes 的 catch 标注，无逻辑变更。
- **商业闭环结论（应用户成本决策请求）**：功能层面变现闭环已完整（获客免费版→价值交付→套餐付费→微信/Stripe 真实验签收款→配额履约→到期降级→开放 API 二次变现），代码无需再为闭环新增大功能。真正卡点是**持续成本**：① AI token 成本（建议 BYOK 自带 Key 或默认 DeepSeek 压成本）；② 服务器成本（架构已支持无 Redis 内存降级 + Mock 模式 + docker-compose 一键部署，可低成本上线）。低成本上线路径：Serverless（Vercel/EdgeOne Pages 前端免费 + 云函数/Railway 免费额度 + MongoDB Atlas 512MB 免费 + 无 Redis）≈ ¥0–30/月；或轻量服务器 ¥30–70/月。**高成本上线（K8s/独立向量库/Redis 集群）无必要，可停止大功能开发。**

### 待办
- client 运行时 moderate（dompurify/echarts XSS）：待大版本迁移专项评估（非破坏性无法修，force 会击穿构建，且前端源码零直接引用，运行时不可达）。
- server `tar` 构建期 high：受 bcrypt 编译链约束，运行时不可达，保持观察。
- 可选后续：client 端各 API 返回类型 interface 补全（响应拦截器已解包为后端返回体，属更深类型工程，非闭环必需）。
