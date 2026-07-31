// ============================================================
// 方式三-B：AI 工具 / MCP 合规桥接云函数（保持「小程序成长计划」免费额度）
//
// 原理（合规关键）：
//   AI 工具 / MCP 不能直接消耗免费额度（免费额度仅限「小程序」和「云函数/云开发服务端」）。
//   所以让 AI 工具调用【本云函数】，本函数在「云开发服务端」用 @cloudbase/node-sdk
//   的 app.ai() 调模型 —— 合法来源=云函数 → 消耗的是免费额度，而非资源点套餐。
//
// 部署：tcb fn deploy ai-proxy
// 调用：POST https://<env>.api.tcloudbasegateway.com/ai-proxy
//       body: { "type":"text", "model":"hy3-preview", "messages":[...] }
//          或 { "type":"image", "model":"HY-Image-3.0-Plus-4090-Tob-v1.0", "prompt":"...", "size":"1024x1024" }
//          或图生图: { "type":"image", "model":"HY-Image-v3.0-I2I-ToB-v1.0.1", "prompt":"...", "images":["<base64>"] }
// ============================================================

const tcb = require('@cloudbase/node-sdk');

const app = tcb.init({
  env: 'jymkjtools-study-d6eipek12446b18',
  timeout: 180000,
});

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const ALLOWED_TEXT = ['hy3', 'hy3-preview'];
const ALLOWED_IMG = ['HY-Image-3.0-Plus-4090-Tob-v1.0', 'HY-Image-v3.0-I2I-ToB-v1.0.1'];

exports.main = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };

  let body = event;
  if (event.httpMethod === 'POST' && event.body) {
    try {
      body = JSON.parse(event.body);
    } catch {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ success: false, error: 'Invalid JSON body' }) };
    }
  }

  const { type = 'text', model, messages, prompt, size = '1024x1024', images, image_urls } = body;
  const ai = app.ai();

  try {
    if (type === 'image') {
      if (!ALLOWED_IMG.includes(model)) {
        return { statusCode: 400, headers: CORS, body: JSON.stringify({ success: false, error: `unsupported image model ${model}` }) };
      }
      const isI2I = model.includes('I2I');
      if (isI2I && !(images || image_urls)) {
        return { statusCode: 400, headers: CORS, body: JSON.stringify({ success: false, error: '图生图需传 images(base64) 或 image_urls' }) };
      }
      const m = ai.createImageModel('hunyuan-image');
      const res = await m.generateImage({
        model,
        prompt,
        size,
        ...(isI2I ? {} : { enable_thinking: { value: false } }),
        ...(images ? { images } : {}),
        ...(image_urls ? { image_urls } : {}),
      });
      return {
        statusCode: 200,
        headers: CORS,
        body: JSON.stringify({
          success: true,
          data: (res.data || []).map((d) => ({ url: d.url })),
          model,
          quotaSource: '小程序成长计划免费额度',
        }),
      };
    }

    // 文本
    if (!ALLOWED_TEXT.includes(model)) {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ success: false, error: `unsupported text model ${model}` }) };
    }
    const m = ai.createModel('cloudbase');
    const res = await m.generateText({ model, messages });
    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({
        success: true,
        text: res.text,
        usage: res.usage,
        quotaSource: '小程序成长计划免费额度',
      }),
    };
  } catch (e) {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ success: false, error: e.message }) };
  }
};
