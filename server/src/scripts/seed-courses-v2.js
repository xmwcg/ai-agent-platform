// Direct MongoDB course seeder - bypasses Mongoose schema issues
const mongoose = require("mongoose");
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://mongodb:27017/ai-agent-platform";

const courses = [
  {
    title: "AI Agent 开发实战",
    description: "从零搭建企业级 AI Agent 系统，涵盖工具调用、记忆管理、多 Agent 协作与生产部署。",
    instructor: "system",
    level: "intermediate",
    category: "AI开发",
    tags: ["AI Agent", "LLM", "LangChain", "函数调用"],
    price: 29900,
    isPublished: true,
    enrolledStudents: 328,
    rating: 4.9,
    chapters: [
      { title: "Agent 架构设计", description: "理解 ReAct、Plan-Execute、Multi-Agent 架构模式", order: 0, duration: 60, content: "# AI Agent 架构\n\nReAct = Reasoning + Acting，是最主流的 Agent 模式。" },
      { title: "工具调用与函数注册", description: "实现 Function Calling，连接外部API与数据库", order: 1, duration: 75, content: "## Function Calling\n\n将 LLM 与外部工具连接。" },
      { title: "记忆与上下文管理", description: "短期记忆、长期记忆、向量数据库检索", order: 2, duration: 60, content: "## 记忆系统\n\n- 短期记忆：对话历史\n- 长期记忆：向量检索" },
    ]
  },
  {
    title: "Python 数据科学入门",
    description: "使用 Pandas、NumPy、Matplotlib 进行数据分析与可视化，适合编程初学者。",
    instructor: "system",
    level: "beginner",
    category: "数据科学",
    tags: ["Python", "数据分析", "Pandas", "可视化"],
    price: 0,
    isPublished: true,
    enrolledStudents: 512,
    rating: 4.6,
    chapters: [
      { title: "Python 基础回顾", description: "变量、循环、函数、列表推导式", order: 0, duration: 45, content: "# Python 基础\n\n快速回顾核心语法。" },
      { title: "NumPy 数值计算", description: "数组操作、广播机制、线性代数", order: 1, duration: 60, content: "## NumPy\n\n多维数组计算引擎。" },
      { title: "Pandas 数据处理", description: "DataFrame 操作、数据清洗、分组聚合", order: 2, duration: 75, content: "## Pandas\n\ndf.groupby().agg() 是核心操作。" },
      { title: "Matplotlib 可视化", description: "折线图、柱状图、散点图、子图布局", order: 3, duration: 50, content: "## 可视化\n\nplt.plot() / plt.bar() / plt.scatter()" },
    ]
  },
  {
    title: "Web 全栈开发速成",
    description: "React + Node.js + MongoDB 全栈项目实战，从零构建完整的 SaaS 应用。",
    instructor: "system",
    level: "intermediate",
    category: "Web开发",
    tags: ["React", "Node.js", "MongoDB", "全栈"],
    price: 19900,
    isPublished: true,
    enrolledStudents: 245,
    rating: 4.7,
    chapters: [
      { title: "项目初始化与架构", description: "Monorepo 结构、前后端分离、环境配置", order: 0, duration: 45, content: "# 全栈架构\n\n前端 React + 后端 Express + 数据库 MongoDB。" },
      { title: "RESTful API 设计", description: "CRUD 接口、中间件、错误处理、认证鉴权", order: 1, duration: 90, content: "## API 设计\n\nGET/POST/PUT/DELETE + JWT 认证。" },
      { title: "React 前端开发", description: "组件化、Hooks、状态管理、路由", order: 2, duration: 90, content: "## React\n\nuseState/useEffect + React Router。" },
    ]
  },
  {
    title: "DevOps 与 CI/CD 实践",
    description: "GitHub Actions、Docker、Kubernetes 部署流水线，实现自动化测试与发布。",
    instructor: "system",
    level: "advanced",
    category: "DevOps",
    tags: ["Docker", "K8s", "CI/CD", "GitHub Actions"],
    price: 39900,
    isPublished: true,
    enrolledStudents: 189,
    rating: 4.8,
    chapters: [
      { title: "Docker 容器化", description: "Dockerfile 编写、多阶段构建、镜像优化", order: 0, duration: 60, content: "# Docker\n\nFROM node:22 AS build..." },
      { title: "GitHub Actions", description: "自动化测试、构建、部署流水线", order: 1, duration: 75, content: "## CI/CD\n\non: push -> test -> build -> deploy" },
      { title: "Kubernetes 部署", description: "Deployment、Service、Ingress、Helm", order: 2, duration: 90, content: "## K8s\n\nkubectl apply -f deployment.yaml" },
    ]
  }
];

async function seed() {
  await mongoose.connect(MONGODB_URI);
  const db = mongoose.connection.db;
  const col = db.collection("courses");
  await col.deleteMany({});
  const result = await col.insertMany(courses);
  console.log("Inserted " + result.insertedCount + " courses");
  await mongoose.disconnect();
}

seed().catch(e => { console.error(e); process.exit(1); });