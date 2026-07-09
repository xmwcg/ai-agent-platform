# AI Agent Platform - 部署指南

## 环境要求

### 必需
- **Node.js**: v18+ （推荐 v20+）
- **MongoDB**: v6.0+
- **Redis**: v7.0+
- **npm**: v9+ 或 **yarn**: v1.22+

### 可选
- **Docker**: v24+ （推荐用于快速部署）
- **Git**: 用于克隆代码

---

## 方式一：本地开发部署

### 1. 克隆项目
```bash
git clone https://github.com/yourusername/ai-agent-platform.git
cd ai-agent-platform
```

### 2. 安装依赖

#### 安装根目录依赖
```bash
npm install
```

#### 安装后端依赖
```bash
cd server
npm install
cd ..
```

#### 安装前端依赖
```bash
cd client
npm install
cd ..
```

### 3. 配置环境变量

#### 后端配置
复制 `server/.env.example` 到 `server/.env` 并填写：

```env
# 必填
PORT=3000
MONGODB_URI=mongodb://localhost:27017/ai-agent-platform
REDIS_URL=redis://localhost:6379
OPENAI_API_KEY=sk-your_openai_key

# 可选
ANTHROPIC_API_KEY=sk-ant-xxx
HUYUAN_API_KEY=xxx
CLIENT_URL=http://localhost:5173
```

#### 前端配置
前端使用 Vite 代理，通常无需额外配置。

### 4. 启动数据库

#### 方式 A：使用 Docker（推荐）
```bash
# 启动 MongoDB 和 Redis
docker-compose up -d mongodb redis

# 查看日志
docker-compose logs -f
```

#### 方式 B：本地安装
- **MongoDB**: 参考 [官方安装指南](https://www.mongodb.com/docs/manual/installation/)
- **Redis**: 参考 [官方安装指南](https://redis.io/docs/getting-started/installation/)

### 5. 启动开发服务器

#### 同时启动前后端
```bash
npm run dev
```

#### 分别启动
```bash
# 启动后端（终端1）
npm run dev:server

# 启动前端（终端2）
npm run dev:client
```

### 6. 访问应用

- **前端**: http://localhost:5173
- **后端 API**: http://localhost:3000
- **健康检查**: http://localhost:3000/api/health

---

## 方式二：Docker 完整部署

### 1. 克隆项目
```bash
git clone https://github.com/yourusername/ai-agent-platform.git
cd ai-agent-platform
```

### 2. 配置环境变量
```bash
cp server/.env.example server/.env
# 编辑 server/.env 填写 API Key
```

### 3. 使用 Docker Compose 部署
```bash
# 构建并启动所有服务
docker-compose up -d

# 查看服务状态
docker-compose ps

# 查看日志
docker-compose logs -f

# 停止服务
docker-compose down
```

### 4. 访问应用

- **前端**: http://localhost（Nginx 代理）
- **后端 API**: http://localhost:3000

---

## 方式三：生产环境部署

### 1. 构建项目
```bash
# 构建前端
cd client
npm run build
cd ..

# 构建后端
cd server
npm run build
cd ..
```

### 2. 配置生产环境变量
```env
NODE_ENV=production
PORT=3000
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/ai-agent-platform
REDIS_URL=redis://redis-server:6379
OPENAI_API_KEY=sk-xxx
```

### 3. 启动生产服务器
```bash
cd server
npm start
```

### 4. 使用 PM2 管理进程（推荐）
```bash
# 安装 PM2
npm install -g pm2

# 启动应用
pm2 start server/dist/index.js --name ai-agent-platform

# 查看状态
pm2 status

# 查看日志
pm2 logs ai-agent-platform
```

---

## 配置说明

### OpenAI API Key
1. 访问 https://platform.openai.com/
2. 注册并登录
3. 进入 API Keys 页面
4. 创建新的 Secret Key
5. 复制到 `.env` 文件

### 腾讯混元 API Key（可选）
1. 访问 https://cloud.tencent.com/
2. 开通混元大模型服务
3. 获取 API Key
4. 填入 `HUYUAN_API_KEY`

### 微信支付配置（可选）
1. 注册微信支付商户
2. 获取商户 ID 和 API Key
3. 配置 `WECHAT_MERCHANT_ID` 和 `WECHAT_API_V3_KEY`

---

## 常见问题

### 1. MongoDB 连接失败
**错误**: `MongooseServerSelectionError: connect ECONNREFUSED 127.0.0.1:27017`

**解决**:
- 确认 MongoDB 已启动：`docker-compose up -d mongodb` 或本地启动 MongoDB
- 检查 `MONGODB_URI` 是否正确

### 2. Redis 连接失败
**错误**: `AbortError: Ready check failed`

**解决**:
- 确认 Redis 已启动：`docker-compose up -d redis`
- 检查 `REDIS_URL` 是否正确

### 3. OpenAI API 调用失败
**错误**: `AuthenticationError: Incorrect API key provided`

**解决**:
- 检查 `OPENAI_API_KEY` 是否正确
- 确认 API Key 有余额

### 4. 前端无法访问后端
**错误**: `Proxy error: Could not proxy request`

**解决**:
- 确认后端已启动：`npm run dev:server`
- 检查 `vite.config.ts` 中的代理配置

### 5. 端口被占用
**错误**: `Error: listen EADDRINUSE: address already in use :::3000`

**解决**:
```bash
# 查找占用端口的进程
lsof -i:3000

# 杀死进程
kill -9 <PID>
```

---

## 性能优化

### 1. 启用 Redis 缓存
确保 Redis 连接正常，会话和向量数据会自动缓存。

### 2. 使用生产构建
```bash
npm run build
npm start
```

### 3. 配置 Nginx 反向代理
```nginx
server {
    listen 80;
    server_name yourdomain.com;

    location / {
        root /path/to/client/dist;
        try_files $uri $uri/ /index.html;
    }

    location /api {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

---

## 安全建议

1. **不要提交 `.env` 文件到 Git**
   - 已包含在 `.gitignore` 中

2. **使用强密码和 JWT Secret**
   ```env
   JWT_SECRET=your-super-secret-jwt-key-change-this
   ```

3. **启用 HTTPS**
   - 使用 Let's Encrypt 免费证书
   - 配置 Nginx SSL

4. **限制 API 访问**
   - 已启用 Rate Limiting（15分钟 100 次）
   - 可调整 `src/index.ts` 中的限制

5. **定期备份数据库**
   ```bash
   # MongoDB 备份
   mongodump --uri="mongodb://localhost:27017" --out=/backup
   ```

---

## 卸载

### 停止并删除容器
```bash
docker-compose down -v
```

### 删除项目
```bash
cd ..
rm -rf ai-agent-platform
```

---

## 获取帮助

- **GitHub Issues**: [提交问题](https://github.com/yourusername/ai-agent-platform/issues)
- **文档**: [查看完整文档](./README.md)
- **邮箱**: your-email@example.com

---

**部署指南版本**: v0.1.0  
**最后更新**: 2025-01-08
