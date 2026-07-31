import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { KnowledgeDocument } from '../models/KnowledgeDocument';

dotenv.config();

const sampleDocuments = [
  {
    title: 'RAG（检索增强生成）技术详解',
    content: `# RAG 技术概述

RAG（Retrieval-Augmented Generation，检索增强生成）是一种将信息检索与文本生成相结合的技术。

## 核心原理

RAG 的工作流程分为三个步骤：

1. **检索（Retrieval）**：根据用户查询，从知识库中检索相关文档
2. **增强（Augmentation）**：将检索到的文档作为上下文，与用户查询一起构建提示词
3. **生成（Generation）**：将增强后的提示词输入到大语言模型，生成最终回答

## 优势

- ✅ 减少幻觉（Hallucination）
- ✅ 知识可更新（无需重新训练模型）
- ✅ 来源可追溯（提供引用文档）

## 代码示例

\`\`\`typescript
// 简化的 RAG 流程
async function ragChat(query: string) {
  // 1. 检索
  const docs = await searchSimilarDocuments(query);
  
  // 2. 增强
  const context = docs.map(doc => doc.content).join('\\n');
  const prompt = \`基于以下上下文回答：\\n\${context}\\n\\n问题：\${query}\`;
  
  // 3. 生成
  const answer = await aiModel.generate(prompt);
  return answer;
}
\`\`\`

## 应用场景

- 📚 知识库问答
- 📖 文档助手
- 🔬 研究辅助
- 💼 企业知识管理`,
    tags: ['AI', 'RAG', '技术文档'],
    categories: ['技术'],
    isPublic: true,
    viewCount: 42,
    author: 'system'
  },
  {
    title: '如何使用 Tiptap 创建 Markdown 编辑器',
    content: `# Tiptap Markdown 编辑器

Tiptap 是一个基于 ProseMirror 的现代化富文本编辑器。

## 安装

\`\`\`bash
npm install @tiptap/react @tiptap/starter-kit
\`\`\`

## 基础用法

\`\`\`typescript
import { useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';

function MyEditor() {
  const editor = useEditor({
    extensions: [StarterKit],
    content: '<p>Hello World!</p>',
  });

  return (
    <div>
      <button onClick={() => editor?.chain().focus().toggleBold().run()}>
        Bold
      </button>
      <EditorContent editor={editor} />
    </div>
  );
}
\`\`\`

## 常用扩展

- \`Bold\` - 加粗
- \`Italic\` - 斜体
- \`Heading\` - 标题
- \`BulletList\` - 无序列表
- \`CodeBlock\` - 代码块`,
    tags: ['前端', 'React', 'Tiptap'],
    categories: ['教程'],
    isPublic: true,
    viewCount: 128,
    author: 'system'
  },
  {
    title: 'OpenAI API 快速入门',
    content: `# OpenAI API 快速入门

## 获取 API Key

1. 访问 https://platform.openai.com/
2. 注册并登录
3. 进入 API Keys 页面
4. 创建新的 Secret Key

## 第一个 API 调用

\`\`\`typescript
import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const completion = await client.chat.completions.create({
  model: 'gpt-4o',
  messages: [
    { role: 'user', content: '你好！' }
  ],
});

console.log(completion.choices[0].message.content);
\`\`\`

## 常用模型

| 模型 | 说明 | 价格 |
|------|------|------|
| gpt-4o | 最新旗舰模型 | $5/M tokens |
| gpt-4o-mini | 性价比高 | $0.15/M tokens |
| gpt-3.5-turbo | 经典模型 | $0.5/M tokens |

## 注意事项

- ⚠️ 保护你的 API Key
- 💰 设置使用限额
- 📊 监控 API 使用情况`,
    tags: ['AI', 'OpenAI', 'API'],
    categories: ['教程'],
    isPublic: true,
    viewCount: 256,
    author: 'system'
  }
];

async function seedDatabase() {
  try {
    // 连接数据库
    const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/ai-agent-platform';
    await mongoose.connect(MONGODB_URI);
    console.log('✅ MongoDB connected');

    // 清空现有数据
    await KnowledgeDocument.deleteMany({});
    console.log('🗑️  Cleared existing documents');

    // 插入测试数据
    const docs = await KnowledgeDocument.insertMany(sampleDocuments);
    console.log(`✅ Inserted ${docs.length} sample documents`);

    // 断开连接
    await mongoose.disconnect();
    console.log('👋 Disconnected from MongoDB');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Seed error:', error);
    process.exit(1);
  }
}

seedDatabase();
