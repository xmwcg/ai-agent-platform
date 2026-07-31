# 贡献指南

感谢你对 Reasonix AI Agent Platform 的关注！

## 如何贡献

### 报告 Bug
1. 使用 [GitHub Issues](https://github.com/your-org/reasonix-ai/issues)
2. 描述复现步骤
3. 提供环境信息（OS、Node 版本、浏览器）

### 提交代码
1. Fork 本项目
2. 创建特性分支：`git checkout -b feat/your-feature`
3. 提交变更：`git commit -m 'feat: add your feature'`
4. 推送分支：`git push origin feat/your-feature`
5. 提交 Pull Request

### Commit 规范
使用 [Conventional Commits](https://www.conventionalcommits.org/)：

- `feat:` 新功能
- `fix:` Bug 修复
- `docs:` 文档变更
- `style:` 代码格式（不影响功能）
- `refactor:` 重构
- `perf:` 性能优化
- `test:` 测试相关
- `chore:` 构建/工具变更
- `security:` 安全修复

### 开发环境
```bash
# 安装依赖
cd client && npm install
cd ../server && npm install

# 启动开发服务器
cd client && npm run dev
cd server && npm run dev
```

### 代码审查
所有 PR 需要至少 1 位维护者审查通过后才能合并。

### 质量门禁
- TypeScript 编译零错误
- ESLint 检查通过
- 新功能需包含测试
- 安全相关变更需经过安全审查

### 行为准则
请遵守我们的[行为准则](CODE_OF_CONDUCT.md)。
