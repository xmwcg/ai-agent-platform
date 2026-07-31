// ============================================================
// aibak.site AI Chat Cloud Function  (直接部署在 jymkj-knowlage 环境)
// 云函数运行在 jymkj-knowlage 内，自动拥有环境身份，无需额外密钥。
// 消耗 jymkj-knowlage「小程序成长计划」免费对话额度。
//
// 与 jymkjtools-study 版区别：
//   不需要 secretId/secretKey 跨环境调用——直接在本环境内用 @cloudbase/node-sdk。
//
// 支持模型：hy3 / hy3-preview / hunyuan-2.0-instruct-20251111
// 触发方式：HTTP 触发，POST { messages, model, stream }
// 返回契约：{ success, text, model, usage }
// ============================================================

const tcb = require('@cloudbase/node-sdk');

const app = tcb.init({
  env: 'jymkj-knowlage-d8gmhvqyq1051579d',
  timeout: 60000,
});

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

exports.main = async (event, context) => {
  // CORS 预检
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' };
  }

  // 健壮解析请求体（HTTP 网关可能 base64 编码或直接给对象）
  let inputData = event;
  if (typeof event.body === 'string') {
    let raw = event.body;
    if (event.isBase64Encoded) {
      try { raw = Buffer.from(raw, 'base64').toString('utf8'); } catch (_) {}
    }
    try {
      inputData = JSON.parse(raw);
    } catch (e) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
        body: JSON.stringify({ success: false, error: 'Invalid JSON body' }),
      };
    }
  } else if (event.body && typeof event.body === 'object') {
    inputData = event.body;
  }

  const { messages, model = 'hy3', stream = false } = inputData;

  if (!Array.isArray(messages) || messages.length === 0) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      body: JSON.stringify({ success: false, error: 'messages 数组必填且非空' }),
    };
  }

  const ai = app.ai();
  const chatModel = ai.createModel('cloudbase');

  try {
    const res = await chatModel.generateText({ model, messages });

    if (res.error) {
      return {
        statusCode: 502,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
        body: JSON.stringify({
          success: false,
          error: res.error.message || '对话生成失败',
          code: res.error.code || 'GEN_ERROR',
        }),
      };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      body: JSON.stringify({
        success: true,
        text: res.text,
        model,
        usage: res.usage,
        quotaSource: 'jymkj-knowlage 小程序成长计划免费额度',
      }),
    };
  } catch (e) {
    console.error('Chat generation failed:', e);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      body: JSON.stringify({ success: false, error: e.message, code: e.code || 'UNKNOWN' }),
    };
  }
};
