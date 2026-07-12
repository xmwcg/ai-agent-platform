# AI Agent Platform

一站式 AI 学习 / 创作 / 生产力平台：**知识中枢 · AI 对话 · RAG 检索 · 课程学习 · 模型对比 · MCP 插件 · 文生图**，并内置**完整的商业变现能力（套餐 / 配额 / 订单 / 支付）**。

> 当前阶段：**Phase 3（生产化与差异化增强已交付）**。代码已远超早期「Phase 1 70%」的旧报告，请以本文档为准。
>
> ![image-20260712155122307](G:\项目成品及测试\AIBAK\reasoni-deepseek\ai-agent-platform\image-20260712155122307.png)

---

## 技术栈

| 层 | 技术 |
|----|------|
| 前端 | React 18 + TypeScript + Vite + Ant Design 5 |
| 后端 | Express + TypeScript + Mongoose(MongoDB) + Redis(ioredis) |
| AI | 多 Provider（OpenAI / Anthropic / DeepSeek / **智谱 GLM / 通义千问 / 豆包** / 混元 / 自定义第三方），统一客户端 + Mock 模式；成本可控、国内合规优先 |
| 认证 | JWT + bcrypt |
| 扩展 | MCP（Model Context Protocol）真实 SDK 接入 |
| 支付 | 可扩展支付抽象层：微信支付 v3 / Stripe / Mock（开发演示） |
| 质量 | ESLint + Prettier + Jest 单测 |

---

## 核心功能

### 已落地（真实可用）
- **用户认证**：注册 / 登录 / 资料，JWT 全链路打通。
- **知识中枢**：Markdown 文档 CRUD + 标签 + 全文搜索 + 浏览统计。
- **AI 对话**：多 Provider、多会话、Redis 持久化。
- **RAG 知识梳理**：向量嵌入（需配置嵌入模型/向量库，未配置时降级为关键词检索）+ 增强生成。嵌入接口已加鉴权（需登录）。
- **课程系统**：课程 / 章节 / 测验结构 + 前端学习页。
- **模型对比分析**：AI 自动生成结构化对比表 + 场景推荐（无 Key 时回退内置数据）。
- **MCP 插件管理**：真实连接 stdio / SSE 服务器，配置持久化（重启保留），支持增删改 / 启停 / 调用工具。
- **文生图**：接口已就绪，配置 `HUNYUAN_SECRET_ID` / `HUNYUAN_SECRET_KEY` 后接入混元真实图像模型，未配置时返回占位图；独立页面 `/text2img`。
- **代码解释**：后端完整（11 语言 × 3 粒度）+ 独立前端页 `/code`（解释 / 生成示例）。
- **大模型配置中心**：`/model-config` 独立模块，运行时接入并管理各厂商模型（OpenAI/DeepSeek/混元/通义/智谱等），统一驱动对话/RAG/客服/生成，支持测试连接与默认切换。
- **智能客服系统**：基于知识库 RAG 的问答机器人，可绑定知识文档、生成网站嵌入码、后台查看会话，构建完整客服生态。
- **智能工具箱** `/tools`：翻译（多语种）、文档转换（PDF/Word/MD/图片等矩阵）、方案生成（商业/营销/技术）、内容生产（图生图 / 文生视频 / 图生视频）。
- **模型发布日历**：后端 `ModelEvent` 持久化 + 种子数据，前端日历视图、厂商筛选、用户自定义动态。
- **学习路径**：后端 AI 生成（引用真实课程库，无 Key 时回退模板），前端按水平/目标生成与展示。
- **创作工坊**：真实工具入口（文生图 / 代码助手 / 文档生成）统一跳转，替代原有占位。
- **个人中心**：`/profile` 展示会员态、积分、今日配额用量、订单记录，支持升级 / 取消订阅。

### 商业变现（本版新增）
- **套餐体系**：免费版 / 专业版 / 旗舰版，按月 / 年计费。
- **配额网关**：按套餐对 12 项资源（AI 对话、RAG、知识文档、MCP、学习路径、代码解释、翻译、文件转换、方案生成、媒体生成、客服问答、模型配置）做「日维度」限流（Redis 计数，无 Redis 时自动降级内存实现，超阈值返回 402 引导升级）。
- **订单与支付**：`Order` 模型 + 支付抽象层（微信 / Stripe / Mock）。Mock 模式可一键跑通「下单 → 支付 → 激活会员」全链路。
- **会员态**：用户模型含 `plan` / `membershipExpiresAt` / `credits`；顶栏显示当前套餐，过期自动降级。
- **定价页**：`/pricing` 提供升级 / 取消订阅流程。

### 生产化与差异化增强（本次新增，已测试）

> 针对全网 AI 痛点（部署复杂、客服不可信、上手难、模型割裂、媒体厂商分散、缺协作与开放变现）设计，避免与 Dify/n8n/LobeChat/FastGPT 同质化。

- **部署自检看板** `/diagnostics`：`GET /api/diagnostics` 一键检测 DB/Redis/各厂商密钥状态（不泄露明文），逐项给修复建议；Redis 缺失自动降级内存实现，0 依赖可跑。
- **场景化快速启动模板** `/quickstart`：`/api/quickstart` 内置「企业智能客服 / 新媒体运营 / 考试备考 / 开发团队知识库」4 套通用模板，外加 **4 套行业垂直模板（诊所导诊 / 律所咨询 / 培训机构课程顾问 / 工厂设备问答）**，一键生成「行业知识文档 + 合规客服机器人」；行业模板内置**合规触发词自动转人工**（如诊所「胸痛」、律所「起诉」、工厂「起火」），让诊所 / 律所 / 培训机构 / 工厂零技术即可上线可信客服。模板支持 `?category=industry|generic` 筛选。
- **智能客服可追溯闭环**：RAG 答案返回**来源引用（docId/标题/置信度）** + 触发词**转人工** + **满意度评分**，让客服可信、可追责（FastGPT 薄弱环节的补强）。
- **合规审计日志（Audit Log）**：每条客服问答完整留痕（问题 / 答案 / 来源依据 / 转人工 / 满意度），提供合规查询、CSV/JSON 导出与统计看板（`/customer-service/:id/audit`），满足金融 / 医疗 / 政务场景的监管调取与责任溯源。
- **团队 RBAC** `/team`：`/api/team` 创建团队、邀请成员、分配 `owner/admin/member/viewer` 角色，支撑企业协作与资源隔离。
- **团队资源级隔离（下沉到资源）**：知识库文档 `/api/knowledge` 与智能客服 `/api/customer-service` 支持**归属团队**，按成员角色控制读写（查看=viewer、编辑/删除=member、团队管理=admin/owner）；快速启动模板也可一键归属团队，让团队资产真正共享隔离。
- **开放 API 市场（按量计费）** `/marketplace`：`/api/marketplace` 签发 API Key、设置日配额、按调用计量；超限返回 429 并引导升级，把能力变成可收费开放平台。
- **媒体生成多厂商抽象 + 真实接入骨架**：文生视频/图生视频/图生图统一 Provider 接口，接入**混元 / 可灵 / 即梦**，配置即切换，无密钥走 Mock 演示。
  - **混元 TC3-HMAC-SHA256 真实验签**已落地（幂等可测），提交/查询均走签名请求。
  - **异步任务轮询**：视频/图像生成是异步的，统一返回 `taskId`，前端 `/tools/media/task/:provider/:taskId` 轮询状态（Mock 模拟 2s 完成，真实厂商走签名查询），避免"假同步"。
- **技能协议层（agency-agents 风格）**：参考 `msitarzewski/agency-agents` 的技能协议，把核心能力封装为**可声明、可插拔、可上架开放 API 市场**的 Skill（`skills/`：manifest + invoke）。`/api/skills` 暴露名册与调用入口，invoke 经配额网关 + 团队 RBAC 守卫；与现有 12 项配额资源打通。
- **AI 网关（OmniRoute 风格）**：参考 `diegosouzapw/OmniRoute` 的设计，新增**统一多厂商路由网关** `gateway/ai-gateway.service.ts`：provider 注册表（内置 OpenAI / Anthropic / DeepSeek / **智谱 GLM / 通义千问 / 豆包** / 混元 + **用户自定义第三方模型**）+ 前缀寻址（`deepseek/deepseek-chat`、`mc_<id>/<model>`）+ priority fallback。**把你手写的腾讯云 TC3 签名作为 `hunyuan` provider 接入网关**（大模型对话也走真实验签，与媒体生成复用同一签名算法）；`/api/gateway/chat` 为统一对话入口，`/api/gateway/models` 返回全部可选模型（内置 + 自定义）。`ai-agent.ts` 的 `sendMessage` 已统一改为走 `gateway.route()`。
  - **低成本国内优先**：默认接 DeepSeek / 智谱 / 通义 / 豆包等国产模型（单价约为 GPT-4 的 1/10），直接拉高毛利，是「低成本变现」的核心。
  - **第三方模型接入闭环**：用户在 `/model-config` 保存的任意 OpenAI 兼容端点（自建 vLLM、其他厂商）会在服务启动与配置变更时热加载进网关，参与路由与 fallback；「测试连接」会真实调用厂商 API 校验可达性。
- **视频生产系统集成**：媒体生成新增 `moneyprinterturbo` provider，对接 **harry0703/MoneyPrinterTurbo**（FastAPI `:8080`，文案→素材→配音→字幕→合成整片），补齐「文生视频」成片能力；新增 `video-pipeline` 技能（借鉴 **Open-Montage** 的 agent-first pipeline 范式：research→script→assets→compose），串联 AI 网关与视频工厂。两者均可经 `/api/skills` 名册调用与上架。
  - ⚠️ **状态：实验性（experimental）**：`video-pipeline` 的 `research` 阶段当前为占位实现（可接 RAG/联网增强），`compose` 阶段依赖外部 MoneyPrinterTurbo 服务可用；生产前请完善 research 与合成链路。
- **技能市场前端页** `/skills`：展示 agency-agents 风格技能名册（按 division 分组、可上架标记），支持 JSON 参数直接 invoke 并查看返回，与开放 API 市场打通。
- **支付真实验签**：Stripe（HMAC-SHA256）与微信支付 v3（AES-256-GCM 解密 + RSA 验签）的 Webhook 验签逻辑已落地，配置密钥后可直接联调。

---

## 安全边界与鉴权模型

> 本节明确「什么能匿名用、什么必须登录、错误与密钥如何不被泄露」，便于部署与审计。

### 认证与匿名边界
- **匿名可用**：注册/登录、公开客服对话（`/api/cs/chat/:embedCode`）、模型对比（无 Key 回退内置数据）、部分只读探查（`/health`、`/diagnostics` 仅返回状态不泄露密钥明文）、开放 API 市场已签发 Key 的计量调用。
- **必须登录（JWT 经 `requireAuth`）**：知识库读写、AI 会话读/清/删、课程增改与发布、MCP 写操作（增删改/启停/connect/call）、RAG 嵌入接口、个人/订单/会员、团队 RBAC 管理与资源级隔离、技能 invoke（走配额+RBAC 守卫）。
- **可选登录（`optionalAuth`）**：AI 对话、翻译、方案生成、文件转换、媒体生成、模型对比生成等——匿名可调（回退 Mock 或内置数据），登录用户受配额约束（`enforceQuota` 后 `quotaIncrement` 计日用量）。

### 配额闸门（12 项资源）
按套餐对 `ai_chat / rag / knowledge / mcp / learning_path / code_explain / translate / file_convert / plan_generate / media_gen / cs_chat / model_config` 做「日维度」Redis 限流；超阈值返回 `402` 并引导升级。无 Redis 时自动降级为内存计数，配额能力不丢失。

### 启动期安全校验（L4）
- 弱 `JWT_SECRET`（如 `dev-secret-key-change-in-production`、空值、`changeme` 等）在启动时拦截：`production` 环境直接退出（`exit(1)`）拒绝带病启动；`development` 仅告警；`test` 环境豁免。
- 缺失关键变量同理拦截，避免误用默认弱凭据上线。

### 错误信息不泄露（L2）
- 统一错误响应 `lib/http-error.ts`：业务错用 `AppError` 返回安全文案（`safeMessage`）；未知内部错误在 **production 仅返回通用语「服务器内部错误，请稍后重试」**，`development`/`test` 才透传 `err.message` 便于排查，避免密钥/路径/连接串泄露到客户端。

### Mock 模式与默认 Provider（M6）
- `ENABLE_MOCK_MODE=true` 时无需任何厂商 Key 即可运行（AI 返回模拟响应）；仍会注册所有已配置的 provider 供显式选用。
- 默认 Provider 跟随平台配置：可经 `DEFAULT_AI_PROVIDER` 环境变量指定；未指定且 Mock 开启时默认走 `mock`（零依赖可跑），非 Mock 模式取第一个已配置的真实 provider。

---

## 快速开始

### 方式一：Docker（推荐生产）
```bash
cp server/.env.example server/.env   # 按需填写（开发可保持 ENABLE_MOCK_MODE=true）
docker-compose up -d
# 前端 http://localhost   后端 http://localhost:3000  健康检查 http://localhost:3000/api/health
```

### 方式二：本地开发
```bash
# 1. 启动基础设施
docker-compose up -d mongodb redis

# 2. 安装依赖
npm install
cd server && npm install && cd ../client && npm install && cd ..

# 3. 配置环境变量
cp server/.env.example server/.env

# 4. 启动（前后端同时）
npm run dev
# 前端 http://localhost:5173   后端 http://localhost:3000
```

### 质量与测试
```bash
npm run lint          # 前端 ESLint
npm run test          # server(Jest) + client(Vitest) 测试
npm run format        # Prettier 格式化
```

> 首次运行测试请先 `npm install`（会安装 `ts-jest`、`prettier` 等质量依赖）。

---

## API 概览

| 模块 | 路由前缀 | 说明 |
|------|----------|------|
| 认证 | `/api/auth` | register / login / profile |
| 知识 | `/api/knowledge` | CRUD + 搜索 |
| AI 对话 | `/api/ai` | chat / session / models |
| RAG | `/api/rag` | chat / embed / search |
| 课程 | `/api/courses` | CRUD + 章节 + 发布 |
| 对比 | `/api/compare` | items / generate |
| 代码 | `/api/code` | 代码解释 |
| 文生图 | `/api/text2img` | generate |
| **MCP** | `/api/mcp` | servers(CRUD) / connect / call / tools |
| 模型日历 | `/api/model-calendar` | 发布事件列表 / 详情 / 用户提交 |
| 学习路径 | `/api/learning-path` | templates / generate(AI 生成) |
| 模型配置 | `/api/model-config` | CRUD / 测试 / 设默认（用户自助接入厂商模型）|
| 智能客服 | `/api/customer-service` | 机器人 CRUD / 嵌入码 / 会话；公开 `/api/cs/chat/:embedCode` |
| 工具箱 | `/api/tools` | translate / plan / convert / media（图生图·文生视频·图生视频）|
| 快速启动 | `/api/quickstart` | templates / apply（一键生成知识库+客服）|
| 部署自检 | `/api/diagnostics` | 集成状态自检（无密钥泄露）|
| 团队权限 | `/api/team` | CRUD / 邀请成员 / 角色管理（RBAC）|
| 技能协议层 | `/api/skills` | 名册 / 详情 / invoke（经配额+RBAC 守卫）|
| AI 网关 | `/api/gateway` | providers / chat（OmniRoute 式统一路由）|
| 开放API市场 | `/api/marketplace` | api-keys / usage / v1/chat（按量计费）|
| **计费** | `/api/billing` | plans / orders / webhook / subscription |

### 商业变现关键接口
```
GET  /api/billing/plans                      # 套餐列表（公开）
GET  /api/billing/subscription               # 我的套餐 + 用量（需登录）
POST /api/billing/orders                     # 创建订单 {plan, period, provider}
GET  /api/billing/orders/:no/pay            # Mock 支付成功（演示）
POST /api/billing/webhook/:provider          # 微信 / Stripe 回调
POST /api/billing/subscription/cancel        # 取消订阅
GET  /api/billing/orders/history              # 我的订单记录（需登录）
```

---

## 扩展新功能指引（可拓展性）

- **新增 AI Provider**：在 `server/src/config/ai-models.ts` 注册即可，全局统一客户端自动生效。
- **新增支付渠道**：实现 `server/src/services/payment.service.ts` 中 `PaymentGateway` 接口，并在工厂 `getPaymentGateway` 注册；下单时传 `provider` 切换。
- **新增受限资源**：在 `server/src/config/billing.ts` 的 `QuotaResource` 增加键，路由里 `enforceQuota('your_resource')` 即获限流能力。
- **新增 MCP 工具**：通过 `/api/mcp` 动态注册服务器，无需改代码。

---

## 目录结构
```
ai-agent-platform/
├── server/
│   ├── src/
│   │   ├── config/      # database(含 Redis 内存降级) / AI 模型 / 套餐(billing)
│   │   ├── models/      # User / Course / KnowledgeDocument / Order / MCPServer / ModelEvent / ModelConfig / CustomerService
│   │   ├── routes/      # 20+ 组路由（auth/knowledge/ai/rag/courses/code/compare/mcp/text2img/billing/model-calendar/learning-path/model-config/customer-service/tools/quickstart/diagnostics/team/skills/ai-gateway/marketplace 等）
│   │   ├── services/    # ai-agent / rag / embedding / mcp / compare / payment / translation / plan-generator / file-convert / media-gen
│   │   ├── skills/      # 技能协议层（agency-agents 风格）：types/registry + defs/*.skill.ts
│   │   ├── gateway/     # AI 网关（OmniRoute 风格）：ai-gateway.service.ts（TC3 签名作为 hunyuan provider）
│   │   ├── middleware/  # auth(JWT) / subscription(配额,12 项) / rbac / resourceAccess
│   │   └── index.ts
│   ├── Dockerfile
│   └── .env.example
├── client/
│   ├── src/
│   │   ├── pages/       # 22 个页面（含 Pricing / Profile / CodeExplanation / Text2Img / ModelConfig / CustomerService / ToolsCenter）
│   │   ├── services/    # api.ts（billing/modelCalendar/learningPath/code/profile/modelConfig/customerService/tools）
│   │   ├── App.tsx（分组侧边栏+渐变品牌头） / router.tsx
│   ├── Dockerfile / nginx.conf
├── docs/                # API.md / DEPLOYMENT.md / BUSINESS-MODEL.md（商业变现方案）
└── docker-compose.yml
```

---

## 路线图
- **Phase 3（已交付）**：团队 RBAC、开放 API 市场按量计费、部署自检、快速启动模板、客服可追溯闭环、媒体多厂商抽象、支付真实验签、TC3 签名统一库、JWT_SECRET 弱值启动拦截、路由鉴权全量回归测试。
- Phase 4：文生图/图生图真实厂商接入（混元/通义/Stable Diffusion）、知识图谱、实践沙盒、桌面端（Tauri）。
- Phase 5：企业版多租户、智能客服坐席计费、积分商城、调用链可观测性（Langfuse 思路）。
- 持续：补充单元测试覆盖、专业向量库（Qdrant/Pinecone）、PostgreSQL 迁移评估、支付 Webhook 端到端联调。

## 商业变现
完整的变现闭环见 [`docs/BUSINESS-MODEL.md`](./docs/BUSINESS-MODEL.md)：订阅套餐、按量积分、API 开放、企业私有化、渠道分润，以及配额闸门驱动的转化路径。支付已实现 Mock / 微信 v3 / Stripe 抽象层。

## 许可证
MIT
