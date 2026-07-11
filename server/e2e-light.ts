/**
 * 轻量级端到端验证（临时，验证后删除）
 * 直接调用纯函数（registry / catalog / generateXhsCopy / 技能 invoke），
 * 不启动服务、不连数据库，秒级完成。
 * 依赖 shell 已设置 ENABLE_MOCK_MODE=true。
 */
import { listMarketableSkills, getSkill } from './src/skills/registry';
import { getCatalog, getCatalogEntry } from './src/skills/external-market';
import { xhsExpertSkills } from './src/skills/defs/xhs-experts.skill';

const results: { name: string; ok: boolean; detail?: any }[] = [];
function log(name: string, ok: boolean, detail?: any) {
  results.push({ name, ok, detail });
  console.log(`${ok ? '✅' : '❌'} ${name}${detail !== undefined ? '  → ' + JSON.stringify(detail).slice(0, 260) : ''}`);
}

async function main() {
  // 1) market：4 个 xhs-* 可上架技能
  const marketIds = listMarketableSkills().map((s) => s.manifest.id);
  const xhs = marketIds.filter((x) => x.startsWith('xhs-'));
  log('registry 含 4 个 xhs-* 可上架技能', xhs.length === 4, xhs);
  log('4 个技能均 marketable=true', xhs.every((id) => getSkill(id)?.manifest.marketable === true), xhs);

  // 2) catalog：新增 MCP / 技能包 / 市场入口均存在
  const cat = getCatalog();
  const catIds = cat.map((c) => c.id);
  const expectNew = [
    'mcp-memory', 'mcp-postgres', 'mcp-slack', 'mcp-google-maps', 'mcp-gitlab', 'mcp-everything',
    'skill-translator', 'skill-meeting-notes', 'skill-sql-helper', 'skill-email-writer',
    'link-pulsemcp', 'link-glama', 'link-composio', 'link-awesome-mcp', 'link-cline-marketplace',
  ];
  const missing = expectNew.filter((x) => !catIds.includes(x));
  log('catalog 含全部新增条目', missing.length === 0, { total: catIds.length, missing });

  // 2b) 各类型条目结构正确（install 消费这些字段）
  const translator = getCatalogEntry('skill-translator');
  log('技能包条目含 skillPackage.manifest.id', !!translator?.skillPackage?.manifest?.id, translator?.skillPackage?.manifest?.id);
  const mem = getCatalogEntry('mcp-memory');
  log('MCP 条目含 mcpConfig（transport/command）', !!mem?.mcpConfig?.transport && !!mem?.mcpConfig?.command, { transport: mem?.mcpConfig?.transport, command: mem?.mcpConfig?.command });
  const link = getCatalogEntry('link-pulsemcp');
  log('市场入口条目 kind=link 且含 officialUrl', link?.kind === 'link' && !!link?.officialUrl, { kind: link?.kind, url: link?.officialUrl });
  log('不存在的条目返回 undefined（install 会 404）', getCatalogEntry('not-exist') === undefined);

  // 3) 直接调用技能 invoke（走统一 AI 网关 mock 兜底）
  for (const role of ['copywriter', 'architect', 'frontend', 'devops'] as const) {
    const skill = xhsExpertSkills.find((s) => s.manifest.id === `xhs-${role}`)!;
    const r = await skill.invoke({ input: { product: '示例产品：AI 智能办公助手', audience: '职场人', style: '专业', keywords: '效率' } });
    log(`invoke xhs-${role} 成功`, r.ok === true && !!r.data, { ok: r.ok, hasStructured: role === 'copywriter' ? !!r.data?.structured : undefined });
  }

  // 3b) 缺 product 应报错
  const bad = await xhsExpertSkills[0].invoke({ input: {} });
  log('invoke 缺 product 返回错误', bad.ok === false && !!bad.error, bad.error);

  const passed = results.filter((r) => r.ok).length;
  console.log(`\n=== 结果：${passed}/${results.length} 通过 ===`);
  const failed = results.filter((r) => !r.ok);
  if (failed.length) console.log('失败项：', failed.map((f) => f.name).join('; '));
  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => {
  console.error('💥 验证异常：', e);
  process.exit(1);
});
