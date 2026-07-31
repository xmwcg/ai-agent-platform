---
title: MCP 与技能（Skills）生态总览
industry: 互联网科技
category: 技能MCP
vendor: MCP / Anthropic
tags: [mcp, skills, agent, 工具调用, 生态, 协议]
sourceUrl: https://modelcontextprotocol.io
fetchedAt: 2026-07-21
requiredPlan: free
creditsCost: 0
freePreviewPages: 0
---

# MCP 与技能（Skills）生态总览

## 1. 什么是 MCP
- MCP（Model Context Protocol，模型上下文协议）由 Anthropic 提出，是「大模型 ↔ 外部工具/数据源」的开放标准。
- 类比：USB-C 之于设备——统一了模型连接文件系统、数据库、API、浏览器的接口。
- 官方：https://modelcontextprotocol.io ；规范仓库：https://github.com/modelcontextprotocol

## 2. 核心概念
- **MCP Server**：暴露 `tools` / `resources` / `prompts` 能力的进程（stdio 或 SSE/HTTP）。
- **MCP Client / Host**：调用方（如 Claude Desktop、Cursor、本平台「MCP 插件」模块）。
- **Transport**：stdio（本地子进程）或 Streamable HTTP / SSE（远程）。
- **Tools**：可被模型调用的函数（如「查天气」「读数据库」）。

## 3. 主流官方 MCP Server（举例，以官方仓库为准）
- 文件系统 `filesystem`、Git、PostgreSQL、SQLite、Slack、GitHub、Google Drive、Puppeteer（浏览器）、Brave Search、Fetch。
- 官方示例集合：https://github.com/modelcontextprotocol/servers
- 社区聚合：https://mcp.so 、https://glama.ai/mcp

## 4. 接入方式（通用）
1. 在 Host 配置中声明 server 的启动命令或 URL：
```json
{ "mcpServers": { "fs": { "command": "npx", "args": ["-y", "@modelcontextprotocol/server-filesystem", "/data"] } } }
```
2. Host 自动发现 tools，模型在对话中按需调用。
3. 远程 server 用 `url` + `headers`（鉴权）。

## 5. Skills（技能）机制
- 许多平台（含本 AIbak 平台）用「技能（skill）」封装一类可复用能力：提示词模板 + 工具调用编排。
- 技能定义通常含：`name`、触发条件、系统提示词、可用 tools、参数 schema。
- 平台「技能市场」模块即此类；可参考 `server/src/skills/defs/` 的 `*.skill.ts` 结构扩展自有技能。

## 6. Agent 列表与编排
- Agent = 模型 + 记忆 + 工具（MCP/Skills）+ 规划循环（ReAct / Plan-Execute）。
- 主流框架：LangChain、AutoGen、CrewAI、本平台 workflow-engine。
- 选型：单工具用 MCP；多角色协作用多 Agent（CrewAI/AutoGen）。

## 7. 平台对接建议
- 本平台「MCP 插件」模块负责注册远程/本地 MCP Server；
- 「技能市场」负责分发 skills；
- 「AI 对话 / 智能客服」通过 agent 编排调用上述能力，实现 RAG + 工具调用闭环。

## 8. 参考来源
- https://modelcontextprotocol.io
- https://github.com/modelcontextprotocol/servers
- https://mcp.so
