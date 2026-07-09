# Superpowers 开发方法论（已安装到本项目）

> 来源：`obra/superpowers`（[GitHub](https://github.com/obra/superpowers)）——
> 一套面向 AI 编码代理的工程化「行为操作系统」。本文件把它的核心纪律安装到本项目的日常开发中。

## 1. 这是什么
Superpowers 不是运行时组件，而是一组**可组合的 `SKILL.md`**（带 frontmatter 元数据），强制编码代理在写代码前先走工程流程：
`brainstorming` → `writing-plans` → `subagent-driven-development` / `executing-plans`
→ `test-driven-development` / `systematic-debugging` / `code-review` → `verification-before-completion`。

**与本项目的关系**：它用来**更好地开发这个平台本身**，而不是作为功能集成进 `skills/defs`。
我们已按 agency-agents 协议做了技能层（`skills/`），其 manifest+invoke 思路与 superpowers 的 `SKILL.md` frontmatter 同构。

## 2. 安装方式（两种，互补）

### 2.1 在你的编码代理里启用插件（推荐，体验最完整）
```bash
# Claude Code
/plugin marketplace add obra/superpowers-marketplace
/plugin install superpowers@superpowers-marketplace

# Cursor / Codex / OpenCode / Gemini CLI：见 obra/superpowers 仓库 .cursor-plugin / .codex / .opencode / gemini-extension 适配文件
```
> 提示：安装命令会向你的编码环境注册外部技能仓库，请确认来源可信后再执行。

### 2.2 已随项目仓库内置（本仓库已 vendored，零依赖可用）
仓库根目录 `.superpowers/skills/` 已落地核心技能的 Markdown 参考（与 obra/superpowers 同 frontmatter 格式）：
- `using-superpowers`（总控开关）
- `brainstorming`（需求澄清 → spec）
- `writing-skills`（沉淀新技能，对应平台 `skill-authoring`）
- `test-driven-development`（TDD 铁律）
- `verification-before-completion`（完成前验证铁律）

这些文件由本平台 `develop` 流程自动对齐，作为团队日常开发的「行为基准」，无需任何外部插件即可遵循。

## 3. 本项目落地的「纪律铁律」（开发任何功能前默念）
1. **先 spec 后实现**：复杂改动先写方案（含用户故事 + 验收标准），不要直觉式直接改代码。
2. **TDD**：新增/修改行为先补测试，跑红再写实现。
3. **系统化调试**：无根因调查不修；改完用 `npm run test:server` 验证。
4. **验证先于完成声明**：`tsc` + `jest` + `lint` 全绿才算完成，不口说"应该没问题"。
5. **技能可沉淀**：任何可复用的能力，按下方「技能 spec 规范」写成 `skills/defs/*.skill.ts`，并可上架开放 API 市场。

## 4. 技能 spec 规范（对齐 superpowers frontmatter）
每个 `SkillManifest` 在已有的 `id/name/description/division/color/coreMission/criticalRules/successMetrics/quotaResource/minRole/requireAuth/marketable` 基础上，鼓励补充 superpowers 风格的声明字段（均为可选，定义在 `skills/types.ts`）：
- `userStory`：谁 / 要什么 / 为什么（作为价值锚点）。
- `acceptanceCriteria`：可勾选的验收清单（完成的定义）。
- `qualityCriteria`：非功能约束（延迟 / 兜底 / 可观测）。
- `references`：相关文档或上游技能链接。

## 5. 元技能：skill-authoring（writing-skills 等价物）
平台内置 `skill-authoring` 业务技能（`skills/defs/skill-authoring.skill.ts`），调用统一 AI 网关生成
新技能的 manifest + invoke 骨架，把 superpowers 的 `writing-skills` 范式落地为「平台内可自助沉淀技能」的能力。
调用入口：`POST /api/skills/invoke`（body `{ id: 'skill-authoring', input: { goal, division } }`）。
