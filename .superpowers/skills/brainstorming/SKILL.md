---
name: brainstorming
description: 需求澄清与设计。输出 spec 文档，禁止过早实现。
division: meta
core_mission: 在写任何代码前，先理解上下文、提问、形成可评审的方案。
critical_rules:
  - 不猜测需求，先提问澄清目标与约束
  - 产出 spec（用户故事 + 验收标准），而非直接实现
  - 范围蔓延时回到 spec 对齐
success_metrics:
  - 关键歧义被提前消除
  - 方案获得干系人认可后再动手
---

# Brainstorming

需求澄清范式（obra/superpowers）。开发本平台任何功能前：
- 用一两段话说清「谁 / 要什么 / 为什么」；
- 列出验收标准（完成的定义）；
- 明确非功能约束（延迟 / 兜底 / 可观测）。

对应本项目：技能 manifest 的 `userStory` / `acceptanceCriteria` / `qualityCriteria` 即该范式的结构化落地。
