/**
 * 数字人口播（云端 API）
 * ----------------------------------------------------------------
 * 架构选定为「纯云端 API」，因此数字人不本地跑 MuseTalk，而是调用一个云数字人服务
 * （腾讯智影 / 火山 / 硅基 等，或自建 MuseTalk 服务），通过环境变量 STUDIO_DH_URL 接入。
 * 约定接口（可替换为任意兼容实现）：
 *   提交：POST {STUDIO_DH_URL}/generate  body:{audio_url, portrait_url} -> {task_id}
 *   轮询：GET  {STUDIO_DH_URL}/tasks/:task_id -> {status:'success'|'failed'|..., video_url}
 */
export interface DigitalHumanResult {
  videoUrl: string;
}

export async function generateDigitalHuman(opts: {
  audioUrl: string;
  portraitUrl?: string;
  userId: string;
}): Promise<DigitalHumanResult> {
  const endpoint = process.env.STUDIO_DH_URL;
  if (!endpoint) {
    throw new Error(
      '数字人服务未配置（STUDIO_DH_URL）。请在环境变量接入云数字人 / 自建 MuseTalk 服务后再使用本功能。'
    );
  }

  const submit = await fetch(`${endpoint.replace(/\/$/, '')}/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ audio_url: opts.audioUrl, portrait_url: opts.portraitUrl || null }),
    signal: AbortSignal.timeout(30000),
  });
  if (!submit.ok) {
    const t = await submit.text().catch(() => '');
    throw new Error(`数字人任务提交失败(${submit.status}): ${t.slice(0, 200)}`);
  }
  const sj: any = await submit.json().catch(() => ({}));
  const taskId = sj?.task_id || sj?.id;
  if (!taskId) throw new Error('数字人服务未返回 task_id');

  const deadline = Date.now() + 1000 * 60 * 8; // 最多等待 8 分钟
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 8000));
    const poll = await fetch(`${endpoint.replace(/\/$/, '')}/tasks/${taskId}`, {
      signal: AbortSignal.timeout(20000),
    }).catch(() => null);
    if (!poll || !poll.ok) continue;
    const pj: any = await poll.json().catch(() => ({}));
    const status = String(pj?.status || '').toLowerCase();
    if (status === 'success' || status === 'done') {
      const url = pj?.video_url || pj?.result?.url || pj?.data?.url;
      if (!url) throw new Error('数字人任务成功但未返回视频 URL');
      return { videoUrl: url };
    }
    if (status === 'failed' || status === 'error') {
      throw new Error(`数字人生成失败：${pj?.message || '未知错误'}`);
    }
  }
  throw new Error('数字人生成超时（>8min），请稍后在任务中心查看');
}
