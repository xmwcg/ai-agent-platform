#!/usr/bin/env bash
# ==========================================================================
# 一键启用 HTTPS（阶段 0）
# 在服务器上运行：  bash deploy/setup-https.sh your.domain.com
#
# 前置条件：
#   1) 域名已通过 A 记录解析到本服务器公网 IP（159.75.124.59）
#   2) 安全组/防火墙已放行 80 与 443 端口
#   3) 当前以 root 运行，且位于项目目录 /opt/ai-agent-platform
#
# 脚本流程：
#   1. 安装 certbot
#   2. 生成 nginx SSL 运行时配置（把 __DOMAIN__ 替换为真实域名）
#   3. 若证书缺失，先用自签名占位证书让 nginx 能启动并服务 ACME 挑战
#   4. certbot webroot 方式签发真实证书
#   5. 复制证书到 /opt/certs 并 reload nginx
#   6. 配置 certbot 自动续期（含复制证书 + reload）
# ==========================================================================
set -euo pipefail

DOMAIN="${1:?用法: setup-https.sh <your.domain.com>}"

# 定位项目根目录（脚本在 deploy/ 下，上一级即项目根）
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
[ -f "$PROJECT_DIR/docker-compose.yml" ] || PROJECT_DIR=/opt/ai-agent-platform
cd "$PROJECT_DIR"

CERTS_DIR=/opt/certs
WEBROOT_DIR=/opt/certs-webroot
RUNTIME_CONF="$PROJECT_DIR/client/nginx.ssl.runtime.conf"
LE_LIVE="/etc/letsencrypt/live/$DOMAIN"

echo "==> 项目目录: $PROJECT_DIR"
echo "==> 目标域名: $DOMAIN"

echo "==> [1/6] 安装 certbot"
if ! command -v certbot >/dev/null 2>&1; then
  apt-get update -y
  apt-get install -y certbot
fi

echo "==> [2/6] 创建目录并生成 nginx SSL 运行时配置"
mkdir -p "$CERTS_DIR" "$WEBROOT_DIR"
# ⚠️ 必须用单引号包裹 sed 表达式，防止 bash 将 nginx 变量（$host/$uri/$backend...）展开为空字符串
sed 's|__DOMAIN__|'"$DOMAIN"'|g' "$PROJECT_DIR/client/nginx.ssl.conf" > "$RUNTIME_CONF"
echo "    已生成: $RUNTIME_CONF"

echo "==> [3/6] 若证书缺失，先用自签名占位证书让 nginx 可启动"
if [ ! -f "$CERTS_DIR/fullchain.pem" ]; then
  openssl req -x509 -nodes -newkey rsa:2048 \
    -keyout "$CERTS_DIR/privkey.pem" \
    -out "$CERTS_DIR/fullchain.pem" \
    -days 1 -subj "/CN=$DOMAIN"
  echo "    已生成占位自签名证书"
fi

echo "==> [4/6] 启动 client 容器（此时 nginx 以占位证书运行并可服务 ACME 挑战）"
docker compose up -d client

# 等待 nginx 起来
for i in $(seq 1 15); do
  if docker exec ai-platform-client nginx -t >/dev/null 2>&1; then break; fi
  sleep 2
done

echo "==> [5/6] certbot 签发真实证书（webroot）"
if [ -f "$LE_LIVE/fullchain.pem" ]; then
  echo "    证书已存在，尝试续期"
  certbot renew --webroot -w "$WEBROOT_DIR" --quiet || true
else
  certbot certonly --webroot -w "$WEBROOT_DIR" -d "$DOMAIN" \
    --non-interactive --agree-tos --email "admin@$DOMAIN" --expand \
    || { echo "❌ 证书签发失败。请确认：①域名 A 记录已指向本机 ②80 端口可达 ③未开启强制 HTTPS 跳转干扰"; exit 1; }
fi

echo "==> [6/6] 复制真实证书并 reload nginx"
cp "$LE_LIVE/fullchain.pem" "$CERTS_DIR/fullchain.pem"
cp "$LE_LIVE/privkey.pem"  "$CERTS_DIR/privkey.pem"
docker exec ai-platform-client nginx -s reload
echo "    nginx 已重载，HTTPS 生效：https://$DOMAIN"

echo "==> 配置自动续期（certbot renew + 复制证书 + reload）"
RENEW_CRON="0 3 * * * root certbot renew --quiet --deploy-hook 'cp $LE_LIVE/fullchain.pem $CERTS_DIR/fullchain.pem; cp $LE_LIVE/privkey.pem $CERTS_DIR/privkey.pem; docker exec ai-platform-client nginx -s reload >/dev/null 2>&1'"
echo "$RENEW_CRON" > /etc/cron.d/https-renew
chmod 644 /etc/cron.d/https-renew
echo "    续期任务已写入 /etc/cron.d/https-renew（每日 03:00 检查）"

echo ""
echo "✅ HTTPS 启用完成！请访问 https://$DOMAIN 验证（浏览器应显示安全锁）。"
echo "   若浏览器仍提示不安全，多为 DNS 未生效或证书刚签发，稍后重试即可。"
