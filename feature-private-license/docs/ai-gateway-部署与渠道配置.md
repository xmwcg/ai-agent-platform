# New API 网关 · 部署与渠道配置手册

> 服务器 `159.75.124.59` · 目录 `/opt/ai-gateway` · 域名 `aibak.site/ai-gateway/`
> 配套文件：`ai-gateway-docker-compose.yml`、`ai-gateway-nginx.conf`

---

## 〇、定位说明（重要）

**对你自有平台（aibak.site 主站）：New API 暂不作为主后端启用。**

理由：
- 你的 `ai-agent-platform` 已直连 DeepSeek/智谱/通义/豆包官方 API（方案A），成本即厂商价，已是当前最优；
- 在官方 API 前再套一层 New API，只会增加一跳延迟与一处运维故障点，**不直接降本**；
- 你已有的成本阀门（`cost-control.service.ts` + `PLAN_AI_BUDGET_FEN`）已锁死垫付风险，无需 New API 再来一层。

**New API 的正确定位 = 私有化交付物：**
- 卖给企业客户的「企业版/私有化」授权包，交付内容 = 你的平台 + New API 聚合网关，客户自己填硅基流动/火山 Key；
- 金网通 License 控激活，离线可用；
- 因此本仓库的 compose/nginx 配置**保留作为交付模板**，不在你主站公网启用（避免多一层暴露面）。

> 若未来要做「多供应商故障转移 + 统一 OpenAI 接口」给自有平台，再评估把 New API 作为可选后端挂到 `gatewayAPI`，但当前阶段不急。

---

## 一、服务器部署步骤（在 159.75.124.59 执行）

```bash
# 1. 建目录
mkdir -p /opt/ai-gateway/data
cd /opt/ai-gateway

# 2. 放 docker-compose.yml（本仓库 ai-gateway-docker-compose.yml）
#    注意改 SESSION_SECRET 为随机串

# 3. 启动
docker compose up -d

# 4. 验证容器
docker ps | grep ai-gateway

# 5. 放 nginx 配置（ai-gateway-nginx.conf 内容追加到 conf.d）
nginx -t && nginx -s reload

# 6. 验证公网
curl -I https://aibak.site/ai-gateway/
```

## 二、首次登录与渠道配置（Web 控制台）

1. 打开 `https://aibak.site/ai-gateway/` → 初始账号 `root` / 密码 `123456`（**务必改密**）。
2. 「渠道」→「添加」逐个接入：

| 渠道名 | 类型 | 密钥来源 | 备注 |
|--------|------|----------|------|
| 硅基流动 | SiliconFlow | platform.siliconflow.cn 控制台 | 主渠道，模型全 |
| 火山方舟 | VolcEngine | console.volcengine.com | 豆包系列 |
| DeepSeek | DeepSeek | platform.deepseek.com | 直连最便宜 |
| OpenRouter | OpenRouter | openrouter.ai | GPT/Claude |

3. 「用户」→ 创建会员用户，在「额度」发放体验包额度。
4. 「设置」→ 将网关 base URL 设为 `https://aibak.site/ai-gateway/`（子路径模式避免 404）。

## 三、渠道 Key 获取（零成本注册即有额度）
- 硅基流动：注册送 2000 万 token 体验。
- 火山方舟：新用户赠额度。
- DeepSeek：充值门槛低，单价最低。
- OpenRouter：注册送 $1 试用。

## 四、验证调用（OpenAI 兼容）
```bash
curl https://aibak.site/ai-gateway/v1/chat/completions \
  -H "Authorization: Bearer <用户令牌>" \
  -H "Content-Type: application/json" \
  -d '{"model":"deepseek-chat","messages":[{"role":"user","content":"你好"}]}'
```

## 五、注意事项（来自现有服务器经验）
- New API 镜像名以官方 `calciumion/new-api` 为准，生产固定 tag。
- 子路径反代必须设 `X-Forwarded-Prefix`，否则静态资源 404（金网通已踩过）。
- 复用服务器 redis 需指向已验证实例，禁用易崩旧逻辑。
- 不改 AIBAK/金网通代码，仅新增目录与 nginx 块，控制爆炸半径。
