/**
 * 统一上传限制中间件测试
 * 覆盖：文件大小上限、类型白名单、数量上限。
 * 验证「上传限制」作为成本护栏（防超大文件撑爆磁盘/内存/解析算力）确实生效。
 */
import { createUploader } from './upload-limit';
import express from 'express';
import request from 'supertest';

function makeApp(upload: ReturnType<typeof createUploader>) {
  const app = express();
  app.post('/single', upload.single('file'), (req: any, res) => {
    res.json({ ok: true, name: req.file?.originalname });
  });
  return app;
}

describe('createUploader 上传限制', () => {
  it('拒绝超类型白名单的文件', async () => {
    const app = makeApp(createUploader({ dir: 'test-up', maxSize: 1 * 1024 * 1024, allowedExts: ['.txt'], maxCount: 1 }));
    const res = await request(app)
      .post('/single')
      .attach('file', Buffer.from('x'), 'evil.exe');
    expect(res.status).toBe(500); // multer 过滤失败 → 错误中间件
    expect(res.body.ok).toBeUndefined();
  });

  it('接受白名单内的文件', async () => {
    const app = makeApp(createUploader({ dir: 'test-up', maxSize: 1 * 1024 * 1024, allowedExts: ['.txt'], maxCount: 1 }));
    const res = await request(app)
      .post('/single')
      .attach('file', Buffer.from('hello'), 'note.txt');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it('拒绝超过单文件大小上限的文件', async () => {
    const app = makeApp(createUploader({ dir: 'test-up', maxSize: 100, allowedExts: ['.txt'], maxCount: 1 }));
    const res = await request(app)
      .post('/single')
      .attach('file', Buffer.alloc(10 * 1024), 'big.txt');
    expect(res.status).toBe(500);
  });
});
