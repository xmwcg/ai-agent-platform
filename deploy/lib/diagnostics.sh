#!/usr/bin/env bash
# ============================================================
# 诊断引擎 v1.0 — 7 项部署前自动预检
# 用法：source deploy/lib/diagnostics.sh && run_diagnostics
# ============================================================
set -euo pipefail

# ---------- 颜色 ----------
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

DIAG_PASS=0
DIAG_FAIL=0
DIAG_WARN=0
DIAG_ISSUES=()

_pass()  { echo -e "  [PASS] $1"; DIAG_PASS=$((DIAG_PASS + 1)); }
_fail()  { echo -e "  [FAIL] $1"; DIAG_FAIL=$((DIAG_FAIL + 1)); DIAG_ISSUES+=("FAIL:$1"); }
_warn()  { echo -e "  [WARN] $1"; DIAG_WARN=$((DIAG_WARN + 1)); DIAG_ISSUES+=("WARN:$1"); }

# ============================================================
# 1. Docker 状态检查
# ============================================================
check_docker() {
  echo -e "${CYAN}[1/7] Docker 状态${NC}"
  if ! command -v docker &>/dev/null; then
    _fail "Docker 未安装，请先运行: bash deploy/init-server.sh"
    return 1
  fi
  if ! docker info &>/dev/null 2>&1; then
    _fail "Docker 守护进程未运行，尝试: sudo systemctl start docker"
    return 1
  fi
  if ! docker compose version &>/dev/null 2>&1; then
    _fail "docker compose 插件未安装: sudo apt-get install -y docker-compose-plugin"
    return 1
  fi
  _pass "Docker $(docker --version | awk '{print $3}' | tr -d ',') + compose 插件就绪"
}

# ============================================================
# 2. 端口占用检查
# ============================================================
check_ports() {
  echo -e "${CYAN}[2/7] 端口检查 (80/3000/27017/6379)${NC}"
  local conflicts=()

  for port in 80 3000 27017 6379; do
    # 检查非 docker-proxy 的占用
    local proc_info
    proc_info=$(ss -tlnp 2>/dev/null | awk -v p=":$port " '$0 ~ p {print $NF}' | grep -v docker-proxy | head -1 || true)
    if [ -n "$proc_info" ]; then
      conflicts+=("端口 $port 被 $proc_info 占用（非 Docker）")
    fi
  done

  if [ ${#conflicts[@]} -eq 0 ]; then
    _pass "所有必需端口可用"
  else
    for c in "${conflicts[@]}"; do
      _fail "$c"
    done
    return 1
  fi
}

# ============================================================
# 3. 磁盘空间检查
# ============================================================
check_disk() {
  echo -e "${CYAN}[3/7] 磁盘空间${NC}"
  local avail
  avail=$(df -BG /opt 2>/dev/null | awk 'NR==2 {print $4}' | tr -d 'G')
  if [ -z "$avail" ]; then
    avail=$(df -BG / | awk 'NR==2 {print $4}' | tr -d 'G')
  fi

  if [ "$avail" -lt 2 ]; then
    _fail "磁盘可用空间不足 2GB（当前 ${avail}GB），Docker 镜像构建可能失败"
    return 1
  fi
  _pass "磁盘可用 ${avail}GB，空间充足"
}

# ============================================================
# 4. 环境变量检查
# ============================================================
check_env() {
  echo -e "${CYAN}[4/7] 环境变量 (server/.env)${NC}"

  if [ ! -f server/.env ]; then
    if [ -f server/.env.production.example ]; then
      _fail "server/.env 不存在，将从 .env.production.example 自动生成"
      return 1
    elif [ -f server/.env.example ]; then
      _fail "server/.env 不存在，将从 .env.example 自动生成"
      return 1
    else
      _fail "server/.env 不存在且无模板文件！"
      return 1
    fi
  fi

  # 检查 JWT_SECRET 是否为占位符
  if grep -qiE 'changeme|请替换|dev-secret-key-change|replace.*me' server/.env 2>/dev/null; then
    _fail "JWT_SECRET 仍为占位符，需替换为强随机值"
    return 1
  fi

  _pass "server/.env 存在且 JWT_SECRET 有效"
}

# ============================================================
# 5. .dockerignore 检查
# ============================================================
check_dockerignore() {
  echo -e "${CYAN}[5/7] .dockerignore 文件完整性${NC}"
  local ok=true

  # client/.dockerignore 不应排除 nginx 配置文件
  if [ -f client/.dockerignore ]; then
    if grep -qE '^nginx\.conf$|^nginx\.ssl\.conf$' client/.dockerignore 2>/dev/null; then
      _fail "client/.dockerignore 排除了 nginx.conf / nginx.ssl.conf，构建时 COPY 会失败"
      ok=false
    fi
  fi

  # server/.dockerignore（如果存在）
  if [ -f server/.dockerignore ]; then
    if grep -qE '^Dockerfile$|^\.env\.' server/.dockerignore 2>/dev/null; then
      _warn "server/.dockerignore 排除了 Dockerfile 或 .env 文件"
    fi
  fi

  $ok && _pass ".dockerignore 配置正常"
  $ok || return 1
}

# ============================================================
# 6. nginx.conf 配置检查
# ============================================================
check_nginx_conf() {
  echo -e "${CYAN}[6/7] nginx.conf DNS 解析配置${NC}"
  local ok=true

  for conf in client/nginx.conf client/nginx.ssl.conf; do
    [ ! -f "$conf" ] && continue

    # 检查是否有 resolver 配置
    if ! grep -q 'resolver\s\+127\.0\.0\.11' "$conf" 2>/dev/null; then
      _fail "$conf 缺少 Docker DNS resolver（resolver 127.0.0.11）"
      ok=false
    fi

    # 检查 proxy_pass 是否用了静态地址（可能启动时 DNS 解析失败）
    if grep -qE 'proxy_pass\s+http://server:' "$conf" 2>/dev/null; then
      _fail "$conf 使用了静态 proxy_pass（server:3000），需改为变量方式"
      ok=false
    fi
  done

  $ok && _pass "nginx 配置 DNS 解析正确"
  $ok || return 1
}

# ============================================================
# 7. Docker 镜像源检查
# ============================================================
check_image_mirror() {
  echo -e "${CYAN}[7/7] Docker 镜像加速${NC}"

  local daemon_json="/etc/docker/daemon.json"
  if [ -f "$daemon_json" ]; then
    if grep -q 'registry-mirrors' "$daemon_json" 2>/dev/null; then
      _pass "Docker 已配置镜像加速"
      return 0
    fi
  fi
  _warn "未配置 Docker 镜像加速，国内拉取可能很慢或失败"
  return 0  # warning 不阻塞
}

# ============================================================
# 汇总 & 主入口
# ============================================================
print_diag_summary() {
  echo ""
  echo "============================================"
  echo -e "  诊断结果：通过 $DIAG_PASS / 失败 $DIAG_FAIL / 警告 $DIAG_WARN"
  echo "============================================"

  if [ "$DIAG_FAIL" -gt 0 ]; then
    echo ""
    echo "发现的严重问题："
    for issue in "${DIAG_ISSUES[@]}"; do
      if [[ "$issue" == FAIL:* ]]; then
        echo -e "  [FAIL] ${issue#FAIL:}"
      fi
    done
  fi

  if [ "$DIAG_FAIL" -eq 0 ]; then
    echo -e "所有检查通过，可以安全部署！"
    return 0
  else
    echo -e "存在 $DIAG_FAIL 个严重问题，需要修复后才能部署"
    return 1
  fi
}

run_diagnostics() {
  echo ""
  echo "============================================"
  echo "  AI Agent Platform — 部署前诊断"
  echo "============================================"
  echo ""

  check_docker || true
  check_ports || true
  check_disk || true
  check_env || true
  check_dockerignore || true
  check_nginx_conf || true
  check_image_mirror || true

  print_diag_summary
}

# 直接运行时自动执行诊断
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  run_diagnostics "$@"
fi
