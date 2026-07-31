# AI Agent Platform - API 文档

## 基础信息

- **Base URL**: `http://localhost:3000/api`
- **认证方式**: JWT Token（Bearer Token）
- **响应格式**: JSON

## 通用响应格式

### 成功响应
```json
{
  "success": true,
  "data": {},
  "message": "操作成功"
}
```

### 错误响应
```json
{
  "success": false,
  "error": "错误类型",
  "message": "错误详情"
}
```

---

## 1. AI 对话接口

### 1.1 发送聊天消息
`POST /ai/chat`

**请求体**:
```json
{
  "message": "你好，请介绍一下自己",
  "sessionId": "session_xxx",  // 可选，不提供则创建新会话
  "config": {  // 可选
    "systemPrompt": "你是一个友好的助手",
    "temperature": 0.7,
    "maxTokens": 2000
  }
}
```

**响应**:
```json
{
  "success": true,
  "sessionId": "session_xxx",
  "message": "你好！我是一个 AI 助手...",
  "usage": {
    "prompt_tokens": 100,
    "completion_tokens": 50,
    "total_tokens": 150
  }
}
```

### 1.2 获取可用模型
`GET /ai/models`

**响应**:
```json
{
  "success": true,
  "models": [
    {
      "provider": "OpenAI",
      "models": ["gpt-4o", "gpt-4o-mini", "gpt-3.5-turbo"]
    }
  ],
  "providers": [
    {
      "name": "OpenAI",
      "defaultModel": "gpt-4o"
    }
  ],
  "defaultProvider": "OpenAI"
}
```

### 1.3 会话管理

#### 创建会话
`POST /ai/session`
```json
{
  "userId": "user123",
  "provider": "openai"
}
```

#### 获取会话历史
`GET /ai/session/:sessionId`

#### 清空会话
`DELETE /ai/session/:sessionId`

#### 删除会话
`DELETE /ai/session/:sessionId/delete`

---

## 2. 知识中枢接口

### 2.1 创建知识文档
`POST /knowledge`

**请求体**:
```json
{
  "title": "如何使用 RAG",
  "content": "RAG（Retrieval-Augmented Generation）是...",
  "tags": ["AI", "RAG"],
  "categories": ["技术文档"],
  "isPublic": true
}
```

### 2.2 获取文档列表
`GET /knowledge?page=1&limit=10&search=rag&tags=AI&categories=技术文档`

### 2.3 获取文档详情
`GET /knowledge/:id`

### 2.4 更新文档
`PUT /knowledge/:id`

### 2.5 删除文档
`DELETE /knowledge/:id`

### 2.6 获取标签和分类
`GET /knowledge/meta/tags-and-categories`

---

## 3. RAG 知识梳理接口

### 3.1 RAG 对话
`POST /rag/chat`

**请求体**:
```json
{
  "question": "什么是 RAG？",
  "sessionId": "session_xxx",  // 可选
  "userId": "user123"  // 可选
}
```

**响应**:
```json
{
  "success": true,
  "sessionId": "session_xxx",
  "answer": "RAG 是检索增强生成...",
  "sources": [
    {
      "id": "doc123",
      "title": "RAG 技术详解",
      "similarity": 0.89,
      "snippet": "RAG（Retrieval-Augmented Generation）..."
    }
  ]
}
```

### 3.2 为文档生成嵌入向量
`POST /rag/embed/document/:id`

### 3.3 批量嵌入文档
`POST /rag/embed/documents`
```json
{
  "documentIds": ["doc1", "doc2", "doc3"]
}
```

### 3.4 嵌入整个知识库
`POST /rag/embed/knowledge-base`

### 3.5 搜索相似文档
`POST /rag/search`
```json
{
  "query": "RAG 技术",
  "limit": 5,
  "minSimilarity": 0.7
}
```

### 3.6 获取 RAG 状态
`GET /rag/status`

---

## 4. 课程管理接口

### 4.1 创建课程
`POST /courses`

### 4.2 获取课程列表
`GET /courses?page=1&limit=10&category=AI&level=beginner`

### 4.3 获取课程详情
`GET /courses/:id`

### 4.4 更新课程
`PUT /courses/:id`

### 4.5 发布/取消发布课程
`PATCH /courses/:id/publish`
```json
{
  "isPublished": true
}
```

### 4.6 添加章节
`POST /courses/:id/chapters`

---

## 5. 代码解释接口

### 5.1 解释代码
`POST /code/explain`

**请求体**:
```json
{
  "code": "function fibonacci(n) { return n <= 1 ? n : fibonacci(n-1) + fibonacci(n-2); }",
  "language": "javascript",
  "level": "detailed",  // brief | detailed | teaching
  "context": "这是一个计算斐波那契数列的函数"
}
```

**响应**:
```json
{
  "success": true,
  "explanation": "这是一个使用递归计算斐波那契数列的函数...\n\n**关键概念**:\n- 递归\n- 条件判断\n- 函数调用",
  "concepts": ["function", "recursion", "condition"]
}
```

### 5.2 生成代码示例
`POST /code/example`
```json
{
  "concept": "递归",
  "language": "python"
}
```

### 5.3 获取支持的编程语言
`GET /code/languages`

---

## 6. 健康检查

`GET /health`

**响应**:
```json
{
  "status": "healthy",
  "mongodb": "connected",
  "redis": "connected",
  "uptime": 123.45,
  "timestamp": "2025-01-08T12:00:00.000Z"
}
```

---

## 错误代码

| 状态码 | 说明 |
|--------|------|
| 200 | 成功 |
| 400 | 请求参数错误 |
| 401 | 未认证 |
| 403 | 无权限 |
| 404 | 资源未找到 |
| 429 | 请求过于频繁 |
| 500 | 服务器内部错误 |

---

## 使用示例

### cURL 示例

#### 发送聊天消息
```bash
curl -X POST http://localhost:3000/api/ai/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "你好",
    "sessionId": ""
  }'
```

#### 创建知识文档
```bash
curl -X POST http://localhost:3000/api/knowledge \
  -H "Content-Type: application/json" \
  -d '{
    "title": "测试文档",
    "content": "这是一个测试文档的内容...",
    "tags": ["测试"],
    "categories": ["示例"]
  }'
```

---

## 更多帮助

- **GitHub**: [项目地址](#)
- **问题反馈**: [Issues](#)
- **联系作者**: your-email@example.com

---

**文档版本**: v0.1.0  
**最后更新**: 2025-01-08
