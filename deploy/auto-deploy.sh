#!/usr/bin/env bash
# ============================================================
# 一键自动部署脚本 — Auto Deploy System v1.0
# 用法：bash deploy/auto-deploy.sh
# 流程：诊断 → 修复 → 构建 → 启动 → 健康检查 → 验证
# ============================================================
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BLUE='\033[0;34m'
NC='\033[0m'
BOLD='\033[1m'

# 切换到项目根目录
cd "$(dirname "$0")/.."
PROJECT_ROOT="$(pwd)"

# ---------- 配置 ----------
HEALTH_RETRIES=40
HEALTH_INTERVAL=2
BUILD_TIMEOUT=600
DEPLOY_LOG="/tmp/auto-deploy-$(date +%Y%m%d-%H%M%S).log"

# ---------- 初始化 ----------
exec > >(tee -a "$DEPLOY_LOG") 2>&1

echo ""
echo "+------------------------------------------------------+"
echo "|     [START] AI Agent Platform — 一键自动部署              |"
echo "|     时间: $(date '+%Y-%m-%d %H:%M:%S')                    |"
echo "|     日志: $DEPLOY_LOG |"
echo "+------------------------------------------------------+"
echo ""

# ============================================================
# Phase 1: 诊断
# ============================================================
echo -e "${BOLD}${BLUE}---------- Phase 1/5: 预检诊断 ----------${NC}"

if [ -f deploy/lib/diagnostics.sh ]; then
  source deploy/lib/diagnostics.sh
  run_diagnostics
  DIAG_RESULT=$?
else
  echo -e "${RED}[ERR] 缺少 deploy/lib/diagnostics.sh${NC}"
  exit 1
fi

# ============================================================
# Phase 2: 自动修复
# ============================================================
if [ "$DIAG_RESULT" -ne 0 ]; then
  echo ""
  echo -e "${BOLD}${BLUE}---------- Phase 2/5: 自动修复 -----------${NC}"

  if [ -f deploy/lib/fixes.sh ]; then
    source deploy/lib/fixes.sh
    run_fixes
    FIX_RESULT=$?
  else
    echo -e "${RED}[ERR] 缺少 deploy/lib/fixes.sh${NC}"
    exit 1
  fi

  # 修复后重新诊断
  echo ""
  echo -e "${BOLD}${BLUE}---------- 修复后重新诊断 -----------${NC}"
  # 重置计数器
  DIAG_PASS=0 DIAG_FAIL=0 DIAG_WARN=0 DIAG_ISSUES=()
  run_diagnostics
  DIAG_RESULT=$?

  if [ "$DIAG_RESULT" -ne 0 ]; then
    echo ""
    echo -e "${RED}[ERR] 自动修复未完全解决问题，请检查上方错误信息${NC}"
    echo -e "${YELLOW}提示：查看完整日志: cat $DEPLOY_LOG${NC}"
    exit 1
  fi
else
  echo ""
  echo -e "${GREEN}[OK] 所有检查通过，跳过修复阶段${NC}"
fi

# ============================================================
# Phase 3: 构建
# ============================================================
echo ""
echo -e "${BOLD}${BLUE}---------- Phase 3/5: 构建镜像 -----------${NC}"

echo "开始构建 Docker 镜像（超时: ${BUILD_TIMEOUT}s）..."
if timeout "$BUILD_TIMEOUT" docker compose build --no-cache 2>&1; then
  echo -e "${GREEN}[OK] 镜像构建成功${NC}"
else
  EXIT_CODE=$?
  if [ "$EXIT_CODE" -eq 124 ]; then
    echo -e "${RED}[ERR] 构建超时（${BUILD_TIMEOUT}秒），请检查网络或增加 BUILD_TIMEOUT${NC}"
  else
    echo -e "${RED}[ERR] 构建失败（退出码: $EXIT_CODE）${NC}"
  fi
  exit 1
fi

# ============================================================
# Phase 4: 启动 + 健康检查
# ============================================================
echo ""
echo -e "${BOLD}${BLUE}---------- Phase 4/5: 启动服务 -----------${NC}"

# 先停止旧容器
echo "停止旧容器..."
docker compose down --remove-orphans 2>/dev/null || true

# 启动
echo "启动所有服务..."
docker compose up -d

echo ""
echo "等待服务就绪（最长 $((HEALTH_RETRIES * HEALTH_INTERVAL)) 秒）..."
HEALTH_OK=false
for i in $(seq 1 $HEALTH_RETRIES); do
  if curl -fsS http://127.0.0.1:3000/api/health >/dev/null 2>&1; then
    echo -e "  ${GREEN}[OK] 后端健康检查通过（第 ${i} 次尝试）${NC}"
    HEALTH_OK=true
    break
  fi
  printf "  ... 等待中... (%d/%d)\r" "$i" "$HEALTH_RETRIES"
  sleep "$HEALTH_INTERVAL"
done

if ! $HEALTH_OK; then
  echo ""
  echo -e "${RED}[ERR] 后端健康检查超时！${NC}"
  echo ""
  echo "--- 最近日志 ---"
  docker compose logs --tail=50 2>&1 || true
  exit 1
fi

# ============================================================
# Phase 5: 最终验证
# ============================================================
echo ""
echo -e "${BOLD}${BLUE}---------- Phase 5/5: 最终验证 -----------${NC}"

# 检查容器状态
echo ""
echo "容器状态："
docker compose ps 2>&1

# 检查前端
echo ""
if curl -fsS -o /dev/null -w "  前端 HTTP 状态码: %{http_code}" http://127.0.0.1:80/ 2>&1; then
  echo ""
  echo -e "  ${GREEN}[OK] 前端可正常访问${NC}"
else
  echo ""
  echo -e "  ${YELLOW}[WARN]  前端返回异常，检查 nginx 日志...${NC}"
  docker compose logs client --tail=20 2>&1 || true
fi

# 检查 API 健康接口
echo ""
HEALTH_JSON=$(curl -fsS http://127.0.0.1:3000/api/health 2>&1 || echo '{"status":"unreachable"}')
echo "  API 健康检查响应: $(echo "$HEALTH_JSON" | head -c 200)"

# ============================================================
# 部署完成报告
# ============================================================
echo ""
echo ""
echo "+------------------------------------------------------+"
echo "|          [OK]  部署完成！                              |"
echo "+------------------------------------------------------+"
echo "|  前端:    http://$(hostname -I 2>/dev/null | awk '{print $1}' || echo '服务器IP')              |"
echo "|  后端:    http://127.0.0.1:3000/api/health           |"
echo "|  日志:    $DEPLOY_LOG |"
echo "|                                                      |"
echo "|  常用命令:                                           |"
echo "|    docker compose ps             查看容器状态         |"
echo "|    docker compose logs -f --tail=50  查看日志        |"
echo "|    docker compose restart         重启所有服务        |"
echo "|    docker compose down            停止所有服务        |"
echo "+------------------------------------------------------+"
echo ""
