---
name: using-superpowers
description: 总控开关。任何开发任务开始前，先判断并调用适用的技能；禁止模型直觉式直接进入实现。
division: meta
core_mission: 让代理在写代码前先走工程流程，把纪律注入协作。
critical_rules:
  - 收到任务先决定「该用哪个技能」，而不是直接写代码
  - 没有匹配技能时，先用 brainstorming 澄清，再考虑 writing-skills 沉淀新技能
  - 违反流程时主动停下来说明，而不是默默绕过
success_metrics:
  - 任务开始即有明确的流程选择
  - 复杂任务产出 spec 与 plan 后再落地
---

# Using Superpowers

这是 superpowers 的入口技能（对应 obra/superpowers 的 `using-superpowers`）。
它强制代理在动手前先选择流程：

1. 需要澄清需求？→ `brainstorming`
2. 要转成施工图？→ `writing-plans`
3. 要派子代理执行？→ `subagent-driven-development`
4. 要写测试驱动？→ `test-driven-development`
5. 要调试根因？→ `systematic-debugging`
6. 要审查？→ `requesting-code-review` / `receiving-code-review`
7. 要沉淀经验？→ `writing-skills`

> 本项目已把该纪律安装到 `docs/SUPERPOWERS.md`，并在 `skills/` 协议层做了同构映射。
