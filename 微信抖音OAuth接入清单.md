# 微信 / 抖音 第三方登录接入清单

> 本地开发态的「微信扫码 / 抖音」是 Mock 占位（点了登不进去）。
> 服务器目前只显示「邮箱登录」是正确的（生产关了 Mock，且未配真实密钥）。
> 走完下面流程、把真实密钥填进服务器 `.env` 并重启后，服务器才会出现**真实可用**的微信/抖音登录。

---

## 一、微信网站应用（扫码登录）

**前提**：微信开放平台「网站应用」要求**企业主体认证（¥300）**，个人无法创建。

1. 打开 https://open.weixin.qq.com/ → 用企业账号登录（无账号先注册并完成开发者资质认证，¥300）。
2. 进入 **管理中心 → 网站应用 → 创建网站应用**。
3. 填写资料：
   - 应用名称：如「AIbak 全站 AI 平台」
   - 网站地址：`https://aibak.site`
   - 应用图标（按提示尺寸上传）
4. 提交审核，等待微信审核通过（通常 1–3 个工作日）。
5. 审核通过后，在应用详情页拿到：
   - **AppID → 对应 `WECHAT_OPEN_APPID`**
   - **AppSecret → 对应 `WECHAT_OPEN_SECRET`**
6. **授权回调域名**：在应用详情把「授权回调域名」设为 **`aibak.site`**（只填域名，不带 `https://` 和路径）。
   代码默认回调地址为 `https://aibak.site/api/auth/wechat/callback`，域名必须备案一致才能通过校验。
7. 把下面两个值发给部署人员：
   ```
   WECHAT_OPEN_APPID = （AppID）
   WECHAT_OPEN_SECRET = （AppSecret）
   ```

---

## 二、抖音网站应用（扫码 / H5 登录）

1. 打开 https://open.douyin.com/ → 注册/登录**抖音开放平台**账号，完成**实名认证**（企业或个人均可）。
2. 进入 **控制台 → 我的应用 → 网站应用 → 创建应用**。
3. 填写：应用名称、简介、图标、类目（如「工具」类）。
   授权回调地址可留空，代码默认用 `https://aibak.site/api/auth/douyin/callback`（也可用 `.env` 的 `DOUYIN_REDIRECT_URI` 指定）。
4. 提交审核，通过后拿到：
   - **Client Key → 对应 `DOUYIN_CLIENT_KEY`**
   - **Client Secret → 对应 `DOUYIN_CLIENT_SECRET`**
5. 把下面两个值发给部署人员：
   ```
   DOUYIN_CLIENT_KEY = （Client Key）
   DOUYIN_CLIENT_SECRET = （Client Secret）
   ```

---

## 三、拿到密钥后的服务器部署步骤（无需手动操作，交给部署人员）

1. SSH 进服务器 `159.75.124.59`，编辑 `/opt/ai-agent-platform/server/.env`，追加/更新：
   ```
   WECHAT_OPEN_APPID=...
   WECHAT_OPEN_SECRET=...
   DOUYIN_CLIENT_KEY=...
   DOUYIN_CLIENT_SECRET=...
   # 同时确认以下两行已存在且正确（回调地址依赖它拼接）
   PUBLIC_BASE_URL=https://aibak.site
   NODE_ENV=production
   ```
2. 重启使环境变量生效（环境变量运行时读取，**无需重新 build 镜像**）：
   ```
   cd /opt/ai-agent-platform && docker compose up -d server
   ```
3. 验证：
   - `curl https://aibak.site/api/auth/login-methods` → 应返回 `wechat:true, douyin:true`
   - 浏览器打开 `https://aibak.site/login` → 出现「微信扫码」「抖音」真实入口
   - 实际扫码一次，确认能创建/绑定账号并登录

---

## 四、注意事项

- **回调域名必须与开放平台备案一致**：微信严格校验 `redirect_uri` 域名，`aibak.site` 已备案 + SSL，没问题。
- **Secret 保密**：密钥只私发给部署人员，仅写入服务器 `.env`，不进代码仓库。
- 抖音 H5 授权在移动端会自动适配，PC 端为弹窗扫码。
