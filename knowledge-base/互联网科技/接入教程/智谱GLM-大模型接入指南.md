---
title: 智谱 GLM 大模型接入指南
industry: 互联网科技
category: 接入教程
vendor: 智谱AI
tags: [zhipu, glm, bigmodel, 国产, llm, baseurl]
sourceUrl: https://open.bigmodel.cn/dev/api
fetchedAt: 2026-07-21
requiredPlan: free
creditsCost: 0
freePreviewPages: 0
---

# 智谱 GLM 大模型接入指南

## 1. 官方资源
- 开放平台：https://open.bigmodel.cn
- API 文档：https://open.bigmodel.cn/dev/api
- 价格/计费：https://open.bigmodel.cn/api/price

## 2. 接入地址
- BaseURL：`https://open.bigmodel.cn/api/paas/v4`（OpenAI 兼容）
- 兼容 Claude Code 框架（GLM-4.5 起支持一键兼容）。

## 3. 主要模型（参考，以官方为准）

| 模型 ID | 特点 | 参考价格（每百万 tokens） |
|------|------|------|
| glm-4.5（开源） | 最新旗舰，强推理 | 输入约 ¥0.8 / 输出约 ¥2（官方宣称） |
| glm-4-plus | 通用旗舰 | 降价后约 ¥5 / 百万（原 ¥50） |
| glm-4-air | 均衡 | 约 ¥0.6 / 百万 |
| glm-4-flash | 极速免费级 | 约 ¥0.06 / 百万（低价标杆） |
| glm-z1-air / z1-airx | 推理增强 | 低至 ¥0.5 / 亿 tokens |

> 智谱多次大幅降价，国产性价比第一梯队；新用户注册送额度（曾 2500 万 tokens）。

## 4. API Key 申请
1. 注册 open.bigmodel.cn；
2. 用户中心 → API Keys → 新建；
3. 国内支付，充值便捷。

## 5. 平台配置
```
ZHIPU_API_KEY=...
ZHIPU_BASE_URL=https://open.bigmodel.cn/api/paas/v4
```

## 6. 调用示例
**curl（OpenAI 兼容）**
```bash
curl https://open.bigmodel.cn/api/paas/v4/chat/completions \
  -H "Authorization: Bearer $ZHIPU_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"glm-4-plus","messages":[{"role":"user","content":"你好"}],"stream":true}'
```

## 7. 适用场景
中文对话、代码、数据分析、金融/互联网/企服/教育多行业、低成本大规模调用。

## 8. 参考来源
- https://open.bigmodel.cn/dev/api
- https://open.bigmodel.cn/api/price
- 智谱 GLM-4.5 开源公告（2025）、GLM-4-Plus 降价公告（2025-04）
