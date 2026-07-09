#!/usr/bin/env bash
# ============================================================
# 批量管理脚本 — Auto Deploy System v1.0
# 用法：
#   bash deploy/batch.sh deploy --all      部署所有启用的项目
#   bash deploy/batch.sh deploy --site xxx  部署指定项目
#   bash deploy/batch.sh status             查看所有项目状态
#   bash deploy/batch.sh logs --site xxx    查看指定项目日志
# ============================================================
set -euo pipefail

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# -------- 简单的 YAML 解析（不依赖 yq）--------
get_yaml_value() {
  local file="$1"
  local key="$2"
  grep "^[[:space:]]*${key}:" "$file" | head -1 | sed 's/.*:[[:space:]]*"\?\([^"]*\)"\?/\1/' | tr -d ' '
}

cmd_deploy() {
  local target="${1:-}"

  echo ""
  echo "============================================"
  echo "  📦 批量部署"
  echo "============================================"

  if [ "$target" = "--all" ]; then
    # 部署所有启用的项目
    local count=0
    while IFS= read -r line; do
      if echo "$line" | grep -q '^  - name:'; then
        local site_name
        site_name=$(echo "$line" | sed 's/.*name:[[:space:]]*"\?\([^"]*\)"\?/\1/' | tr -d ' ')
        count=$((count + 1))
      fi
    done < "$SCRIPT_DIR/sites.yaml"

    if [ "$count" -eq 0 ]; then
      echo "没有配置任何项目"
      return
    fi

    echo "共发现 $count 个项目"
    local idx=0
    while IFS= read -r line; do
      if echo "$line" | grep -q '^  - name:'; then
        idx=$((idx + 1))
        local site_name
        site_name=$(echo "$line" | sed 's/.*name:[[:space:]]*"\?\([^"]*\)"\?/\1/' | tr -d ' ')
        echo ""
        echo -e "${CYAN}[$idx/$count] 部署: $site_name${NC}"
        # 进入项目目录并部署
        if [ -f "$SCRIPT_DIR/auto-deploy.sh" ]; then
          bash "$SCRIPT_DIR/auto-deploy.sh" || echo -e "${RED}  ❌ $site_name 部署失败${NC}"
        fi
      fi
    done < "$SCRIPT_DIR/sites.yaml"
  elif [ -n "$target" ]; then
    echo "部署单项目: $target"
    # 查找项目路径并部署
    if [ -f "$SCRIPT_DIR/auto-deploy.sh" ]; then
      bash "$SCRIPT_DIR/auto-deploy.sh"
    else
      echo "请进入项目目录运行 auto-deploy.sh"
    fi
  else
    echo "用法: bash deploy/batch.sh deploy --all | --site <name>"
  fi
}

cmd_status() {
  echo ""
  echo "============================================"
  echo "  📊 项目状态"
  echo "============================================"

  local host
  host=$(get_yaml_value "$SCRIPT_DIR/sites.yaml" "host")

  # 动态解析 sites.yaml 中的项目列表
  local projects=()
  while IFS= read -r line; do
    if echo "$line" | grep -q '^  - name:'; then
      local site_name
      site_name=$(echo "$line" | sed 's/.*name:[[:space:]]*"\?\([^"]*\)"\?/\1/' | tr -d ' ')
      # 检查 enabled 字段
      local enable_line
      enable_line=$(grep -A5 "name:.*$site_name" "$SCRIPT_DIR/sites.yaml" | grep 'enabled:' | head -1)
      if [ -z "$enable_line" ] || echo "$enable_line" | grep -qv 'false'; then
        projects+=("$site_name")
      fi
    fi
  done < "$SCRIPT_DIR/sites.yaml"

  if [ ${#projects[@]} -eq 0 ]; then
    echo -e "  ${YELLOW}⚠️  没有已启用的项目${NC}"
    return
  fi

  for project in "${projects[@]}"; do
    echo ""
    echo -e "  ${CYAN}📁 $project${NC}"
    local base_path
    base_path=$(get_yaml_value "$SCRIPT_DIR/sites.yaml" "base_path")
    base_path="${base_path:-/opt}"
    local project_dir="${base_path}/${project}"
    # 检查目录是否存在
    if ssh -o ConnectTimeout=5 -o StrictHostKeyChecking=no "$host" "[ -d $project_dir ]" 2>/dev/null; then
      local status
      status=$(ssh -o ConnectTimeout=5 "$host" "cd $project_dir && docker compose ps --format 'table {{.Name}}\t{{.Status}}' 2>/dev/null || echo 'NOT_DEPLOYED'" 2>/dev/null)
      echo "$status" | while IFS= read -r line; do
        echo "    $line"
      done
    else
      echo -e "    ${YELLOW}⚠️  未部署（目录不存在）${NC}"
    fi
  done
}

cmd_logs() {
  local site="${1:-ai-agent-platform}"
  echo "查看 $site 日志（最近 50 行）..."
  local host
  host=$(get_yaml_value "$SCRIPT_DIR/sites.yaml" "host")
  local base_path
  base_path=$(get_yaml_value "$SCRIPT_DIR/sites.yaml" "base_path")
  base_path="${base_path:-/opt}"
  ssh -t "$host" "cd ${base_path}/${site} && docker compose logs --tail=50" 2>/dev/null || echo "无法连接"
}

# ---------- 主入口 ----------
case "${1:-}" in
  deploy)
    cmd_deploy "${2:-}"
    ;;
  status)
    cmd_status
    ;;
  logs)
    cmd_logs "${2:-}"
    ;;
  *)
    echo "用法: bash deploy/batch.sh <command>"
    echo ""
    echo "命令:"
    echo "  deploy --all       部署所有项目"
    echo "  deploy --site <名称> 部署指定项目"
    echo "  status             查看所有项目状态"
    echo "  logs [项目名]       查看项目日志"
    ;;
esac
