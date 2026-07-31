# 金奕鸣通用知识库（Universal Knowledge Base）

> 一套「与大模型 + 各行各业高频主流痛点相关」的公开技术资料汇总：官方文档、模型配置、接入教程、技能/MCP、行业自动应答客服知识库。
> 受 Git 版本管理、可一键导入平台「通用知识库」模块、可服务于未来其他产品。

## 一、分类总览（一级行业 → 目录名）

目录名使用**无斜杠安全写法**，与平台 `knowledge-categories.ts` 的 12 行业一一对应：

| 行业（标签） | 目录名 | industry key |
|------|------|------|
| 互联网/科技 | `互联网科技` | internet-tech |
| 金融 | `金融` | finance |
| 医疗健康 | `医疗健康` | medical |
| 零售/电商 | `零售电商` | retail |
| 教育 | `教育` | education |
| 企业服务 | `企业服务` | enterprise |
| 工业制造 | `工业制造` | manufacturing |
| 政府/公共 | `政府公共` | government |
| 媒体/通信 | `媒体通信` | media |
| 专业服务 | `专业服务` | professional |
| 开源社区 | `开源社区` | opensource |
| 其他 | `其他` | other |

## 二、功能子类（二级，所有行业通用）

每个行业目录下固定 6 个子目录：

| 子目录 | 含义 | functional key |
|------|------|------|
| `官方文档` | 厂商官方文档 / API 参考 / 模型列表 | official-docs |
| `接入教程` | 调用示例 / SDK / 快速上手 / 接入文档 | integration |
| `客服知识库` | 行业自动应答 FAQ / 话术 / 知识条目模板 | cs-kb |
| `技术资料` | 原理 / 最佳实践 / 白皮书 / 案例 | tech |
| `模型配置` | baseURL / 模型 ID / 环境变量名 / 获取 key 入口 | model-config |
| `技能MCP` | MCP Server / 技能 / Agent 列表与调用 | skills-mcp |

## 三、文档命名规范

- 文件名：`厂商-主题.md`，例如 `DeepSeek-官方文档.md`、`OpenAI-接入教程.md`、`智谱GLM-模型配置.md`。
- 多厂商通用主题用 `通用-主题.md`，例如 `通用-提示词工程.md`。
- 行业客服知识库用 `行业-场景-FAQ.md`，例如 `金融-理财顾问-FAQ.md`。

## 四、来源标注约定（Frontmatter）

每篇文档**开头必须**包含 YAML frontmatter，便于导入脚本解析与溯源：

```markdown
---
title: DeepSeek 官方文档与模型配置
industry: 金融              # 一级行业标签（对应上表）
category: 模型配置          # 二级功能子类标签
vendor: DeepSeek            # 厂商/项目名（无则留空）
tags: [deepseek, llm, api, baseurl]
sourceUrl: https://platform.deepseek.com/api-docs   # 官方来源（必填，可验证）
fetchedAt: 2026-07-21       # 采集日期
requiredPlan: free          # 文档查看所需最低会员：free | pro | max
creditsCost: 0              # 查看/下载消耗积分（0=免费）
freePreviewPages: 0         # 免费试看页数（长文档用）
---

正文…
```

**安全前提**：本库**只采集公开官方资料**（文档链接、baseURL、模型列表、官方定价、获取 API Key 的方式与接入教程）。**不存储真实 secret key**——厂商 key 一律以「平台 `provider-catalog` 环境变量占位 + 获取指引」形式呈现，例如：

> 申请地址：https://platform.deepseek.com （登录后「API Keys」页面创建）
> 平台配置：在 `.env` 设置 `DEEPSEEK_API_KEY=sk-xxx`，对应 `provider-catalog.ts` 的 `deepseek` 条目。

## 五、导入平台

由 `server/src/scripts/importKnowledgeBase.ts` 读取本目录树，解析 frontmatter，批量 UPSERT 进 MongoDB 的 `KnowledgeDocument`（复用现有 `通用知识库` 模块）。运行：

```bash
npm run seed:kb          # 等价于 ts-node server/src/scripts/importKnowledgeBase.ts
```

导入逻辑只增不改模型结构，向后兼容现有 `/knowledge` 列表、详情、搜索、商业化分层（免费/会员/积分/试看）。

## 六、版本与维护

- v1（广度优先）：12 行业 × 主流厂商代表性资料，建立「通用全通」骨架。
- v2（深度优先）：金融 / 零售电商 / 医疗 / 教育 等高频行业逐条可验证补强，沉淀「行业自动应答客服知识库」模板。
- 所有资料附 `sourceUrl` + `fetchedAt`，便于定期复查时效。
