import fs from 'fs/promises';
import path from 'path';

/**
 * 从 STUDIO_BGM_DIR 选取一段 BGM。
 * 优先按情绪关键词匹配文件名（如 轻快.mp3 / cheerful.mp3），无匹配则随机取一首。
 * 目录未配置或为空时返回 null（管线跳过配乐）。
 */
export async function selectBgm(mood?: string): Promise<string | null> {
  const dir = process.env.STUDIO_BGM_DIR;
  if (!dir) return null;
  let files: string[] = [];
  try {
    const all = await fs.readdir(dir);
    files = all.filter((f) => /\.(mp3|wav|ogg|m4a)$/i.test(f));
  } catch {
    return null;
  }
  if (!files.length) return null;

  if (mood && mood !== '无BGM') {
    const hit = files.find((f) => f.toLowerCase().includes(mood.toLowerCase()));
    if (hit) return path.join(dir, hit);
  }
  const pick = files[Math.floor(Math.random() * files.length)];
  return path.join(dir, pick);
}
