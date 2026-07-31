# CloudBase 双环境免费模型接入指南

> 适用场景：将 aibak.site /ai-chat 页面的 AI 对话能力接入腾讯云 CloudBase 小程序成长计划免费额度。
> 
> 本文档记录完整流程：**环境准备 → 云函数编写 → 前端集成 → 部署上线**。
>
> 最终效果：用户在 aibak.site/ai-chat 可选择 4 个免费模型（2 文本 + 2 图像），由两个独立的 CloudBase 环境分别提供额度。

---

## 目录

- [1. 架构概览](#1-架构概览)
- [2. 环境准备](#2-环境准备)
- [3. 云函数开发](#3-云函数开发)
- [4. 前端页面集成](#4-前端页面集成)
- [5. 部署步骤](#5-部署步骤)
- [6. 故障排查](#6-故障排查)
- [7. 安全提醒](#7-安全提醒)

---

## 1. 架构概览

```
浏览器 (aibak.site/ai-chat)
    │
    ├─ 额度池 A（jymkjtools-study-d6eipek12446b18）
    │     ├─ ai-chat（云函数）→ hy3, hy3-preview
    │     └─ ai-image（云函数）→ HY-Image-3.0-Plus（文生图）, HY-Image-v3.0-I2I（图生图）
    │
    └─ 额度池 B（jymkj-knowlage-d8gmhvqyq1051579d）
          ├─ ai-chat-knowlage（云函数）→ hy3, hy3-preview
          └─ ai-image-knowlage（云函数）→ HY-Image-3.0-Plus（文生图）, HY-Image-v3.0-I2I（图生图）
```

### 核心设计原则

| 原则 | 说明 |
|------|------|
| **云函数桥接（三-B）** | 必须通过云函数调用 AI 模型，不能前端直连 API Gateway |
| **Key 不进前端** | 所有敏感凭据仅存在于服务端，用户无法获取或复用 |
| **独立额度池** | 两环境互相独立，一个额度用完可切换另一个 |
| **node-sdk 身份** | 使用 `@cloudbase/node-sdk` 的 `app.ai()` 接口，消耗的是小程序成长计划免费额度 |

---

## 2. 环境准备

### 2.1 开通小程序成长计划

1. 登录 [CloudBase 控制台](https://console.cloud.tencent.com/tcb)
2. 进入目标环境 → 左侧菜单「模型管理」→ 「小程序成长计划」
3. 确认已激活且有可用额度

**需要两个环境都开通**：
- `jymkjtools-study-d6eipek12446b18`（原环境）
- `jymkj-knowlage-d8gmhvqyq1051579d`（新环境）

### 2.2 安装 CLI 工具

```bash
npm install -g @cloudbase/cli
```

登录后配置：
```bash
tcb login
```

### 2.3 初始化 Node 项目

在每个函数的目录下执行：

```bash
cd functions/ai-chat
npm init -y
npm install @cloudbase/node-sdk@latest
```

---

## 3. 云函数开发

### 3.1 文本对话函数 (`functions/ai-chat/index.js`)

完整代码见 [functions/ai-chat/index.js](./cloud-functions/functions/ai-chat/index.js)。

#### 关键要点

```javascript
const tcb = require("@cloudbase/node-sdk");

const app = tcb.init({
  env: "目标环境ID",      // ← 重要：改这里决定走哪个环境的免费额度
  timeout: 60000,
});

exports.main = async (event, context) => {
  const ai = app.ai();
  const aiModel = ai.createModel("cloudbase");

  const result = await aiModel.generateText({
    model: "hy3",              // 支持: hy3, hy3-preview
    messages: [{ role: "user", content: "你好" }],
  });

  return { statusCode: 200, body: JSON.stringify(result) };
};
```

#### CORS 处理

浏览器直接 POST 请求时，必须在响应头中设置：

```javascript
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};
```

### 3.2 图像生成函数 (`functions/ai-image/index.js`)

完整代码见 [functions/ai-image/index.js](./cloud-functions/functions/ai-image/index.js)。

#### 文生图

```javascript
const res = await aiModel.image({
  model: "HY-Image-3.0-Plus-4090-Tob-v1.0",
  prompt: "一只猫",
});
// res.images 包含生成的 base64 图片
```

#### 图生图（I2I）

```javascript
const res = await aiModel.image({
  model: "HY-Image-v3.0-I2I-ToB-v1.0.1",
  prompt: "把这张图变成动漫风格",
  images: [base64String.replace(/^data:image\/[a-z]+;base64,/, "")],
});
```

### 3.3 模型白名单

在云函数内部做模型校验，防止用户调用非免费模型：

```javascript
const ALLOWED_MODELS = ["hy3", "hy3-preview"];
if (!ALLOWED_MODELS.includes(model)) {
  return { statusCode: 400, body: JSON.stringify({ error: "不支持的模型" }) };
}
```

---

## 4. 前端页面集成

### 4.1 chat.html 结构

```html
<!-- 环境选择器 -->
<select id="envSelect" onchange="switchEnv()">
  <option value="study">额度池 A — jymkjtools-study</option>
  <option value="knowlage">额度池 B — jymkj-knowlage</option>
</select>

<!-- 模型选择器 -->
<select id="modelSelect">
  <option value="hy3">hy3</option>
  <option value="hy3-preview">hy3-preview</option>
  <option value="HY-Image-3.0-Plus-4090-Tob-v1.0">文生图</option>
  <option value="HY-Image-v3.0-I2I-ToB-v1.0.1">图生图</option>
</select>
```

### 4.2 环境变量映射

```javascript
const ENVS = {
  study: {
    name: "jymkjtools-study",
    chatApi: "https://jymkjtools-study-d6eipek12446b18-xxxxxx.ap-shanghai.app.tcloudbase.com/ai-chat",
    imageApi: "https://jymkjtools-study-d6eipek12446b18-xxxxxx.ap-shanghai.app.tcloudbase.com/ai-image",
  },
  knowlage: {
    name: "jymkj-knowlage",
    chatApi: "https://jymkj-knowlage-d8gmhvqyq1051579d-xxxxxx.ap-shanghai.app.tcloudbase.com/ai-chat-knowlage",
    imageApi: "https://jymkj-knowlage-d8gmhvqyq1051579d-xxxxxx.ap-shanghai.app.tcloudbase.com/ai-image-knowlage",
  }
};
```

> ⚠️ `xxxxxx` 是 HTTP 触发器后的 6 位短码，部署后才能拿到。见 §5。

### 4.3 发送消息

```javascript
async function sendMessage(text) {
  const env = ENVS[currentEnv];
  const res = await fetch(env.chatApi, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages: history,
      model: selectedModel,
    }),
  });
  const data = await res.json();
  return data.text;
}
```

---

## 5. 部署步骤

### 5.1 部署云函数

在项目根目录执行：

```bash
# 部署文本对话函数
tcb service create -f ai-chat -p /ai-chat --env jymkjtools-study-d6eipek12446b18

# 部署图像生成函数
tcb service create -f ai-image -p /ai-image --env jymkjtools-study-d6eipek12446b18

# 部署新环境函数
tcb service create -f ai-chat-knowlage -p /ai-chat-knowlage --env jymkj-knowlage-d8gmhvqyq1051579d
tcb service create -f ai-image-knowlage -p /ai-image-knowlage --env jymkj-knowlage-d8gmhvqyq1051579d
```

### 5.2 获取 HTTP 触发器地址

部署成功后，CLI 会输出类似：

```
HTTP Endpoint: https://jymkjtools-study-d6eipek12446b18-1450366372.ap-shanghai.app.tcloudbase.com/ai-chat
```

**记下这个地址，回填到 `chat.html` 的 `ENVS` 配置中。**

也可以在 CloudBase 控制台查看：
1. 进入环境 → 云函数
2. 点击函数名称 → 「访问方式」标签页
3. 复制 HTTPS 地址

### 5.3 上传前端文件

将以下文件上传到你的服务器：

| 文件 | 路径 |
|------|------|
| `chat.html` | `/ai-chat/chat.html` |
| `web-demo.html` | `/ai-chat/web-demo.html` |
| `aibak-chat-widget.js` | `/ai-chat/aibak-chat-widget.js` |

或者直接把整个 `client/public/ai-chat/` 目录部署到你的 CDN/Nginx。

---

## 6. 故障排查

### 问题 1：`TypeError: app.ai is not a function`

**原因**：`@cloudbase/node-sdk` 版本过低，不支持 AI 模块。

**解决**：
```bash
npm install @cloudbase/node-sdk@latest
```

### 问题 2：模型返回空或乱码

**原因**：prompt 中包含非 UTF-8 字符。

**解决**：确保 JSON 编码正确，测试时先用简单英文 prompt。

### 问题 3：CORS 错误

**原因**：云函数未设置 CORS 响应头，或浏览器拦截了跨域请求。

**解决**：检查 `index.js` 中的 `CORS_HEADERS` 是否正确返回。

### 问题 4：额度消耗完了怎么办？

前端会自动显示剩余次数：

```javascript
// localStorage 存储今日使用次数
const todayKey = `aibak_free_${YYYY-MM-DD}`;
const quota = JSON.parse(localStorage.getItem(todayKey) || "{}");
console.log(`对话: ${quota.chat}/30, 生图: ${quota.image}/15`);
```

达到上限后提示用户切换到另一个额度池，或等待次日重置。

---

## 7. 安全提醒

### 绝对不要做的事

| 行为 | 风险 |
|------|------|
| ❌ 把 API Key 写在 `chat.html` 中 | 任何人可以右键查看源代码，偷用你的免费额度 |
| ❌ 在前端环境变量中暴露云函数密钥 | 同上 |
| ❌ 允许用户指定任意模型名 | 可能被用于调用付费模型 |

### 必须遵守的规则

| 规则 | 说明 |
|------|------|
| ✅ 所有 AI 调用必须经过云函数 | 前端只发 POST 到 HTTPS 地址 |
| ✅ 云函数内做模型白名单校验 | 不允许的模型直接返回 400 |
| ✅ 每天额度软上限（如 30 次） | 超过后提示用户明天再来 |
| ✅ 定期清理旧日志和未使用的云函数 | 减少攻击面 |

### 关于 API Key

如果你选择走「AI 网关直连（方式三-A）」：
- API Key **只能放在服务器后端**（Node.js / Python 代理层）
- **绝对不能**出现在前端 JS、HTML 或任何公开可访问的文件中
- 建议通过环境变量注入

---

## 附录 A：文件清单

| 文件 | 用途 |
|------|------|
| `cloud-functions/functions/ai-chat/index.js` | 文本对话云函数（原环境） |
| `cloud-functions/functions/ai-image/index.js` | 图像生成云函数（原环境） |
| `cloud-functions/functions/ai-chat-knowlage/index.js` | 文本对话云函数（新环境） |
| `cloud-functions/functions/ai-image-knowlage/index.js` | 图像生成云函数（新环境） |
| `cloud-functions/cloudbaserc.json` | CLI 部署配置 |
| `client/public/ai-chat/chat.html` | 前端对话页面 |
| `client/public/ai-chat/web-demo.html` | 快速体验页 |
| `client/public/ai-chat/aibak-chat-widget.js` | 嵌入式 Widget SDK |

## 附录 B：模型对照表

| 模型 ID | 类型 | 用途 | 所属计划 |
|---------|------|------|----------|
| `hy3` | 文本 | 对话 / 问答 | 小程序成长计划 |
| `hy3-preview` | 文本 | 对话 / 问答 | 小程序成长计划 |
| `HY-Image-3.0-Plus-4090-Tob-v1.0` | 图像 | 文生图 | 小程序成长计划 |
| `HY-Image-v3.0-I2I-ToB-v1.0.1` | 图像 | 图生图 | 小程序成长计划 |

---

> 本文档基于实际部署经验编写，最后更新：2026-07-22
