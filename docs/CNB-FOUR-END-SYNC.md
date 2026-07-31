# CNB 四端同步与生产发布方案

## 单一真相源

四端定义：

1. 本地开发工作区
2. CNB `main`（唯一写入主源）
3. GitHub `main`（只读镜像）
4. 生产服务器（只部署通过门禁的 `deploy/production`）

为避免双主循环同步和误覆盖，**不支持直接在 GitHub 或生产服务器修改正式代码**。GitHub 若出现独立提交，CNB 流水线会拒绝覆盖并停止发布，必须先人工合并回 CNB。

## 一次 push 的发布链路

```text
local main
  -> push CNB main
  -> server tsc + npm test
  -> client build + test
  -> 安全镜像 GitHub main
  -> 快进 deploy/production
  -> 服务器 systemd timer 主动拉取并发现新版本
  -> 同步部署 + 本地健康检查 + 公网健康检查
  -> /api/health revision 与 CNB_COMMIT 一致
  -> CNB 流水线公网验收完成
```

关键点：

- 服务器不监听 `main`，只监听 `deploy/production`，因此未通过流水线门禁的提交不会部署。
- 生产部署坚持 outbound pull：CNB 不连接服务器 SSH，也不要求开放部署 webhook 入站端口。
- systemd timer 每分钟检查一次；CNB 流水线会等待生产探针完成，不以通知请求成功代替部署成功。

## GitHub 镜像保护

- GitHub 可快进：普通 push。
- GitHub 与 CNB 文件内容完全一致但历史不同：使用带期望旧 SHA 的 `--force-with-lease`。
- GitHub 有独立内容：拒绝覆盖、流水线失败。

## 服务器安装

获得服务器 SSH 权限后执行：

```bash
cd /opt/ai-agent-platform
git fetch cnb deploy/production
bash deploy/install-cnb-watcher.sh
```

检查：

```bash
systemctl is-enabled cnb-watcher.timer
systemctl is-active cnb-watcher.timer
systemctl list-timers cnb-watcher.timer
journalctl -u cnb-watcher.service -n 100 --no-pager
cat /opt/.cnb-deploy-sha
curl -fsS https://aibak.site/api/health
curl -fsS https://aibak.site/api/sandbox/status
```

## 失败策略

- 部署成功并通过内网、公网验收后才更新 `/opt/.cnb-deploy-sha`。
- 新版本失败时回滚到上一成功 SHA。
- 默认重试 3 次。
- 同一失败 SHA 默认进入 900 秒冷却期，避免 timer 每分钟重复构建；新 SHA 会立即解除冷却。
- 可在 `/etc/default/cnb-watcher` 配置 `DEPLOY_ALERT_WEBHOOK`、重试次数和冷却时间。
- 如运行环境已人工修复并需立即重试，可删除 `/opt/.cnb-deploy-failed` 后启动 watcher。
