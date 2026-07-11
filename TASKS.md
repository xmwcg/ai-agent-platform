# 项目任务清单（Reasonix AI Agent Platform）

> 说明：原 Phase 1/2 任务已完成并验证（见 MEMORY.md）。以下为**当前实际进度**。

## ✅ 已完成（Phase 2 - 基础平台 + 变现闭环）
- [x] 用户认证（JWT 注册/登录/资料）
- [x] 知识中枢（Markdown CRUD + 搜索）
- [x] AI 对话（多 Provider + 会话）
- [x] RAG 检索（向量嵌入 + 余弦相似度）
- [x] 课程 / 对比 / 代码解释 / 文生图 / 模型日历 / 学习路径
- [x] MCP 插件管理（真实连接 + 持久化）
- [x] 大模型配置中心（运行时自助接入厂商模型）
- [x] 智能客服系统（RAG 支撑 + 嵌入码）
- [x] 智能工具箱（翻译/转换/方案/媒体生成）
- [x] 商业变现（套餐/配额12项/订单/支付抽象/定价页/个人中心）

## ✅ 已完成（Phase 3 - 生产化与差异化增强，本次交付）
- [x] 部署自检看板 `/api/diagnostics` + 前端页（解决「安装部署痛点」）
- [x] 场景化快速启动模板 `/api/quickstart` + 前端页（解决「上手门槛痛点」）
- [x] 智能客服可追溯闭环：来源引用 + 转人工 + 满意度（解决「客服不可信痛点」）
- [x] 团队 RBAC `/api/team` + 前端页（解决「企业协作痛点」）
- [x] 开放 API 市场按量计费 `/api/marketplace` + 前端页（解决「开放变现痛点」）
- [x] 媒体生成多厂商抽象（混元/可灵/即梦/Mock）
- [x] 微信/Stripe 真实 Webhook 验签（HMAC / AES-GCM / RSA）
- [x] 单元测试：新增 24 例（验签/ RBAC / API 配额 / 媒体厂商 / 客服可追溯 / 快速启动），全量 47 例通过
- [x] 验证：后端 tsc ✅ / jest 47-47 ✅ / 前端 build ✅ / lint 0 error ✅

## 📌 下一阶段（Phase 4/5）
- [x] 团队邀请链接 + 通过邀请码加入团队（第十四轮）
- [x] 团队审计日志：记录全部关键操作（第十四轮）
- [x] 媒体任务持久化：内存 Map → MongoDB（TTL 24h + 自动降级）（第十四轮）
- [x] **支付 Webhook 端到端联调**：Stripe raw body 中间件 + 微信验签修复 + 微信 E2E 测试（第十五轮）

## ✅ 第十六轮（全量补完：知识图谱 / 实践沙盒 / 可观测性 / 向量库 / 桌面端）
- [x] **知识图谱（后端+前端）**：`knowledge-graph.service.ts` 纯函数聚合（doc/tag/category 节点 + doc-tag/doc-category/doc-doc 共现/relatedDocs 强边）+ `routes/knowledge-graph.ts`（团队隔离 viewer+）+ 前端 `KnowledgeGraphPage.tsx`（ECharts 力导向图，标签/分类开关、共现阈值、节点详情抽屉）+ 7 例单测。修复 `includeTags=false` 仍生成标签边的 bug（已并入聚合逻辑）。
- [x] **实践沙盒（后端+前端）**：`sandbox.service.ts` 多模式 Provider（mock/local/remote）+ 危险写法 deny-list 静态扫描（纯函数 `detectDangerousPatterns`）+ local 子进程超时隔离 + remote 容器执行器对接；`routes/sandbox.ts`（`/run` + `/status`）；前端 `SandboxPage.tsx`（语言选择/运行/输出控制台/演示模式提示）；20 例单测。
- [x] **调用链可观测性（Langfuse 思路）**：`lib/trace.ts` noop/langfuse 双 Tracer，`buildTraceEvent`/`selectTracerMode` 纯函数 + `measure()` 包裹异步操作；RAG 答案生成已接入 `measure('rag.generateAnswer', ...)`；9 例单测。
- [x] **专业向量库插件化（Qdrant/Pinecone）**：`vector-store.ts` Provider 抽象（memory/qdrant/pinecone）+ `cosineSimilarity`/`rankByCosine` 纯函数 + `selectVectorStoreKind` 按环境变量自动切换；`embedding.ts` 的 `searchSimilarDocuments` 改走向量库抽象（memory 默认，行为完全兼容；qdrant/pinecone 配置后自动启用远程检索）；12 例单测。
- [x] **桌面端 Tauri 脚手架**：`client/src-tauri/`（Cargo.toml / tauri.conf.json / build.rs / src/main.rs / src/lib.rs / icons 占位）+ `client/package.json` 增加 `@tauri-apps/api`、`@tauri-apps/cli` 与 `tauri`/`tauri:dev`/`tauri:build` 脚本。Rust 编译需本机工具链，按 `tauri icon` 重生成正式图标后 `npm run tauri:dev` 即可启动桌面应用。
- [x] **支付 Webhook 真实凭证（配置就绪）**：`.env.example` 已含 `STRIPE_WEBHOOK_SECRET` 与 `WECHAT_PLATFORM_CERT` 占位，billing 代码已消费；填入真实密钥即投产（第十五轮已就绪）。
- [x] **核查即标记完成（Round 15 代码已含，未重复实现）**：媒体真实厂商轮询（可灵/即梦 `queryTask`）、团队资源级授权（`canAccessResource` 已接入 knowledge/customer-service/quickstart/knowledge-graph 路由）、API 市场计费（原子积分扣减 + CreditsTransaction 审计 + CSV/JSON 用量账单导出）。
- [x] **验证**：后端 tsc ✅ / jest **288 用例 · 39 suite 全过** / 前端 tsc ✅ / 前端 eslint **0 error**。注：上一轮随知识图谱交付的 2 例单测断言因无向边 source/target 顺序假设而失败（从未运行），本轮修复为顺序无关断言后全绿。
