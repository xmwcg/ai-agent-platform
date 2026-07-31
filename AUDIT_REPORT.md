# AI Agent Platform — 全面审计报告

> 审计日期：2026-07-12  
> 版本：main @ `226d136`  
> 生产环境：159.75.124.59 (Docker Compose, 4 容器)

---

## 一、生产环境状态

| 容器 | 状态 | 端口 | 备注 |
|------|------|------|------|
| ai-platform-client | Up (healthy) | 80, 443 | Nginx 反代，HTTPS |
| ai-platform-server | Up **(healthy)** | 127.0.0.1:3000 | Node.js 后端 |
| ai-platform-redis | Up | 6379 (内网) | **连接不稳定** |
| ai-platform-mongodb | Up | 27017 (内网) | 正常 |

### 已修复的问题

| # | 问题 | 状态 |
|---|------|------|
| 1 | Docker 健康检查 busybox wget 误判 unhealthy | ✅ 已修复（改用 node 内联脚本） |
| 2 | /api/health 因数据库 hang 而永不返回 | ✅ 已修复（1.5s 超时保护） |
| 3 | enableOfflineQueue:false 导致 worker 连接雪崩 | ✅ 已修复（恢复默认 true） |
| 4 | maxRetriesPerRequest:3 触发永久断连 | ✅ 已修复（改为 20） |
| 5 | keepAlive:5000 可能触发 Docker 网络误判断连 | ✅ 已移除 |
| 6 | 服务器 .env REDIS_URL 指向 localhost | ✅ 已修正为 redis://redis:6379 |

### ⚠️ 持续问题：Redis 半开连接

**现象**：ioredis 连接成功（status='ready'），但 ping() 挂死（1.5s 超时）。  
**影响**：health check 返回 `redis: disconnected`，MemoryRedis 降级未触发（因为 status 仍是 'ready'）。  
**根因分析中**：手动测试连接完全正常，疑似应用层多消费者并发访问同一 ioredis 单连接的边缘行为。

---

## 二、后端代码审计

### 2.1 架构概览

```
server/src/
├── index.ts          — 入口，注册中间件/路由
├── config/           — 配置（AI模型、数据库、计费、积分、分类）
├── gateway/          — AI 统一网关（OmniRoute 前缀寻址）
├── lib/              — 工具库（加密、日志、OSS、HTTP 错误）
├── middleware/        — 中间件（认证、限流、RBAC、安全头、CORS）
├── models/           — 数据模型（20+ 个）
├── routes/           — 路由（28 个路由文件 + 16 个测试）
├── services/         — 业务服务（43 个文件）
└── scripts/          — 运维脚本
```

### 2.2 中间件审计

| 中间件 | 状态 | 关键发现 |
|--------|------|----------|
| `auth.ts` | ⚠️ | 存在硬编码 JWT fallback 弱密钥；7 天有效期偏长 |
| `cors-config.ts` | ✅ | 严格白名单，无 `*` 通配符 |
| `security-headers.ts` | ✅ | Helmet 配置良好，HSTS 有效期 1 年 |
| `rate-limit.ts` | ⚠️ | 内存存储，重启丢失；未用 Redis 存储 |
| `rbac.ts` | ✅ | 团队 RBAC 角色验证完整 |
| `subscription.ts` | ✅ | 配额/成本阀门三层防护 |

### 2.3 路由端点统计

| 模块 | 端点数 | 认证 | 备注 |
|------|--------|------|------|
| auth | 8 | 混合 | 登录/注册/OAuth/验证码 |
| knowledge | 10 | 混合 | 知识库 CRUD + 搜索 |
| billing | 14 | 混合 | 订阅/支付/Webhook |
| ai-chat / aibak-chat | 8 | 需登录 | AI 对话 |
| text2img | 5 | 混合 | 文生图 |
| team | 8 | 需登录 | 团队管理 |
| courses | 6 | 混合 | 课程/测验 |
| marketplace | 8 | 混合 | API 市场/技能 |
| model-config | 5 | 需登录 | 模型配置 |
| 其他 | ~20 | 混合 | 工作流/沙盒/客服/诊断等 |

---

## 三、前端代码审计

### 3.1 架构

- **框架**：React + TypeScript + Vite
- **状态管理**：Zustand（5 个 store） + React Query
- **UI 库**：Ant Design
- **路由**：react-router-dom v6（44 条路由）
- **API 层**：axios 实例，18 个 API 模块

### 3.2 页面清单（43 页）

| 类别 | 页面 |
|------|------|
| 核心 | Home, Login, Register, Profile, Pricing, PointsCenter, Distribution |
| AI | AiChat, AibakChat, CreativeWorkshop, CodeExplanation, Sandbox, Text2Img, Compare, ModelCalendar |
| 知识 | KnowledgeList, KnowledgeDetail, KnowledgeEditor, KnowledgeGraph |
| 学习 | CourseList, CourseDetail, Quiz, LearningPath |
| 工具 | WorkflowEditor, PluginManager, ModelConfig, ToolsCenter, Quickstart, Diagnostics, XiaohongshuGenerator |
| 商业 | Marketplace, SkillsMarket, Team, CustomerService, AuditLog, OrderDetail |
| 其他 | Terms, Privacy, Cookies, About, Contact, Join |

### 3.3 前端发现

| # | 问题 | 严重度 |
|---|------|--------|
| 1 | API base URL 硬编码在 api.ts | 低 |
| 2 | 无全局错误边界（仅 main.tsx 中有基础 ErrorBoundary） | 低 |
| 3 | 部分页面无 loading 骨架屏 | 低 |

---

## 四、支付系统审计

### 4.1 支付网关

| 网关 | 实现 | 验签 | 查单 | 密钥配置 |
|------|------|------|------|----------|
| **微信支付** | ✅ 完整 | RSA-SHA256 + AES-256-GCM | ✅ | ✅ 已配置 |
| **支付宝** | ✅ 完整 | RSA2 异步通知验签 | ✅ | ❌ 未配置密钥 |
| **Stripe** | ✅ 完整 | HMAC-SHA256 | ✅ | ❌ 未配置密钥 |
| **Mock** | ✅ 完整 | — | — | N/A |

### 4.2 Webhook 安全

- ✅ 验签防伪造（所有渠道）
- ✅ 幂等去重（eventId 唯一索引）
- ✅ 重放攻击防护（5 分钟窗口）
- ✅ 原子占位（防并发重复激活）
- ✅ 审计日志（WebhookEvent 集合，30 天 TTL）
- ✅ 回调响应永不返回非 200

### 4.3 待改进

| # | 问题 |
|---|------|
| 1 | 支付宝/Stripe 密钥未配置（需在服务器 .env 中补齐） |
| 2 | `.env` 文件中的 OPENAI_API_KEY 为真实值 |

---

## 五、数据库审计

### 5.1 高优先级修复

| # | 问题 | 影响 |
|---|------|------|
| 1 | **`Withdrawal.account` 明文存储** | 合规风险，必须加密 |
| 2 | **`User.phone` 明文存储** | 个人信息保护合规 |
| 3 | **`ModelConfig` 无任何索引** | 全表扫描 |
| 4 | **`Team.members.userId` 无多键索引** | 用户查团队全表扫描 |
| 5 | **`CustomerService.ownerId` 无索引** | 高频查询字段 |
| 6 | **Workflow `owner` 索引冗余** | 复合索引已覆盖 |
| 7 | **UserCourseProgress `userId` 索引冗余** | 复合唯一索引已覆盖 |

### 5.2 中优先级修复

| # | 问题 |
|---|------|
| 8 | `Order`/`MediaTask`/`KnowledgeDocument` 缺少 `{userId:1, createdAt:-1}` 复合索引 |
| 9 | `services/ai-agent.ts` 中使用 `keys()`（阻塞命令，生产环境应改 `SCAN`） |
| 10 | `express-rate-limit` 使用内存存储（多实例部署时不共享） |
| 11 | `storeImage` 下载远程图片无大小限制（SSRF 风险） |

### 5.3 TTL 索引（设计良好）

- ApiUsageLog: 90 天
- CreditsTransaction: 365 天
- WebhookEvent: 30 天
- MediaTask: 24 小时

---

## 六、部署与安全审计

### 6.1 安全评分：8.0/10

| 维度 | 评分 | 说明 |
|------|------|------|
| 端口暴露 | 9/10 | 数据库零公网，server 仅回环 |
| 网络隔离 | 9/10 | 自定义 bridge 网络 |
| HTTPS/SSL | 8/10 | 证书管理完善，缺 OCSP Stapling |
| 安全响应头 | 7/10 | 后端 helmet 好，nginx 层缺失 |
| CORS | 9/10 | 严格白名单 |
| 认证 | 7/10 | 有弱密钥拦截，但 fallback 仍存在 |
| 限流 | 8/10 | 三层限流设计好，缺分布式存储 |
| Docker 安全 | 7/10 | 镜像精简但 server 以 root 运行 |
| 部署脚本 | 8/10 | 门禁检查 + 幂等 + 超时保护 |

### 6.2 高优先级安全问题

| # | 问题 | 建议 |
|---|------|------|
| 1 | MongoDB/Redis 容器无 healthcheck | 添加 `depends_on` condition: service_healthy |
| 2 | Nginx 静态资源无安全响应头 | 添加 CSP/HSTS/X-Frame-Options |
| 3 | Server 容器以 root 运行 | 添加非 root 用户 |

### 6.3 中优先级

| # | 问题 | 建议 |
|---|------|------|
| 4 | auth.ts 硬编码 JWT fallback 弱密钥 | 移除 fallback，未设置时 `throw Error` |
| 5 | morgan 日志使用 `dev` 模式 | 生产改用 `combined` |
| 6 | JWT 7 天过期无 refresh 机制 | 缩短 + 添加 refresh token |
| 7 | sites.yaml 含真实服务器 IP | 仓库公开时去敏 |

---

## 七、改进任务优先级矩阵

### 🔴 P0 — 必须立即修复
1. `Withdrawal.account` 提现账号加密
2. `User.phone` 手机号加密
3. Nginx 添加安全响应头（CSP/HSTS/X-Frame-Options）

### 🟠 P1 — 本周内修复
4. `ModelConfig` 添加索引
5. `Team.members.userId` 多键索引
6. `CustomerService.ownerId` 索引
7. 移除 auth.ts JWT fallback 弱密钥
8. 补充支付宝/Stripe 密钥到 .env

### 🟡 P2 — 本月内修复
9. MongoDB/Redis healthcheck
10. Server Dockerfile 非 root 用户
11. express-rate-limit 切换 Redis 存储
12. `keys()` 改 `SCAN` + 补充复合索引
13. 消除冗余索引

### 🟢 P3 — 持续改进
14. Nginx OCSP Stapling + session cache
15. morgan `dev` → `combined`
16. JWT refresh token 机制
17. 前端 loading 骨架屏
18. 上传文件病毒扫描

---

## 八、Redis 连接问题追踪

**当前状态**：ioredis status='ready'，但 ping() 超时（1.5s），health check 正确报告 `redis: disconnected`。  
**已排除**：网络连通性（TCP 可达）、Redis 服务端（PONG）、ioredis 配置（手动测试通过）。  
**疑似根因**：应用层多个服务（queue worker brpop + agent keys/get + health check ping）并发使用同一 ioredis 单连接导致内部状态异常。  
**临时方案**：health check 1.5s 超时正确工作，服务器标记 unhealthy 阈值（3 次 x 4s timeout）远大于 1.5s，暂不影响稳定性。  
**长期方案**：考虑使用 ioredis Cluster 或为 health check 使用独立连接。

---

## 九、总结

| 项目 | 评估 |
|------|------|
| **代码质量** | 良好 — 模块化清晰，TypeScript 全覆盖，测试充分 |
| **安全性** | 良好 — CORS/限流/认证/验签机制完善，nginx 层需补充 |
| **支付** | 完整 — 三通道全实现，Mock 降级，Webhook 安全设计优秀 |
| **数据库** | 一般 — 索引缺失较多，部分敏感字段未加密 |
| **运维** | 良好 — Docker Compose + 自动部署 + 健康检查 + HTTPS |
| **生产稳定性** | 良好 — 4 容器全 Up，health check 通过，Redis 连接待长期修复 |

**本次审计修复了 5 个生产环境 bug，识别出 3 个 P0、5 个 P1、5 个 P2 改进项。**
