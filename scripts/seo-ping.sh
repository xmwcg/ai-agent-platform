#!/bin/bash
# ============================================
# AIbak.site SEO Ping 脚本
# 用途：主动提交 sitemap 到百度、Bing、Google
# 用法：bash scripts/seo-ping.sh
# ============================================

SITEMAP_URL="https://aibak.site/sitemap.xml"
DOMAIN="aibak.site"

echo "=== AIbak.site SEO Ping ==="
echo "时间: $(date '+%Y-%m-%d %H:%M:%S')"
echo ""

# ─── 1. 百度站长平台 ───
# 需要先在 https://ziyuan.baidu.com/ 验证站点所有权
# 然后获取 API 提交地址中的 token
BAIDU_TOKEN="${BAIDU_API_TOKEN:-}"
if [ -n "$BAIDU_TOKEN" ]; then
  echo "[百度] 提交 sitemap..."
  RESP=$(curl -s -o /dev/null -w "%{http_code}" "https://data.zz.baidu.com/urls?site=https://$DOMAIN&token=$BAIDU_TOKEN")
  echo "[百度] HTTP $RESP"
else
  echo "[百度] 跳过（未设置 BAIDU_API_TOKEN 环境变量）"
  echo "  提示：登录 https://ziyuan.baidu.com/ 获取 token 后设置环境变量"
fi

# ─── 2. Bing Webmaster Tools ───
BING_API_KEY="${BING_API_KEY:-}"
if [ -n "$BING_API_KEY" ]; then
  echo "[Bing] 提交 sitemap..."
  RESP=$(curl -s -o /dev/null -w "%{http_code}" -X POST "https://ssl.bing.com/webmaster/api.svc/json/SubmitSiteSitemap?apikey=$BING_API_KEY" \
    -H "Content-Type: application/json" \
    -d "{\"siteUrl\":\"https://$DOMAIN\",\"sitemapUrl\":\"$SITEMAP_URL\"}")
  echo "[Bing] HTTP $RESP"
else
  echo "[Bing] 跳过（未设置 BING_API_KEY）"
fi

# ─── 3. Google (通过 ping sitemap URL) ───
echo "[Google] Ping sitemap..."
RESP=$(curl -s -o /dev/null -w "%{http_code}" "https://www.google.com/ping?sitemap=$SITEMAP_URL")
echo "[Google] HTTP $RESP"

# ─── 4. 百度主动推送（普通收录） ───
# 推送金网通等关键URL
KEY_URLS=(
  "https://aibak.site/jinwangtong"
  "https://aibak.site/jinwangtong-demo"
  "https://aibak.site/project-grade"
  "https://aibak.site/project-grade/demo"
  "https://aibak.site/pricing"
  "https://aibak.site/landing/saas"
  "https://aibak.site/landing/ecommerce"
  "https://aibak.site/landing/fintech"
)

if [ -n "$BAIDU_TOKEN" ]; then
  echo ""
  echo "[百度主动推送] 提交关键URL..."
  URLS=$(printf '%s\n' "${KEY_URLS[@]}")
  RESP=$(curl -s -X POST "https://data.zz.baidu.com/urls?site=https://$DOMAIN&token=$BAIDU_TOKEN" \
    -H "Content-Type: text/plain" \
    -d "$URLS")
  echo "[百度主动推送] 响应: $RESP"
fi

echo ""
echo "=== SEO Ping 完成 ==="
