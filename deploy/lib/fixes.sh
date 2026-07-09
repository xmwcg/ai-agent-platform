#!/usr/bin/env bash
# ============================================================
# 自愈引擎 v1.0 — 自动修复已知部署问题
# 用法：source deploy/lib/fixes.sh && run_fixes
# ============================================================
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

FIX_DONE=0
FIX_SKIPPED=0
FIX_FAILED=0

# ============================================================
# 1. 端口冲突修复
# ============================================================
fix_port_conflict() {
  echo -e "  ${YELLOW}[FIX] 修复端口冲突...${NC}"

  local CONF_SERVICES=("caddy" "nginx" "apache2")
  local fixed=false

  for svc in "${CONF_SERVICES[@]}"; do
    if systemctl is-active --quiet "$svc" 2>/dev/null; then
      echo "    停止并禁用 $svc..."
      systemctl stop "$svc" 2>/dev/null || true
      systemctl disable "$svc" 2>/dev/null || true
      fixed=true
    fi
  done

  # 清理残余端口占用（非 Docker）
  for port in 80 443; do
    if ss -tlnp 2>/dev/null | grep -q ":$port " | grep -v docker-proxy; then
      echo "    清理端口 $port 残余进程..."
      fuser -k "$port"/tcp 2>/dev/null || true
      fixed=true
    fi
  done

  if $fixed; then
    echo -e "  ${GREEN}[OK] 端口冲突已修复${NC}"
    FIX_DONE=$((FIX_DONE + 1))
  else
    echo -e "  ${GREEN}[OK] 无需修复（无端口冲突）${NC}"
    FIX_SKIPPED=$((FIX_SKIPPED + 1))
  fi
}

# ============================================================
# 2. Nginx DNS 解析修复
# ============================================================
fix_nginx_dns() {
  echo -e "  ${YELLOW}[FIX] 修复 nginx DNS 解析...${NC}"
  local fixed=false

  for conf in client/nginx.conf client/nginx.ssl.conf; do
    [ ! -f "$conf" ] && continue

    local content
    content=$(cat "$conf")
    local modified=false

    # 添加 resolver（如果缺失）
    if ! echo "$content" | grep -q 'resolver\s\+127\.0\.0\.11'; then
      # 在第一个 server 块的 listen 行后插入 resolver
      content=$(echo "$content" | sed '/listen 80;/a\    # Docker 内置 DNS（运行时解析）\n    resolver 127.0.0.11 valid=30s ipv6=off;')
      # 避免重复添加
      modified=true
      echo "    $conf: 注入 resolver 127.0.0.11"
    fi

    # 替换静态 proxy_pass 为变量方式（如果还是静态的）
    if echo "$content" | grep -qE 'proxy_pass\s+http://server:'; then
      content=$(echo "$content" | sed 's|proxy_pass http://server:3000;|set $backend "server:3000";\n        proxy_pass http://$backend;|g')
      modified=true
      echo "    $conf: proxy_pass 改为变量方式"
    fi

    if $modified; then
      echo "$content" > "$conf"
      fixed=true
    fi
  done

  if $fixed; then
    echo -e "  ${GREEN}[OK] nginx DNS 配置已修复${NC}"
    FIX_DONE=$((FIX_DONE + 1))
  else
    echo -e "  ${GREEN}[OK] 无需修复（nginx DNS 配置正确）${NC}"
    FIX_SKIPPED=$((FIX_SKIPPED + 1))
  fi
}

# ============================================================
# 3. .dockerignore 修复
# ============================================================
fix_dockerignore() {
  echo -e "  ${YELLOW}[FIX] 修复 .dockerignore...${NC}"
  local fixed=false

  if [ -f client/.dockerignore ]; then
    if grep -qE '^nginx\.conf$|^nginx\.ssl\.conf$' client/.dockerignore 2>/dev/null; then
      # 备份 + 移除
      cp client/.dockerignore client/.dockerignore.bak
      grep -vE '^nginx\.conf$|^nginx\.ssl\.conf$' client/.dockerignore.bak > client/.dockerignore
      echo "    已从 client/.dockerignore 移除 nginx 配置文件排除项"
      fixed=true
    fi
  fi

  if $fixed; then
    echo -e "  ${GREEN}[OK] .dockerignore 已修复${NC}"
    FIX_DONE=$((FIX_DONE + 1))
  else
    echo -e "  ${GREEN}[OK] 无需修复（.dockerignore 配置正确）${NC}"
    FIX_SKIPPED=$((FIX_SKIPPED + 1))
  fi
}

# ============================================================
# 4. Docker 镜像加速配置
# ============================================================
fix_docker_mirror() {
  echo -e "  ${YELLOW}[FIX] 配置 Docker 镜像加速...${NC}"

  local DAEMON_JSON="/etc/docker/daemon.json"

  if [ -f "$DAEMON_JSON" ] && grep -q 'registry-mirrors' "$DAEMON_JSON" 2>/dev/null; then
    echo -e "  ${GREEN}[OK] 无需修复（已有镜像加速）${NC}"
    FIX_SKIPPED=$((FIX_SKIPPED + 1))
    return
  fi

  mkdir -p /etc/docker
  cat > "$DAEMON_JSON" << 'EOF'
{
  "registry-mirrors": [
    "https://mirror.ccs.tencentyun.com",
    "https://docker.m.daocloud.io"
  ],
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  },
  "storage-driver": "overlay2"
}
EOF
  systemctl restart docker
  echo -e "  ${GREEN}[OK] Docker 镜像加速已配置${NC}"
  FIX_DONE=$((FIX_DONE + 1))
}

# ============================================================
# 5. JWT 密钥生成
# ============================================================
fix_jwt_secret() {
  echo -e "  ${YELLOW}[FIX] 检查 JWT_SECRET...${NC}"

  if [ ! -f server/.env ]; then
    echo "    server/.env 不存在，跳过（由 fix_env_template 处理）"
    FIX_SKIPPED=$((FIX_SKIPPED + 1))
    return
  fi

  if grep -qiE 'changeme|请替换|dev-secret-key-change|replace.*me' server/.env 2>/dev/null; then
    local new_secret
    new_secret=$(openssl rand -hex 48 2>/dev/null || cat /dev/urandom | tr -dc 'a-zA-Z0-9' | head -c 64)
    # 替换 JWT_SECRET= 开头的行
    sed -i "s/^JWT_SECRET=.*/JWT_SECRET=$new_secret/" server/.env
    echo "    JWT_SECRET 已替换为强随机值"
    echo -e "  ${GREEN}[OK] JWT_SECRET 已生成${NC}"
    FIX_DONE=$((FIX_DONE + 1))
  else
    echo -e "  ${GREEN}[OK] 无需修复（JWT_SECRET 有效）${NC}"
    FIX_SKIPPED=$((FIX_SKIPPED + 1))
  fi
}

# ============================================================
# 6. 环境变量模板 → 实际 .env
# ============================================================
fix_env_template() {
  echo -e "  ${YELLOW}[FIX] 检查环境变量文件...${NC}"

  if [ -f server/.env ]; then
    echo -e "  ${GREEN}[OK] server/.env 已存在${NC}"
    FIX_SKIPPED=$((FIX_SKIPPED + 1))
    return
  fi

  if [ -f server/.env.production.example ]; then
    cp server/.env.production.example server/.env
    echo "    从 server/.env.production.example 生成 server/.env"
  elif [ -f server/.env.example ]; then
    cp server/.env.example server/.env
    echo "    从 server/.env.example 生成 server/.env"
  else
    echo -e "  ${RED}[ERR] 未找到环境变量模板文件！${NC}"
    FIX_FAILED=$((FIX_FAILED + 1))
    return
  fi

  # 自动生成 JWT_SECRET
  local new_secret
  new_secret=$(openssl rand -hex 48 2>/dev/null || cat /dev/urandom | tr -dc 'a-zA-Z0-9' | head -c 64)
  if grep -q 'JWT_SECRET=' server/.env 2>/dev/null; then
    sed -i "s/^JWT_SECRET=.*/JWT_SECRET=$new_secret/" server/.env
  else
    echo "JWT_SECRET=$new_secret" >> server/.env
  fi

  echo -e "  ${GREEN}[OK] server/.env 已生成，JWT_SECRET 已填充${NC}"
  echo -e "  ${YELLOW}[WARN]  请编辑 server/.env 填入真实厂商 Key 后再部署！${NC}"
  FIX_DONE=$((FIX_DONE + 1))
}

# ============================================================
# 汇总 & 主入口
# ============================================================
print_fix_summary() {
  echo ""
  echo "----------------------------------------"
  echo -e "  修复结果：已修复 $FIX_DONE / 跳过 $FIX_SKIPPED / 失败 $FIX_FAILED"
  echo "----------------------------------------"
}

run_fixes() {
  echo ""
  echo "============================================"
  echo "  自动修复引擎"
  echo "============================================"
  echo ""

  fix_port_conflict
  fix_nginx_dns
  fix_dockerignore
  fix_docker_mirror
  fix_jwt_secret
  fix_env_template

  print_fix_summary

  if [ "$FIX_FAILED" -gt 0 ]; then
    return 1
  fi
  return 0
}

# 直接运行时自动执行修复
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  run_fixes "$@"
fi
