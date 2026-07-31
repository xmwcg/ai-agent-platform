import { buildFlowCliArgs } from './flow-sync.service';

describe('NexMind Flow CLI 参数', () => {
  it('预览模式必须传递 --dry-run，且保留多来源', () => {
    const args = buildFlowCliArgs({
      userId: 'u1',
      sources: ['a', 'b'],
      project: '项目',
      tags: ['A', 'B'],
      dryRun: true,
    });

    expect(args).toEqual(expect.arrayContaining(['--source', 'a', '--source', 'b', '--dry-run']));
    expect(args).toContain('A,B');
  });
});
