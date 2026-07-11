/**
 * 外部技能市场「精选目录」（安全接入方案）
 * ----------------------------------------------------------------
 * 不实时联网、不在服务器执行任意代码；仅把可信的 MCP 服务器配置 /
 * 声明式技能包 / 工作流模板一键加入你自己的平台，连接凭证由用户本地填写。
 *
 * 来源覆盖：官方 MCP Registry、mcp.so、Smithery、Coze 商店、Dify 市场等。
 * 一键安装时：
 *   - kind=mcp      → 写入 MCP 服务器配置（需用户自行补充 env/密钥后连接）
 *   - kind=skill    → 写入用户技能库（prompt 类，走统一 AI 网关）
 *   - kind=link     → 仅跳转外部市场，不下发配置
 */
import type { MCPServerConfig } from '../services/mcp.service';
import type { SkillPackage } from './package-types';

export type CatalogKind = 'mcp' | 'skill' | 'link';

export interface ExternalMarketEntry {
  id: string;
  name: string;
  source: string; // 来源市场
  kind: CatalogKind;
  category: string;
  description: string;
  officialUrl?: string;
  /** 安装后给用户的提示（如需要自行填写的密钥） */
  installHint?: string;
  mcpConfig?: MCPServerConfig;
  skillPackage?: SkillPackage;
}

const CATALOG: ExternalMarketEntry[] = [
  // ───────── MCP 服务器（官方 / 社区可信源） ─────────
  {
    id: 'mcp-filesystem',
    name: 'Filesystem 文件系统',
    source: '官方 MCP Registry',
    kind: 'mcp',
    category: '文件系统',
    description: '读写本地文件系统的 MCP 服务器，可用于文档处理、代码读取等 Agent 工具流。',
    officialUrl: 'https://github.com/modelcontextprotocol/servers/tree/main/src/filesystem',
    installHint: '安装后请将 args 中的目录改为你允许访问的路径，再点击「连接」。',
    mcpConfig: {
      id: 'mcp-filesystem',
      name: 'Filesystem 文件系统',
      description: '本地文件系统读写（官方 MCP）',
      transport: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem', '.'],
      enabled: false,
      status: 'disconnected',
    },
  },
  {
    id: 'mcp-github',
    name: 'GitHub 代码仓库',
    source: '官方 MCP Registry',
    kind: 'mcp',
    category: '开发运维',
    description: '通过 GitHub API 管理仓库、Issue、PR 的 MCP 服务器，赋能研发类 Agent。',
    officialUrl: 'https://github.com/modelcontextprotocol/servers/tree/main/src/github',
    installHint: '连接前请在 env 中填入你的 GITHUB_TOKEN。',
    mcpConfig: {
      id: 'mcp-github',
      name: 'GitHub 代码仓库',
      description: 'GitHub API MCP（官方）',
      transport: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-github'],
      env: { GITHUB_TOKEN: 'YOUR_GITHUB_TOKEN' },
      enabled: false,
      status: 'disconnected',
    },
  },
  {
    id: 'mcp-sqlite',
    name: 'SQLite 数据库',
    source: '官方 MCP Registry',
    kind: 'mcp',
    category: '数据',
    description: '对本地 SQLite 数据库执行查询与写入，适合数据类 Agent 工具流。',
    officialUrl: 'https://github.com/modelcontextprotocol/servers/tree/main/src/sqlite',
    installHint: '请将 args 中的数据库路径改为你的 .db 文件位置。',
    mcpConfig: {
      id: 'mcp-sqlite',
      name: 'SQLite 数据库',
      description: 'SQLite MCP（官方）',
      transport: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-sqlite', './data.db'],
      enabled: false,
      status: 'disconnected',
    },
  },
  {
    id: 'mcp-fetch',
    name: 'Fetch 网页抓取',
    source: 'mcp.so',
    kind: 'mcp',
    category: '网络',
    description: '把网页 URL 抓取为 Markdown 的 MCP 服务器，适合联网检索类技能。',
    officialUrl: 'https://mcp.so/server/fetch',
    mcpConfig: {
      id: 'mcp-fetch',
      name: 'Fetch 网页抓取',
      description: '网页抓取 MCP（mcp.so）',
      transport: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-fetch'],
      enabled: false,
      status: 'disconnected',
    },
  },
  {
    id: 'mcp-puppeteer',
    name: 'Puppeteer 浏览器自动化',
    source: 'mcp.so',
    kind: 'mcp',
    category: '网络',
    description: '基于 Puppeteer 的浏览器自动化 MCP，可截图、点击、爬取动态页面。',
    officialUrl: 'https://mcp.so/server/puppeteer',
    mcpConfig: {
      id: 'mcp-puppeteer',
      name: 'Puppeteer 浏览器自动化',
      description: '浏览器自动化 MCP（mcp.so）',
      transport: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-puppeteer'],
      enabled: false,
      status: 'disconnected',
    },
  },
  {
    id: 'mcp-time',
    name: 'Time 时间服务',
    source: '官方 MCP Registry',
    kind: 'mcp',
    category: '工具',
    description: '获取当前时间、时区转换的时间类 MCP 服务器，轻量常用。',
    officialUrl: 'https://github.com/modelcontextprotocol/servers/tree/main/src/time',
    mcpConfig: {
      id: 'mcp-time',
      name: 'Time 时间服务',
      description: '时间 MCP（官方）',
      transport: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-time'],
      enabled: false,
      status: 'disconnected',
    },
  },
  {
    id: 'mcp-sequentialthinking',
    name: 'Sequential Thinking 结构化推理',
    source: '官方 MCP Registry',
    kind: 'mcp',
    category: '推理',
    description: '引导模型做分步、可回溯的结构化推理，提升复杂任务拆解质量。',
    officialUrl: 'https://github.com/modelcontextprotocol/servers/tree/main/src/sequentialthinking',
    mcpConfig: {
      id: 'mcp-sequentialthinking',
      name: 'Sequential Thinking 结构化推理',
      description: '结构化推理 MCP（官方）',
      transport: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-sequentialthinking'],
      enabled: false,
      status: 'disconnected',
    },
  },
  {
    id: 'mcp-brave-search',
    name: 'Brave Search 联网搜索',
    source: 'Smithery',
    kind: 'mcp',
    category: '网络',
    description: '通过 Brave Search API 做联网搜索，为 Agent 提供实时检索能力。',
    officialUrl: 'https://smithery.ai/server/@mcp_server/brave-search',
    installHint: '连接前请在 env 中填入 BRAVE_API_KEY（在 brave.com/search/api 申请）。',
    mcpConfig: {
      id: 'mcp-brave-search',
      name: 'Brave Search 联网搜索',
      description: '联网搜索 MCP（Smithery）',
      transport: 'stdio',
      command: 'npx',
      args: ['-y', '@smithery/mcp-server-brave-search'],
      env: { BRAVE_API_KEY: 'YOUR_BRAVE_API_KEY' },
      enabled: false,
      status: 'disconnected',
    },
  },

  {
    id: 'mcp-memory',
    name: 'Memory 知识图谱记忆',
    source: '官方 MCP Registry',
    kind: 'mcp',
    category: '记忆',
    description: '基于本地知识图谱的长期记忆 MCP，让 Agent 跨会话记住实体与关系。',
    officialUrl: 'https://github.com/modelcontextprotocol/servers/tree/main/src/memory',
    mcpConfig: {
      id: 'mcp-memory',
      name: 'Memory 知识图谱记忆',
      description: '知识图谱记忆 MCP（官方）',
      transport: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-memory'],
      enabled: false,
      status: 'disconnected',
    },
  },
  {
    id: 'mcp-postgres',
    name: 'PostgreSQL 数据库',
    source: '官方 MCP Registry',
    kind: 'mcp',
    category: '数据',
    description: '以只读方式查询 PostgreSQL 数据库并读取表结构，适合数据分析类 Agent。',
    officialUrl: 'https://github.com/modelcontextprotocol/servers/tree/main/src/postgres',
    installHint: '请将 args 末尾的连接串改为你的 PostgreSQL 连接地址后再连接。',
    mcpConfig: {
      id: 'mcp-postgres',
      name: 'PostgreSQL 数据库',
      description: 'PostgreSQL 只读查询 MCP（官方）',
      transport: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-postgres', 'postgresql://localhost/mydb'],
      enabled: false,
      status: 'disconnected',
    },
  },
  {
    id: 'mcp-slack',
    name: 'Slack 协作',
    source: '官方 MCP Registry',
    kind: 'mcp',
    category: '协作',
    description: '读写 Slack 频道消息、拉取历史与用户信息的 MCP，赋能团队协作类 Agent。',
    officialUrl: 'https://github.com/modelcontextprotocol/servers/tree/main/src/slack',
    installHint: '连接前请在 env 中填入 SLACK_BOT_TOKEN 与 SLACK_TEAM_ID。',
    mcpConfig: {
      id: 'mcp-slack',
      name: 'Slack 协作',
      description: 'Slack MCP（官方）',
      transport: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-slack'],
      env: { SLACK_BOT_TOKEN: 'YOUR_SLACK_BOT_TOKEN', SLACK_TEAM_ID: 'YOUR_TEAM_ID' },
      enabled: false,
      status: 'disconnected',
    },
  },
  {
    id: 'mcp-google-maps',
    name: 'Google Maps 地图',
    source: '官方 MCP Registry',
    kind: 'mcp',
    category: '工具',
    description: '地理编码、路线规划、地点检索的地图 MCP，为出行/本地服务类 Agent 提供空间能力。',
    officialUrl: 'https://github.com/modelcontextprotocol/servers/tree/main/src/google-maps',
    installHint: '连接前请在 env 中填入 GOOGLE_MAPS_API_KEY。',
    mcpConfig: {
      id: 'mcp-google-maps',
      name: 'Google Maps 地图',
      description: 'Google Maps MCP（官方）',
      transport: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-google-maps'],
      env: { GOOGLE_MAPS_API_KEY: 'YOUR_GOOGLE_MAPS_API_KEY' },
      enabled: false,
      status: 'disconnected',
    },
  },
  {
    id: 'mcp-gitlab',
    name: 'GitLab 代码仓库',
    source: '官方 MCP Registry',
    kind: 'mcp',
    category: '开发运维',
    description: '管理 GitLab 项目、Issue 与合并请求的 MCP，适配企业内部研发流程 Agent。',
    officialUrl: 'https://github.com/modelcontextprotocol/servers/tree/main/src/gitlab',
    installHint: '连接前请在 env 中填入 GITLAB_PERSONAL_ACCESS_TOKEN（私有部署再改 GITLAB_API_URL）。',
    mcpConfig: {
      id: 'mcp-gitlab',
      name: 'GitLab 代码仓库',
      description: 'GitLab MCP（官方）',
      transport: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-gitlab'],
      env: { GITLAB_PERSONAL_ACCESS_TOKEN: 'YOUR_GITLAB_TOKEN', GITLAB_API_URL: 'https://gitlab.com/api/v4' },
      enabled: false,
      status: 'disconnected',
    },
  },
  {
    id: 'mcp-everything',
    name: 'Everything 参考服务器',
    source: '官方 MCP Registry',
    kind: 'mcp',
    category: '工具',
    description: '官方参考实现，覆盖 prompts/resources/tools 全特性，适合调试与学习 MCP 协议。',
    officialUrl: 'https://github.com/modelcontextprotocol/servers/tree/main/src/everything',
    mcpConfig: {
      id: 'mcp-everything',
      name: 'Everything 参考服务器',
      description: 'MCP 全特性参考实现（官方）',
      transport: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-everything'],
      enabled: false,
      status: 'disconnected',
    },
  },

  // ───────── 声明式技能包（prompt 类，安装即入库） ─────────
  {
    id: 'skill-weekly-report',
    name: '周报生成器',
    source: 'Reasonix 精选',
    kind: 'skill',
    category: '生产力',
    description: '输入本周工作要点，自动整理为结构化的周报（含进展/风险/下周计划）。',
    skillPackage: {
      schema: 'reasonix.skill/1.0',
      manifest: {
        id: 'weekly-report',
        name: '周报生成器',
        description: '把本周工作要点整理为结构化周报。',
        division: 'productivity',
        color: '#6366f1',
        coreMission: '降低周报撰写成本， standardized 输出。',
        criticalRules: ['必须包含「本周进展 / 风险阻塞 / 下周计划」三段', '语言简洁、可量化'],
        successMetrics: ['输出结构完整', '要点可量化'],
        minRole: 'none',
        requireAuth: false,
        marketable: true,
        tags: ['周报', '生产力'],
      },
      kind: 'prompt',
      prompt: {
        system: '你是高效的职场助理。把用户给的零散工作要点，整理为专业周报。',
        userTemplate:
          '请基于以下本周工作要点生成周报，三段式：1) 本周进展 2) 风险与阻塞 3) 下周计划。\n要点：{{input}}',
        maxTokens: 800,
        temperature: 0.4,
      },
    },
  },
  {
    id: 'skill-code-reviewer',
    name: '代码审查官',
    source: 'Reasonix 精选',
    kind: 'skill',
    category: '工程',
    description: '粘贴代码或 PR diff，输出问题清单、风险等级与改进建议。',
    skillPackage: {
      schema: 'reasonix.skill/1.0',
      manifest: {
        id: 'code-reviewer',
        name: '代码审查官',
        description: '对代码做审查，输出问题清单与改进建议。',
        division: 'engineering',
        color: '#14b8a6',
        coreMission: '在合并前发现潜在缺陷与可维护性问题。',
        criticalRules: ['按严重程度分级（阻断/重要/建议）', '每条问题给出修改示例'],
        successMetrics: ['问题分级清晰', '建议可执行'],
        minRole: 'none',
        requireAuth: false,
        marketable: true,
        tags: ['代码审查', '工程'],
      },
      kind: 'prompt',
      prompt: {
        system:
          '你是资深代码审查专家。请严格输出 JSON：{ "issues": [{"severity":"阻断|重要|建议","file":"","desc":"","fix":""}] }。',
        userTemplate: '请审查以下代码/变更：\n```\n{{input}}\n```',
        maxTokens: 1000,
        temperature: 0.2,
      },
    },
  },
  {
    id: 'skill-xhs-copy',
    name: '小红书爆款文案',
    source: 'Reasonix 精选',
    kind: 'skill',
    category: '创作',
    description: '输入产品/主题，生成符合小红书风格的标题+正文+话题标签。',
    skillPackage: {
      schema: 'reasonix.skill/1.0',
      manifest: {
        id: 'xhs-copy',
        name: '小红书爆款文案',
        description: '生成小红书风格种草文案。',
        division: 'media',
        color: '#ec4899',
        coreMission: '产出高点击率的小红书笔记文案。',
        criticalRules: ['语气亲切、带 emoji', '结尾附 3-5 个 #话题'],
        successMetrics: ['标题有钩子', '话题标签合规'],
        minRole: 'none',
        requireAuth: false,
        marketable: true,
        tags: ['小红书', '文案', '创作'],
      },
      kind: 'prompt',
      prompt: {
        system: '你是小红书爆款文案专家，擅长种草与情绪价值表达。',
        userTemplate: '请为以下产品/主题写一条小红书笔记（含标题、正文、话题标签）：{{input}}',
        maxTokens: 800,
        temperature: 0.8,
      },
    },
  },

  // ───────── 外部市场入口（仅跳转，不下发配置） ─────────
  {
    id: 'link-mcp-so',
    name: 'mcp.so 市场',
    source: 'mcp.so',
    kind: 'link',
    category: '市场',
    description: '全球最大的 MCP 服务器发现平台，按类别浏览数千个社区服务器。',
    officialUrl: 'https://mcp.so',
  },
  {
    id: 'link-smithery',
    name: 'Smithery',
    source: 'Smithery',
    kind: 'link',
    category: '市场',
    description: '托管式 MCP 服务器注册中心，支持 SSE 一键接入。',
    officialUrl: 'https://smithery.ai',
  },
  {
    id: 'link-official-registry',
    name: 'Model Context Protocol 官方 Registry',
    source: '官方',
    kind: 'link',
    category: '市场',
    description: 'Anthropic 官方维护的 MCP 服务器与客户端列表。',
    officialUrl: 'https://modelcontextprotocol.io/examples',
  },
  {
    id: 'link-coze',
    name: 'Coze 商店',
    source: 'Coze',
    kind: 'link',
    category: '市场',
    description: '字节跳动 Coze 的 Bot/插件商店，可参考其工作流与插件思路。',
    officialUrl: 'https://www.coze.cn/store',
  },
  {
    id: 'link-dify',
    name: 'Dify 市场',
    source: 'Dify',
    kind: 'link',
    category: '市场',
    description: 'Dify 的 Agent/工作流/模型市场，可参考其工具流编排范式。',
    officialUrl: 'https://marketplace.dify.ai',
  },
];

export function getCatalog(): ExternalMarketEntry[] {
  return CATALOG;
}

export function getCatalogEntry(id: string): ExternalMarketEntry | undefined {
  return CATALOG.find((e) => e.id === id);
}
