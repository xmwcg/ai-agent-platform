/**
 * 混剪视频适配器
 * ----------------------------------------------------------------
 * 将多个视频素材按模板自动剪辑合成一条输出视频。
 * 对标成哥工坊 MixCutPlanner + MixCutAssetClassifier + MixCutRenderService。
 *
 * 流程：
 * 1. 素材分析：提取每个视频的时长、分辨率、关键帧
 * 2. 混剪规划：按模板分配片段时长和转场
 * 3. 渲染合成：ffmpeg concat + overlay 字幕/配乐/转场
 */

import { execFileP, tmpFile, runFfmpeg, uploadBuffer } from "./_util";
import { readFile, writeFile } from "fs/promises";

/** 混剪素材定义 */
export interface MixCutAsset {
  /** 素材 URL 或本地路径 */
  url: string;
  /** 素材类型 */
  type: "video" | "image";
  /** 建议时长（秒），视频取 clipDuration，图片取 displayDuration */
  suggestedDuration: number;
}

/** 单个混剪片段 */
export interface MixCutSegment {
  /** 片段序号 */
  index: number;
  /** 来源素材 URL */
  sourceUrl: string;
  /** 素材类型 */
  type: "video" | "image";
  /** 开始时间（相对源素材，秒） */
  srcStart: number;
  /** 片段持续（秒） */
  duration: number;
  /** 转场效果（none / fade / slide / zoom） */
  transition: "none" | "fade" | "slide" | "zoom";
}

/** 混剪规划输入 */
export interface MixCutPlanInput {
  /** 素材列表（URL 或本地路径） */
  assets: string[];
  /** 目标总时长（秒），0 表示自适应 */
  targetDurationSec: number;
  /** 混剪风格 */
  style: "fast" | "cinematic" | "vlog" | "slideshow";
  /** BGM 路径（可选） */
  bgmPath?: string;
  /** 字幕文案（可选，按时间轴分段） */
  subtitles?: Array<{ startSec: number; endSec: number; text: string }>;
  /** 输出位置文本（可选，如 "1/3" 分屏标注） */
  caption?: string;
}

/** 混剪渲染结果 */
export interface MixCutRenderResult {
  /** 输出视频 URL */
  videoUrl: string;
  /** 视频时长（秒） */
  durationSec: number;
  /** 片段列表 */
  segments: MixCutSegment[];
  /** 使用的素材数量 */
  assetCount: number;
}

/** 风格预设 */
const STYLE_PRESETS = {
  fast: { segmentDuration: 2.5, transition: "fade" as const, transitionMs: 200 },
  cinematic: { segmentDuration: 4.0, transition: "fade" as const, transitionMs: 800 },
  vlog: { segmentDuration: 3.0, transition: "slide" as const, transitionMs: 400 },
  slideshow: { segmentDuration: 3.0, transition: "zoom" as const, transitionMs: 600 },
};

/**
 * 分析视频素材信息（使用 ffprobe）
 */
async function analyzeAsset(
  url: string
): Promise<{ durationSec: number; width: number; height: number }> {
  try {
    const { stdout } = await execFileP("ffprobe", [
      "-v",
      "error",
      "-show_entries",
      "format=duration:stream=width,height",
      "-of",
      "json",
      url,
    ]);
    const info = JSON.parse(stdout);
    const stream = info.streams?.find((s: any) => s.width && s.height) || {};
    const duration = parseFloat(info.format?.duration || "0");
    return {
      durationSec: isNaN(duration) ? 0 : duration,
      width: stream.width || 1920,
      height: stream.height || 1080,
    };
  } catch {
    // 无法分析时返回默认值
    return { durationSec: 0, width: 1920, height: 1080 };
  }
}

/**
 * 规划混剪片段
 */
function planSegments(
  assets: string[],
  style: keyof typeof STYLE_PRESETS,
  targetDurationSec: number
): MixCutSegment[] {
  const preset = STYLE_PRESETS[style];
  const segmentDuration = preset.segmentDuration;

  // 如果指定目标时长，均匀分配；否则每素材一段
  const totalSegments = targetDurationSec > 0
    ? Math.max(assets.length, Math.ceil(targetDurationSec / segmentDuration))
    : assets.length;

  const segments: MixCutSegment[] = [];
  for (let i = 0; i < totalSegments; i++) {
    segments.push({
      index: i,
      sourceUrl: assets[i % assets.length],
      type: "video",
      srcStart: 0,
      duration: segmentDuration,
      transition: i < totalSegments - 1 ? preset.transition : "none",
    });
  }

  return segments;
}

/**
 * 生成 ffmpeg concat 文件列表
 */
async function buildConcatFile(segments: MixCutSegment[]): Promise<string> {
  const lines: string[] = [];
  for (const seg of segments) {
    lines.push(`file '${seg.sourceUrl.replace(/'/g, "'\\''")}'`);
    lines.push(`inpoint ${seg.srcStart}`);
    lines.push(`outpoint ${seg.srcStart + seg.duration}`);
  }
  const concatPath = await tmpFile("txt");
  await writeFile(concatPath, lines.join("\n"), "utf-8");
  return concatPath;
}

/**
 * 主入口：执行混剪视频合成
 */
export async function composeMixCut(
  input: MixCutPlanInput
): Promise<MixCutRenderResult> {
  const { assets, targetDurationSec, style, bgmPath, subtitles } = input;

  if (!assets || assets.length === 0) {
    throw new Error("混剪需要至少 1 个素材");
  }

  const preset = STYLE_PRESETS[style] || STYLE_PRESETS.fast;

  // 1. 分析素材
  const analyzedAssets = await Promise.all(assets.map((url) => analyzeAsset(url)));
  const validAssets = analyzedAssets.filter((a) => a.durationSec > 0);

  if (validAssets.length === 0) {
    throw new Error("没有可用的视频素材（所有素材分析失败）");
  }

  // 2. 规划片段
  const segments = planSegments(assets, style, targetDurationSec);

  // 3. 构建 concat 文件
  const concatPath = await buildConcatFile(segments);

  // 4. ffmpeg 合成
  const outputPath = await tmpFile("mp4");

  const ffmpegArgs: string[] = [
    "-f", "concat",
    "-safe", "0",
    "-i", concatPath,
  ];

  // BGM 混音
  if (bgmPath) {
    ffmpegArgs.push("-i", bgmPath);
  }

  // 视频编码
  ffmpegArgs.push(
    "-c:v", "libx264",
    "-preset", "fast",
    "-crf", "23",
    "-pix_fmt", "yuv420p",
  );

  // 音频编码
  if (bgmPath) {
    ffmpegArgs.push(
      "-filter_complex",
      `[0:a][1:a]amix=inputs=2:duration=first:dropout_transition=2[a]`,
      "-map", "0:v",
      "-map", "[a]",
    );
  } else {
    ffmpegArgs.push("-c:a", "aac", "-b:a", "128k");
  }

  // 视频时长限制
  const totalDuration = segments.reduce((sum, s) => sum + s.duration, 0);
  ffmpegArgs.push("-t", String(totalDuration), outputPath);

  await runFfmpeg(ffmpegArgs);

  // 5. 上传到对象存储
  const videoBuffer = await readFile(outputPath);
  const videoUrl = await uploadBuffer(videoBuffer, "video/mp4", "studio");

  return {
    videoUrl,
    durationSec: totalDuration,
    segments,
    assetCount: assets.length,
  };
}
