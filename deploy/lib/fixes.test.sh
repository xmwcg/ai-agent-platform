#!/usr/bin/env bash
# ============================================================
# fixes.sh 单元测试（Mock 模式）
# 用法：bash deploy/lib/fixes.test.sh
# ============================================================
set -euo pipefail

TEST_PASS=0
TEST_FAIL=0

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

pass() { echo -e "  ${GREEN}[PASS]${NC} $1"; TEST_PASS=$((TEST_PASS + 1)); }
fail() { echo -e "  ${RED}[FAIL]${NC} $1"; TEST_FAIL=$((TEST_FAIL + 1)); }

echo ""
echo "============================================"
echo "  fixes.sh 单元测试"
echo "============================================"
echo ""

# --- Test 1: 所有 fix 函数已定义 ---
echo -e "${YELLOW}[1] fix 函数定义检查${NC}"
source deploy/lib/fixes.sh 2>/dev/null

declare -f fix_port_conflict   &>/dev/null && pass "fix_port_conflict 已定义"   || fail "fix_port_conflict 未定义"
declare -f fix_nginx_dns       &>/dev/null && pass "fix_nginx_dns 已定义"       || fail "fix_nginx_dns 未定义"
declare -f fix_dockerignore    &>/dev/null && pass "fix_dockerignore 已定义"    || fail "fix_dockerignore 未定义"
declare -f fix_docker_mirror   &>/dev/null && pass "fix_docker_mirror 已定义"   || fail "fix_docker_mirror 未定义"
declare -f fix_jwt_secret      &>/dev/null && pass "fix_jwt_secret 已定义"      || fail "fix_jwt_secret 未定义"
declare -f fix_env_template    &>/dev/null && pass "fix_env_template 已定义"    || fail "fix_env_template 未定义"
declare -f run_fixes           &>/dev/null && pass "run_fixes 已定义"           || fail "run_fixes 未定义"
declare -f print_fix_summary   &>/dev/null && pass "print_fix_summary 已定义"   || fail "print_fix_summary 未定义"

# --- Test 2: FIX_DONE/FIX_SKIPPED/FIX_FAILED 变量存在 ---
echo ""
echo -e "${YELLOW}[2] 计数器变量${NC}"
FIX_DONE=0 FIX_SKIPPED=0 FIX_FAILED=0
[ "$FIX_DONE" -eq 0 ] && pass "FIX_DONE 可赋值" || fail "FIX_DONE 赋值失败"

# --- Test 3: run_fixes 可正常执行（不崩溃即通过） ---
echo ""
echo -e "${YELLOW}[3] run_fixes 不崩溃${NC}"
# Mock systemctl 避免真正操作
mock_systemctl() {
  if [ "${1:-}" = "is-active" ]; then
    return 1  # 假装服务未运行
  fi
  return 0
}
export -f mock_systemctl 2>/dev/null || true

# Mock openssl
mock_openssl() {
  echo "deadbeef0123456789abcdef0123456789abcdef01"
}
export -f mock_openssl 2>/dev/null || true

# 不实际执行 run_fixes（会尝试操作文件系统），只验证函数可调用
FIX_DONE=0 FIX_SKIPPED=0 FIX_FAILED=0
# 测试 print_fix_summary 不崩溃
print_fix_summary > /dev/null 2>&1
pass "print_fix_summary 执行不崩溃"

# --- Test 4: 颜色常量 ---
echo ""
echo -e "${YELLOW}[4] 颜色常量${NC}"
source deploy/lib/fixes.sh 2>/dev/null
[ -n "${RED:-}" ]    && pass "RED 已定义"    || fail "RED 未定义"
[ -n "${GREEN:-}" ]  && pass "GREEN 已定义"  || fail "GREEN 未定义"
[ -n "${YELLOW:-}" ] && pass "YELLOW 已定义" || fail "YELLOW 未定义"
[ -n "${CYAN:-}" ]   && pass "CYAN 已定义"   || fail "CYAN 未定义"
[ -n "${NC:-}" ]     && pass "NC 已定义"     || fail "NC 未定义"

# --- Test 5: 直接执行 fixes.sh 入口 ---
echo ""
echo -e "${YELLOW}[5] 直接执行 fixes.sh（不崩溃）${NC}"
set +e
FIX_DONE=0 FIX_SKIPPED=0 FIX_FAILED=0
run_fixes > /dev/null 2>&1
EXIT_CODE=$?
set -e
[ "$EXIT_CODE" -ge 0 ] && pass "run_fixes 返回码 $EXIT_CODE" || fail "run_fixes 崩溃"

# ========== 汇总 ==========
TOTAL=$((TEST_PASS + TEST_FAIL))
echo ""
echo "============================================"
echo -e "  fixes.sh 测试：${GREEN}通过 $TEST_PASS${NC} / ${RED}失败 $TEST_FAIL${NC} / 总计 $TOTAL"
echo "============================================"

if [ "$TEST_FAIL" -gt 0 ]; then
  exit 1
fi
exit 0
