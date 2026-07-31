---
title: DeepSeek 大模型接入指南
industry: 互联网科技
category: 接入教程
vendor: DeepSeek
tags: [deepseek, llm, api, baseurl, 国产, 推理]
sourceUrl: https://platform.deepseek.com/api-docs
fetchedAt: 2026-07-21
requiredPlan: free
creditsCost: 0
freePreviewPages: 0
---

# DeepSeek 大模型接入指南

## 1. 官方资源
- 文档：https://platform.deepseek.com/api-docs / https://api-docs.deepseek.com
- 价格：https://platform.deepseek.com/usage
- API Keys：https://platform.deepseek.com/api_keys

## 2. 接入地址
- BaseURL：`https://api.deepseek.com`（OpenAI 兼容 `/v1/chat/completions`）
- 协议：与 OpenAI Chat Completions **完全兼容**，迁移只需改 base_url 与 model。

## 3. 主要模型（参考，以官方为准）

| 模型 ID | 特点 | 上下文 | 参考价格（每百万 tokens，输入/输出） |
|------|------|------|------|
| deepseek-chat (V3) | 通用旗舰，性价比极高 | 64K | 约 ¥1 / ¥4（V3 系低价） |
| deepseek-reasoner (R1) | 强化推理（思维链） | 64K | 约 ¥4 / ¥16 |
| deepseek-v4 / v4-flash（2026 发布） | 1M 上下文 + Thinking | 1M | Flash 输入约为 OpenAI 的 1/89（官方宣称） |

> 价格以官方 usage 页为准；DeepSeek 以「低价高性能」著称，是成本敏感场景首选。

## 4. API Key 申请
1. 注册 platform.deepseek.com；
2. API Keys → 创建；
3. 新用户通常有赠送额度，调用前需充值（人民币，国内支付便捷）。

## 5. 平台配置
```
DEEPSEEK_API_KEY=sk-...
DEEPSEEK_BASE_URL=https://api.deepseek.com
```

## 6. 调用示例
**curl**
```bash
curl https://api.deepseek.com/v1/chat/completions \
  -H "Authorization: Bearer $DEEPSEEK_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"deepseek-chat","messages":[{"role":"user","content":"你好"}],"stream":true}'
```
**Node.js（OpenAI SDK 直连，仅改 baseURL）**
```js
import OpenAI from 'openai';
const client = new OpenAI({ apiKey: process.env.DEEPSEEK_API_KEY, baseURL: 'https://api.deepseek.com' });
const r = await client.chat.completions.create({ model: 'deepseek-chat', messages: [{ role: 'user', content: '你好' }] });
```

## 7. 适用场景
推理任务、代码、数学、中文场景、成本敏感型批量调用、RAG。

## 8. 参考来源
- https://platform.deepseek.com/api-docs
- https://platform.deepseek.com/usage
- 腾讯云开发者社区 DeepSeek V4 指南（2026-04）
