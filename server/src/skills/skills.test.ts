import { listSkills, listMarketableSkills, getSkill, registerSkill } from './registry';
import type { Skill } from './types';

describe('技能注册表（agency-agents 风格）', () => {
  it('默认注册了 9 个核心技能（含 skill-authoring 与 summarize）', () => {
    const ids = listSkills().map((s) => s.manifest.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        'knowledge',
        'ai-chat',
        'media-gen',
        'customer-service',
        'code-explain',
        'translate',
        'video-pipeline',
        'skill-authoring',
        'summarize',
      ])
    );
  });

  it('summarize 技能在 mock 下返回摘要结构', async () => {
    const r = await getSkill('summarize')!.invoke({ input: { text: '这是一段很长的文本，需要被摘要成要点。', length: 'brief' } });
    expect(r.ok).toBe(true);
    expect(r.data.summary).toBeTruthy();
    expect(Array.isArray(r.data.bullets)).toBe(true);
  });

  it('summarize 缺 text 时返回错误', async () => {
    const r = await getSkill('summarize')!.invoke({ input: {} });
    expect(r.ok).toBe(false);
    expect(r.error).toContain('text');
  });

  it('summarize 透传 length/lang 参数', async () => {
    const r: any = await getSkill('summarize')!.invoke({
      input: { text: '内容A。内容B。内容C。', length: 'detailed', lang: 'en' },
    });
    expect(r.ok).toBe(true);
    expect(r.data.length).toBe('detailed');
    expect(r.data.lang).toBe('en');
  });

  it('summarize 可上架开放 API 市场', () => {
    expect(getSkill('summarize')!.manifest.marketable).toBe(true);
    expect(getSkill('summarize')!.manifest.quotaResource).toBe('ai_chat');
  });

  it('skill-authoring 元技能 manifest 含 superpowers 风格声明字段', () => {
    const m = getSkill('skill-authoring')!.manifest;
    expect(m.division).toBe('engineering');
    expect(m.userStory).toBeTruthy();
    expect(Array.isArray(m.acceptanceCriteria)).toBe(true);
    expect(Array.isArray(m.qualityCriteria)).toBe(true);
  });

  it('skill-authoring 在缺 goal 时返回错误', async () => {
    const r = await getSkill('skill-authoring')!.invoke({ input: {} });
    expect(r.ok).toBe(false);
    expect(r.error).toContain('goal');
  });

  it('技能 manifest 字段完整', () => {
    for (const s of listSkills()) {
      const m = s.manifest;
      expect(m.id).toBeTruthy();
      expect(m.name).toBeTruthy();
      expect(m.division).toBeTruthy();
      expect(m.color).toBeTruthy();
      expect(Array.isArray(m.criticalRules)).toBe(true);
      expect(Array.isArray(m.successMetrics)).toBe(true);
    }
  });

  it('marketable 技能可被单独列出（开放 API 市场上架）', () => {
    const marketable = listMarketableSkills().map((s) => s.manifest.id);
    expect(marketable).toContain('ai-chat');
    expect(marketable).toContain('media-gen');
    expect(marketable).toContain('skill-authoring');
    expect(marketable).not.toContain('knowledge'); // knowledge 不可上架（受团队隔离约束）
  });

  it('所有技能均含 superpowers 风格声明字段（userStory + acceptanceCriteria），名册评审规范', () => {
    for (const s of listSkills()) {
      const m = s.manifest;
      expect(m.userStory).toBeTruthy();
      expect(Array.isArray(m.acceptanceCriteria) && m.acceptanceCriteria!.length > 0).toBe(true);
    }
  });

  it('可动态注册新技能（插拔）', () => {
    const before = listSkills().length;
    const fake: Skill = {
      manifest: {
        id: 'temp-skill',
        name: '临时技能',
        description: '测试插拔',
        division: 'productivity',
        color: '#000',
        coreMission: 'x',
        criticalRules: ['a'],
        successMetrics: ['b'],
        minRole: 'none',
        requireAuth: false,
        marketable: false,
      },
      async invoke() {
        return { ok: true };
      },
    };
    registerSkill(fake);
    expect(listSkills().length).toBe(before + 1);
    expect(getSkill('temp-skill')?.manifest.name).toBe('临时技能');
  });

  it('技能 invoke 返回结构正确', async () => {
    const r = await getSkill('media-gen')!.invoke({ input: { type: 'text2video', prompt: '测试' } });
    expect(r.ok).toBe(true);
    expect(r.data).toHaveProperty('taskId');
  });
});
