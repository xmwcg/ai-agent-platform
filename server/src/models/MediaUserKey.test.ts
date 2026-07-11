import { MediaUserKey } from './MediaUserKey';

describe('MediaUserKey 模型（媒体 BYOK 凭据）', () => {
  it('定义 userId / provider / secretKeyEnc / enabled 字段', () => {
    const s = MediaUserKey.schema;
    expect(s.path('userId').instance).toBe('String');
    expect(s.path('provider').instance).toBe('String');
    // enumValues 在 mongoose 运行期存在，TS 类型未暴露，故 as any 读取
    expect((s.path('provider') as any).enumValues).toEqual(
      expect.arrayContaining(['hunyuan', 'keling', 'jimeng'])
    );
    expect(s.path('secretIdEnc').instance).toBe('String');
    expect(s.path('secretKeyEnc').instance).toBe('String');
    expect(s.path('enabled').instance).toBe('Boolean');
    expect(s.path('enabled').options.default).toBe(true);
  });

  it('userId + provider 唯一索引（upsert 语义，每个用户每厂商一条）', () => {
    const indexes = MediaUserKey.schema.indexes() as unknown as Array<[Record<string, number>, Record<string, unknown>]>;
    const uniq = indexes.find(
      (i) => i[0] && i[0].userId === 1 && i[0].provider === 1 && (i[1] as any)?.unique
    );
    expect(uniq).toBeDefined();
  });
});
