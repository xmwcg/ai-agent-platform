/**
 * 技能市场 + AI 网关 冒烟验证（无需常驻端口 / 无需真实密钥）
 * 运行：ENABLE_MOCK_MODE=true npx ts-node --transpile-only src/scripts/smoke-skills.ts
 */
process.env.ENABLE_MOCK_MODE = 'true';
import { listSkills, getSkill } from '../skills/registry';
import { route, listGatewayProviders } from '../gateway/ai-gateway.service';

async function main() {
  console.log('=== 1. 技能名册 ===');
  const skills = listSkills();
  console.log(`技能数：${skills.length}`);
  console.log(skills.map((s) => ` - ${s.manifest.id} [${s.manifest.division}] marketable=${s.manifest.marketable}`).join('\n'));

  console.log('\n=== 2. AI 网关 providers ===');
  console.log(listGatewayProviders().map((p) => ` - ${p.name} configured=${p.configured}`).join('\n'));

  console.log('\n=== 3. 网关 route（Mock 模式）===');
  const r = await route({ model: 'openai/gpt-4o', messages: [{ role: 'user', content: '你好' }] });
  console.log(`provider=${r.provider} reply=${r.reply.slice(0, 40)}...`);

  console.log('\n=== 4. video-pipeline 技能 invoke（compose 阶段无 MPT 服务应优雅降级）===');
  const vps = getSkill('video-pipeline')!;
  const res = await vps.invoke({ input: { topic: '人工智能如何改变教育', duration: 30, compose: true } });
  console.log('ok=', res.ok);
  console.log('script 片段：', String(res.data?.stages?.script || '').slice(0, 60));
  console.log('compose：', JSON.stringify(res.data?.stages?.compose).slice(0, 120));

  console.log('\n=== 5. media-gen 含 moneyprinterturbo provider ===');
  const { listMediaProviders } = await import('../services/media-gen.service');
  const ps = listMediaProviders();
  console.log(`厂商数：${ps.length}`);
  console.log(ps.map((p: any) => ` - ${p.name} configured=${p.configured}`).join('\n'));

  console.log('\n✅ 冒烟验证完成（所有调用均闭环，无密钥/无外部依赖）');
}

main().catch((e) => {
  console.error('❌ 冒烟失败：', e);
  process.exit(1);
});
