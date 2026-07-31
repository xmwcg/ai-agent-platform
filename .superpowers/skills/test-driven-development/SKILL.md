---
name: test-driven-development
description: 铁律——“无失败测试不写生产代码”。
division: engineering
core_mission: 用测试锁住行为，降低回归风险。
critical_rules:
  - 先写失败测试，再写最小实现使其变绿
  - 重构时不破坏已有测试
  - 新行为必须可测
success_metrics:
  - 新增逻辑有对应测试
  - 全量测试在 CI / 本地均为绿
---

# Test Driven Development

本项目纪律：`npm run test:server` 全绿才算完成。
新增技能时，同步在 `skills.test.ts` 增加名册与 invoke 断言（见 `skill-authoring` 示范）。
