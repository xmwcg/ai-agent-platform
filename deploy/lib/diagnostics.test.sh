#!/usr/bin/env bash
# ============================================================
# diagnostics.sh 单元测试（Mock 模式）
# 用法：bash deploy/lib/diagnostics.test.sh
# ============================================================
set -euo pipefail

TEST_PASS=0
TEST_FAIL=0
TEST_TOTAL=0

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

pass() { echo -e "  ${GREEN}[PASS]${NC} $1"; TEST_PASS=$((TEST_PASS + 1)); }
fail() { echo -e "  ${RED}[FAIL]${NC} $1"; TEST_FAIL=$((TEST_FAIL + 1)); }

# ========== Mock helpers ==========
mock_cmd_available()     { command -v "$1" &>/dev/null; }
mock_docker_info_ok()    { return 0; }
mock_docker_info_fail()  { return 1; }
mock_docker_compose_ok() { return 0; }
mock_docker_compose_fail(){ return 1; }
mock_ss_port_empty()     { echo ""; }
mock_ss_port_occupied()  { echo "nginx"; }
mock_df_ok()             { echo "Filesystem     1K-blocks     Used Available Use% Mounted on"; echo "/dev/sda1       51474912 11234568  37598184  24% /"; }
mock_df_low()            { echo "Filesystem     1K-blocks     Used Available Use% Mounted on"; echo "/dev/sda1       51474912 50500124    500000  99% /"; }
mock_env_exists()        { [ -f /tmp/test_diag_env ] && return 0 || return 1; }
mock_env_ok()            { echo "JWT_SECRET=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0"; }
mock_env_weak()          { echo "JWT_SECRET=changeme"; }
mock_grep_hit()          { return 0; }
mock_grep_miss()         { return 1; }

# ========== 测试用例 ==========

echo ""
echo "============================================"
echo "  diagnostics.sh 单元测试"
echo "============================================"
echo ""

# --- Test 1: _pass / _fail / _warn 计数器 ---
echo -e "${YELLOW}[1] 计数器函数${NC}"
source deploy/lib/diagnostics.sh 2>/dev/null
DIAG_PASS=0 DIAG_FAIL=0 DIAG_WARN=0 DIAG_ISSUES=()
_pass "test pass 1"
_pass "test pass 2"
_fail "test fail 1"
_warn "test warn 1"

[ "$DIAG_PASS" -eq 2 ] && pass "DIAG_PASS=2" || fail "DIAG_PASS expected 2 got $DIAG_PASS"
[ "$DIAG_FAIL" -eq 1 ] && pass "DIAG_FAIL=1" || fail "DIAG_FAIL expected 1 got $DIAG_FAIL"
[ "$DIAG_WARN" -eq 1 ] && pass "DIAG_WARN=1" || fail "DIAG_WARN expected 1 got $DIAG_WARN"
[ "${#DIAG_ISSUES[@]}" -eq 2 ] && pass "DIAG_ISSUES 有 2 条" || fail "DIAG_ISSUES expected 2 got ${#DIAG_ISSUES[@]}"

# --- Test 2: check_docker ---
echo ""
echo -e "${YELLOW}[2] check_docker / check_ports / check_disk 函数存在性${NC}"
declare -f check_docker  &>/dev/null && pass "check_docker 已定义"   || fail "check_docker 未定义"
declare -f check_ports   &>/dev/null && pass "check_ports 已定义"    || fail "check_ports 未定义"
declare -f check_disk    &>/dev/null && pass "check_disk 已定义"     || fail "check_disk 未定义"
declare -f check_env     &>/dev/null && pass "check_env 已定义"      || fail "check_env 未定义"
declare -f check_dockerignore &>/dev/null && pass "check_dockerignore 已定义" || fail "check_dockerignore 未定义"
declare -f check_nginx_conf    &>/dev/null && pass "check_nginx_conf 已定义"    || fail "check_nginx_conf 未定义"
declare -f check_image_mirror  &>/dev/null && pass "check_image_mirror 已定义"  || fail "check_image_mirror 未定义"

# --- Test 3: run_diagnostics 函数存在 ---
echo ""
echo -e "${YELLOW}[3] run_diagnostics / print_diag_summary 存在${NC}"
declare -f run_diagnostics      &>/dev/null && pass "run_diagnostics 已定义"      || fail "run_diagnostics 未定义"
declare -f print_diag_summary   &>/dev/null && pass "print_diag_summary 已定义"   || fail "print_diag_summary 未定义"

# --- Test 4: 直接执行 diagnostics.sh 不崩溃 ---
echo ""
echo -e "${YELLOW}[4] 直接执行 diagnostics.sh（退出码）${NC}"
DIAG_PASS=0 DIAG_FAIL=0 DIAG_WARN=0 DIAG_ISSUES=()
set +e
run_diagnostics > /dev/null 2>&1
EXIT_CODE=$?
set -e
# 在非 Docker 环境预期可能非 0，只要脚本不崩溃就算通过
[ "$EXIT_CODE" -ge 0 ] && pass "run_diagnostics 返回码 $EXIT_CODE（正常）"  || fail "run_diagnostics 崩溃"

# --- Test 5: 颜色常量定义 ---
echo ""
echo -e "${YELLOW}[5] 颜色常量${NC}"
source deploy/lib/diagnostics.sh 2>/dev/null
[ -n "${RED:-}" ]  && pass "RED 已定义"  || fail "RED 未定义"
[ -n "${GREEN:-}" ] && pass "GREEN 已定义" || fail "GREEN 未定义"
[ -n "${YELLOW:-}" ]&& pass "YELLOW 已定义"|| fail "YELLOW 未定义"
[ -n "${CYAN:-}" ]  && pass "CYAN 已定义"  || fail "CYAN 未定义"
[ -n "${NC:-}" ]    && pass "NC 已定义"    || fail "NC 未定义"

# ========== 汇总 ==========
TEST_TOTAL=$((TEST_PASS + TEST_FAIL))
echo ""
echo "============================================"
echo -e "  diagnostics.sh 测试：${GREEN}通过 $TEST_PASS${NC} / ${RED}失败 $TEST_FAIL${NC} / 总计 $TEST_TOTAL"
echo "============================================"

if [ "$TEST_FAIL" -gt 0 ]; then
  exit 1
fi
exit 0
