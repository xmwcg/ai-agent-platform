import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { getObjectStorage } from '../../../lib/object-storage';

export const execFileP = promisify(execFile);

/** 工坊临时工作目录（中间产物，定期清理） */
export const WORK_DIR = process.env.STUDIO_WORK_DIR || path.join(os.tmpdir(), 'nexmind-studio');

export async function ensureWorkDir(): Promise<void> {
  await fs.mkdir(WORK_DIR, { recursive: true });
}

export async function tmpFile(ext: string): Promise<string> {
  await ensureWorkDir();
  return path.join(WORK_DIR, `s_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`);
}

export async function runFfmpeg(args: string[]): Promise<void> {
  try {
    await execFileP('ffmpeg', ['-y', ...args]);
  } catch (e: any) {
    const detail = String(e?.stderr || e?.message || e).slice(0, 400);
    throw new Error(`ffmpeg 执行失败: ${detail}`);
  }
}

function extFromCt(ct: string): string {
  if (ct.includes('mp4')) return 'mp4';
  if (ct.includes('mp3')) return 'mp3';
  if (ct.includes('webp')) return 'webp';
  if (ct.includes('png')) return 'png';
  if (ct.includes('jpeg') || ct.includes('jpg')) return 'jpg';
  return 'bin';
}

export async function uploadBuffer(buf: Buffer, contentType: string, prefix = 'studio'): Promise<string> {
  const ext = extFromCt(contentType);
  const key = `${prefix}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  return getObjectStorage().put(key, buf, contentType);
}

export async function downloadToTmp(url: string, ext: string): Promise<string> {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`下载远程资源失败(${resp.status})`);
  const buf = Buffer.from(await resp.arrayBuffer());
  const p = await tmpFile(ext);
  await fs.writeFile(p, buf);
  return p;
}
