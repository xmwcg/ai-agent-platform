# 2026-10-31 · ai-agent-platform 代码证据审计与统一平台差距

审计基线：`main@5618fc70bc3d99ab75a969db0547bccff6b96bbe`（2026-07-31）。范围为重点模块静态审阅、目录与测试/CI 记录核对；不代表生产环境或全量端到端验收。本次目标保持“步骤通 × 商链”PRD 2.0 不变。

## 证据差距矩阵

| 范围 | 代码证据 | 判定（限本次核查） | 下一验收 |
| --- | --- | --- | --- |
| 知识底座/文档 | `models/KnowledgeDocument.ts`、`routes/knowledge.ts` | CRUD/索引/团队文档归属已实现；未见行业专属隔离协议 | 跨行业、跨团队与付费资源用例 |
| RAG/嵌入 | `services/rag.ts`、`embedding.ts`、`vector-store.ts` | 有向量与关键词降级；基线检索没有请求级权限过滤，远程命中直接信任 payload；本分支修复只读检索路径 | Mongo/远程向量/关键词全链路安全回归 |
| AI Gateway | `gateway/ai-gateway.service.ts`、`routes/ai-gateway.ts` | 多 Provider 注册、模型路由、Mock/fallback 有代码和单测；不等于真实可达/费用可控 | 主 A → 审查 B → 知识验证 → 冲突检测端到端 |
| 意图/行业/地区/场景/风险 | `config/knowledge-categories.ts`、`routes/quickstart.ts` | 存在分类与行业模板；未确认统一结构化识别及行业硬隔离 | 36 行业交叉污染对抗样例 |
| 标准答案协议/证据链 | `services/rag.ts` 输出 answer/sources；`KnowledgeDocument` 元数据 | 基础来源摘要存在；未证实统一标准答案、来源版本/原始链接/证据校验链 | 固定 JSON Schema 与拒答/过期证据测试 |
| 视频生产 | `skills/defs/video-pipeline.skill.ts`、`services/media-providers/` | 调研目前由模型文本生成，无可验证联网来源；合成可能失败并返回降级结果，不能等同已出片 | 真实模型+任务轮询+可播放成片及事实引用 |
| 支付 | `routes/billing/webhook.routes.ts`、`services/payment-crypto.ts`、相关测试 | 验签、幂等与回调处理逻辑存在；未核实真实商户回调、对账、退款生产闭环 | 微信/Stripe 沙箱实签、重复/乱序回调对账 |
| 团队 RBAC | `routes/team.ts`、`middleware/resourceAccess.ts` | 角色管理与资源判定存在；RAG 基线绕过了该隔离边界 | 跨团队读写、成员退出及批量嵌入权限 |
| API 市场 | `routes/marketplace.ts`、`models/ApiKey.ts` | 密钥/配额/使用量路径存在；实收费和对账未验证 | 并发计费、配额重置与用量对账 |
| 部署安全 | `docker-compose.yml`、`server/src/config/env-check.ts`、`scripts/validate-production-config.ts`、`.github/workflows/ci.yml` | 有部署/环境检查及 CI；基线最近 CI 总体失败（server 成功，client 失败） | 生产配置实测、恢复演练、全量 CI 绿灯 |
| 统一 Knowledge API/SDK | 现有 `/api/knowledge`、`/api/rag` | 有应用 API，但未确认独立公司级服务和可复用 SDK | 跨产品独立服务与版本化协议契约测试 |

## 本轮实现：P0 RAG 读取权限防穿透

- `services/rag-access.ts`：从认证用户/真实团队成员关系构造 Mongo 权限查询；匿名只可检索免费公开全文；作者/团队成员可检索其访问范围内的免费全文。任何需要积分、付费、高级会员或仅供试看的文档均须等待独立权益校验，不得通过 RAG 绕过。
- `routes/rag.ts`：聊天及搜索均传入访问范围；忽略用户提交的 `userId` 防伪造访问主体。
- `services/rag.ts`：向量与关键词降级共享同一过滤条件；内部默认只查免费公开知识。
- `services/embedding.ts`：远程向量结果只作为候选 ID，不信任 payload；必须回 Mongo 按过滤器读取。
- 单测：`rag-access.test.ts`、`embedding.access.test.ts`。

## 明确未修复 / 不能宣布生产就绪

1. `/api/rag/embed/*` 与 `/api/rag/pipeline/re-embed` 仅要求登录，没有逐文档权限校验；必须下一轮处理。
2. RAG 上传传入的 `teamId` 没有统一成员校验，`ingest-url` 还需要 SSRF（服务器主动请求受保护地址）完整封堵；与本轮读路径隔离。
3. 本轮 RAG 对已购买/会员付费公开文档采取**拒绝进入检索**而非自动解锁；这避免越权，但不能代表“付费 RAG”完工。
4. `optionalAuth` 的 JWT 会话撤销状态、旧代码通道与客服/工作流等其它检索入口尚需专项审计。
5. 行业/地区/证据版本、双模型交叉审查和 Knowledge API/SDK 是总体目标中的未验收项目，不得删减。
6. 不将已有单测数量、README Phase 3 文案或 Mock 模式成功作为真实支付、真实视频、真实 LLM 的生产验收。

## 验证命令与交接

```bash
cd server
npm ci --no-audit --no-fund
npx tsc --noEmit
npm test -- --runTestsByPath src/services/rag-access.test.ts src/services/embedding.access.test.ts
npm test
```

**测试结果：以该分支 GitHub Actions 的实际执行记录为准，未有绿色运行不得写“通过”。**

Codex/Claude 接续：先读本文件、`README.md`、本分支 diff、GitHub CI；确认新增测试成功后，下一轮优先修复 RAG 批量嵌入与上传团队归属授权，并增加真实 Mongo / 关键词降级 / Qdrant 端到端安全用例。若 CI 失败，先分类既有的 client 失败与本轮 server 失败，不擅自改无关前端；所有新工作在独立分支继续，记录提交 SHA、运行证据及剩余风险。


## 本轮续审：匿名客服读取权限（2026-10-31）

**选择理由 / P0：** 基线 `server/src/routes/customer-service.ts` 的 `POST /chat/:embedCode` 允许匿名访问，原实现以机器人配置的 `knowledgeBaseIds` 直接读取文档；向量命中仅按绑定 ID 过滤，远程 payload 正文可被直接使用，向量失败时 fallback 取前三篇全文。原路径未使用 `isPublic`、付费/试看约束，存在经公开客服泄漏私有、跨团队、付费文档全文的风险。本轮只修这个公开读取面，不更动业务套餐、已发布服务或无关模块。

### 代码差距矩阵（以本仓库所见源代码和实际 CI 为准）

| 子系统 | 状态类别 | 代码/约束证据 | 尚缺生产验收 |
| --- | --- | --- | --- |
| 知识底座 / 文档 CRUD | 已实现应用模块；独立底座缺失 | `models/KnowledgeDocument.ts`、`routes/knowledge.ts` | 跨应用独立服务、文档版本、迁移、租户数据真库测试 |
| RAG、向量与关键词降级 | 已实现逻辑；权限修复在未合并分支；真实外部服务未验证 | `services/rag.ts`、`embedding.ts`、`rag-access.ts` | Mongo/Qdrant 回归、写侧嵌入授权、付费权益协议 |
| 公开客服 RAG | **本轮 P0 修复待最终 CI / 真实库验收** | `routes/customer-service.ts`、`customer-service.access.test.ts` | 真实数据库复现与线上灰度，校验历史绑定文档 |
| 多模型 AI Gateway | 已有 Provider 路由与 Mock；A→B 审查闭环未证实 | `gateway/ai-gateway.service.ts`、`ai-gateway.test.ts` | 真实多模型调用、故障恢复、质量与成本记录、交叉审查 |
| 36 行业隔离与场景/地区/风险识别 | 分类骨架，未达到 PRD 2.0 | `knowledge-base/README.md`、`config/knowledge-categories.ts` 仅列 12 个一级分类 | 36 行业标准、硬隔离、对抗测试、地域/风险协议 |
| 标准答案、来源时效与证据链 | 基础 sources 存在；统一证据契约未证实 | `KnowledgeDocument` 缺独立 sourceUrl/fetchedAt 字段；`scripts/importKnowledgeBase.ts` 将其拼到正文 | 结构化来源、时间、版本、风险、拒答、冲突证据测试 |
| 视频 pipeline | 实验性 / 外部依赖；不等于成片 | `skills/defs/video-pipeline.skill.ts` 调用模型生成 research，无外部联网证据；compose 依赖外部提供者 | 可播放文件、任务状态、来源验证、失败不误报 |
| 支付 / Webhook | 验签、幂等代码及单测存在；实际商户未验证 | `routes/billing/webhook.routes.ts` 生产环境仅开放 wechat；其它渠道返回 404 | 真商户签名、支付→权益→退款/对账、丢单重试 |
| 团队 RBAC / 资源隔离 | 部分实现；其他入口仍需逐一核查 | `middleware/resourceAccess.ts`、`routes/team.ts`；本轮封堵客服匿名读取面 | 成员撤销、跨团队、写侧、各类公开入口统一权限 |
| 开放 API 市场 | 鉴权与计费代码存在；商业收费未验收 | `routes/marketplace.ts`、`models/ApiKey.ts` | 并发配额、对账、真实计费、越权测试 |
| 私密部署、安全与 CI | 配置/检查实现；生产就绪未确认 | `docker-compose.production.yml`、`config/env-check.ts`、`.github/workflows/ci.yml` | 全量 CI 绿灯、实际私有部署、安全扫描与备份恢复 |
| Knowledge API / SDK | 应用 API 已有；公司级统一 SDK 未验收 | `routes/knowledge.ts`、`routes/rag.ts` | 跨产品统一版本化协议、兼容测试 |

**可复用：** 文档模型及 CRUD、AI Gateway 现有 Provider 层、Team 成员角色判断、支付验签/幂等工具、分层配额和现有 Jest 测试基础设施。

**必须调整的架构：** 检索/客服/技能所有知识入口共享服务端授权与付费决策；区分公开问答和已登录权益；行业、地区、场景和风险作为结构化身份参与检索；来源、版本与更新时间独立字段存储；公司级 Knowledge API/SDK 提供固定版本和全链路证据协议；多模型路由升级为 A 生成→B 评审→知识校验→冲突检测。

**暂缓（不删除最终需求）：** 媒体市场扩张、积分商城、额外视觉能力和新行业模板的广度扩充。优先守住现有匿名数据边界、真实调用与可验证输出，再扩功能。

### 本轮改动、测试与验收边界

- `server/src/routes/customer-service.ts`：使用与匿名 RAG 一致的 `buildRagAccessFilter()` 对绑定文档在 MongoDB 执行公开 + 免费全文过滤；向量只保留候选 ID/得分，正文从已授权的 Mongo 结果取；向量失败 fallback 亦只取授权文档；绑定后改为私有/付费将立即失去匿名可检索资格。
- `server/src/routes/customer-service.access.test.ts`：检查权限查询、向量 payload 伪造、非绑定/受限 ID、向量失败 fallback、无可公开文档时不检索也不引文。
- **明确限制：** Jest 仅验证模拟 DB/向量服务下的代码路径；尚未用真实 Mongo/Qdrant/实际模型或真实公开客服部署验收。只有 CI 完成通过后才能记录「测试通过」；客户端 CI 的 `dompurify` 依赖问题是已知独立阻断，不计为客服修复已通过生产验收。

从仓库根目录：
```bash
cd server
npm ci --no-audit --no-fund
npx tsc --noEmit
npm test -- --runTestsByPath src/routes/customer-service.access.test.ts
npm test
```

### Codex / Claude 无缝交接（下一轮保持完整 PRD 2.0）

1. 先读本文件、`README.md`、`docs/AIBAK-FULL-PROJECT-HANDOFF.md`、PR #1 全部 diff 和最新 GitHub Actions Job 日志，再确认主分支、工作分支和当前 HEAD；不以 README 宣传文案作结论。
2. 确保上述安全回归单测 + 全量后端通过；若测试失败先修此次提交引入的差错；客户端 `dompurify` 问题单独定位并最小修复，记录锁文件及复现实验。
3. 下一独立 P0：逐文档校验 `/api/rag/embed/document/:id`、批量嵌入、`/embed/knowledge-base`、`pipeline/re-embed` 和写侧 teamId；禁止越权重嵌入。另一独立 P0：公开客服绑定文档授权、更新权限/会话 ID 归属、用户可控 URL 导入 SSRF 等安全边界。
4. 每轮记录：目标、基线提交、改动文件、真实运行命令、通过数量与 CI 网址、未验证边界、下一项任务、提交 SHA；Codex/Claude 以仓库文件交接而不是依赖聊天上下文。草稿 PR 未全链路验收不得宣传已生产完工；不做生产部署或真实资金动作。

**唯一产品目标仍为“步骤通 × 商链”PRD 2.0 全部内容；阶段 P0 只决定先后顺序，不删减最终范围。**
