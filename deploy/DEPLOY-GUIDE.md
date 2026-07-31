# NexMind Platform — 自动部署配置指南

## ⚠️ 只需做一次，之后全自动

---

## 第一步：在生产服务器上执行（SSH 进去，复制下面整段）

`ash
bash <(curl -s https://cnb.cool/aibak.site/ai-agent-platform/-/raw/main/deploy/setup-auto-deploy.sh)
`

如果 curl 不可用，手动执行：
`ash
mkdir -p ~/.ssh && chmod 700 ~/.ssh
echo 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIMeS4RMq2wVulMLDWphoR+UxH9jwDXYIkJqpSJslP0uN nexmind-deploy@aibak.site' >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys
cd /app && git pull origin main && cd client && npm ci && npm run build && cd ../server && npm ci && npx tsc && pm2 restart nexmind-platform
`

---

## 第二步：在 CNB 网页配置 Secrets

打开 https://cnb.cool/aibak.site/ai-agent-platform/-/settings/secrets

添加三个 Secret：

| 名称 | 值 |
|------|-----|
| DEPLOY_HOST | 你的服务器IP |
| DEPLOY_USER | root |
| DEPLOY_SSH_KEY | (见下方密钥) |

**DEPLOY_SSH_KEY 内容（完整复制）：**
`
-----BEGIN OPENSSH PRIVATE KEY-----
b3BlbnNzaC1rZXktdjEAAAAACmFlczI1Ni1jdHIAAAAGYmNyeXB0AAAAGAAAABCOCdjszd
o23BXxQ/XFFdoZAAAAEAAAAAEAAAAzAAAAC3NzaC1lZDI1NTE5AAAAIMeS4RMq2wVulMLD
WphoR+UxH9jwDXYIkJqpSJslP0uNAAAAoI1GCMwttGH8tOIT1ZJAwxO0B28M+HmRJsB1QT
c+X43CaKbZL572bDfDBSqqkxlf6uW4M2qQkBIJYl22uE9h6ZjA8jwCT/tz6ITIVJ+uQe9U
KEmVie2I3GH2SoempJ2vHhvls0f+8rQt8NkO7Gpco80PrwsiSTcxplEwta95smZfXlV3PK
DTHSZVRBXHyFybOefDRuych+ZEcPNJvqDtZOo=
-----END OPENSSH PRIVATE KEY-----
`

---

## 完成！

之后每次 git push main，CNB 自动：
1. 构建前端 (Vite)
2. 编译后端 (TypeScript)  
3. rsync 到生产服务器
4. pm2 restart

你在任何电脑上 push 代码，自动上线。
