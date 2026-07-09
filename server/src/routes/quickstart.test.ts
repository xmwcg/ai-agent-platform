import { ALL_QUICKSTART_TEMPLATES, INDUSTRY_TEMPLATES, QUICKSTART_TEMPLATES } from './quickstart';

describe('快速启动模板目录', () => {
  it('应同时包含通用模板与行业垂直模板', () => {
    expect(QUICKSTART_TEMPLATES.length).toBe(4);
    expect(INDUSTRY_TEMPLATES.length).toBe(4);
    expect(ALL_QUICKSTART_TEMPLATES.length).toBe(8);
  });

  it('每个模板字段完整且可应用', () => {
    for (const t of ALL_QUICKSTART_TEMPLATES) {
      expect(t.id).toBeTruthy();
      expect(t.name).toBeTruthy();
      expect(Array.isArray(t.knowledge) && t.knowledge.length > 0).toBe(true);
      expect(t.bot.name).toBeTruthy();
      expect(t.bot.systemPrompt).toBeTruthy();
    }
  });

  it('模板 id 唯一', () => {
    const ids = ALL_QUICKSTART_TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('通用模板均为 generic 分类', () => {
    for (const t of QUICKSTART_TEMPLATES) expect(t.category).toBe('generic');
  });

  it('行业模板均为 industry 分类且含 vertical 与合规触发词', () => {
    const verticals = INDUSTRY_TEMPLATES.map((t) => t.vertical).sort();
    expect(verticals).toEqual(['clinic', 'factory', 'law', 'training']);
    for (const t of INDUSTRY_TEMPLATES) {
      expect(t.category).toBe('industry');
      expect(Array.isArray(t.escalationTriggers) && t.escalationTriggers!.length > 0).toBe(true);
    }
  });
});
