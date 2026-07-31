---
name: writing-skills
description: 元技能。把有效经验沉淀为新 skill（自身也按 TDD 思路写）。
division: meta
core_mission: 让代理能自我进化——把可复用能力固化为技能。
critical_rules:
  - 新技能必须有清晰的 manifest（使命 / 规则 / 成功指标）
  - 技能应可独立测试
  - 沉淀前先验证它真的被复用过
success_metrics:
  - 新技能可被 registry 注册并调用
  - 技能 doc 完备，他人可理解复用
---

# Writing Skills

本项目的工程化映射见 `server/src/skills/defs/skill-authoring.skill.ts`：
调用统一 AI 网关生成新技能的 manifest + invoke 骨架，开发者复制到 `defs/` 并注册即可上架。
这是 obra/superpowers `writing-skills` 在「平台运行时」内的等价能力。
