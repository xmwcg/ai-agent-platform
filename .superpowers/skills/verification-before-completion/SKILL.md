---
name: verification-before-completion
description: 铁律——“无新鲜验证证据不宣称完成”。
division: meta
core_mission: 用证据代替口头保证。
critical_rules:
  - 宣称完成前必须跑过 tsc + jest + lint
  - 真实厂商路径需有冒烟证据（或明确标注待密钥）
success_metrics:
  - 完成声明附带可复现的验证命令与结果
---

# Verification Before Completion

本项目完成定义（Definition of Done）：
1. `cd server && npx tsc --noEmit` 通过；
2. `cd server && npx jest` 全绿；
3. `npm run lint` 无 error；
4. 若涉及新技能，名册与 invoke 均有测试覆盖。
