---
title: Anthropic Claude 大模型接入指南
industry: 互联网科技
category: 接入教程
vendor: Anthropic
tags: [anthropic, claude, llm, api, baseurl, 海外]
sourceUrl: https://docs.anthropic.com/en/api
fetchedAt: 2026-07-21
requiredPlan: free
creditsCost: 0
freePreviewPages: 0
---

# Anthropic Claude 大模型接入指南

## 1. 官方资源
- 文档：https://docs.anthropic.com
- API 参考：https://docs.anthropic.com/en/api
- 控制台/Key：https://console.anthropic.com
- 价格：https://www.anthropic.com/pricing

## 2. 接入地址
- BaseURL：`https://api.anthropic.com`
- 版本头：`anthropic-version: 2023-06-01`（或 `x-api-key` 鉴权）。
- 兼容模式：可通过第三方网关转 OpenAI 格式；本平台 `provider-catalog` 含 `claude` 直连接入。

## 3. 主要模型（参考，以官方为准）

| 模型 ID | 特点 | 上下文 | 参考价格（每百万 tokens） |
|------|------|------|------|
| claude-opus-4 / opus | 最强推理与长文 | 200K | 较高 |
| claude-sonnet-4 / sonnet | 均衡性价比 | 200K | 中等 |
| claude-haiku-4 / haiku | 极速低成本 | 200K | 低 |

## 4. API Key 申请
1. 登录 console.anthropic.com → API Keys → Create Key；
2. 需绑定海外支付方式；
3. 仅显示一次，妥善保存。

## 5. 平台配置
```
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_BASE_URL=https://api.anthropic.com
```

## 6. 调用示例
**curl**
```bash
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{"model":"claude-sonnet-4","max_tokens":1024,"messages":[{"role":"user","content":"你好"}]}'
```
**Python（官方 SDK）**
```python
import anthropic
c = anthropic.Anthropic()
r = c.messages.create(model="claude-sonnet-4", max_tokens=1024, messages=[{"role":"user","content":"你好"}])
print(r.content[0].text)
```

## 7. 适用场景
长文档分析、代码助手、严谨推理、Agent、企业知识处理。

## 8. 参考来源
- https://docs.anthropic.com/en/api
- https://www.anthropic.com/pricing
