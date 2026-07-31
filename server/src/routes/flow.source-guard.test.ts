import path from 'path';
import { isPathWithinRoot } from './flow';

describe('NexMind Flow 来源目录门禁', () => {
  const root = path.resolve('uploads', 'chat-export-user-1');

  it('允许根目录及其子路径', () => {
    expect(isPathWithinRoot(root, root)).toBe(true);
    expect(isPathWithinRoot(path.join(root, 'session.md'), root)).toBe(true);
  });

  it('拒绝父目录与同名前缀目录', () => {
    expect(isPathWithinRoot(path.resolve(root, '..', 'other-user'), root)).toBe(false);
    expect(isPathWithinRoot(`${root}-evil`, root)).toBe(false);
  });
});
