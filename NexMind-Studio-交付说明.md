# NexMind 创作工坊（Studio）交付说明

> 本包 = 你的平台 `ai-agent-platform-recovery-20260727` 的完整可部署副本，已内含「NexMind 创作工坊」模块（短视频成片 / 数字人口播 / 电商图文三条产品线），生产构建已验证通过。

## 一、包内含什么
- 平台全量源码（server + client）+ 本次**生产构建产物 dist**（server/dist、client/dist 均已生成）
- Docker 部署链：`server/Dockerfile`、`client/Dockerfile`、`docker-compose.*.yml`、整套 `deploy/` 脚本
- 创作工坊专属代码（见第三节清单）
- `.env.example`（已追加 `STUDIO_*` 区块）

> 已排除：`node_modules/`、`.git/`、`coverage/`、`.superpowers/`（目标机自行 `npm install`）。

## 二、验证状态（打包前已通过）
- ✅ server `tsc` 生产构建 exit 0
- ✅ client `vite build` 生产构建 exit 0（4075 模块转译成功）
- ✅ 创作工坊 17 单测 + 全平台 1003 回归测试全过
- ⏳ 真实云 API 联调未做（需填 AK/ARK Key 后跑第一条成片）

## 三、Studio 模块文件清单（本次新增 / 修改）
**新增（未跟踪）：**
- `server/src/models/StudioJob.ts` — 多步任务持久化
- `server/src/routes/studio.ts` — `/api/studio` 路由
- `server/src/services/studiopipe/` — 编排核心 + 适配器（script/tts/asr/subtitle/bgm/export/digitalhuman/ecommerce/_util）+ `credit-map.ts` + `types.ts` + `studio-templates/manifest.json`
- `server/src/index.route-mounts.studio.test.ts` — 路由挂载契约测试
- `client/src/pages/StudioPage.tsx` — `/studio` 页面
- `client/src/services/studio.ts` — 前端接口封装
- `client/public/brand/NexMind-LOGO-深色底.svg` — 品牌 LOGO

**修改（已集成）：**
- `server/src/index.ts` — 挂载 `/api/studio`
- `server/src/models/MediaUserKey.ts` — BYOK 厂商扩展 `+deepseek +ark`
- `client/src/router.tsx` — 注册 `/studio` 路由
- `server/.env.example` — 追加 `STUDIO_*` 环境变量区块

## 四、部署方式

### 方式 A：Docker（推荐上线）
```bash
# 在目标服务器
docker compose -f docker-compose.production.yml up -d --build
```
按 `deploy/PRODUCTION-CHECKLIST.md` 与 `.env.example` 填好环境变量（含 `STUDIO_*`）后部署。

### 方式 B：本地 / 裸机
```bash
# 1. 依赖
cd server && npm install && npm run build
cd ../client && npm install && npm run build
# 2. 配置：复制 .env.example → .env 并填值（JWT_SECRET / ENCRYPTION_KEY / MONGODB_URI / REDIS_URL / STUDIO_*）
# 3. 起基础设施（mongo + redis）+ ffmpeg
# 4. 启动
cd server && npm start        # 后端 :3000
cd client && npm run preview   # 前端静态 :5173（或交由 nginx）
```

## 五、环境变量（创作工坊专属，已写入 .env.example）
```
DEEPSEEK_API_KEY=        # 脚本生成
ARK_API_KEY=             # 配音/视觉/图像（火山方舟）
ARK_TTS_MODEL=  ARK_TTS_VOICE=  ARK_VISION_MODEL=  ARK_IMAGE_MODEL=
STUDIO_ASR_URL=          # 云识别，留空则占位字幕
STUDIO_DH_URL=           # 数字人 API（数字人口播必需）
STUDIO_WORK_DIR=./studio-tmp
STUDIO_BGM_DIR=          # 背景音乐目录，留空无 BGM
STUDIO_WATERMARK_PATH=   # 水印 PNG，留空不加
```
> 也可不填平台 Key，登录后在前端「模型配置」用 **BYOK 自带 Key**（免平台算力积分）。

## 六、使用流程
浏览器打开前端 → 登录 → 进入 `/studio` → 选场景（短视频成片 / 数字人口播 / 电商图文）→ 填表 → 生成 → 看进度 → 预览/下载。每次生成按积分扣费（短视频 20 / 数字人 31 / 电商 29），不足引导充值/开会员（走既有微信支付 v3）。

## 七、法律边界
本模块为**自有产品**：仅借鉴成哥 AI 自媒体工坊的架构思路（场景声明式 / 配额积分 / 云 API 抽象 / 任务编排），全部胶水代码自研，**未复制其任何 dll/cs/py，也未接入或绕过其付费逻辑**。
