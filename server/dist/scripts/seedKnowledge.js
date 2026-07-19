"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.seedKnowledgeSamples = seedKnowledgeSamples;
const KnowledgeDocument_1 = require("../models/KnowledgeDocument");
const logger_1 = require("../lib/logger");
// 系统虚拟作者（合法 ObjectId 字面量，仅用于示例文档归属展示）
const SYSTEM_AUTHOR = '64b0f2c2c3d4e5f600000001';
const SAMPLES = [
    {
        title: 'aibak 平台使用指南：从注册到上手',
        categories: ['平台指南'],
        categoryTree: ['平台指南', '入门'],
        tags: ['指南', '入门', '新手'],
        content: `# aibak 平台使用指南：从注册到上手

欢迎使用 aibak！本指南帮助你快速了解平台的核心能力与基本操作。

## 一、核心模块
- **AI 对话**：基于多模型路由的对话能力，支持上下文记忆与文件理解。
- **创作工坊**：聚合文生图、代码助手、文档工作流等创作工具。
- **知识库**：上传或撰写文档，支持积分/会员解锁、分享与格式转换。
- **中转站（Relay）**：统一管理多家大模型上游渠道，为对话与创作提供模型供给。
- **插件管理（MCP）**：接入第三方工具与服务，扩展智能体能力边界。

## 二、三步上手
1. **注册并登录**：使用邮箱注册，登录后即可使用全部模块。
2. **选择模型**：在「大模型配置」中查看可用渠道，对话时自动路由到最优上游。
3. **开始创作**：进入「创作工坊」或「AI 对话」，输入需求即可获得结果。

## 三、常见问题
- 若某模块提示需要登录，请先完成注册登录。
- 中转站渠道由运营统一配置，普通用户无需关心上游细节。
- 知识库文档可设置公开/私有，公开文档对所有访客可见。

> 提示：善用搜索与分类筛选，能更快找到你需要的资源。
`,
    },
    {
        title: 'AI 对话高效提问技巧（Prompt 实战）',
        categories: ['AI技巧'],
        categoryTree: ['AI技巧', '提示词'],
        tags: ['提示词', '技巧', '效率'],
        content: `# AI 对话高效提问技巧（Prompt 实战）

同样一个问题，措辞不同，结果天差地别。下面是一组可复用的提问框架。

## 一、结构化提问公式
**角色 + 任务 + 约束 + 输出格式**
> 例：「你是一名资深后端工程师，帮我把这段 Python 代码重构为异步版本，要求保留原有接口签名，并给出单元测试示例。」

## 二、常见误区
- 太笼统：「帮我写个文章」→ 补充主题、受众、字数、风格。
- 一次塞太多任务：拆成多轮，逐步收敛。
- 缺少上下文：给出相关代码/数据片段，AI 才能对症下药。

## 三、进阶技巧
1. **少样本（Few-shot）**：给 1~3 个示例，显著提升一致性。
2. **思维链（CoT）**：要求「先列出步骤，再给结论」，复杂推理更稳。
3. **自我校验**：让模型在回答后「检查是否存在事实错误」。

掌握以上方法，你能把 AI 从「玩具」变成「生产力工具」。
`,
    },
    {
        title: '知识库积分与会员体系说明',
        categories: ['平台指南'],
        categoryTree: ['平台指南', '商业化'],
        tags: ['积分', '会员', '解锁'],
        content: `# 知识库积分与会员体系说明

知识库支持创作者通过内容获得收益，读者通过积分或会员解锁优质内容。

## 一、解锁方式
- **免费公开**：所有访客可直接阅读。
- **积分解锁**：消耗一定积分查看/下载，适合单篇付费场景。
- **会员等级**：设置 requiredPlan（free / pro / max），仅对应等级及以上会员可见。
- **试看页数**：文档类可设置 freePreviewPages，前 N 页免费，后续需解锁。

## 二、创作者视角
- 在创建文档时填写 \`price\` / \`creditsCost\` / \`requiredPlan\` 即可开启变现。
- 文档浏览量、解锁量会在创作者后台汇总。

## 三、读者视角
- 余额不足时，先去「账户」完成积分充值或升级会员。
- 已解锁内容会出现在「我的知识库」，避免重复扣费（unlockedBy 去重）。

平台鼓励优质原创，持续创作可获得流量与收益倾斜。
`,
    },
    {
        title: '中转站（Relay）配置与上游接入指南',
        categories: ['API文档'],
        categoryTree: ['API文档', '中转站'],
        tags: ['中转站', 'api', '上游'],
        content: `# 中转站（Relay）配置与上游接入指南

中转站是平台统一的大模型流量入口，负责把对话/创作请求路由到配置好的上游渠道。

## 一、渠道字段说明
- **provider**：厂商标识（deepseek / openai / dashscope / hunyuan / moonshot / gemini 等）。
- **baseURL**：OpenAI 兼容接口地址，例如 \`https://api.deepseek.com/v1\`。
- **apiKey**：上游密钥，存储时自动加密，不以明文落库。
- **models**：该渠道支持的模型名列表。
- **authMode**：鉴权方式，通常为 \`bearer\`。
- **weight / enabled**：权重与启用开关，用于灰度与故障隔离。

## 二、自动播种
部署时若数据库尚无任何渠道，且环境变量配置了对应厂商 Key，系统会**自动播种**默认渠道，做到开箱即用。

## 三、新增自定义上游
在「中转站」管理页点击新增，填入上述字段并启用即可。系统会按权重与健康度自动调度。
`,
    },
    {
        title: '常见问题 FAQ 与故障排查',
        categories: ['帮助'],
        categoryTree: ['帮助', 'FAQ'],
        tags: ['faq', '排查', '帮助'],
        content: `# 常见问题 FAQ 与故障排查

## Q1：为什么某个模块打不开？
多数情况是未登录或会话过期，请重新登录；若提示维护中，稍后重试。

## Q2：AI 对话没有响应？
检查「大模型配置」是否有可用渠道；上游限流或密钥失效时请更换渠道。

## Q3：知识库文档无法下载？
确认是否已解锁（积分/会员），未解锁内容仅支持试看。

## Q4：中转站请求 5xx？
通常是上游渠道异常，在「中转站」中禁用故障渠道或补充余额。

## Q5：创作工坊生成慢？
文生图、长文创作本身耗时较长，请耐心等待；任务进度可在对应页面查看。

如问题仍未解决，可通过「客服」模块提交工单。
`,
    },
];
/**
 * 知识库示例文档播种（幂等）：
 * 仅在同名标题文档不存在时插入，避免重复。使首页/知识库列表开箱即有内容。
 */
async function seedKnowledgeSamples() {
    let n = 0;
    for (const s of SAMPLES) {
        const dup = await KnowledgeDocument_1.KnowledgeDocument.findOne({ title: s.title });
        if (dup)
            continue;
        await KnowledgeDocument_1.KnowledgeDocument.create({
            title: s.title,
            content: s.content,
            tags: s.tags,
            categories: s.categories,
            categoryTree: s.categoryTree,
            isPublic: true,
            requiredPlan: s.requiredPlan || 'free',
            creditsCost: s.creditsCost,
            freePreviewPages: s.freePreviewPages,
            author: SYSTEM_AUTHOR,
        });
        n++;
    }
    if (n > 0) {
        logger_1.logger.info('seed', `已播种 ${n} 篇示例知识文档`);
    }
    else {
        logger_1.logger.info('seed', '示例知识文档已存在，跳过播种');
    }
}
//# sourceMappingURL=seedKnowledge.js.map