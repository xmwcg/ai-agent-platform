# AIbak 智评通 — 生产部署最终验证清单

## 部署前置条件

### 1. 环境变量配置 (server/.env)

```bash
# 必需
MONGODB_URI=mongodb://127.0.0.1:27017/aibak
REDIS_URL=redis://127.0.0.1:6379
JWT_SECRET=<生成64位随机字符串>
ENABLE_MOCK_MODE=false
NODE_ENV=production
PUBLIC_BASE_URL=https://aibak.site

# 邮件（可选但推荐）
EMAIL_TRANSPORT=smtp           # smtp | sendgrid | mock
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=noreply@aibak.site
SMTP_PASS=<邮箱密码>
EMAIL_FROM="AIBak 智评通 <noreply@aibak.site>"

# 微信支付（可选，需商户号）
DEFAULT_PAY_PROVIDER=mock       # mock | wechat | stripe
WECHAT_MCH_ID=
WECHAT_APP_ID=
WECHAT_API_V3_KEY=
WECHAT_CERT_SERIAL=
WECHAT_PRIVATE_KEY=
WECHAT_PLATFORM_CERT=

# 微信登录（可选）
WECHAT_OPEN_APPID=
WECHAT_OPEN_SECRET=

# Stripe（可选）
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
```

### 2. 服务器软件依赖

```bash
# Node.js >= 18
# MongoDB >= 6.0
# Redis >= 7.0
# Chromium（用于 PDF 生成）
apt install -y chromium-browser
# Caddy（用于 HTTPS 反代）
```

### 3. 部署步骤

```bash
# 1. 上传项目到服务器
scp -r ai-agent-platform user@aibak.site:/opt/

# 2. 执行部署脚本
cd /opt/ai-agent-platform
bash deploy/push-deploy.sh

# 3. 安装 cron 定时任务
bash deploy/cron-reengagement.sh

# 4. 验证
curl https://aibak.site/api/ops
```

## 部署后验证

### 验证项

| # | 检查项 | 命令 | 预期结果 |
|---|--------|------|----------|
| 1 | 服务健康 | `curl https://aibak.site/api/ops` | `{"ok":true}` |
| 2 | 前端可访问 | 浏览器打开 `https://aibak.site` | 首页正常加载 |
| 3 | 智评通落地页 | `curl https://aibak.site/project-grade` | 返回 HTML |
| 4 | 公开数据 | `curl https://aibak.site/api/project-grade/public/landing` | 返回 JSON |
| 5 | 匿名体检 | `curl -X POST https://aibak.site/api/project-grade/evaluate -H "Content-Type: application/json" -d '{"url":"https://aibak.site"}'` | 返回 sessionId |
| 6 | 套餐查询 | `curl https://aibak.site/api/billing/plans` | 返回免费版 |
| 7 | API 代理 | `curl https://aibak.site/api/ops/public` | serviceOnline: true |
| 8 | 静态资源 | 浏览器 DevTools → 无 404 | — |
| 9 | robots.txt | `curl https://aibak.site/robots.txt` | 包含 Allow 规则 |
| 10 | sitemap.xml | `curl https://aibak.site/sitemap.xml` | 返回 XML |

## 商业闭环验证

| 路径 | 步骤 | 预期 |
|------|------|------|
| 获客 | 用户访问 aibak.site → 点击"智评通" → 免费体检 | 成功扫描 URL |
| 注册 | 体检结果页 → 点击"保存项目" → 注册 | 注册成功 + 归因关联 |
| 付费 | 项目页 → 升级套餐 → 微信扫码 → 支付 | 权益实时到账 |
| 报告 | 发布报告 → 公开链接 → PDF 下载 | 报告可访问 |
| 售后 | 客服入口 → 退款申请 → 管理员处理 | 状态通知 |
| 运营 | 管理员看板 /ops-dashboard | 数据正常 |
| 分销 | 推荐码 → 新用户注册 → 佣金记录 | 关系链正确 |
| 通知 | 支付 → 邮件 + 站内信 | 都收到 |

## 已知限制（生产需关注）

- 微信支付：需申请商户号并配置 WECHAT_* 环境变量
- 微信登录：需配置 WECHAT_OPEN_APPID/SECRET
- PDF 生成：需服务器安装 Chromium（Docker 已含）
- 邮件发送：需配置 SMTP 或 SendGrid
- 真实支付验收：生产环境切换 DEFAULT_PAY_PROVIDER=wechat 前需完成沙箱测试
