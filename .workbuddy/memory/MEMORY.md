# 项目记忆 / Project Memory — AI Agent Platform (aibak.site)

> 项目专属长期上下文。跨项目通用规则见 `~/.workbuddy/MEMORY.md`（全局 §18 为本项目强约束）。
> 最后更新：2026-07-22

---

## 0. 项目身份
- 域名：`aibak.site` / `www.aibak.site`（生产强制服务本平台，见 AGENTS.md 生产契约）。
- 形态：React18+Vite+Antd5 前端 + Express+TS+MongoDB+Redis 后端全栈 AI Agent 平台。
- 三合一定位：**知识中枢 / 学习平台 / AI Agent 平台**（竞品差异点：教育+创作+Agent 融合，非纯 Agent 搭建器）。
- 生产部署：Caddy 反代，`/api/*` → 127.0.0.1:3000，前端 `/opt/ai-agent-platform/client/dist`。
- Git：main 跟踪 `cnb/main`；prod remote `ssh://root@159.75.124.59/opt/ai-agent-platform.git`；github remote 常不可达（沙箱网络）。

## 1. 当前状态快照（2026-07-22）
- **本地**：7 个未提交改动（site-features.ts、CreativeWorkshop.tsx、Home.tsx、router.tsx、ai-gateway.service.ts、code-explanation.ts + 未跟踪 CodeLabPage.tsx）—— 均未 commit/push/部署。
- **CNB**：main 与 cnb/main 同步（0 ahead / 0 behind），但上述本地改动未推送。
- **服务器**：`https://aibak.site/api/health` 返回 **502 Bad Gateway**（Caddy 连不上后端 127.0.0.1:3000）→ 后端进程未运行/崩溃，需登服务器重启；且本地改动未上线。
- **结论**：服务器未更新，且处于不健康状态。

## 2. 强约束（来自全局 §18，龙哥 2026-07-22 明确指令）
- 全项目检查：查一个功能=查全部；各功能必须已上线、可用、可变现、可商用、可运营，无虚拟数据、非内部测试。
- 结果导向：只给结果，不给过程；报告结构=做了什么/发生什么/验证了什么/限制风险。
- 建议≤2个，每个含「怎么做+结果」，只问同意/不同意。
- 功能设计前必须联网调研竞品 + 国内外大数据，参考并创新，结合本平台架构。
- 调研结果写入「金奕鸣大数据知识库」（lexiang KB，jym=金奕鸣）。

## 3. 竞品调研结论（2026-07-22，详见金奕鸣大数据知识库）
- 标杆：Dify（开源/RAG/工作流/8000+插件，弱在团队协作与合规）、Coze 扣子 3.0（多Agent协作/项目空间/行业技能包，封闭生态）、百度文心、阿里百炼（绑钉钉）、腾讯元器（微信墙内强）、蚂蚁Agentar（高合规）、华为盘古。
- 海外：MindStudio（200+模型市场无加价）、Crossnode（代理商白标门户+计费+订阅变现）、Adaptive/Lindy（自然语言建Agent）、CustomGPT（反幻觉1400+格式）、Stack AI（SOC2/HIPAA合规）、Gumloop（画布工作流）、Microsoft Copilot Studio（M365生态）。
- 本平台可差异化切入：**学习场景Agent化（课程知识库答疑）+ 创作工坊变现（小红书生成器直接分发）+ 多Agent协作（Zhitalk 10技能）+ 分销/积分闭环**。

## 4. 待办 / 死功能清单（需逐个验证可用）
- 服务器 502 需先修复（重启后端 + 确认 caddy）。
- 本地 7 改动需 commit→push→部署验证。
- 全功能可用性审计（见全局 §18：各司其职、真实连接、可变现）。

## 5. 全功能可用性审计结果（2026-07-22，详见根目录《全功能可用性审计-达标清单与修复方案.md》）
- 审计范围：前端 75 页 + 后端 33 路由 + 支付变现闭环。
- 达标率：前端~90% / 后端~85% / 支付~82%；修复 P0+P1+P2 后可达 ≥95%。
- **死功能（P0，精确位置）**：CourseDetail.tsx:239 无播放器；ModelCalendar.tsx:31 写死6条+:133 伪造订阅；QuizPage.tsx:344 静态提示；ProfilePage.tsx:340 复制无onClick+:354 分销空表+:248 取消订阅假；CreativeWorkshop.tsx:69 开关本地态；Home.tsx:370 占位数字；JinWangTongDemo.tsx:186 纯演示需标角标。
- **支付/合规断裂（P1）**：payment.service.ts:467 忽略 DEFAULT_PAY_PROVIDER 硬编码 mock；marketing.ts:31 意向存内存；auth-verify.ts:31/auth-password.ts:33 验证码内存降级；asset-store.ts:66 内存兜底；relay.ts:71 密码可抢注；sandbox.service.ts:170 默认 mock。
- **体验假象（P2）**：points.service.ts:112 任务积分从未发放；ai.ts/billing.ts:215 api_chat BYOK 未注入；SandboxPage.tsx:127 默认 mock；billing.ts:296,338 license dev 不签发。
- 微信支付 v3 本身真实合规（RSA2048+证书验签+查单+幂等+重放防护）；核心付费闭环真实成立。
- 下一步：待龙哥确认选项1（全量修复+部署）或选项2（先 P0+P1 上线）后执行。
