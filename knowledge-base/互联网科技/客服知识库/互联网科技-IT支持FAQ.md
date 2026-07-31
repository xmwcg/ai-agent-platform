---
title: 互联网/科技 · 大模型 IT 支持知识库（FAQ 模板）
industry: 互联网科技
category: 客服知识库
vendor: ''
tags: [互联网, 科技, it, 客服, faq, 开发者]
sourceUrl: https://www.skillhub.cn/enterprise-zone
fetchedAt: 2026-07-21
requiredPlan: free
creditsCost: 0
freePreviewPages: 0
---

# 互联网/科技 · 大模型 IT 支持知识库

## 常见问答（示例）
1. **Q：API 调用报 401？**
   A：检查 API Key 是否有效、是否带 Bearer；环境变量是否注入。

2. **Q：如何切换模型/供应商？**
   A：在「模型配置」选择 provider 与 model；或在请求体改 `model` 字段。

3. **Q：流式输出怎么处理？**
   A：请求 `stream:true`，按 SSE 逐块解析 `choices[0].delta.content`。

4. **Q：上下文超长怎么办？**
   A：用长上下文模型（gemini/claude/kimi）或 RAG 检索代替全量注入。

5. **Q：怎么降低调用成本？**
   A：选低成本模型（deepseek-chat/glm-4-flash）、开启缓存、压缩历史。

6. **Q：如何接 MCP 工具？**
   A：在「MCP 插件」注册 server，详见技能/MCP 文档。

7. **Q：报错/限流怎么办？**
   A：实现指数退避重试；查看供应商速率限制页。

8. **Q：数据怎么保证安全？**
   A：敏感数据走私有化/脱敏；密钥放环境变量，不入库。

## 部署要点
- 知识库接开发者文档/错误码表；接 MCP 查用量。
- 推荐模型：`deepseek-chat`（成本）、`claude`（复杂）。
- 参见：../技术资料/互联网科技-大模型应用指引.md
