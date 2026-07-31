import fs from 'node:fs';
import path from 'node:path';

describe('公开状态接口契约', () => {
  const source = fs.readFileSync(path.join(__dirname, 'ops.ts'), 'utf8');
  const publicStatusBlock = source.slice(source.indexOf("router.get('/public-status'"), source.indexOf("router.get('/funnel'"));

  it('提供同源公开状态接口并保持内部信息最小暴露', () => {
    expect(source).toContain("router.get('/public-status'");
    expect(source).toContain('checkDatabaseHealth');
    expect(source).toContain('NexMind by AIbak');
    expect(publicStatusBlock).not.toContain('hostname: os.hostname()');
  });
});
