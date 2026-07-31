import { runFfmpeg } from './_util';

export interface ComposeInput {
  /** 背景视频或图片（本地路径或 http URL）；不填则生成纯色背景 */
  videoBasePath?: string;
  /** TTS 配音音频（本地路径） */
  audioPath: string;
  /** 字幕 ASS 文件（本地路径） */
  assPath?: string;
  /** BGM 文件（本地路径）；null 表示不加 */
  bgmPath?: string | null;
  /** 水印 PNG（本地路径） */
  watermarkPath?: string;
  /** 时长（秒），用于纯色/图片背景 */
  durationSec: number;
  /** 输出路径 */
  outPath: string;
}

/** 过滤图中转义 Windows / 含空格路径，避免 ffmpeg 解析失败 */
function escapeFilterPath(p: string): string {
  const esc = p.replace(/\\/g, '\\\\').replace(/:/g, '\\:').replace(/'/g, "\\'");
  return `'${esc}'`;
}

const VIDEO_EXT = /\.(mp4|webm|mov|mkv|avi)$/i;
const IMG_EXT = /\.(png|jpe?g|webp|bmp)$/i;

/**
 * 合成 9:16 竖屏成片：缩放/铺满背景 + 烧录字幕 + 混音 BGM + 叠加水印。
 * 输出 H.264 + AAC 的 mp4。失败抛错（由 service 记录步骤错误，不中断整体任务状态）。
 */
export async function compose(input: ComposeInput): Promise<string> {
  const { videoBasePath, audioPath, assPath, bgmPath, watermarkPath, durationSec, outPath } = input;

  const args: string[] = [];
  let videoIdx = 0;

  if (videoBasePath) {
    if (IMG_EXT.test(videoBasePath)) {
      args.push('-loop', '1', '-t', String(durationSec), '-i', videoBasePath);
    } else if (VIDEO_EXT.test(videoBasePath)) {
      args.push('-i', videoBasePath);
    } else {
      args.push('-i', videoBasePath); // 其余交给 ffmpeg 自行判断
    }
    videoIdx = 0;
  } else {
    args.push('-f', 'lavfi', '-i', `color=c=0x101728:s=1080x1920:d=${durationSec}:r=25`);
    videoIdx = 0;
  }

  const audioIdx = videoIdx + 1;
  args.push('-i', audioPath);

  let bgmIdx = -1;
  if (bgmPath) {
    bgmIdx = audioIdx + 1;
    args.push('-i', bgmPath);
  }

  let wmIdx = -1;
  if (watermarkPath) {
    wmIdx = (bgmIdx >= 0 ? bgmIdx : audioIdx) + 1;
    args.push('-i', watermarkPath);
  }

  // ---- 视频滤镜链 ----
  const vfilters: string[] = [];
  vfilters.push(`[${videoIdx}:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920[scaled]`);
  let vcur = '[scaled]';
  if (assPath) {
    const next = '[vsub]';
    vfilters.push(`${vcur}subtitles=${escapeFilterPath(assPath)}${next}`);
    vcur = next;
  }
  if (wmIdx >= 0) {
    const next = '[vout]';
    vfilters.push(`${vcur}[${wmIdx}:v]overlay=W-w-40:H-h-40${next}`);
    vcur = next;
  } else {
    vfilters.push(`${vcur}null[vout]`);
  }

  // ---- 音频滤镜链 ----
  const afilters: string[] = [];
  if (bgmIdx >= 0) {
    afilters.push(
      `[${audioIdx}:a]volume=1.0[a];[${bgmIdx}:a]volume=0.18[b];[a][b]amix=inputs=2:duration=first[aout]`
    );
  } else {
    afilters.push(`[${audioIdx}:a]anull[aout]`);
  }

  args.push('-filter_complex', [...vfilters, ...afilters].join(';'));
  args.push('-map', '[vout]', '-map', '[aout]');
  args.push('-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '128k', '-shortest', '-movflags', '+faststart');
  args.push(outPath);

  await runFfmpeg(args);
  return outPath;
}
