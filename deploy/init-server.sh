#!/usr/bin/env bash
# ============================================================
# 服务器初始化脚本 — Auto Deploy System v1.0
# 适用于：全新 Ubuntu 22.04/24.04 轻量服务器
# 用法：以 root 运行: bash init-server.sh
# 作用：安装 Docker + compose 插件 + 镜像加速 + 防火墙
# ============================================================
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo ""
echo "============================================"
echo "  🚀 服务器初始化 — Auto Deploy System"
echo "============================================"
echo ""

# ============================================================
# Step 0: 权限检查
# ============================================================
echo -e "${CYAN}[0/6] 权限检查${NC}"
if [ "$(id -u)" -ne 0 ]; then
  echo -e "  ${RED}❌ 请以 root 身份运行此脚本：sudo bash init-server.sh${NC}"
  exit 1
fi
echo -e "  ${GREEN}✅ root 权限${NC}"

# ============================================================
# Step 1: 系统更新
# ============================================================
echo -e "${CYAN}[1/6] 系统包更新${NC}"
apt-get update -qq && apt-get upgrade -y -qq
echo -e "  ${GREEN}✅ 系统包已更新${NC}"

# ============================================================
# Step 2: 安装 Docker 引擎
# ============================================================
echo -e "${CYAN}[2/6] Docker 引擎${NC}"
if command -v docker &>/dev/null; then
  echo -e "  ${GREEN}✅ Docker 已安装：$(docker --version)${NC}"
else
  echo "  正在安装 Docker..."
  curl -fsSL https://get.docker.com | sh
  echo -e "  ${GREEN}✅ Docker 安装完成${NC}"
fi

# ============================================================
# Step 3: 安装 Docker Compose 插件
# ============================================================
echo -e "${CYAN}[3/6] Docker Compose 插件${NC}"
if docker compose version &>/dev/null 2>&1; then
  echo -e "  ${GREEN}✅ docker compose 插件已就绪${NC}"
else
  echo "  正在安装 docker-compose-plugin..."
  apt-get install -y docker-compose-plugin
  echo -e "  ${GREEN}✅ 安装完成${NC}"
fi

# 启用并启动 Docker
systemctl enable --now docker 2>/dev/null || true

# ============================================================
# Step 4: 配置 Docker 国内镜像加速
# ============================================================
echo -e "${CYAN}[4/6] Docker 镜像加速${NC}"

DAEMON_JSON="/etc/docker/daemon.json"
mkdir -p /etc/docker

if [ -f "$DAEMON_JSON" ] && grep -q 'registry-mirrors' "$DAEMON_JSON"; then
  echo -e "  ${GREEN}✅ 镜像加速已配置${NC}"
else
  echo "  配置腾讯云镜像加速..."
  cat > "$DAEMON_JSON" << 'DAEMONEOF'
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
DAEMONEOF
  systemctl restart docker
  echo -e "  ${GREEN}✅ 镜像加速已配置并重启 Docker${NC}"
fi

# ============================================================
# Step 5: 冲突服务检测 & 清理
# ============================================================
echo -e "${CYAN}[5/6] 冲突服务检测${NC}"

CONFLICT_SERVICES=("caddy" "nginx" "apache2" "httpd")

for svc in "${CONFLICT_SERVICES[@]}"; do
  if systemctl is-active --quiet "$svc" 2>/dev/null; then
    echo -e "  ${YELLOW}⚠️  检测到 $svc 正在运行，自动停止并禁用...${NC}"
    systemctl stop "$svc" 2>/dev/null || true
    systemctl disable "$svc" 2>/dev/null || true
    echo -e "  ${GREEN}✅ 已停止 $svc${NC}"
  fi
done

# 检查端口是否还有残余占用
for port in 80 443 3000; do
  if lsof -ti:"$port" &>/dev/null 2>&1; then
    echo -e "  ${YELLOW}⚠️  端口 $port 仍有进程占用，尝试清理...${NC}"
    fuser -k "$port"/tcp 2>/dev/null || true
  fi
done

echo -e "  ${GREEN}✅ 冲突检测完成${NC}"

# ============================================================
# Step 6: 防火墙配置
# ============================================================
echo -e "${CYAN}[6/6] 防火墙配置${NC}"

# 云服务器通常安全组已管控，这里只做基本检查
if command -v ufw &>/dev/null; then
  if ufw status | grep -q 'Status: active'; then
    echo "  UFW 已启用，开放必要端口..."
    ufw allow 80/tcp  2>/dev/null || true
    ufw allow 443/tcp 2>/dev/null || true
    ufw allow 22/tcp  2>/dev/null || true
    echo -e "  ${GREEN}✅ 防火墙端口已开放${NC}"
  else
    echo -e "  ${YELLOW}⚠️  UFW 未启用（云服务器可能使用安全组管控）${NC}"
  fi
else
  echo -e "  ${YELLOW}⚠️  未安装 UFW（云服务器可能使用安全组管控）${NC}"
fi

# ============================================================
# 完成
# ============================================================
echo ""
echo "============================================"
echo -e "  ${GREEN}✅ 服务器初始化完成！${NC}"
echo "============================================"
echo ""
echo "环境信息："
echo "  Docker:    $(docker --version 2>/dev/null || echo 'N/A')"
echo "  Compose:   $(docker compose version 2>/dev/null || echo 'N/A')"
echo "  OS:        $(lsb_release -ds 2>/dev/null || cat /etc/os-release | grep PRETTY_NAME | cut -d= -f2 | tr -d '"')"
echo ""
echo "下一步："
echo "  1. 把项目代码传到服务器"
echo "  2. cd /opt/YOUR_PROJECT && bash deploy/auto-deploy.sh"
echo ""
