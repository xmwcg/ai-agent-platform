import { readFileSync } from 'fs';
import path from 'path';

const source = readFileSync(path.resolve(process.cwd(), 'src/index.ts'), 'utf8');

describe('阶段 0 路由挂载契约 - 创作工坊', () => {
  it("挂载 /api/studio", () => {
    expect(source).toContain(`app.use('/api/studio', studioRoutes);`);
  });

  it('从 ./routes/studio 引入 studioRoutes（默认导出）', () => {
    expect(source).toContain(`import studioRoutes from './routes/studio';`);
  });
});
