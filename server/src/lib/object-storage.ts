/**
 * 对象存储抽象层（OSS）
 *
 * 设计目标：把「生成结果（图片/视频）落到稳定可访问的 URL」这件事从业务逻辑里解耦。
 * - 默认实现 LocalStorage：写入本地 uploads/generated，由 Express 静态服务 /generated 对外提供（自托管/开发环境开箱即用）。
 * - 生产环境应切换为云对象存储（腾讯云 COS / 阿里云 OSS / S3）。ObjectStorage 接口已预留，
 *   配置对应环境变量（如 COS_ / OSS_ 前缀）后在 getObjectStorage() 工厂里实例化对应实现即可，
 *   业务代码（text2img 路由等）无需改动。这是「基础设施骨架」中对象存储部分的标准接入点。
 *
 * 选择逻辑：云存储已配置 > LocalStorage 兜底。
 */
import fs from 'fs/promises';
import path from 'path';
import axios from 'axios';
import { randomBytes } from 'crypto';

/** 本地落盘根目录：与生产静态挂载点一致（index.ts 中 express.static 挂载 /generated → 此目录） */
export const LOCAL_STORAGE_DIR =
  process.env.OSS_LOCAL_DIR || path.join(__dirname, '..', 'uploads', 'generated');

export interface ObjectStorage {
  /** 存储名，便于诊断 */
  name: string;
  /** 是否已配置（用于工厂选择） */
  isConfigured(): boolean;
  /**
   * 写入一个对象，返回可公开访问的 URL。
   * @param key   对象键（可含子目录，如 text2img/xxx.png）
   * @param data  二进制内容
   * @param contentType  MIME 类型
   */
  put(key: string, data: Buffer, contentType: string): Promise<string>;
}

/* ------------------------------ 本地磁盘实现（默认，零依赖） ------------------------------ */
class LocalStorage implements ObjectStorage {
  name = 'local';
  isConfigured() {
    return true; // 始终可用，作为兜底
  }
  async put(key: string, data: Buffer, contentType: string): Promise<string> {
    const full = path.join(LOCAL_STORAGE_DIR, key);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, data);
    // 返回相对 URL，由 /generated 静态服务解析（同源，前端无需关心域名）
    return `/generated/${key.replace(/\\/g, '/')}`;
  }
}

/* ------------------------------ 云对象存储（生产，腾讯云 COS） ------------------------------
 * 接入 cos-nodejs-sdk-v5（已安装）。在 .env 配置 COS_SECRET_ID / COS_SECRET_KEY /
 * COS_BUCKET / COS_REGION / COS_BASE_URL 后，getObjectStorage() 工厂会自动优先启用本实现。
 *
 * 访问 URL：
 *  - 配置了 COS_BASE_URL（公有读 Bucket 或 CDN 域名）→ 返回 `${BASE_URL}/${key}`，稳定可公开访问；
 *  - 未配置 → 返回 SDK 生成的签名临时 URL（默认 1 小时有效），适合私有 Bucket。
 *
 * 成本相关：
 *  - 存储费：COS 标准存储约 0.118 元/GB/月（远低于本地磁盘爆满导致的故障成本）。
 *  - 下行流量：外网约 0.5 元/GB，接入 CDN 后可低至 0.15 元/GB，且提速明显。
 *  - 自动清理：对象级过期需 Bucket 生命周期规则（控制台/API 配置），COS_OBJECT_TTL 仅作语义约定；
 *    建议对 text2img/ 前缀设「N 天后删除」规则，把存储成本压到接近 0。
 */
// @ts-ignore - cos-nodejs-sdk-v5 自带类型较旧，容忍其默认导入
import COS from 'cos-nodejs-sdk-v5';

class CloudOssStorage implements ObjectStorage {
  name = 'cloud';
  private cos: any;
  private get configured() {
    return !!(
      process.env.COS_SECRET_ID &&
      process.env.COS_SECRET_KEY &&
      process.env.COS_BUCKET &&
      process.env.COS_REGION
    );
  }
  isConfigured() {
    return this.configured;
  }
  private client() {
    if (!this.cos) {
      this.cos = new COS({
        SecretId: process.env.COS_SECRET_ID,
        SecretKey: process.env.COS_SECRET_KEY,
      });
    }
    return this.cos;
  }
  async put(key: string, data: Buffer, contentType: string): Promise<string> {
    if (!this.configured) throw new Error('云对象存储未配置：请在 .env 设置 COS_*');
    const cos = this.client();
    const bucket = process.env.COS_BUCKET!;
    const region = process.env.COS_REGION!;
    const baseUrl = process.env.COS_BASE_URL?.replace(/\/$/, '');

    await new Promise<void>((resolve, reject) => {
      cos.putObject(
        {
          Bucket: bucket,
          Region: region,
          Key: key,
          Body: data,
          ContentType: contentType,
          // 浏览器侧缓存，减少重复回源流量成本
          CacheControl: 'max-age=86400',
        },
        (err: any) => (err ? reject(err) : resolve())
      );
    });

    // 配置了公有读/CDN 域名 → 直接返回稳定 URL；否则返回签名临时 URL（默认 1h）
    if (baseUrl) return `${baseUrl}/${key}`;
    const url = await new Promise<string>((resolve, reject) => {
      cos.getObjectUrl(
        { Bucket: bucket, Region: region, Key: key, Sign: true, Expires: 3600 },
        (err: any, data: any) => (err ? reject(err) : resolve(data.Url))
      );
    });
    return url;
  }
}

let _cached: ObjectStorage | null = null;
/** 工厂：云存储已配置则优先，否则 LocalStorage 兜底（幂等、单例） */
export function getObjectStorage(): ObjectStorage {
  if (_cached) return _cached;
  const cloud = new CloudOssStorage();
  _cached = cloud.isConfigured() ? cloud : new LocalStorage();
  return _cached;
}

/* ------------------------------ 业务辅助：把图片存进对象存储 ------------------------------ */

export function isHttpUrl(s?: string): boolean {
  return typeof s === 'string' && /^https?:\/\//i.test(s);
}

function genKey(prefix: string, ext: string): string {
  const ts = Date.now();
  const rand = randomBytes(4).toString('hex');
  return `${prefix || 'media'}/${ts}-${rand}.${ext}`;
}

function extFromContentType(ct: string): string {
  if (ct.includes('png')) return 'png';
  if (ct.includes('jpeg') || ct.includes('jpg')) return 'jpg';
  if (ct.includes('webp')) return 'webp';
  if (ct.includes('gif')) return 'gif';
  return 'bin';
}

export interface StoreImageInput {
  /** 远程图片 URL（与 base64 二选一） */
  url?: string;
  /** base64 数据（可能带 data: 前缀） */
  base64?: string;
}
export interface StoreImageOptions {
  /** 存储前缀（子目录），如 'text2img' */
  prefix?: string;
  /** 强制扩展名（缺省按内容推断） */
  ext?: string;
}

/**
 * 把一张图片存入对象存储，返回稳定可访问的 URL。
 * - url：下载后落盘；
 * - base64：解码后落盘（data URI 亦可）；
 * - 二者皆非则抛错。
 */
export async function storeImage(
  input: StoreImageInput,
  opts: StoreImageOptions = {}
): Promise<string> {
  const storage = getObjectStorage();
  let data: Buffer;
  let contentType = 'application/octet-stream';

  if (input.url) {
    if (!isHttpUrl(input.url)) return input.url; // 已是本地/数据 URI，原样返回
    const resp = await axios.get<Buffer>(input.url, { responseType: 'arraybuffer', timeout: 15000 });
    data = Buffer.from(resp.data);
    contentType = (resp.headers['content-type'] as string) || 'image/png';
  } else if (input.base64) {
    const cleaned = input.base64.replace(/^data:.*;base64,/, '');
    data = Buffer.from(cleaned, 'base64');
    const m = /^data:(.*?);/.exec(input.base64);
    if (m) contentType = m[1];
  } else {
    throw new Error('storeImage 需要 url 或 base64 之一');
  }

  const ext = opts.ext || extFromContentType(contentType);
  const key = genKey(opts.prefix || 'media', ext);
  return storage.put(key, data, contentType);
}
