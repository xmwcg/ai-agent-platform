# 自动化 SEO 方案（主动收录，替代被动分享转发）

> 原则：**搜索引擎主动收录 > 等用户分享**。通过 sitemap + 结构化数据 + 自动 ping + 站内搜索 + SSR 级 meta，让 aibak.site 持续被百度/Google/Bing 抓取，形成稳定自然流量。

## 一、现状缺口
- 当前引流靠分享/转发（被动），无 sitemap、无 JSON-LD、无主动提交。
- `router.tsx` 为 SPA（客户端渲染），爬虫首屏可能拿不到内容 → 需 meta/结构化数据兜底。

## 二、主动收录技术栈（2026 最佳实践，联网核验）

### 1. Sitemap（全路由）
- `public/sitemap.xml` 列出全部可索引路由（首页、知识库、各模块、法律页）。
- 部署后自动 ping：`https://www.baidu.com/s?site=域名`、`https://www.google.com/ping?sitemap=域名/sitemap.xml`、`https://www.bing.com/ping?sitemap=...`。
- 知识库新增文档时，由后端在 `/knowledge/:id` 生成 `<url>` 并刷新 sitemap（或走「提交接口」）。

### 2. robots.txt
- 允许全部爬虫，指向 sitemap：`Sitemap: https://aibak.site/sitemap.xml`。

### 3. 结构化数据 JSON-LD（首页注入）
- `WebSite`（站内搜索框、`potentialAction` SearchAction，直接获得百度/Google 站点搜索富结果）。
- `SoftwareApplication`（AI 平台名称、类别、功能、评分占位）。
- 各详情页 `BreadcrumbList`（面包屑，提升收录层级清晰度）。

### 4. 元数据（每页 title/description/og）
- 抽一个 `useSeo(title, desc)` Hook，在页面 mount 时写 `document.title` + `<meta name=description>` + OG，保证 SPA 每页有独立 meta（利于收录与分享卡片）。

### 5. 自动 ping 脚本（部署钩子）
- 在 `deploy.sh` / `push-deploy` 末尾调用 `curl` 批量 ping 三大引擎 + 提交 sitemap 到百度搜索资源平台/Google Search Console（用平台验证 token）。
- 也可做后端 `POST /api/seo/ping` 由前端「发布内容」时触发（知识库/创作发布即上报）。

### 6. 站内搜索（已有 GlobalSearch）
- 接 `WebSite` 的 `SearchAction`，让搜索引擎识别站内搜索；同时站内搜索结果页本身可被收录（query 参数页加 `canonical`）。

### 7. 内容更新即收录
- 知识库/创作发布 → 后端写入 sitemap 队列 → 定时（或即时）ping。形成「发布即收录」闭环。

## 三、实施清单（落到代码）
1. `public/sitemap.xml`（脚本 `scripts/gen-sitemap.mjs` 从 router 生成，部署前执行）。
2. `public/robots.txt`。
3. `index.html` 注入 WebSite + SoftwareApplication JSON-LD。
4. `client/src/hooks/useSeo.ts` + 在核心页（Home/KnowledgeList/各模块）调用。
5. `server/src/routes/seo.ts`：`GET /sitemap.xml`（动态，含知识库 URL）、`POST /api/seo/ping`。
6. `deploy.sh` 末尾加 ping + sitemap 提交。
7. 知识库发布钩子：创建/更新文档时触发 sitemap 刷新 + ping。

## 四、预期效果
- 新内容 24h 内被主流引擎发现；站点搜索富结果提升点击率；长尾词（如「DeepSeek 接入」「行业大模型客服」）借知识库内容自然排名 → 持续免费引流，不依赖分享。
