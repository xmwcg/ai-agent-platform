import 'dotenv/config';
import { generateXhsCopy } from './src/services/xhs-copy.service';

/**
 * 真实产出验证：直接调用统一 AI 网关（真实 provider，非 mock）。
 * 前置：在 .env 中
 *   - ENABLE_MOCK_MODE=false
 *   - OPENAI_API_KEY=<你的自定义端点 Key>
 *   - OPENAI_BASE_URL=<你的 OpenAI 兼容端点，如 https://xxx/v1>
 *   - CUSTOM_MODEL=<你的模型名，如 gpt-4o>
 * 运行：cd ai-agent-platform/server && npx ts-node --transpile-only verify-real.ts
 */
async function main() {
  if (process.env.ENABLE_MOCK_MODE === 'true') {
    console.error('[verify] 请先把 .env 的 ENABLE_MOCK_MODE 设为 false，再跑真实产出验证');
    process.exit(2);
  }
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    console.error('[verify] 请先在 .env 填入 OPENAI_API_KEY（你的自定义端点 Key）');
    process.exit(2);
  }
  const base = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
  const customModel = process.env.CUSTOM_MODEL || 'gpt-4o';
  const model = `openai/${customModel}`;
  console.log(`[verify] base=${base}  model=${model}`);

  console.log('[verify] 调用 xhs-copywriter（真实 AI 网关）...');
  const r = await generateXhsCopy({
    role: 'copywriter',
    product: '一款主打“早C晚A”的平价护肤精华，核心卖点：温和、见效快、学生党友好',
    audience: '18-25岁大学生',
    style: '种草、亲切',
    keywords: '平价、温和、学生党',
    count: 1,
    model,
  });

  console.log('---- REPLY（前 600 字）----');
  console.log(r.reply.slice(0, 600));
  console.log('---- STRUCTURED ----');
  console.log(JSON.stringify(r.structured, null, 2));

  const isMock = r.reply.includes('[Mock]');
  const ok = !isMock && !!r.reply.trim();
  console.log(ok ? '\n[verify] PASS ✅ 真实产出成功（非 Mock）' : '\n[verify] FAIL ❌ 仍为 Mock 或空');
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error('[verify] ERROR:', e?.message || e);
  process.exit(1);
});

setTimeout(() => {
  console.error('[verify] WATCHDOG: 90s 超时，请检查网络 / 端点 / 模型名');
  process.exit(3);
}, 90000).unref();
