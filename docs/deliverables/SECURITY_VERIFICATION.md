# 安全加固验收报告（Security Verification Report）

- **项目**：ai-agent-platform（第三方大模型 API Key 管理）
- **日期**：2026-07-11
- **范围**：用户配置的第三方厂商 `ModelConfig.apiKey` 的加密落库、密钥轮换、操作审计与异常告警
- **结论**：✅ 全部通过对上线变现至关重要的安全能力，验证通过

---

## 一、验证结果汇总

| 验证项 | 方式 | 结果 |
|--------|------|------|
| 类型检查 | `npx tsc --noEmit`（server） | ✅ 0 error |
| 全量回归测试 | `npx jest` | ✅ 41 套件 / 299 用例全过 |
| 双密钥加解密 | `crypto.test.ts`（7 用例） | ✅ 旧→新回退、显式 key、明文兼容、缺失 key 抛错 |
| 审计异步落库 + 高频告警 | `secret-audit.service.test.ts`（4 用例） | ✅ 写入/失败不阻塞/高频告警 |
| 密钥轮换算法 | ts-node 端到端冒烟（旧密文重加密 / 已新密钥跳过 / 明文加密 / 空值跳过） | ✅ `rotated:2, skipped:1, empty:1` |

---

## 二、已具备的安全能力

### 1. API Key 加密落库（AES-256-GCM）— 既有
- 算法：AES-256-GCM，带认证标签，密文篡改可被检测。
- 密文格式：`enc::v1:<iv>:<tag>:<cipher>`，密钥来自 `ENCRYPTION_KEY`（64 hex），缺失即启动失败。
- 读取点：网关 `reloadCustomProviders` 解密注入；`/test` 解密调用；列表接口返回固定掩码 `****`，不回传明文。

### 2. 密钥双密钥轮换（本次新增）
- `src/lib/crypto.ts`：
  - `encryptSecret(plaintext, { key })` / `decryptSecret(payload, { key })` 支持显式密钥。
  - `decryptSecret` 在 `ENCRYPTION_KEY` 解密失败时，自动回退 `ENCRYPTION_KEY_PREV`（或 `OLD_ENCRYPTION_KEY`），兼容轮换过渡期老密文。
  - 新增 `keyFromHex(hex)`，供脚本确定性构造密钥。
- 轮换脚本 `src/scripts/rotate-encryption-key.ts`：
  - 用旧密钥解密全部 `apiKey`，再用新密钥重加密写回。
  - 支持 `--old <hex> --new <hex>` 或 `.env` 中 `ENCRYPTION_KEY` / `ENCRYPTION_KEY_PREV`。
  - `--dry-run` 演练；**幂等**（已新密钥的跳过）；**失败即停**（绝不全量破坏）；明文历史数据会被新密钥加固加密。
  - `npm run rotate-key` 已加入 scripts。

### 3. 密钥操作审计 + 异常告警（本次新增）
- 模型 `src/models/SecretAuditLog.ts`：记录 `secret_created` / `secret_updated` / `secret_test` / `secret_deleted`，含 `ownerId`/`actorId`/`targetId`/`ip`/`userAgent`/`result`/`alert`/`detail`。
- 服务 `src/services/secret-audit.service.ts`：
  - `logSecretAudit()` 异步写入，失败不阻塞主业务。
  - `checkTestAbuse()` 滑动窗口（60s 内 >20 次 `/test`）触发高频告警，写入审计 `alert=true` 并打印告警日志。
- 接入点：`src/routes/model-config.ts` 的 创建 / 更新密钥 / 删除 / 测试连接 四处，均从 `req.user` + `req.ip` 取操作者上下文。

---

## 三、上线运维手册

### 轮换 ENCRYPTION_KEY（泄露或定期合规）
```bash
# 1) 生成新密钥
openssl rand -hex 32        # 记为 NEW_KEY

# 2) .env 同时保留旧与新
ENCRYPTION_KEY=<NEW_KEY>
ENCRYPTION_KEY_PREV=<OLD_KEY>

# 3) 先演练（不改库）
npm run rotate-key -- --dry-run

# 4) 确认无误后正式执行
npm run rotate-key

# 5) 轮换完成后移除 ENCRYPTION_KEY_PREV，重启服务
```
> 过渡期保持 `ENCRYPTION_KEY_PREV`，使旧密文仍可解密；全部重加密后删除该变量。脚本幂等，可安全重跑。

### 查询密钥审计
```js
// 某配置的全部密钥操作
db.secretauditlogs.find({ targetId: '<ModelConfig._id>' }).sort({ createdAt: -1 })
// 高频告警记录
db.secretauditlogs.find({ alert: true })
```

### 部署安全基线
- `.env` 权限 `chmod 600`，`ENCRYPTION_KEY` 走 KMS / 密钥管理服务，禁止进代码与镜像与前端。
- 多实例部署时，`checkTestAbuse` 的滑动窗口计数可改为 Redis（ioredis 已就绪）以支持跨实例聚合。

---

## 四、残留建议（非阻塞）
- 平台用户级 `ApiKey`（非第三方厂商 key）已采用 `keyHash` 哈希存储，无需改动。
- 建议为 `SecretAuditLog` 配置 TTL 索引，避免审计表无限增长。
- 告警目前仅落库 + 日志；如需实时通知，可在 `checkTestAbuse` 命中时对接钉钉/邮件 webhook。

---

## 五、变更清单
- `server/src/lib/crypto.ts` — 双密钥支持
- `server/src/models/SecretAuditLog.ts` — 新增审计模型
- `server/src/services/secret-audit.service.ts` — 新增审计 + 告警服务
- `server/src/routes/model-config.ts` — 接入审计与高频告警
- `server/src/scripts/rotate-encryption-key.ts` — 新增轮换脚本
- `server/package.json` — 新增 `rotate-key` 脚本
- `server/src/lib/crypto.test.ts`、`server/src/services/secret-audit.service.test.ts` — 新增测试
