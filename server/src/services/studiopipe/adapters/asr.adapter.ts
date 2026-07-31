export interface AsrSegment {
  text: string;
  start: number; // 秒
  end: number; // 秒
}
export interface AsrResult {
  segments: AsrSegment[];
  language?: string;
  /** true 表示未接真实 ASR，使用占位（单条整段字幕），管线仍可用 */
  fallback?: boolean;
}

/**
 * 语音识别：把配音音频转成「逐句 + 时间轴」，供字幕烧录。
 *
 * 接入方式（二选一，通过环境变量）：
 *   STUDIO_ASR_URL  —— 任意兼容的云 ASR / 自建 faster-whisper 服务，
 *                      约定 POST JSON { audio_url } -> { segments:[{text,start,end}], language }
 *   （未配置）       —— 回退占位：单条整段字幕，保证管线可跑通，接入真实 ASR 即得逐句轴。
 */
export async function transcribe(audioUrl: string): Promise<AsrResult> {
  const endpoint = process.env.STUDIO_ASR_URL;
  if (endpoint) {
    try {
      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audio_url: audioUrl }),
        signal: AbortSignal.timeout(60000),
      });
      if (resp.ok) {
        const data: any = await resp.json();
        if (Array.isArray(data?.segments) && data.segments.length) {
          return { segments: data.segments as AsrSegment[], language: data.language };
        }
      }
    } catch {
      /* 落到占位 */
    }
  }
  // 占位：无法得到真实时间轴时，给一条整段字幕（时长由调用方在 segments[0].end 提供）
  return { segments: [{ text: '', start: 0, end: 0 }], language: 'zh', fallback: true };
}
