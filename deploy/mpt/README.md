# MoneyPrinterTurbo 生产工作流（AIBAK 短视频生成）

AIBAK 的 `moneyprinterturbo` provider（`server/src/services/media-providers/moneyprinterturbo.provider.ts`）
已对接本服务，真实契约为：

- `POST /api/v1/videos`  → 请求体 `VideoParams`；响应信封 `{status,message,data:{task_id}}`
- `GET  /api/v1/tasks/{task_id}` → `{status,message,data:{task_id,state,videos:[...]}}`
  - `state` 整数：`1`=完成, `-1`=失败, 其它（含 `4`）视为进行中
  - `videos` 为成片 URI 数组

## 默认是“关闭”的（零风险）

`deploy/docker-compose.production.yml` 中的 `moneyprinterturbo` 服务带
`profiles: ["mpt"]`，普通 `docker compose up -d` / 自动部署**不会**构建或启动它。
AIBAK server 容器已注入 `MONEY_PRINTER_TURBO_URL=http://moneyprinterturbo:8080`；
MPT 未启动时 provider 会优雅返回 503，整站照常运行。

## 在服务器上启用

1. 部署后，在服务器项目根目录准备真实密钥：
   ```bash
   cd deploy/mpt
   cp config.example.toml config.toml
   # 编辑 config.toml，填入 deepseek / pexels 等真实 key（config.toml 已被 gitignore）
   ```
2. 构建并启动 MPT 服务（仅这一个服务，不影响其它）：
   ```bash
   docker compose --profile mpt build moneyprinterturbo
   docker compose --profile mpt up -d moneyprinterturbo
   ```
3. 验证：
   ```bash
   curl -fsS http://127.0.0.1:8080/api/v1/tasks | head
   ```

## 镜像来源说明

Dockerfile 基于 `harry0703/moneyprinterturbo:latest`（Docker Hub）。若生产服务器访问
Docker Hub 受限（GFW），两种替代：

- 在能访问的机器 `docker pull` 后 `docker save/load` 到生产服务器；或
- 把 MPT 源码克隆到 `deploy/mpt/src`，把 Dockerfile 的 `FROM` 改为
  `FROM python:3.11-slim-bullseye` 并 `COPY` 源码、`pip install -r requirements.txt`。

## 让终端用户浏览器直接看到成片（可选增强）

当前 `endpoint` 留空，成片 URL 为容器内相对路径，仅 AIBAK 后端可达。若要让用户浏览器
直接播放/下载：

1. `config.toml` 设 `endpoint = "https://aibak.site/api/mpt"`；
2. 在 `client/nginx.ssl.runtime.conf` 增加反向代理：
   ```
   location /api/mpt/ {
       proxy_pass http://moneyprinterturbo:8080/;
       proxy_set_header Host $host;
   }
   ```
3. 重建 mpt 镜像并重启。

## 安全

- 所有密钥只存在于服务器本地的 `config.toml`，绝不进仓库（已 gitignore）。
- MPT 默认关闭鉴权，仅监听 `127.0.0.1:8080`（宿主机环回），不对外暴露。
- AIBAK 与 MPT 同处 `ai-platform-network`，通过服务名 `moneyprinterturbo` 互访。
