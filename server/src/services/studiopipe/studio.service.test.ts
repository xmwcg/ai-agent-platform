import { listScenes, getScene, getTemplates } from './studio.service';

// 已知的全量步骤键 + 对应成本表键，用于契约校验
const KNOWN_STEP_KEYS = [
  'script',
  'tts',
  'asr',
  'subtitle',
  'bgm',
  'export',
  'digitalhuman',
  'vision',
  'text',
  'image',
  'analyze',
  'plan',
  'compose',
  'generate-slides',
  'build-markdown',
  'seo-check',
];

describe('创作工坊 - 场景/模板注册表 (studio.service)', () => {
  it('注册五条产品线（短视频成片 / 数字人口播 / 电商图文）', () => {
    const scenes = listScenes();
    const ids = scenes.map((s: any) => s.id);
    expect(ids).toEqual(expect.arrayContaining(['short-video', 'digital-human', 'ecommerce', 'mixcut', 'product-article']));
    expect(scenes).toHaveLength(5);
  });

  it('每个场景的步骤键都是合法步骤，且都能映射到计费维度', () => {
    for (const scene of listScenes()) {
      expect(Array.isArray(scene.steps)).toBe(true);
      for (const step of scene.steps) {
        expect(KNOWN_STEP_KEYS).toContain(step);
      }
    }
  });

  it('模板的 sceneId 必须指向已注册场景', () => {
    const sceneIds = new Set(listScenes().map((s: any) => s.id));
    for (const tpl of getTemplates()) {
      expect(sceneIds.has(tpl.sceneId)).toBe(true);
    }
    expect(getTemplates().length).toBeGreaterThanOrEqual(1);
  });

  it('按 id 取场景返回完整定义', () => {
    const sv = getScene('short-video');
    expect(sv).toBeTruthy();
    expect(sv.name).toContain('短视频');
    expect(sv.steps).toEqual(['script', 'tts', 'asr', 'subtitle', 'bgm', 'export']);
  });

  it('未知场景返回 undefined', () => {
    expect(getScene('not-exist')).toBeUndefined();
  });

  it('电商图文场景为免费层(tier=free)，数字人为 pro 层', () => {
    expect(getScene('ecommerce')?.tier).toBe('free');
    expect(getScene('digital-human')?.tier).toBe('pro');
  });
});

