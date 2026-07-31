import { readFileSync } from 'fs';
import path from 'path';

const source = readFileSync(path.resolve(process.cwd(), 'src/index.ts'), 'utf8');

describe('阶段 0 路由挂载契约', () => {
  it.each([
    ["/api/flow", 'flowRoutes'],
    ["/api/admin/knowledge-products", 'adminKnowledgeProductsRoutes'],
    ["/api/keys", 'apiKeyRoutes'],
  ])('挂载 %s', (route, handler) => {
    expect(source).toContain(`app.use('${route}', ${handler});`);
  });
});
