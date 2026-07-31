# Auto Deploy System — 一键全自动部署

> **一条命令完成全部流程**：从代码打包、环境检查、自动修复、构建到上线，彻底告别手工 SSH 分步部署。

## 快速开始

### 服务器端（Ubuntu 首次）

```bash
# 1. 初始化服务器（安装 Docker + compose + 镜像加速 + 防火墙）
sudo bash deploy/init-server.sh

# 2. 配置环境变量
cp server/.env.production.example server/.env
# 编辑 server/.env 填入 JWT_SECRET 与各厂商 Key

# 3. 一键部署
bash deploy/auto-deploy.sh
```

### 本地 CLI（Windows → 远程 Ubuntu）

```bash
cd deploy/cli && npm install

# 一键部署（打包 + 上传 + 远程触发部署）
node cli.js deploy -H <服务器IP> -p <SSH密码>

# 首次部署（含服务器初始化）
node cli.js deploy -H <服务器IP> -p <SSH密码> --init

# 查看状态
node cli.js status -H <服务器IP> -p <SSH密码>

# 查看日志
node cli.js logs -H <服务器IP> -p <SSH密码> -s server

# 重启服务
node cli.js restart -H <服务器IP> -p <SSH密码>
```

### 批量管理多项目

编辑 `deploy/sites.yaml` 添加更多项目，然后：

```bash
bash deploy/batch.sh deploy --all     # 批量部署
bash deploy/batch.sh status           # 查看所有项目状态
bash deploy/batch.sh logs 项目名       # 查看日志
```

## 架构

```
┌───────────────────────────────────────────────────┐
│  一键部署流程 (auto-deploy.sh)                      │
│                                                    │
│  Phase 1: 预检诊断 (diagnostics.sh, 7 项检查)      │
│           → Docker/端口/磁盘/env/dockerignore/     │
│             nginx/镜像源                           │
│  Phase 2: 自动修复 (fixes.sh, 6 种修复)            │
│           → 端口冲突/nginx DNS/dockerignore/       │
│             镜像加速/JWT密钥/env模板                │
│  Phase 3: 构建镜像 (docker compose build)          │
│  Phase 4: 启动 + 健康检查 (40 次轮询)              │
│  Phase 5: 最终验证 (前端 + 后端 + 容器状态)         │
└───────────────────────────────────────────────────┘
```

## 自动诊断能力

| 检查项 | 对应函数 | 检测内容 |
|--------|----------|----------|
| Docker 状态 | `check_docker()` | Docker 安装、守护进程、compose 插件 |
| 端口占用 | `check_ports()` | 80/3000/27017/6379 是否被非 Docker 进程占用 |
| 磁盘空间 | `check_disk()` | 可用空间 > 2GB |
| 环境变量 | `check_env()` | server/.env 存在 + JWT_SECRET 非占位符 |
| .dockerignore | `check_dockerignore()` | nginx.conf 未被排除 |
| nginx DNS | `check_nginx_conf()` | resolver 127.0.0.11 + 变量化 proxy_pass |
| 镜像加速 | `check_image_mirror()` | registry-mirrors 已配置 |

## 自动修复能力

| 修复项 | 对应函数 | 修复策略 |
|--------|----------|----------|
| 端口冲突 | `fix_port_conflict()` | 停用 caddy/nginx/apache2 + 清理残余 |
| nginx DNS | `fix_nginx_dns()` | 注入 resolver 127.0.0.11 + 变量化 proxy_pass |
| .dockerignore | `fix_dockerignore()` | 移除 nginx.conf 排除项 |
| 镜像加速 | `fix_docker_mirror()` | 配置腾讯云镜像源 |
| JWT 密钥 | `fix_jwt_secret()` | 生成 openssl rand -hex 48 |
| env 模板 | `fix_env_template()` | .env.example → .env + 填充 JWT |

## 配置文件

### sites.yaml（多项目配置）

```yaml
server:
  host: "159.75.124.59"
  user: "root"
  port: 22
  ssh_key: ""          # SSH 私钥路径（留空用密码）
  base_path: "/opt"

sites:
  - name: "ai-agent-platform"
    path: "."
    domain: ""
    port: 80
    enabled: true
```

## 可靠性设计

- **幂等性**：诊断→修复→部署可重复执行
- **超时保护**：构建 600s，健康检查 80s
- **错误回传**：SSH stderr/stdout 全部回传本地
- **修复后重诊**：Phase 2 修复后自动重新诊断
- **日志持久化**：每次部署日志保存到 `/tmp/auto-deploy-*.log`

## 故障排除

| 现象 | 原因 | 解决 |
|------|------|------|
| 构建超时 | Docker 镜像拉取慢 | 检查镜像源配置 |
| 端口冲突 | Caddy/nginx 占用 80 | auto-fix 自动停止 |
| nginx DNS 错误 | 缺少 resolver | auto-fix 自动注入 |
| JWT 弱密钥 | 占位符未替换 | auto-fix 自动生成 |
| 健康检查超时 | 服务启动慢 | 增加 HEALTH_RETRIES |

## 文件清单

```
deploy/
├── auto-deploy.sh          # 一键自动部署主脚本
├── init-server.sh          # 服务器初始化
├── batch.sh                # 批量管理
├── deploy.sh               # 兼容旧版
├── sites.yaml              # 多项目配置
├── lib/
│   ├── diagnostics.sh      # 7 项诊断引擎
│   ├── fixes.sh            # 6 种自愈引擎
│   ├── diagnostics.test.sh # 诊断单元测试
│   └── fixes.test.sh       # 修复单元测试
└── cli/
    ├── package.json         # Node.js CLI
    ├── cli.js               # CLI 入口（deploy/status/logs/restart）
    └── lib/
        └── cli.test.js      # CLI 单元测试（39 用例）
```
