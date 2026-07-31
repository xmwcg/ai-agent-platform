import fs from 'fs/promises';
import { buildAss } from './subtitle.ffmpeg';

describe('创作工坊 - ASS 字幕生成 (subtitle.ffmpeg)', () => {
  it('生成符合 ASS v4+ 规范的字幕文件', async () => {
    const segs = [
      { text: '第一句口播', start: 0, end: 2.5 },
      { text: '第二句口播', start: 2.5, end: 5 },
    ];
    const p = await buildAss(segs as any, {
      font: 'Microsoft YaHei',
      size: 14,
      color: '&H00FFFFFF',
      outline: '&H00000000',
      position: 'bottom',
    });
    const content = await fs.readFile(p, 'utf-8');

    expect(content).toContain('[Script Info]');
    expect(content).toContain('ScriptType: v4.00+');
    expect(content).toContain('PlayResX: 1080');
    expect(content).toContain('PlayResY: 1920');
    expect(content).toContain('[V4+ Styles]');
    expect(content).toContain('[Events]');
    // 时间轴格式 HH:MM:SS.CC
    expect(content).toMatch(/Dialogue: 0,0:00:00\.00,0:00:02\.50,Default,第一句口播/);
    expect(content).toMatch(/Dialogue: 0,0:00:02\.50,0:00:05\.00,Default,第二句口播/);
    // 默认底部对齐 alignment=2
    expect(content).toContain('Default,Microsoft YaHei,14,&H00FFFFFF,&H00000000,0,0,2,40,40,220');
  });

  it('居中位置时切换对齐方式 alignment=5 且提高底部边距', async () => {
    const p = await buildAss([{ text: '居中字幕', start: 0, end: 3 }] as any, {
      font: 'Microsoft YaHei',
      size: 14,
      color: '&H00FFFFFF',
      outline: '&H00000000',
      position: 'center',
    });
    const content = await fs.readFile(p, 'utf-8');
    expect(content).toContain('0,0,5,40,40,120');
  });

  it('多行文本被转换为 \\N 换行', async () => {
    const p = await buildAss([{ text: '第一行\n第二行', start: 0, end: 3 }] as any);
    const content = await fs.readFile(p, 'utf-8');
    expect(content).toContain('第一行\\N第二行');
  });
});
