import fs from 'fs/promises';
import { tmpFile } from './_util';
import { AsrSegment } from './asr.adapter';
import { SubtitleStyle } from '../types';

function fmtTime(sec: number): string {
  const s = Math.max(0, sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = Math.floor(s % 60);
  const cs = Math.floor((s - Math.floor(s)) * 100);
  return `${h}:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

/** 把识别分段 / 脚本整段，写成 ASS 字幕文件，返回本地路径 */
export async function buildAss(segments: AsrSegment[], style?: SubtitleStyle): Promise<string> {
  const st = style || {
    font: 'Microsoft YaHei',
    size: 14,
    color: '&H00FFFFFF',
    outline: '&H00000000',
    position: 'bottom' as const,
  };
  const alignment = st.position === 'center' ? 5 : 2;
  const marginV = st.position === 'center' ? 120 : 220;

  const lines: string[] = [];
  lines.push('[Script Info]');
  lines.push('ScriptType: v4.00+');
  lines.push('PlayResX: 1080');
  lines.push('PlayResY: 1920');
  lines.push('');
  lines.push('[V4+ Styles]');
  lines.push(
    'Format: Name, Fontname, Fontsize, PrimaryColour, OutlineColour, Bold, Italic, Alignment, MarginL, MarginR, MarginV'
  );
  lines.push(
    `Style: Default,${st.font},${st.size},${st.color},${st.outline},0,0,${alignment},40,40,${marginV}`
  );
  lines.push('');
  lines.push('[Events]');
  lines.push('Format: Layer, Start, End, Style, Text');

  for (const seg of segments) {
    const text = (seg.text || '').replace(/\r?\n/g, '\\N').trim();
    if (!text) continue;
    const start = fmtTime(seg.start || 0);
    const end = fmtTime(seg.end || seg.start + 3 || 3);
    lines.push(`Dialogue: 0,${start},${end},Default,${text}`);
  }

  const assPath = await tmpFile('ass');
  await fs.writeFile(assPath, lines.join('\n'), 'utf-8');
  return assPath;
}
