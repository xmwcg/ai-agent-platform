import { route } from '../gateway/ai-gateway.service';

/**
 * 小红书爆款文案生成器（整合自 ADP 应用包「小红书爆款文案生成器」）
 * ----------------------------------------------------------------
 * 应用包原本是 4 个聊天 Agent（系统架构师 / 前端开发助手 / 文案生成专家 / 部署运维助手），
 * 这里把它们的 Instructions 提取为 4 个可复用的「专家角色」，统一走平台 AI 网关 route()，
 * 复用现有的 Provider 选择与故障转移机制；生产环境只允许真实 Provider，不再依赖 ADP 平台本身。
 *
 * 说明：应用包自带的 <handoff_rules>（transfer_to_* 工具）在单轮调用场景下无意义，
 * 已在此处剔除，仅保留角色设定、核心能力、输出规范，避免模型误以为要「转交」其他智能体。
 */

export type XhsRole = 'copywriter' | 'architect' | 'frontend' | 'devops';

export interface XhsAgent {
  id: XhsRole;
  name: string;
  description: string;
  systemPrompt: string;
  temperature: number;
  maxTokens: number;
}

export interface XhsGenerateInput {
  role: XhsRole;
  /** 产品卖点 / 主题 */
  product: string;
  /** 目标受众 */
  audience?: string;
  /** 风格 / 语气（如：种草、专业测评、搞笑、职场） */
  style?: string;
  /** 关键词 / 卖点补充 */
  keywords?: string;
  /** 生成条数（仅 copywriter 角色生效，默认 1） */
  count?: number;
  /** 指定模型（前缀寻址，如 "openai/gpt-4o"），缺省走网关默认 provider */
  model?: string;
}

export interface XhsStructured {
  title?: string;
  body?: string;
  hashtags?: string[];
  imageSuggestions?: string[];
}

export interface XhsGenerateResult {
  role: XhsRole;
  agentName: string;
  reply: string;
  structured?: XhsStructured;
}

const COPYWRITER_SYSTEM = `你是专注小红书平台爆款文案生成的专家。基于用户提供的产品卖点、目标受众与风格要求，自动创作带有强烈网感和高互动潜力的结构化内容，旨在提升品牌在小红书社区的曝光与转化。

核心能力：
- 解析产品核心卖点并提炼为小红书用户感兴趣的话题
- 生成符合小红书社区语境的文案，包含创意标题、生动正文、热门话题标签及 emoji 表情
- 提供与文案主题高度匹配的视觉化配图建议与描述
- 运用网感排版技巧（短句、分段、符号）优化文案可读性与传播性

执行准则：
- 文案必须真实反映产品卖点，禁止夸大或虚假宣传
- 所有话题标签（#）需与文案内容强相关，并考虑搜索热度
- 配图建议需具体（场景、色调、元素），而非笼统描述
- 正文避免过长段落，善用换行和符号（如“✨”、“🔥”、“❗”）制造阅读节奏

输出要求：
- 必须且只能输出一个 JSON 对象，结构为：
{
  "title": "创意标题（制造悬念或直击痛点，含 1 个 emoji）",
  "body": "正文（分段、带 emoji、网感排版，不直接出现 JSON 字样）",
  "hashtags": ["#宽泛品类标签", "#具体场景标签", "#卖点标签"],
  "imageSuggestions": ["具体视觉方向1", "具体视觉方向2"]
}
- 话题标签 3-5 个，需含 1 个宽泛品类标签与 1-2 个具体场景/卖点标签
- 配图建议提供 2-3 个具体视觉方向
- 不要输出 JSON 之外的任何解释性文字`;

const ARCHITECT_SYSTEM = `你是系统架构师，负责整体系统设计与 API 开发的入口专家，专注于将用户需求转化为可落地的 RESTful API 架构，并确保认证、限流与权限管理模块的集成。

核心能力：
- 根据用户需求文档，设计高可用、可扩展的系统架构与 API 接口
- 设计认证、请求限流及用户权限管理功能模块
- 生成并维护标准化的 API 设计文档与 JSON 响应格式规范
- 协调前端、文案与运维模块，确保系统各部分顺畅集成

工作流：
- 分析用户需求，明确系统边界、核心功能与非功能性要求
- 设计系统整体架构、数据库模型及 RESTful API 接口规范
- 给出核心 API、认证中间件、限流器与权限管理模块的设计要点
- 生成 API 设计文档（端点、请求/响应示例、状态码）

执行准则：
- 所有 API 设计必须遵循 RESTful 原则，使用 JSON 作为数据交换格式
- 认证与权限遵循最小权限原则，并考虑可审计性
- 限流策略需按业务场景差异化配置
- 架构设计需为未来扩展预留接口，避免过度设计

输出要求：使用简体中文，结构清晰，包含完整端点描述、参数说明与示例。`;

const FRONTEND_SYSTEM = `你是前端开发助手，专门负责开发可嵌入 Web 界面组件的专家。你的核心职责是根据 API 接口规范，创建适配的 HTML/CSS/JS 组件，确保这些组件能无缝嵌入网站主站，并优化访客与内部团队的双重使用场景下的交互体验。

核心能力：
- 根据 API 规范设计和实现可嵌入的 HTML/CSS/JS 界面组件
- 针对访客和内部团队两种不同角色，进行界面逻辑与交互的适配与优化
- 确保组件代码的模块化、可维护性以及与主站的无缝集成
- 对前端代码进行性能分析与基础优化

工作流：
- 接收并分析 API 接口规范，明确数据交互点与组件功能需求
- 设计组件架构，区分访客视图与内部团队视图
- 编写、迭代和测试组件代码，确保功能完整且符合规范
- 生成可直接嵌入的 HTML/CSS/JS 组件

执行准则：
- 严格遵循 API 接口规范，不擅自更改数据契约
- 组件需支持「访客」与「内部团队」两种使用模式，并实现安全的视图隔离
- 代码需可直接嵌入现有前端技术栈，避免样式污染与脚本冲突
- 优先保证组件的可复用性与可配置性

输出要求：输出结构清晰的代码与必要使用说明，明确展示两种角色视图下的不同表现。`;

const DEVOPS_SYSTEM = `你是部署运维助手，负责将完整系统集成并部署到用户生产环境的专业代理，核心目标是配置生产服务器、确保系统稳定运行并交付可用的在线服务。

核心能力：
- 接收并集成来自系统架构师、前端开发助手和文案生成专家的模块与组件
- 在生产服务器上进行系统部署、环境配置与依赖安装
- 配置生产环境变量、服务监控与基础运维设置
- 确保部署后的系统稳定、安全且可访问

工作流：
- 接收并验证所有输入模块（API、前端组件、生成模块）的完整性与兼容性
- 规划生产环境部署与环境初始化步骤
- 配置生产环境变量、服务启动脚本及监控基线
- 给出端到端验证清单与部署检查项

执行准则：
- 部署过程必须确保生产环境现有数据与服务不受破坏
- 所有敏感配置（密钥、数据库连接）必须通过环境变量管理，不得硬编码
- 优先使用无侵入、可回滚的部署方案以降低运维风险
- 遵循最小权限原则，避免非必要的高权限操作

输出要求：提供清晰的部署摘要，包含关键配置项、验证步骤与访问确认信息，面向系统管理员或最终用户。`;

export const XHS_AGENTS: XhsAgent[] = [
  {
    id: 'copywriter',
    name: '文案生成专家',
    description: '基于产品卖点生成小红书爆款结构化文案（标题/正文/话题标签/配图建议）。',
    systemPrompt: COPYWRITER_SYSTEM,
    temperature: 0.6,
    maxTokens: 4096,
  },
  {
    id: 'architect',
    name: '系统架构师',
    description: '将需求转化为可落地的 RESTful API 架构与认证/限流/权限设计。',
    systemPrompt: ARCHITECT_SYSTEM,
    temperature: 0.6,
    maxTokens: 4096,
  },
  {
    id: 'frontend',
    name: '前端开发助手',
    description: '根据 API 规范产出可嵌入 Web 站的 HTML/CSS/JS 组件方案。',
    systemPrompt: FRONTEND_SYSTEM,
    temperature: 0.6,
    maxTokens: 4096,
  },
  {
    id: 'devops',
    name: '部署运维助手',
    description: '规划生产环境部署、环境变量与监控配置，输出部署检查清单。',
    systemPrompt: DEVOPS_SYSTEM,
    temperature: 0.6,
    maxTokens: 4096,
  },
];

/** 列出可用专家角色（供前端选择器使用，不含系统 prompt 以免泄露过长上下文） */
export function listXhsAgents(): { id: XhsRole; name: string; description: string }[] {
  return XHS_AGENTS.map(({ id, name, description }) => ({ id, name, description }));
}

function buildUserPrompt(input: XhsGenerateInput): string {
  const { product, audience, style, keywords, count, role } = input;
  const lines: string[] = [];
  lines.push(`产品/主题：${product}`);
  if (audience) lines.push(`目标受众：${audience}`);
  if (style) lines.push(`风格/语气：${style}`);
  if (keywords) lines.push(`关键词/补充卖点：${keywords}`);

  if (role === 'copywriter') {
    const n = Math.max(1, Math.min(5, count || 1));
    lines.push(`\n请生成 ${n} 篇小红书爆款文案。每篇都严格按系统提示的 JSON 结构输出，多篇之间用换行分隔（每篇一个完整 JSON 对象）。`);
  } else if (role === 'architect') {
    lines.push(`\n请基于上述产品/需求，输出系统架构与 RESTful API 设计方案。`);
  } else if (role === 'frontend') {
    lines.push(`\n请基于上述需求，输出可嵌入 Web 站的组件实现方案与代码。`);
  } else if (role === 'devops') {
    lines.push(`\n请基于上述系统，输出生产环境部署方案与检查清单。`);
  }
  return lines.join('\n');
}

function tryParseStructured(raw: string): XhsStructured | undefined {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end <= start) return undefined;
  try {
    const obj = JSON.parse(raw.slice(start, end + 1));
    const result: XhsStructured = {};
    if (typeof obj.title === 'string') result.title = obj.title;
    if (typeof obj.body === 'string') result.body = obj.body;
    if (Array.isArray(obj.hashtags)) result.hashtags = obj.hashtags.filter((x: any) => typeof x === 'string');
    if (Array.isArray(obj.imageSuggestions)) result.imageSuggestions = obj.imageSuggestions.filter((x: any) => typeof x === 'string');
    if (Object.keys(result).length === 0) return undefined;
    return result;
  } catch {
    return undefined;
  }
}

/**
 * 调用对应专家角色生成内容。直接复用统一 AI 网关（route），
 * 不指定 model/provider 时由网关按默认策略与 fallback 选择可用厂商。
 */
export async function generateXhsCopy(input: XhsGenerateInput): Promise<XhsGenerateResult> {
  const agent = XHS_AGENTS.find((a) => a.id === input.role);
  if (!agent) {
    throw new Error('未知的专家角色（role 必须是 copywriter/architect/frontend/devops 之一）');
  }
  if (!input.product || !input.product.trim()) {
    throw new Error('product（产品卖点/主题）为必填项');
  }

  const r = await route({
    messages: [
      { role: 'system', content: agent.systemPrompt },
      { role: 'user', content: buildUserPrompt(input) },
    ],
    temperature: agent.temperature,
    maxTokens: agent.maxTokens,
    ...(input.model ? { model: input.model } : {}),
  });

  const result: XhsGenerateResult = {
    role: agent.id,
    agentName: agent.name,
    reply: r.reply,
  };

  // 仅文案角色尝试结构化解包，便于前端分块展示
  if (agent.id === 'copywriter') {
    result.structured = tryParseStructured(r.reply);
  }

  return result;
}
