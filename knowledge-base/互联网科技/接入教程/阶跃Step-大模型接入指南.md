---
title: 阶跃 Step（StepFun）大模型接入指南
industry: 互联网科技
category: 接入教程
vendor: 阶跃星辰
tags: [stepfun, 阶跃, step, 国产, llm, baseurl]
sourceUrl: https://platform.stepfun.com
fetchedAt: 2026-07-21
requiredPlan: free
creditsCost: 0
freePreviewPages: 0
---

# 阶跃 Step（StepFun）大模型接入指南

## 1. 官方资源
- 开放平台：https://platform.stepfun.com
- 文档中心：https://platform.stepfun.com/docs
- 价格：https://platform.stepfun.com/pricing

## 2. 接入地址
- BaseURL：`https://api.stepfun.com/v1`（OpenAI 兼容）

## 3. 主要模型（参考，以官方为准）

| 模型 ID | 特点 |
|------|------|
| step-2 / step-2-mini | 旗舰推理 |
| step-1v / step-1.5v | 多模态视觉 |
| step-lite | 轻量 |
| step-r1 | 推理增强 |

> 价格以官方为准；新用户赠送额度。

## 4. API Key 申请
1. 注册 platform.stepfun.com；
2. API Keys → 创建；
3. 国内支付。

## 5. 平台配置
```
STEPFUN_API_KEY=...
STEPFUN_BASE_URL=https://api.stepfun.com/v1
```

## 6. 调用示例
```js
import OpenAI from 'openai';
const c = new OpenAI({ apiKey: process.env.STEPFUN_API_KEY, baseURL: 'https://api.stepfun.com/v1' });
const r = await c.chat.completions.create({ model: 'step-2-mini', messages: [{ role: 'user', content: '你好' }] });
```

## 7. 适用场景
多模态、Agent、长文、国产合规场景。

## 8. 参考来源
- https://platform.stepfun.com
- https://platform.stepfun.com/docs
