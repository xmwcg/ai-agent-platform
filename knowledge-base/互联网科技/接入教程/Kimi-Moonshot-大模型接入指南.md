---
title: Kimi（月之暗面 Moonshot）大模型接入指南
industry: 互联网科技
category: 接入教程
vendor: Moonshot AI
tags: [kimi, moonshot, 月之暗面, 国产, llm, baseurl, 长文本]
sourceUrl: https://platform.moonshot.cn/docs
fetchedAt: 2026-07-21
requiredPlan: free
creditsCost: 0
freePreviewPages: 0
---

# Kimi（月之暗面 Moonshot）大模型接入指南

## 1. 官方资源
- 开放平台：https://platform.moonshot.cn
- 文档：https://platform.moonshot.cn/docs
- 价格：https://platform.moonshot.cn/pricing

## 2. 接入地址
- BaseURL：`https://api.moonshot.cn/v1`（OpenAI 兼容）
- 长上下文是 Kimi 核心优势（最高 128K~200K+）。

## 3. 主要模型（参考，以官方为准）

| 模型 ID | 特点 | 上下文 | 参考价格（每百万 tokens，输入/输出） |
|------|------|------|------|
| moonshot-v1-8k / kimi-latest-8k | 短上下文均衡 | 8K | 约 ¥2 / ¥10（2025-04 调价后） |
| moonshot-v1-32k | 中等 | 32K | 略高 |
| moonshot-v1-128k | 长文 | 128K | 约 ¥5 / ¥25 |
| moonshot-v1-*-vision | 多模态图片理解 | — | 视觉 12/24/60 元每百万 |

> 2025-04 起大幅降价：多款模型输入降至 2 元/百万，输出 10 元/百万；新用户赠 15 元额度。

## 4. API Key 申请
1. 注册 platform.moonshot.cn；
2. API Key 管理 → 创建；
3. 国内支付。

## 5. 平台配置
```
KIMI_API_KEY=sk-...
KIMI_BASE_URL=https://api.moonshot.cn/v1
```

## 6. 调用示例
```js
import OpenAI from 'openai';
const c = new OpenAI({ apiKey: process.env.KIMI_API_KEY, baseURL: 'https://api.moonshot.cn/v1' });
const r = await c.chat.completions.create({ model: 'moonshot-v1-8k', messages: [{ role: 'user', content: '总结这篇长文' }] });
```

## 7. 适用场景
超长文档阅读/摘要、法律合同、论文、研报、知识库问答。

## 8. 参考来源
- https://platform.moonshot.cn/docs
- https://platform.moonshot.cn/pricing
- Kimi 2025-04 调价公告
