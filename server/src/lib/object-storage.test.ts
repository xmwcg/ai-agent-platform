import { isHttpUrl, storeImage, getObjectStorage, LOCAL_STORAGE_DIR } from './object-storage';
import fs from 'fs/promises';
import path from 'path';

// 1x1 透明 PNG 的 base64（无需网络）
const PNG_B64 =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

describe('对象存储 object-storage', () => {
  it('isHttpUrl 正确判定', () => {
    expect(isHttpUrl('https://a.com/x.png')).toBe(true);
    expect(isHttpUrl('http://a.com/x.png')).toBe(true);
    expect(isHttpUrl('/generated/x.png')).toBe(false);
    expect(isHttpUrl('data:image/png;base64,xxx')).toBe(false);
    expect(isHttpUrl(undefined)).toBe(false);
  });

  it('默认使用本地存储兜底', () => {
    // 测试环境未配置 COS_*，应回退 LocalStorage
    expect(getObjectStorage().name).toBe('local');
  });

  it('base64 图片落盘并返回 /generated 稳定 URL', async () => {
    const url = await storeImage({ base64: PNG_B64 }, { prefix: 'test' });
    expect(url.startsWith('/generated/test/')).toBe(true);
    expect(url.endsWith('.png')).toBe(true);

    // 文件确实写入了 LOCAL_STORAGE_DIR
    const file = path.join(LOCAL_STORAGE_DIR, url.replace('/generated/', ''));
    const buf = await fs.readFile(file);
    expect(buf.length).toBeGreaterThan(0);
    // 清理测试产物
    await fs.rm(file, { force: true });
  });
});
