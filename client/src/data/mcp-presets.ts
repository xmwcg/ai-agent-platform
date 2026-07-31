/**
 * MCP 服务器预设库 — 国内外主流 MCP 插件
 *
 * 每个预设包含完整的 id/name/transport/command/args/url/env/description，
 * 可直接用于一键安装或作为添加表单的默认值。
 *
 * 分类说明：
 *  - international — 国外主流（Anthropic 官方 + 社区热门）
 *  - china      — 国内主流（腾讯/阿里/高德/百度/魔搭等）
 *  - search     — AI 搜索 / 网页爬取
 *  - database   — 数据库 / 存储
 *  - dev-tools  — 开发效率 / 项目管理
 *  - platform   — 云平台 / 基础设施
 *  - media      — 媒体 / AI 图片 / 视频
 */

// ─── 常量：标准命令 ───
const NPX = 'npx';
const UVX = 'uvx';
const NODE = 'node';

// ─── 工具函数 ───
function stdioArgs(pkg: string, extra: string[] = []): string {
  return ['-y', pkg, ...extra].join(' ');
}
function uvxArgs(pkg: string, extra: string[] = []): string {
  return [pkg, ...extra].join(' ');
}

// ─── 类型定义 ───
export interface MCPServerPreset {
  id: string;
  name: string;
  description: string;
  category: 'international' | 'china' | 'search' | 'database' | 'dev-tools' | 'platform' | 'media';
  tags: string[];
  transport: 'stdio' | 'sse';
  command?: string;
  args?: string;       // 参数字符串（空格分隔，与 UI 的 textarea 一致）
  url?: string;
  env?: string;        // 环境变量（每行 KEY=VALUE，与 UI 的 textarea 一致）
  envRequired?: string[];  // 必填的环境变量名
  features: string[];
  installSteps: string[];
  npmPackage?: string;
  docsUrl?: string;
  stars?: string;      // GitHub stars 标注
  difficulty: 'easy' | 'medium' | 'hard';
}

// ─────────────────────────────────────────────────────────
// 一、Anthropic 官方 MCP 服务器 (International)
// ─────────────────────────────────────────────────────────

const FILESYSTEM: MCPServerPreset = {
  id: 'mcp-filesystem',
  name: '文件系统',
  description: '让 AI 安全地读写本地文件系统，支持创建/读取/编辑/删除文件和目录。',
  category: 'international',
  tags: ['官方', '文件', '文件系统'],
  transport: 'stdio',
  command: NPX,
  args: '-y @modelcontextprotocol/server-filesystem /data',
  features: [
    '读取/写入文件',
    '创建/删除目录',
    '列出目录结构',
    '文件路径白名单安全控制',
  ],
  installSteps: [
    '确保 Node.js >= 18 已安装',
    '修改 args 中的路径为你允许 AI 访问的目录',
    '保存后点击「连接」启动服务器',
    'AI 即可通过工具读写指定目录',
  ],
  npmPackage: '@modelcontextprotocol/server-filesystem',
  docsUrl: 'https://github.com/modelcontextprotocol/servers/tree/main/src/filesystem',
  stars: '50k+',
  difficulty: 'easy',
};

const GITHUB: MCPServerPreset = {
  id: 'mcp-github',
  name: 'GitHub',
  description: '让 AI 操作 GitHub 仓库、Issue、PR、代码搜索等，自动化开发流程。',
  category: 'international',
  tags: ['官方', 'GitHub', '代码', '仓库'],
  transport: 'stdio',
  command: NPX,
  args: '-y @modelcontextprotocol/server-github',
  env: 'GITHUB_PERSONAL_ACCESS_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx',
  envRequired: ['GITHUB_PERSONAL_ACCESS_TOKEN'],
  features: [
    '创建/管理 Issue 和 PR',
    '搜索代码和仓库',
    '读取文件内容',
    '管理分支和提交',
  ],
  installSteps: [
    '前往 GitHub Settings > Developer settings > Personal access tokens 创建 Token',
    '权限至少勾选 repo 和 read:org',
    '将 Token 填入环境变量 GITHUB_PERSONAL_ACCESS_TOKEN',
    '保存后点击「连接」',
  ],
  npmPackage: '@modelcontextprotocol/server-github',
  docsUrl: 'https://github.com/modelcontextprotocol/servers/tree/main/src/github',
  stars: '50k+',
  difficulty: 'easy',
};

const POSTGRES: MCPServerPreset = {
  id: 'mcp-postgres',
  name: 'PostgreSQL',
  description: '让 AI 直接查询和管理 PostgreSQL 数据库，支持执行 SQL 和查看表结构。',
  category: 'database',
  tags: ['官方', '数据库', 'PostgreSQL', 'SQL'],
  transport: 'stdio',
  command: NPX,
  args: '-y @modelcontextprotocol/server-postgres postgresql://user:password@localhost:5432/mydb',
  features: [
    '执行只读 SQL 查询',
    '查看数据库 Schema',
    '表结构分析',
    '连接字符串配置',
  ],
  installSteps: [
    '确保 PostgreSQL 数据库可访问',
    '构造连接字符串：postgresql://用户名:密码@主机:5432/数据库名',
    '替换 args 中的连接字符串',
    '保存后点击「连接」',
  ],
  npmPackage: '@modelcontextprotocol/server-postgres',
  docsUrl: 'https://github.com/modelcontextprotocol/servers/tree/main/src/postgres',
  stars: '50k+',
  difficulty: 'medium',
};

const MEMORY: MCPServerPreset = {
  id: 'mcp-memory',
  name: '记忆系统',
  description: '为 AI 提供持久化知识图谱记忆，跨会话保持用户偏好和上下文信息。',
  category: 'international',
  tags: ['官方', '记忆', '知识图谱'],
  transport: 'stdio',
  command: NPX,
  args: '-y @modelcontextprotocol/server-memory',
  features: [
    '持久化用户偏好',
    '知识图谱实体存储',
    '跨会话记忆',
    '自动关联信息',
  ],
  installSteps: [
    '无需额外配置',
    '保存后点击「连接」即可',
    'AI 会自动使用记忆工具存储信息',
  ],
  npmPackage: '@modelcontextprotocol/server-memory',
  docsUrl: 'https://github.com/modelcontextprotocol/servers/tree/main/src/memory',
  stars: '50k+',
  difficulty: 'easy',
};

const FETCH: MCPServerPreset = {
  id: 'mcp-fetch',
  name: '网页抓取',
  description: '让 AI 抓取网页内容并转为 Markdown，获取实时网络信息。',
  category: 'search',
  tags: ['官方', '网页', '抓取', 'Markdown'],
  transport: 'stdio',
  command: NPX,
  args: '-y @modelcontextprotocol/server-fetch',
  features: [
    '抓取网页 HTML 转 Markdown',
    '获取实时网络信息',
    '支持 HTTP/HTTPS',
    '递归抓取链接',
  ],
  installSteps: [
    '无需额外配置',
    '保存后点击「连接」',
    'AI 可通过 fetch 工具获取网页内容',
  ],
  npmPackage: '@modelcontextprotocol/server-fetch',
  docsUrl: 'https://github.com/modelcontextprotocol/servers/tree/main/src/fetch',
  stars: '50k+',
  difficulty: 'easy',
};

const SQLITE: MCPServerPreset = {
  id: 'mcp-sqlite',
  name: 'SQLite 数据库',
  description: '让 AI 操作本地 SQLite 数据库，适合小型项目和数据探索。',
  category: 'database',
  tags: ['官方', '数据库', 'SQLite', '本地'],
  transport: 'stdio',
  command: NPX,
  args: '-y @modelcontextprotocol/server-sqlite /path/to/database.db',
  features: [
    '执行 SQL 查询',
    '创建/修改表结构',
    '数据导入导出',
    '内置分析工具',
  ],
  installSteps: [
    '准备一个 SQLite 数据库文件',
    '替换 args 中的路径为实际 .db 文件路径',
    '保存后点击「连接」',
  ],
  npmPackage: '@modelcontextprotocol/server-sqlite',
  docsUrl: 'https://github.com/modelcontextprotocol/servers/tree/main/src/sqlite',
  stars: '50k+',
  difficulty: 'easy',
};

const SEQUENTIAL_THINKING: MCPServerPreset = {
  id: 'mcp-sequential-thinking',
  name: '推理思维链',
  description: '为 AI 提供结构化多步推理能力，通过思维链分解复杂问题逐步求解。',
  category: 'international',
  tags: ['官方', '推理', '思维链', '逻辑'],
  transport: 'stdio',
  command: NPX,
  args: '-y @modelcontextprotocol/server-sequential-thinking',
  features: [
    '多步骤结构化推理',
    '链路回溯与修正',
    '假设验证机制',
    '复杂问题拆解',
  ],
  installSteps: [
    '无需额外配置',
    '保存后点击「连接」',
    'AI 在进行复杂推理时会自动激活此工具',
  ],
  npmPackage: '@modelcontextprotocol/server-sequential-thinking',
  docsUrl: 'https://github.com/modelcontextprotocol/servers/tree/main/src/sequential-thinking',
  stars: '50k+',
  difficulty: 'easy',
};

const GIT: MCPServerPreset = {
  id: 'mcp-git',
  name: 'Git 版本控制',
  description: '让 AI 执行 Git 操作：查看历史、diff、blame、分支管理。',
  category: 'dev-tools',
  tags: ['版本控制', 'Git', '代码'],
  transport: 'stdio',
  command: UVX,
  args: 'mcp-server-git --repository /path/to/repo',
  features: [
    '查看 Git 日志和历史',
    '代码 diff 对比',
    'Blame 追溯',
    '分支和标签管理',
  ],
  installSteps: [
    '确保已安装 uv (Python 包管理器)',
    '修改 args 中的仓库路径',
    '保存后点击「连接」',
  ],
  npmPackage: 'mcp-server-git',
  docsUrl: 'https://github.com/modelcontextprotocol/servers/tree/main/src/git',
  stars: '50k+',
  difficulty: 'medium',
};

const TIME: MCPServerPreset = {
  id: 'mcp-time',
  name: '时间工具',
  description: '为 AI 提供精确的时间/时区转换功能，支持多时区查询和格式转换。',
  category: 'international',
  tags: ['官方', '时间', '时区', '工具'],
  transport: 'stdio',
  command: NPX,
  args: '-y @modelcontextprotocol/server-time',
  features: [
    '获取当前 UTC 时间',
    '多时区转换',
    '时间戳与日期互转',
    'ISO 8601 格式化',
  ],
  installSteps: [
    '无需额外配置',
    '保存后点击「连接」',
  ],
  npmPackage: '@modelcontextprotocol/server-time',
  docsUrl: 'https://github.com/modelcontextprotocol/servers/tree/main/src/time',
  stars: '50k+',
  difficulty: 'easy',
};

// ─────────────────────────────────────────────────────────
// 二、AI 搜索 / 网页爬取类
// ─────────────────────────────────────────────────────────

const TAVILY_SEARCH: MCPServerPreset = {
  id: 'mcp-tavily',
  name: 'Tavily 搜索',
  description: 'AI 专用搜索引擎，国内可访问，免费每月 1000 次调用，返回结构化搜索结果。',
  category: 'search',
  tags: ['搜索', 'AI搜索', '国内可用', '免费额度'],
  transport: 'stdio',
  command: NPX,
  args: '-y tavily-mcp',
  env: 'TAVILY_API_KEY=tvly-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
  envRequired: ['TAVILY_API_KEY'],
  features: [
    'AI 优化的搜索结果',
    '国内可直连',
    '免费每月 1000 次',
    '返回结构化数据',
  ],
  installSteps: [
    '访问 https://tavily.com 注册账号',
    '复制 API Key',
    '填入 env 的 TAVILY_API_KEY',
    '保存后点击「连接」',
  ],
  npmPackage: 'tavily-mcp',
  docsUrl: 'https://tavily.com',
  stars: '5k+',
  difficulty: 'easy',
};

const EXA_SEARCH: MCPServerPreset = {
  id: 'mcp-exa',
  name: 'Exa 搜索',
  description: 'AI 原生神经搜索引擎，支持网页搜索、代码搜索、学术论文检索。',
  category: 'search',
  tags: ['搜索', 'AI搜索', '学术', '神经搜索'],
  transport: 'stdio',
  command: NPX,
  args: '-y exa-mcp-server',
  env: 'EXA_API_KEY=your_exa_api_key_here',
  envRequired: ['EXA_API_KEY'],
  features: [
    '神经语义搜索',
    '代码片段搜索',
    '学术论文检索',
    '内容相似度匹配',
  ],
  installSteps: [
    '访问 https://exa.ai 注册账号',
    '获取 API Key',
    '填入 env 的 EXA_API_KEY',
    '保存后点击「连接」',
  ],
  npmPackage: 'exa-mcp-server',
  docsUrl: 'https://exa.ai/mcp',
  stars: '3k+',
  difficulty: 'easy',
};

const BRAVE_SEARCH: MCPServerPreset = {
  id: 'mcp-brave-search',
  name: 'Brave 搜索',
  description: '通过 Brave Search API 进行网页搜索和本地搜索，隐私友好的搜索引擎。',
  category: 'search',
  tags: ['搜索', 'Brave', '隐私'],
  transport: 'stdio',
  command: NPX,
  args: '-y @modelcontextprotocol/server-brave-search',
  env: 'BRAVE_API_KEY=BSA_xxxxxxxxxxxxxxxxxxxxxxxxxxxx',
  envRequired: ['BRAVE_API_KEY'],
  features: [
    '网页搜索',
    '本地商家搜索',
    '新闻搜索',
    '隐私保护',
  ],
  installSteps: [
    '访问 https://brave.com/search/api/ 注册获取 API Key',
    '免费套餐每月 2000 次查询',
    '填入 env 的 BRAVE_API_KEY',
    '保存后点击「连接」',
  ],
  npmPackage: '@modelcontextprotocol/server-brave-search',
  docsUrl: 'https://brave.com/search/api/',
  stars: '50k+',
  difficulty: 'easy',
};

const FIRECRAWL: MCPServerPreset = {
  id: 'mcp-firecrawl',
  name: 'Firecrawl 网页抓取',
  description: '强大的网页抓取与搜索，支持 JS 渲染、批量处理、结构化数据提取。',
  category: 'search',
  tags: ['抓取', '爬虫', '搜索', '深度研究'],
  transport: 'stdio',
  command: NPX,
  args: '-y firecrawl-mcp',
  env: 'FIRECRAWL_API_KEY=fc-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
  envRequired: ['FIRECRAWL_API_KEY'],
  features: [
    'JS 渲染网页抓取',
    '批量抓取与深度研究',
    '结构化数据提取',
    '网页搜索 + 抓取一体化',
  ],
  installSteps: [
    '访问 https://firecrawl.dev 注册',
    '获取 API Key',
    '填入 env 的 FIRECRAWL_API_KEY',
    '保存后点击「连接」',
  ],
  npmPackage: 'firecrawl-mcp',
  docsUrl: 'https://docs.firecrawl.dev',
  stars: '6k+',
  difficulty: 'easy',
};

const JINA_READER: MCPServerPreset = {
  id: 'mcp-jina',
  name: 'Jina Reader 阅读器',
  description: '通过 Jina AI 将任意网页转为 LLM 友好的 Markdown，支持搜索和嵌入。',
  category: 'search',
  tags: ['阅读器', '内容提取', 'Jina', 'Markdown'],
  transport: 'sse',
  url: 'https://reader.jina.ai',
  env: 'JINA_API_KEY=jina_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
  envRequired: ['JINA_API_KEY'],
  features: [
    '网页转 Markdown',
    'PDF/Word 文档解析',
    '图片内容提取',
    '搜索 + 提取一体化',
  ],
  installSteps: [
    '访问 https://jina.ai 注册获取 API Key',
    '免费套餐 100 万 tokens',
    '填入 env 的 JINA_API_KEY',
    '保存后点击「连接」',
  ],
  docsUrl: 'https://jina.ai/reader',
  stars: '20k+',
  difficulty: 'easy',
};

const PERPLEXITY_SEARCH: MCPServerPreset = {
  id: 'mcp-perplexity',
  name: 'Perplexity 搜索',
  description: 'Perplexity 联网搜索 API，提供带引用来源的 AI 增强搜索结果。',
  category: 'search',
  tags: ['搜索', 'Perplexity', '引用'],
  transport: 'stdio',
  command: NPX,
  args: '-y @anthropic-ai/mcp-perplexity',
  env: 'PERPLEXITY_API_KEY=pplx-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
  envRequired: ['PERPLEXITY_API_KEY'],
  features: [
    '实时联网搜索',
    '带引用来源的回答',
    '深度研究模式',
    '学术级搜索精度',
  ],
  installSteps: [
    '访问 https://perplexity.ai 注册 Pro 账号',
    '获取 API Key',
    '填入 env 的 PERPLEXITY_API_KEY',
    '保存后点击「连接」',
  ],
  npmPackage: '@anthropic-ai/mcp-perplexity',
  docsUrl: 'https://docs.perplexity.ai',
  stars: '2k+',
  difficulty: 'easy',
};

// ─────────────────────────────────────────────────────────
// 三、开发效率 / 项目管理类
// ─────────────────────────────────────────────────────────

const PLAYWRIGHT: MCPServerPreset = {
  id: 'mcp-playwright',
  name: 'Playwright 浏览器自动化',
  description: '微软出品，让 AI 控制真实浏览器：填写表单、截图、自动化测试、网页交互。国内可直接使用。',
  category: 'dev-tools',
  tags: ['微软', '浏览器', '自动化', '测试', '国内可用'],
  transport: 'stdio',
  command: NPX,
  args: '-y @playwright/mcp@latest',
  features: [
    '控制真实浏览器',
    '网页截图与 PDF',
    '表单自动填写',
    'E2E 自动化测试',
  ],
  installSteps: [
    '确保系统已安装 Chromium 浏览器',
    '或运行 npx playwright install chromium 安装',
    '保存后点击「连接」',
    'AI 即可控制浏览器完成各种网页操作',
  ],
  npmPackage: '@playwright/mcp',
  docsUrl: 'https://playwright.dev',
  stars: '70k+',
  difficulty: 'medium',
};

const CONTEXT7: MCPServerPreset = {
  id: 'mcp-context7',
  name: 'Context7 实时文档',
  description: 'Upstash 出品，为 AI 提供最新库文档，杜绝幻觉，支持 2 万+ 开源库。',
  category: 'dev-tools',
  tags: ['文档', '实时', '开发', '幻觉治理'],
  transport: 'stdio',
  command: NPX,
  args: '-y @upstash/context7-mcp',
  env: 'CONTEXT7_API_KEY=ctx7_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
  envRequired: ['CONTEXT7_API_KEY'],
  features: [
    '2 万+ 开源库实时文档',
    '版本感知（自动匹配最新）',
    '杜绝 AI 幻觉',
    '代码示例直接可用',
  ],
  installSteps: [
    '访问 https://context7.com 注册获取 API Key',
    '填入 env 的 CONTEXT7_API_KEY',
    '保存后点击「连接」',
    'AI 写代码时会自动查询最新文档',
  ],
  npmPackage: '@upstash/context7-mcp',
  docsUrl: 'https://context7.com',
  stars: '3k+',
  difficulty: 'easy',
};

const PUPPETEER: MCPServerPreset = {
  id: 'mcp-puppeteer',
  name: 'Puppeteer 浏览器',
  description: '通过 Puppeteer 控制无头浏览器，进行网页抓取、截图和自动化操作。',
  category: 'dev-tools',
  tags: ['Puppeteer', '浏览器', '截图', '爬虫'],
  transport: 'stdio',
  command: NPX,
  args: '-y @anthropic-ai/mcp-puppeteer',
  features: [
    '无头浏览器控制',
    '网页截图',
    '表单交互',
    'PDF 生成',
  ],
  installSteps: [
    '无需额外配置',
    '保存后点击「连接」',
    'AI 可通过 Puppeteer 控制浏览器',
  ],
  npmPackage: '@anthropic-ai/mcp-puppeteer',
  docsUrl: 'https://pptr.dev',
  stars: '88k+',
  difficulty: 'medium',
};

const DOCKER: MCPServerPreset = {
  id: 'mcp-docker',
  name: 'Docker 容器管理',
  description: '让 AI 管理 Docker 容器、镜像、网络和数据卷，DevOps 自动化。',
  category: 'platform',
  tags: ['Docker', '容器', 'DevOps', '基础设施'],
  transport: 'stdio',
  command: NPX,
  args: '-y @anthropic-ai/mcp-server-docker',
  features: [
    '管理容器生命周期',
    '镜像拉取与管理',
    '查看容器日志',
    '网络和数据卷管理',
  ],
  installSteps: [
    '确保 Docker Desktop/Docker Engine 已安装运行',
    '确保当前用户有 docker 命令权限',
    '保存后点击「连接」',
  ],
  npmPackage: '@anthropic-ai/mcp-server-docker',
  docsUrl: 'https://www.docker.com/blog/the-model-context-protocol/',
  stars: '50k+',
  difficulty: 'medium',
};

const SENTRY: MCPServerPreset = {
  id: 'mcp-sentry',
  name: 'Sentry 错误追踪',
  description: '让 AI 查看和分析 Sentry 错误追踪数据，快速定位生产环境 Bug。',
  category: 'dev-tools',
  tags: ['Sentry', '错误追踪', '调试', '监控'],
  transport: 'stdio',
  command: NPX,
  args: '-y @sentry/mcp',
  env: 'SENTRY_AUTH_TOKEN=sntrys_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
  envRequired: ['SENTRY_AUTH_TOKEN'],
  features: [
    '查看错误和崩溃详情',
    '分析 Issue 趋势',
    '性能追踪数据',
    'Release 管理',
  ],
  installSteps: [
    '访问 Sentry 项目设置生成 Auth Token',
    '填入 env 的 SENTRY_AUTH_TOKEN',
    '保存后点击「连接」',
  ],
  npmPackage: '@sentry/mcp',
  docsUrl: 'https://docs.sentry.io',
  stars: '40k+',
  difficulty: 'medium',
};

const NOTION: MCPServerPreset = {
  id: 'mcp-notion',
  name: 'Notion 工作空间',
  description: '让 AI 读取和操作 Notion 页面、数据库和内容，提升知识管理效率。',
  category: 'dev-tools',
  tags: ['Notion', '知识管理', '文档', '协作'],
  transport: 'stdio',
  command: NPX,
  args: '-y @notionhq/notion-mcp-server',
  env: 'OPENAPI_MCP_HEADERS={"Authorization":"Bearer ntn_xxxxxxxxxxxxxxxxxxxxxxxxxxxx","Notion-Version":"2022-06-28"}',
  envRequired: ['OPENAPI_MCP_HEADERS'],
  features: [
    '读取/创建 Notion 页面',
    '操作数据库',
    '搜索工作空间内容',
    '管理页面属性',
  ],
  installSteps: [
    '访问 https://www.notion.so/my-integrations 创建集成',
    '获取 Internal Integration Secret (以 ntn_ 开头)',
    '在 Notion 页面中邀请该集成',
    '填入 env 的 OPENAPI_MCP_HEADERS，替换 Token',
    '保存后点击「连接」',
  ],
  npmPackage: '@notionhq/notion-mcp-server',
  docsUrl: 'https://github.com/makenotion/notion-mcp-server',
  stars: '5k+',
  difficulty: 'hard',
};

const JIRA_ATLASSIAN: MCPServerPreset = {
  id: 'mcp-jira',
  name: 'Jira 项目管理',
  description: '让 AI 管理 Jira Issue、Sprint、项目，自动化项目管理流程。',
  category: 'dev-tools',
  tags: ['Jira', 'Atlassian', '项目管理', 'Agile'],
  transport: 'stdio',
  command: NPX,
  args: '-y @orengrinker/jira-mcp-server',
  env: 'JIRA_HOST=https://your-domain.atlassian.net\nJIRA_EMAIL=your-email@example.com\nJIRA_API_TOKEN=your_jira_api_token',
  envRequired: ['JIRA_HOST', 'JIRA_EMAIL', 'JIRA_API_TOKEN'],
  features: [
    '创建/更新 Issue',
    '查询 Sprint 和看板',
    '搜索项目和问题',
    'JQL 高级查询',
  ],
  installSteps: [
    '访问 https://id.atlassian.com/manage-profile/security/api-tokens 创建 API Token',
    '填入 env 中的 JIRA_HOST（你的 Jira 域名）',
    '填入 JIRA_EMAIL（你的 Atlassian 邮箱）',
    '填入 JIRA_API_TOKEN',
    '保存后点击「连接」',
  ],
  npmPackage: '@orengrinker/jira-mcp-server',
  docsUrl: 'https://www.npmjs.com/package/@orengrinker/jira-mcp-server',
  stars: '1k+',
  difficulty: 'medium',
};

const LINEAR: MCPServerPreset = {
  id: 'mcp-linear',
  name: 'Linear 项目管理',
  description: '让 AI 操作 Linear 项目管理工具，创建 Issue、管理项目和查看进度。',
  category: 'dev-tools',
  tags: ['Linear', '项目管理', '敏捷开发'],
  transport: 'stdio',
  command: NPX,
  args: '-y @linear/mcp',
  env: 'LINEAR_API_KEY=lin_api_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
  envRequired: ['LINEAR_API_KEY'],
  features: [
    '创建/查询 Issue',
    '管理项目 Teams',
    '查看 Sprint 周期',
    '评论和更新问题',
  ],
  installSteps: [
    '访问 Linear > Settings > API 创建 Key',
    '填入 env 的 LINEAR_API_KEY',
    '保存后点击「连接」',
  ],
  npmPackage: '@linear/mcp',
  docsUrl: 'https://linear.app/docs',
  stars: '2k+',
  difficulty: 'easy',
};

const SLACK: MCPServerPreset = {
  id: 'mcp-slack',
  name: 'Slack 消息协作',
  description: '让 AI 在 Slack 中发送消息、查询频道、搜索历史消息。',
  category: 'dev-tools',
  tags: ['Slack', '消息', '协作', '团队'],
  transport: 'stdio',
  command: NPX,
  args: '-y @anthropic-ai/mcp-server-slack',
  env: 'SLACK_BOT_TOKEN=xoxb-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
  envRequired: ['SLACK_BOT_TOKEN'],
  features: [
    '发送频道消息',
    '搜索历史消息',
    '列出频道和用户',
    '读取消息线程',
  ],
  installSteps: [
    '在 Slack 创建 Bot App，获取 Bot Token (xoxb-...)',
    '填入 env 的 SLACK_BOT_TOKEN',
    '保存后点击「连接」',
  ],
  npmPackage: '@anthropic-ai/mcp-server-slack',
  docsUrl: 'https://api.slack.com',
  stars: '50k+',
  difficulty: 'medium',
};

// ─────────────────────────────────────────────────────────
// 四、云平台 / 基础设施类
// ─────────────────────────────────────────────────────────

const CLOUDFLARE: MCPServerPreset = {
  id: 'mcp-cloudflare',
  name: 'Cloudflare 平台',
  description: '让 AI 管理 Cloudflare Workers、KV、R2、D1 和 Pages 部署。',
  category: 'platform',
  tags: ['Cloudflare', 'CDN', '边缘计算', '部署'],
  transport: 'stdio',
  command: NPX,
  args: '-y @cloudflare/mcp-server-cloudflare',
  env: 'CLOUDFLARE_API_TOKEN=your_cf_api_token_here',
  envRequired: ['CLOUDFLARE_API_TOKEN'],
  features: [
    'Workers 部署管理',
    'KV 存储操作',
    'R2 对象存储',
    'DNS 和域名管理',
  ],
  installSteps: [
    '访问 Cloudflare Dashboard > API Tokens 创建 Token',
    '填入 env 的 CLOUDFLARE_API_TOKEN',
    '保存后点击「连接」',
  ],
  npmPackage: '@cloudflare/mcp-server-cloudflare',
  docsUrl: 'https://developers.cloudflare.com',
  stars: '10k+',
  difficulty: 'medium',
};

const SUPABASE_MCP: MCPServerPreset = {
  id: 'mcp-supabase',
  name: 'Supabase 后端服务',
  description: '让 AI 管理 Supabase 数据库、认证、存储和 Edge Functions。',
  category: 'platform',
  tags: ['Supabase', '数据库', 'BaaS', '认证'],
  transport: 'stdio',
  command: NPX,
  args: '-y @supabase/mcp-server-supabase',
  env: 'SUPABASE_ACCESS_TOKEN=sbp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
  envRequired: ['SUPABASE_ACCESS_TOKEN'],
  features: [
    '数据库表管理',
    'SQL 查询执行',
    '认证用户管理',
    'Edge Functions 部署',
  ],
  installSteps: [
    '访问 Supabase Dashboard > Access Tokens 创建 Token',
    '填入 env 的 SUPABASE_ACCESS_TOKEN',
    '保存后点击「连接」',
  ],
  npmPackage: '@supabase/mcp-server-supabase',
  docsUrl: 'https://supabase.com/docs',
  stars: '100k+',
  difficulty: 'medium',
};

const KUBERNETES: MCPServerPreset = {
  id: 'mcp-kubernetes',
  name: 'Kubernetes 管理',
  description: '让 AI 操作 K8s 集群：查看 Pods、Services、Deployments、日志和配置。',
  category: 'platform',
  tags: ['Kubernetes', 'K8s', '云原生', '运维'],
  transport: 'stdio',
  command: NPX,
  args: '-y @anthropic-ai/mcp-server-kubernetes',
  features: [
    '查看 Pods/Services/Nodes',
    '读取容器日志',
    '管理 Deployments',
    'ConfigMap/Secret 查询',
  ],
  installSteps: [
    '确保 kubeconfig 已正确配置（kubectl 可用）',
    '保存后点击「连接」',
    'AI 可通过 kubectl 操作集群',
  ],
  npmPackage: '@anthropic-ai/mcp-server-kubernetes',
  docsUrl: 'https://kubernetes.io/docs',
  stars: '50k+',
  difficulty: 'hard',
};

// ─────────────────────────────────────────────────────────
// 五、国内主流 MCP 服务器
// ─────────────────────────────────────────────────────────

const CLOUDBASE: MCPServerPreset = {
  id: 'mcp-cloudbase',
  name: '腾讯云开发 CloudBase',
  description: '腾讯云开发 MCP，支持云函数、数据库、存储、静态托管一站式管理。国内用户首选。',
  category: 'china',
  tags: ['国内', '腾讯', '云开发', 'CloudBase', '全栈'],
  transport: 'stdio',
  command: NPX,
  args: '-y @cloudbase/cloudbase-mcp',
  env: 'TCB_ENV_ID=your-env-id\nTCB_SECRET_ID=your_secret_id\nTCB_SECRET_KEY=your_secret_key',
  envRequired: ['TCB_ENV_ID'],
  features: [
    '云函数部署管理',
    'NoSQL/MySQL 数据库操作',
    '云存储文件管理',
    '静态网站托管',
    'AI 模型调用',
  ],
  installSteps: [
    '访问 https://console.cloud.tencent.com/tcb 创建云开发环境',
    '获取环境 ID (TCB_ENV_ID)',
    '填入 env 中的 TCB_ENV_ID（Secret ID/Key 可选）',
    '保存后点击「连接」',
  ],
  npmPackage: '@cloudbase/cloudbase-mcp',
  docsUrl: 'https://docs.cloudbase.net/ai/mcp/introduce',
  stars: '1k+',
  difficulty: 'easy',
};

const AMAP_MAP: MCPServerPreset = {
  id: 'mcp-amap',
  name: '高德地图',
  description: '高德地图 MCP，提供地理编码、路径规划、POI 搜索、天气查询等服务。国内可用。',
  category: 'china',
  tags: ['国内', '高德', '地图', '位置', '导航'],
  transport: 'stdio',
  command: NPX,
  args: '-y @amap/mcp-server-amap',
  env: 'AMAP_API_KEY=你的高德Key',
  envRequired: ['AMAP_API_KEY'],
  features: [
    '地理编码/逆地理编码',
    '路径规划（驾车/步行/骑行/公交）',
    'POI 搜索',
    '实时天气查询',
    'IP 定位',
    '行政区划查询',
  ],
  installSteps: [
    '访问 https://lbs.amap.com 注册开发者',
    '创建应用获取 API Key（选择 Web 服务）',
    '填入 env 的 AMAP_API_KEY',
    '保存后点击「连接」',
  ],
  npmPackage: '@amap/mcp-server-amap',
  docsUrl: 'https://lbs.amap.com/api/mcp-server/gettingstarted',
  stars: '1k+',
  difficulty: 'easy',
};

const TENCENT_MAP: MCPServerPreset = {
  id: 'mcp-tencent-map',
  name: '腾讯位置服务',
  description: '腾讯地图 MCP，提供位置搜索、路线规划、地图可视化等位置服务。',
  category: 'china',
  tags: ['国内', '腾讯', '地图', '位置', '导航'],
  transport: 'sse',
  url: 'https://apis.map.qq.com/mcp',
  env: 'TENCENT_MAP_KEY=你的腾讯地图Key',
  envRequired: ['TENCENT_MAP_KEY'],
  features: [
    '地点搜索',
    '路线规划',
    '地址解析',
    '地图静态图',
  ],
  installSteps: [
    '访问 https://lbs.qq.com 注册并创建应用',
    '获取 Key',
    '填入 env 的 TENCENT_MAP_KEY',
    '配置 SSE URL',
    '保存后点击「连接」',
  ],
  docsUrl: 'https://lbs.qq.com/service/MCPServer/MCPServerGuide/overview',
  stars: '1k+',
  difficulty: 'easy',
};

const BAIDU_MAP: MCPServerPreset = {
  id: 'mcp-baidu-map',
  name: '百度地图',
  description: '百度地图 MCP，提供地理编码、POI 搜索、路线规划、实时路况等位置服务。',
  category: 'china',
  tags: ['国内', '百度', '地图', '位置', '路况'],
  transport: 'sse',
  url: 'https://api.map.baidu.com/mcp',
  env: 'BAIDU_MAP_AK=你的百度地图AK',
  envRequired: ['BAIDU_MAP_AK'],
  features: [
    '地理编码服务',
    'POI 及周边搜索',
    '交通路线规划',
    '实时路况查询',
  ],
  installSteps: [
    '访问 https://lbsyun.baidu.com 注册开发者',
    '创建应用获取 AK',
    '填入 env 的 BAIDU_MAP_AK',
    '配置 SSE URL',
    '保存后点击「连接」',
  ],
  docsUrl: 'https://lbsyun.baidu.com',
  stars: '1k+',
  difficulty: 'easy',
};

const ALIYUN_BAILIAN: MCPServerPreset = {
  id: 'mcp-aliyun-bailian',
  name: '阿里云百炼 AI',
  description: '阿里云百炼 MCP，接入通义千问等大模型及丰富 AI 插件工具。',
  category: 'china',
  tags: ['国内', '阿里', 'AI模型', '百炼', '大模型'],
  transport: 'sse',
  url: 'https://dashscope.aliyuncs.com/mcp',
  env: 'DASHSCOPE_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
  envRequired: ['DASHSCOPE_API_KEY'],
  features: [
    '大模型调用',
    'AI Agent 工具集',
    '文档解析',
    '插件市场',
  ],
  installSteps: [
    '访问 https://bailian.console.aliyun.com 开通百炼',
    '获取 DashScope API Key',
    '填入 env 的 DASHSCOPE_API_KEY',
    '配置 SSE URL',
    '保存后点击「连接」',
  ],
  npmPackage: 'dashscope',
  docsUrl: 'https://help.aliyun.com/document_detail/2712195.html',
  stars: '5k+',
  difficulty: 'medium',
};

const MODELSCOPE: MCPServerPreset = {
  id: 'mcp-modelscope',
  name: '魔搭 ModelScope',
  description: '阿里魔搭社区 MCP 广场，千余款热门 MCP 服务，国内最大 MCP 中文社区。',
  category: 'china',
  tags: ['国内', '魔搭', '社区', '模型', 'MCP广场'],
  transport: 'sse',
  url: 'https://api.modelscope.cn/mcp',
  env: 'MODELSCOPE_API_TOKEN=ms_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
  envRequired: ['MODELSCOPE_API_TOKEN'],
  features: [
    '千余款 MCP 服务',
    '模型推理服务',
    '数据集访问',
    '社区资源',
  ],
  installSteps: [
    '访问 https://modelscope.cn 注册魔搭账号',
    '获取 API Token',
    '填入 env 的 MODELSCOPE_API_TOKEN',
    '配置 SSE URL',
    '保存后点击「连接」',
  ],
  docsUrl: 'https://modelscope.cn/mcp',
  stars: '10k+',
  difficulty: 'medium',
};

const TENCENT_LIGHTHOUSE: MCPServerPreset = {
  id: 'mcp-lighthouse',
  name: '腾讯云 Lighthouse',
  description: '腾讯轻量应用服务器 MCP，让 AI 管理 Lighthouse 实例、防火墙、快照等。',
  category: 'china',
  tags: ['国内', '腾讯', '云服务器', 'Lighthouse', '运维'],
  transport: 'sse',
  url: 'https://lighthouse.tencentcloudapi.com/mcp',
  env: 'TENCENT_SECRET_ID=YOUR_TENCENT_SECRET_ID\nTENCENT_SECRET_KEY=YOUR_TENCENT_SECRET_KEY',
  envRequired: ['TENCENT_SECRET_ID', 'TENCENT_SECRET_KEY'],
  features: [
    '实例管理',
    '防火墙规则配置',
    '快照管理',
    '实时监控数据',
  ],
  installSteps: [
    '访问 https://console.cloud.tencent.com/cam/capi 获取密钥',
    '填入 env 的 TENCENT_SECRET_ID 和 TENCENT_SECRET_KEY',
    '配置 SSE URL',
    '保存后点击「连接」',
  ],
  docsUrl: 'https://cloud.tencent.com/document/product/1207',
  stars: '1k+',
  difficulty: 'medium',
};

const TCB_AI_TOOLKIT: MCPServerPreset = {
  id: 'mcp-tcb-ai',
  name: 'CloudBase AI ToolKit',
  description: '腾讯云开发 AI 工具包，支持数据库、云函数、存储、静态托管等一站式 AI 开发。',
  category: 'china',
  tags: ['国内', '腾讯', 'AI开发', '工具包', 'MCP'],
  transport: 'stdio',
  command: NPX,
  args: '-y @cloudbase/cloudbase-mcp',
  env: 'TCB_ENV_ID=your-env-id\nTCB_SECRET_ID=your_secret_id\nTCB_SECRET_KEY=your_secret_key',
  envRequired: ['TCB_ENV_ID'],
  features: [
    'NoSQL/SQL 数据库读写',
    '云函数创建和部署',
    '静态托管文件管理',
    'AI 模型调用',
    '安全规则配置',
  ],
  installSteps: [
    '访问 https://console.cloud.tencent.com/tcb 创建环境',
    '获取环境 ID',
    '填入 env 中的 TCB_ENV_ID',
    '保存后点击「连接」',
  ],
  npmPackage: '@cloudbase/cloudbase-mcp',
  docsUrl: 'https://docs.cloudbase.net/ai/mcp/introduce',
  stars: '1k+',
  difficulty: 'easy',
};

const RPGSMART_CHARACTERS: MCPServerPreset = {
  id: 'mcp-rpgsmart',
  name: 'Rpgsmart 角色生成',
  description: 'AI 驱动的角色生成服务，用于游戏和内容创作。',
  category: 'china',
  tags: ['国内', '游戏', '角色', '创作'],
  transport: 'sse',
  url: 'https://api.rpgsmart.com/mcp',
  env: 'RPGSMART_API_KEY=your_api_key_here',
  envRequired: ['RPGSMART_API_KEY'],
  features: [
    'AI 角色生成',
    '角色属性自定义',
    '角色关系图',
    '故事线生成',
  ],
  installSteps: [
    '访问 https://rpgsmart.com 注册',
    '获取 API Key',
    '填入 env 的 RPGSMART_API_KEY',
    '保存后点击「连接」',
  ],
  docsUrl: 'https://rpgsmart.com',
  stars: '1k+',
  difficulty: 'easy',
};

const STOCK_MARKET: MCPServerPreset = {
  id: 'mcp-a-stock',
  name: 'A股行情数据',
  description: '沪深 A 股市场实时行情数据，提供股票价格、K线、财务指标等数据。',
  category: 'china',
  tags: ['国内', '股票', 'A股', '行情', '金融'],
  transport: 'sse',
  url: 'https://tcb.cloud.tencent.com/mcp-server/stock',
  features: [
    '实时行情数据',
    '历史 K 线数据',
    '财务指标查询',
    '板块行业分析',
  ],
  installSteps: [
    '配置 SSE URL',
    '保存后点击「连接」',
    'AI 即可查询 A 股数据',
  ],
  docsUrl: 'https://tcb.cloud.tencent.com/mcp-server',
  stars: '1k+',
  difficulty: 'easy',
};

// ─────────────────────────────────────────────────────────
// 六、媒体 / AI 生成类
// ─────────────────────────────────────────────────────────

const REPLICATE: MCPServerPreset = {
  id: 'mcp-replicate',
  name: 'Replicate AI 模型',
  description: '通过 Replicate 平台调用数千种 AI 模型：图像生成、视频、语音合成等。',
  category: 'media',
  tags: ['AI模型', '图像生成', '视频', 'Replicate'],
  transport: 'stdio',
  command: NPX,
  args: '-y @anthropic-ai/mcp-server-replicate',
  env: 'REPLICATE_API_TOKEN=r8_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
  envRequired: ['REPLICATE_API_TOKEN'],
  features: [
    '图像生成（Stable Diffusion 等）',
    '语音合成与识别',
    '视频生成和处理',
    '数千种模型选择',
  ],
  installSteps: [
    '访问 https://replicate.com 注册账号',
    '获取 API Token',
    '填入 env 的 REPLICATE_API_TOKEN',
    '保存后点击「连接」',
  ],
  npmPackage: '@anthropic-ai/mcp-server-replicate',
  docsUrl: 'https://replicate.com/docs',
  stars: '50k+',
  difficulty: 'easy',
};

const ELEVENLABS: MCPServerPreset = {
  id: 'mcp-elevenlabs',
  name: 'ElevenLabs 语音合成',
  description: 'AI 语音合成与克隆，支持多语言、多音色，生成自然流畅的语音。',
  category: 'media',
  tags: ['语音合成', 'TTS', 'AI', '音频'],
  transport: 'stdio',
  command: NPX,
  args: '-y @anthropic-ai/mcp-server-elevenlabs',
  env: 'ELEVENLABS_API_KEY=your_api_key_here',
  envRequired: ['ELEVENLABS_API_KEY'],
  features: [
    '多语言语音合成',
    '声音克隆',
    '情感语调调节',
    'MP3/WAV 输出',
  ],
  installSteps: [
    '访问 https://elevenlabs.io 注册',
    '获取 API Key',
    '填入 env 的 ELEVENLABS_API_KEY',
    '保存后点击「连接」',
  ],
  npmPackage: '@anthropic-ai/mcp-server-elevenlabs',
  docsUrl: 'https://elevenlabs.io/docs',
  stars: '50k+',
  difficulty: 'easy',
};

const GOOGLE_MAPS: MCPServerPreset = {
  id: 'mcp-google-maps',
  name: 'Google Maps 地图',
  description: 'Google 地图 MCP，提供地理编码、路径规划、地点搜索和时区查询。',
  category: 'platform',
  tags: ['Google', '地图', '位置', '全球'],
  transport: 'stdio',
  command: NPX,
  args: '-y @modelcontextprotocol/server-google-maps',
  env: 'GOOGLE_MAPS_API_KEY=your_google_api_key_here',
  envRequired: ['GOOGLE_MAPS_API_KEY'],
  features: [
    '全球地理编码',
    '路线规划',
    '地点搜索',
    '时区查询',
    '海拔数据',
  ],
  installSteps: [
    '访问 https://console.cloud.google.com 创建 API Key',
    '启用 Maps JavaScript API 和 Geocoding API',
    '填入 env 的 GOOGLE_MAPS_API_KEY',
    '保存后点击「连接」',
  ],
  npmPackage: '@modelcontextprotocol/server-google-maps',
  docsUrl: 'https://developers.google.com/maps',
  stars: '50k+',
  difficulty: 'easy',
};

const EVERART_AI: MCPServerPreset = {
  id: 'mcp-everart',
  name: 'EverArt AI 图像',
  description: 'AI 图像生成与编辑，支持多模型选择，提供风格迁移和图像增强。',
  category: 'media',
  tags: ['AI图像', '生成', '编辑', '风格迁移'],
  transport: 'stdio',
  command: NPX,
  args: '-y @anthropic-ai/mcp-server-everart',
  env: 'EVERART_API_KEY=your_api_key_here',
  envRequired: ['EVERART_API_KEY'],
  features: [
    'AI 图像生成',
    '风格迁移',
    '图像增强',
    '多模型切换',
  ],
  installSteps: [
    '访问 https://everart.ai 注册获取 API Key',
    '填入 env 的 EVERART_API_KEY',
    '保存后点击「连接」',
  ],
  npmPackage: '@anthropic-ai/mcp-server-everart',
  docsUrl: 'https://everart.ai',
  stars: '50k+',
  difficulty: 'easy',
};

// ─────────────────────────────────────────────────────────
// 导出主列表
// ─────────────────────────────────────────────────────────

export const MCP_PRESETS: MCPServerPreset[] = [
  // ── 国际官方 ──
  FILESYSTEM,
  GITHUB,
  MEMORY,
  FETCH,
  SEQUENTIAL_THINKING,
  TIME,

  // ── 数据库 ──
  POSTGRES,
  SQLITE,

  // ── AI 搜索 ──
  TAVILY_SEARCH,
  EXA_SEARCH,
  BRAVE_SEARCH,
  FIRECRAWL,
  JINA_READER,
  PERPLEXITY_SEARCH,

  // ── 开发工具 ──
  PLAYWRIGHT,
  PUPPETEER,
  CONTEXT7,
  GIT,
  SENTRY,
  NOTION,
  JIRA_ATLASSIAN,
  LINEAR,
  SLACK,

  // ── 云平台 ──
  DOCKER,
  CLOUDFLARE,
  SUPABASE_MCP,
  KUBERNETES,
  GOOGLE_MAPS,

  // ── 国内主流 ──
  CLOUDBASE,
  TCB_AI_TOOLKIT,
  AMAP_MAP,
  TENCENT_MAP,
  BAIDU_MAP,
  ALIYUN_BAILIAN,
  MODELSCOPE,
  TENCENT_LIGHTHOUSE,
  STOCK_MARKET,
  RPGSMART_CHARACTERS,

  // ── AI 媒体 ──
  REPLICATE,
  ELEVENLABS,
  EVERART_AI,
];

// ─── 工具函数 ───
export function getPresetsByCategory(): Record<string, MCPServerPreset[]> {
  const groups: Record<string, MCPServerPreset[]> = {
    international: [],
    china: [],
    search: [],
    database: [],
    'dev-tools': [],
    platform: [],
    media: [],
  };
  MCP_PRESETS.forEach((p) => {
    if (groups[p.category]) groups[p.category].push(p);
  });
  return groups;
}

export const CATEGORY_LABELS: Record<string, string> = {
  international: '🌐 国际官方',
  china: '🇨🇳 国内主流',
  search: '🔍 AI 搜索',
  database: '🗄️ 数据库',
  'dev-tools': '🛠️ 开发工具',
  platform: '☁️ 云平台',
  media: '🎬 AI 媒体',
};

export const CATEGORY_COLORS: Record<string, string> = {
  international: 'purple',
  china: 'red',
  search: 'orange',
  database: 'blue',
  'dev-tools': 'cyan',
  platform: 'geekblue',
  media: 'magenta',
};
