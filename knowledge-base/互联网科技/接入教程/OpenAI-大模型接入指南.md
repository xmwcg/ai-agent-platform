---
title: OpenAI 大模型接入指南
industry: 互联网科技
category: 接入教程
vendor: OpenAI
tags: [openai, gpt, llm, api, baseurl, 海外]
sourceUrl: https://platform.openai.com/docs/api-reference
fetchedAt: 2026-07-21
requiredPlan: free
creditsCost: 0
freePreviewPages: 0
---

# OpenAI 大模型接入指南

## 1. 官方资源
- 文档中心：https://platform.openai.com/docs
- API 参考：https://platform.openai.com/docs/api-reference
- API Keys：https://platform.openai.com/api-keys
- 价格页：https://openai.com/api/pricing

## 2. 接入地址
- BaseURL：`https://api.openai.com/v1`
- 协议：OpenAI Chat Completions 标准，兼容绝大多数 SDK（`openai` / `langchain` / 本平台 `provider-catalog`）。

## 3. 主要模型（参考，以官方价格页为准）

| 模型 ID | 特点 | 上下文 | 参考价格（输入/输出，每百万 tokens） |
|------|------|------|------|
| gpt-4o | 多模态旗舰，均衡 | 128K | 约 $2.5 / $10 |
| gpt-4o-mini | 高性价比 | 128K | 约 $0.15 / $0.6 |
| o1 / o3 | 推理增强（思维链） | 200K | 较高，按官方 |
| gpt-5 系列（如已发布） | 最新旗舰 | 256K+ | 以官方为准 |

> 注：模型迭代快，调用前以 `GET /v1/models` 拉取可用列表为准。

## 4. API Key 申请
1. 注册并登录 platform.openai.com；
2. 进入 API Keys → Create new secret key；
3. 绑定付款方式（海外信用卡）后方可调用；
4. 复制到安全位置（仅显示一次）。

## 5. 平台配置
在 `.env` 设置（对应 `provider-catalog.ts` 的 `openai` 条目）：
```
OPENAI_API_KEY=sk-...
OPENAI_BASE_URL=https://api.openai.com/v1
```
> 安全：本知识库仅记录「获取方式」，**不存储真实 key**。

## 6. 调用示例
**curl**
```bash
curl https://api.openai.com/v1/chat/completions \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"gpt-4o-mini","messages":[{"role":"user","content":"你好"}],"stream":true}'
```
**Node.js**
```js
import OpenAI from 'openai';
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const r = await client.chat.completions.create({ model: 'gpt-4o-mini', messages: [{ role: 'user', content: '你好' }], stream: true });
```
**Python**
```python
from openai import OpenAI
c = OpenAI()
for chunk in c.chat.completions.create(model="gpt-4o-mini", messages=[{"role":"user","content":"你好"}], stream=True):
    print(chunk.choices[0].delta.content or "", end="")
```

## 7. 适用场景
通用对话、代码生成、函数调用（Tool Calling）、多模态理解、Agent 编排。

## 8. 参考来源
- https://platform.openai.com/docs/api-reference
- https://openai.com/api/pricing
