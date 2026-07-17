/**
 * 可插拔资产存储（转换产物 / 图生图参考图等临时资产）
 *
 * 后端优先级：
 *   1. 腾讯云 COS（对象存储）—— 多实例共享，生产推荐。
 *      需配置：COS_SECRET_ID / COS_SECRET_KEY / COS_BUCKET / COS_REGION
 *   2. 本地磁盘 —— 单实例或挂载共享卷时可用，重启不丢。
 *      目录由 ASSET_STORE_DIR 指定，默认 <cwd>/.cache/assets
 *   3. 内存兜底 —— 最差情况（进程级，重启清空）。
 *
 * 取代原先散落的进程级 Map，解决「多实例不可达」「重启丢失」问题。
 */

import fs from 'fs';
import path from 'path';
import { logger } from '../lib/logger';

export interface StoredAsset {
  buf: Buffer;
  ctype: string;
  name?: string;
}

type Backend = 'cos' | 'disk' | 'memory';

// ─── 腾讯云 COS 后端（对象存储，多实例共享）───
let cosClient: any = null;
let cosBucket = '';
let cosRegion = '';
try {
  if (
    process.env.COS_SECRET_ID &&
    process.env.COS_SECRET_KEY &&
    process.env.COS_BUCKET &&
    process.env.COS_REGION
  ) {
    // cos-nodejs-sdk-v5 可能无类型声明，用 require 规避
    // @ts-ignore
    const COS = require('cos-nodejs-sdk-v5');
    cosClient = new COS({
      SecretId: process.env.COS_SECRET_ID,
      SecretKey: process.env.COS_SECRET_KEY,
    });
    cosBucket = process.env.COS_BUCKET!;
    cosRegion = process.env.COS_REGION!;
    logger.info('asset-store', '✅ COS 对象存储后端已启用（多实例共享）');
  }
} catch (e: any) {
  logger.warn('asset-store', `COS 初始化失败，回落本地磁盘: ${e?.message || e}`);
  cosClient = null;
}

// ─── 本地磁盘后端（单实例 / 共享卷；重启不丢）───
const DISK_DIR = process.env.ASSET_STORE_DIR || path.join(process.cwd(), '.cache', 'assets');
let diskOk = false;
if (!cosClient) {
  try {
    fs.mkdirSync(DISK_DIR, { recursive: true });
    diskOk = true;
    logger.info('asset-store', `本地磁盘资产存储已就绪: ${DISK_DIR}`);
  } catch (e: any) {
    logger.warn('asset-store', `磁盘目录不可用（${e?.message || e}），回落内存兜底`);
  }
}

const backend: Backend = cosClient ? 'cos' : diskOk ? 'disk' : 'memory';

// 内存兜底（最差情况，进程级，重启清空）
const memoryStore = new Map<string, StoredAsset>();

export function getAssetBackend(): Backend {
  return backend;
}

export async function putAsset(id: string, buf: Buffer, ctype: string, name?: string): Promise<void> {
  if (backend === 'cos') {
    await cosClient.putObject({
      Bucket: cosBucket,
      Region: cosRegion,
      Key: `assets/${id}`,
      Body: buf,
      ContentType: ctype,
    });
    return;
  }
  if (backend === 'disk') {
    await fs.promises.writeFile(path.join(DISK_DIR, id), buf);
    await fs.promises
      .writeFile(path.join(DISK_DIR, `${id}.meta`), JSON.stringify({ ctype, name: name || '' }), 'utf8')
      .catch(() => {});
    return;
  }
  memoryStore.set(id, { buf, ctype, name });
}

export async function getAsset(id: string): Promise<StoredAsset | undefined> {
  if (backend === 'cos') {
    try {
      const r = await cosClient.getObject({
        Bucket: cosBucket,
        Region: cosRegion,
        Key: `assets/${id}`,
      });
      const ctype = (r.headers && r.headers['content-type']) || 'application/octet-stream';
      return { buf: r.Body as Buffer, ctype };
    } catch {
      return undefined;
    }
  }
  if (backend === 'disk') {
    try {
      const buf = await fs.promises.readFile(path.join(DISK_DIR, id));
      let ctype = 'application/octet-stream';
      let name: string | undefined;
      try {
        const meta = JSON.parse(await fs.promises.readFile(path.join(DISK_DIR, `${id}.meta`), 'utf8'));
        ctype = meta.ctype || ctype;
        name = meta.name || undefined;
      } catch {
        /* 元信息缺失不阻塞 */
      }
      return { buf, ctype, name };
    } catch {
      return undefined;
    }
  }
  return memoryStore.get(id);
}

export async function deleteAsset(id: string): Promise<void> {
  if (backend === 'cos') {
    try {
      await cosClient.deleteObject({ Bucket: cosBucket, Region: cosRegion, Key: `assets/${id}` });
    } catch {
      /* 忽略 */
    }
    return;
  }
  if (backend === 'disk') {
    await fs.promises.unlink(path.join(DISK_DIR, id)).catch(() => {});
    await fs.promises.unlink(path.join(DISK_DIR, `${id}.meta`)).catch(() => {});
    return;
  }
  memoryStore.delete(id);
}
