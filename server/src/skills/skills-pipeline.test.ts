import { getSkill } from './registry';
import { listMediaProviders } from '../services/media-gen.service';

/**
 * 视频生产流水线 + 媒体厂商 冒烟（无需常驻端口 / 无需真实密钥）
 * 验证：技能名册含 video-pipeline；invoke 在 Mock 模式闭环（compose 阶段无 MPT 服务优雅降级）。
 */
describe('视频生产流水线技能 - 端到端闭环（Mock）', () => {
  const OLD_ENV = process.env;
  beforeEach(() => {
    process.env = { ...OLD_ENV, ENABLE_MOCK_MODE: 'true' };
    delete process.env.MONEY_PRINTER_TURBO_URL;
  });
  afterAll(() => {
    process.env = OLD_ENV;
  });

  it('技能名册含 video-pipeline 且可上架', () => {
    const s = getSkill('video-pipeline');
    expect(s).toBeDefined();
    expect(s!.manifest.marketable).toBe(true);
    expect(s!.manifest.division).toBe('media');
  });

  it('video-pipeline invoke 在 Mock 环境完整闭环', async () => {
    const s = getSkill('video-pipeline')!;
    const res = await s.invoke({ input: { topic: '人工智能如何改变教育', duration: 30, compose: true } });
    expect(res.ok).toBe(true);
    // 脚本阶段走网关（Mock 返回非空）
    expect(String(res.data.stages.script).length).toBeGreaterThan(0);
    // compose 阶段：无 MPT 服务时应返回带降级说明的对象，而非抛错
    expect(res.data.stages.compose).toBeDefined();
  });

  it('媒体厂商注册表含 moneyprinterturbo（默认未配置）', () => {
    const ps = listMediaProviders();
    const mpt = ps.find((p) => p.name === 'moneyprinterturbo');
    expect(mpt).toBeDefined();
    expect(mpt!.configured).toBe(false);
    expect(ps.length).toBe(7);
  });
});
