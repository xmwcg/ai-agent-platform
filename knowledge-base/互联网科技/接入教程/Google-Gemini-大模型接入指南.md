---
title: Google Gemini 大模型接入指南
industry: 互联网科技
category: 接入教程
vendor: Google
tags: [google, gemini, llm, api, baseurl, 海外]
sourceUrl: https://ai.google.dev/gemini-api/docs
fetchedAt: 2026-07-21
requiredPlan: free
creditsCost: 0
freePreviewPages: 0
---

# Google Gemini 大模型接入指南

## 1. 官方资源
- 文档：https://ai.google.dev/gemini-api/docs
- API Key：https://aistudio.google.com/apikey
- 价格：https://ai.google.dev/gemini-api/docs/pricing

## 2. 接入地址
- BaseURL：`https://generativelanguage.googleapis.com/v1beta`
- 也提供 OpenAI 兼容网关（`https://generativelanguage.googleapis.com/v1beta/openai/`），便于迁移。

## 3. 主要模型（参考，以官方为准）

| 模型 ID | 特点 | 上下文 | 备注 |
|------|------|------|------|
| gemini-2.5-pro | 旗舰多模态 | 1M+ | 强推理 |
| gemini-2.5-flash | 高性价比 | 1M | 低延迟 |
| gemini-2.0-flash / flash-lite | 轻量 | 1M | 低成本 |

## 4. API Key 申请
1. 打开 aistudio.google.com/apikey；
2. 使用 Google 账号登录并创建 Key；
3. 免费层有额度与速率限制，付费需绑定卡片。

## 5. 平台配置
```
GEMINI_API_KEY=AIza...
GEMINI_BASE_URL=https://generativelanguage.googleapis.com/v1beta
```

## 6. 调用示例
**curl（generateContent）**
```bash
curl "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=$GEMINI_API_KEY" \
  -H "content-type: application/json" \
  -d '{"contents":[{"parts":[{"text":"你好"}]}]}'
```
**Python**
```python
import google.generativeai as genai
genai.configure(api_key="AIza...")
m = genai.GenerativeModel("gemini-2.5-flash")
print(m.generate_content("你好").text)
```

## 7. 适用场景
超长上下文、多模态（图/音/视频）、检索增强、海量文档处理。

## 8. 参考来源
- https://ai.google.dev/gemini-api/docs
- https://ai.google.dev/gemini-api/docs/pricing
