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
