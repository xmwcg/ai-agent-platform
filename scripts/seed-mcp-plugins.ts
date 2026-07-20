// scripts/seed-mcp-plugins.ts
// 预置 MCP 插件配置种子数据 — 服务器端直接 node 运行，不依赖 npx
import mongoose from "mongoose";
import { MCPServer } from "../server/src/models/MCPServer";

const BUILTIN_PLUGINS = [
  {
    id: "puppeteer",
    name: "Puppeteer 浏览器自动化",
    description: "通过 Puppeteer 控制无头浏览器，实现网页截图、PDF生成、表单填写等自动化操作",
    transport: "stdio" as const,
    command: "node",
    args: [],
    enabled: true,
    status: "disconnected" as const,
    installNote: "需要服务器预装 @anthropic/mcp-server-puppeteer 包。当前暂不可用，请等待管理后台「一键安装」功能。",
  },
  {
    id: "filesystem",
    name: "文件系统操作",
    description: "读取、写入、搜索、编辑本地文件，支持目录树浏览和批量文件操作",
    transport: "stdio" as const,
    command: "node",
    args: [],
    enabled: true,
    status: "disconnected" as const,
    installNote: "需要服务器预装 @anthropic/mcp-server-filesystem 包。",
  },
  {
    id: "github",
    name: "GitHub 仓库管理",
    description: "管理 GitHub 仓库、Issue、PR、分支，自动代码审查与提交",
    transport: "stdio" as const,
    command: "node",
    args: [],
    enabled: true,
    status: "disconnected" as const,
    installNote: "需要服务器预装 @anthropic/mcp-server-github 包，并配置 GITHUB_TOKEN 环境变量。",
  },
  {
    id: "postgres",
    name: "PostgreSQL 数据库",
    description: "连接 PostgreSQL 数据库，执行 SQL 查询、查看表结构和数据",
    transport: "stdio" as const,
    command: "node",
    args: [],
    enabled: true,
    status: "disconnected" as const,
    installNote: "需要服务器预装 @anthropic/mcp-server-postgres 包，并配置数据库连接串。",
  },
  {
    id: "brave-search",
    name: "Brave Search 网络搜索",
    description: "通过 Brave Search API 进行网页搜索，获取实时信息",
    transport: "stdio" as const,
    command: "node",
    args: [],
    enabled: true,
    status: "disconnected" as const,
    installNote: "需要服务器预装 @anthropic/mcp-server-brave-search 包，并配置 BRAVE_API_KEY。",
  },
];

async function seed() {
  const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/ai-agent-platform";
  await mongoose.connect(MONGODB_URI);
  console.log("Connected to MongoDB");

  for (const plugin of BUILTIN_PLUGINS) {
    const exists = await MCPServer.findOne({ id: plugin.id });
    if (!exists) {
      await MCPServer.create(plugin);
      console.log(`  ✅ Created: ${plugin.name}`);
    } else {
      // 只更新 installNote 和 description，不覆盖用户修改的配置
      await MCPServer.updateOne(
        { id: plugin.id },
        { $set: { description: plugin.description, installNote: plugin.installNote } }
      );
      console.log(`  🔄 Updated: ${plugin.name}`);
    }
  }

  console.log("\n✅ MCP 插件种子数据完成");
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
