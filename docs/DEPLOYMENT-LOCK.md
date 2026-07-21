# DEPLOYMENT-LOCK.md — 域名指向锁定规则

> **文档级别：强制执行（MANDATORY）**
> **最后更新：2026-07-21**
> **负责人：龙哥（项目负责人）**

---

## 1. 核心规则

### aibak.site 是 AI Agent Platform 的主站，永久锁定。

**任何开发者、运维人员、自动化工具（包括 `acli hermes webui`）不得将 `aibak.site` / `www.aibak.site` 域名指向 AI Agent Platform 以外的任何项目。**

违反此规则将导致线上主站被替换为错误内容，属于 **P0 级生产事故**。

---

## 2. 当前锁定配置

### 域名 → 服务映射

| 域名 | 指向 | 端口 | 说明 |
|------|------|------|------|
| `aibak.site` | AI Agent Platform 前端 + API | 443 → dist + 3000 | **主站，禁止修改** |
| `www.aibak.site` | 同上 | 同上 | 重定向到主站 |
| `159.75.124.59` | Caddy ACME challenge | 80 | Let's Encrypt HTTP-01 |
| `159.75.124.59:11038` | acli hermes 管理面板 | 11038 | hermes webui |

### Caddyfile aibak.site 配置块（权威版本）

```
aibak.site www.aibak.site {
    tls /etc/caddy/certs/aibak.site.crt /etc/caddy/certs/aibak.site.key

    root * /opt/ai-agent-platform/client/dist

    handle /api/* {
        reverse_proxy 127.0.0.1:3000
    }

    handle {
        try_files {path} /index.html
        file_server
    }
}
```

### 服务架构

```
用户浏览器
    │
    ▼
aibak.site:443 (Caddy v2.11.4)
    ├── TLS 证书: Let's Encrypt (CN=aibak.site, 有效期至 2026-10-07)
    ├── 静态文件: /opt/ai-agent-platform/client/dist/ (React SPA)
    └── /api/* → reverse_proxy 127.0.0.1:3000
                      │
                      ▼
              Docker: ai-platform-server
                      ├── MongoDB (ai-platform-mongodb)
                      └── Redis (ai-platform-redis)
```

---

## 3. 禁止事项

以下操作 **严格禁止**，无论任何理由：

1. **禁止** 将 `aibak.site` 的 `reverse_proxy` 指向非 `127.0.0.1:3000` 的端口
2. **禁止** 将 `aibak.site` 的 `root` 指向非 `/opt/ai-agent-platform/client/dist` 的目录
3. **禁止** 使用 `acli hermes webui` 修改 `aibak.site` 配置块
4. **禁止** 在 `aibak.site` 配置块中添加其他项目的 `reverse_proxy` 或 `handle_path`
5. **禁止** 将 `aibak.site` 的 TLS 证书替换为自签名证书
6. **禁止** 在 Caddyfile 中为 `aibak.site` 添加额外的站点别名

---

## 4. 其他项目的部署规则

服务器上可以部署其他项目（如金网通等），但必须遵守以下规则：

- **其他项目不得使用 `aibak.site` 域名**
- 其他项目应使用子域名（如 `jinwangtong.aibak.site`）或独立端口访问
- 其他项目的 Caddyfile 配置块必须与 `aibak.site` 配置块完全独立
- 添加新项目配置时，**不得修改** `aibak.site` 配置块

### 已知其他服务

| 服务名 | 端口 | 访问方式 | 备注 |
|--------|------|----------|------|
| 金网通 | 3100 | 仅内网 `127.0.0.1:3100` | 不得绑定到 aibak.site |
| acli hermes | 9119 | `159.75.124.59:11038` | hermes 管理面板 |
| sandbox-executor | Docker | 仅容器内网 | 代码执行沙箱 |

---

## 5. 修改流程

如确需修改 `aibak.site` 配置（如更换证书路径、添加新 API 路由等）：

1. **提交变更申请**：在 CNB 仓库提交 Issue，说明修改原因、内容、影响范围
2. **负责人审批**：由项目负责人（龙哥）书面批准
3. **备份当前配置**：`cp /etc/caddy/Caddyfile /etc/caddy/Caddyfile.bak.$(date +%Y%m%d%H%M%S)`
4. **修改并验证**：修改后执行 `caddy validate --config /etc/caddy/Caddyfile`
5. **重启生效**：`systemctl restart caddy`（注意：`caddy reload` 因 `admin off` 不可用）
6. **验证线上**：`curl -s https://aibak.site/api/health` 确认服务正常
7. **更新本文档**：同步更新此文件的配置块

---

## 6. 证书续期

- **证书类型**：Let's Encrypt（通过 certbot 申请）
- **证书路径**：`/etc/caddy/certs/aibak.site.crt` + `/etc/caddy/certs/aibak.site.key`
- **原始 LE 路径**：`/etc/letsencrypt/live/aibak.site/`（Caddy 用户无权限直接读取）
- **续期方式**：certbot 自动续期后，需手动复制到 Caddy 可读目录：
  ```bash
  cp /etc/letsencrypt/live/aibak.site/fullchain.pem /etc/caddy/certs/aibak.site.crt
  cp /etc/letsencrypt/live/aibak.site/privkey.pem /etc/caddy/certs/aibak.site.key
  chown caddy:caddy /etc/caddy/certs/aibak.site.{crt,key}
  systemctl restart caddy
  ```
- **建议**：配置 certbot deploy-hook 自动执行上述复制操作

---

## 7. 故障排查

### 症状：aibak.site 显示错误内容

1. 检查 Caddyfile：`cat /etc/caddy/Caddyfile | grep -A10 'aibak.site'`
2. 确认 `reverse_proxy` 指向 `127.0.0.1:3000`
3. 确认 `root` 指向 `/opt/ai-agent-platform/client/dist`
4. 如被篡改，从备份恢复：`cp /etc/caddy/Caddyfile.bak.* /etc/caddy/Caddyfile`

### 症状：证书错误

1. 检查证书：`openssl x509 -in /etc/caddy/certs/aibak.site.crt -noout -issuer -dates`
2. 确认 issuer 为 `Let's Encrypt`
3. 如为自签名证书，从 LE 路径复制最新证书

### 症状：API 不可用

1. 检查后端容器：`docker ps | grep ai-platform-server`
2. 检查健康：`curl -s http://127.0.0.1:3000/api/health`
3. 检查 Caddy：`systemctl status caddy`

---

## 8. 违规处理

任何违反本文件规定的域名指向修改，一经发现：

1. **立即恢复**：从备份恢复 Caddyfile 并重启 Caddy
2. **记录事故**：在 CNB 仓库 Issue 中记录违规时间、原因、影响
3. **追究责任**：对违规操作者进行追责
4. **加固措施**：评估是否需要进一步限制服务器访问权限

---

**本文件由项目负责人龙哥于 2026-07-21 签署生效。**
