#!/usr/bin/env bash
set -e
BASE=http://127.0.0.1:3000
echo "=== 注册临时账号 ==="
curl -s -X POST $BASE/api/auth/register -H 'Content-Type: application/json' \
  -d '{"email":"deploy_verify@test.local","password":"Test123456","name":"DeployVerify"}' -o /tmp/reg.json
TOKEN=$(grep -oE '"token":"[^"]+"' /tmp/reg.json | head -1 | sed 's/"token":"//;s/"//')
echo "TOKEN_LEN=${#TOKEN}"

echo "=== 微信下单 (期望返回 codeUrl) ==="
curl -s -X POST $BASE/api/billing/orders -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"plan":"pro","period":"monthly","provider":"wechat"}' -o /tmp/order_wx.json
cat /tmp/order_wx.json | head -c 800
echo

echo "=== 支付宝下单 (期望被拦截: 未配置) ==="
curl -s -X POST $BASE/api/billing/orders -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"plan":"pro","period":"monthly","provider":"alipay"}' -o /tmp/order_al.json
cat /tmp/order_al.json | head -c 500
echo

echo "=== 诊断接口 (需鉴权) ==="
curl -s $BASE/api/diagnostics -H "Authorization: Bearer $TOKEN" -o /tmp/diag.json
grep -oE '"alipay":\{[^}]*\}' /tmp/diag.json || echo "(diag中无alipay字段?)"
echo
grep -oE '"wechat":\{[^}]*\}' /tmp/diag.json || echo "(diag中无wechat字段?)"
