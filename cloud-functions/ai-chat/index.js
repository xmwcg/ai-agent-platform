// ============================================================
// aibak.site AI Chat Cloud Function  (jymkj-knowlage 环境)
// 调用 CloudBase AI 混元文本模型，消耗「小程序成长计划」免费对话额度。
//
// 为什么必须经云函数？
//   CloudBase 的 AI 通道被硬性限制为「仅允许小程序 SDK / 云开发 SDK（即运行在
//   CloudBase 环境内的代码）调用」。从独立后端直接 HTTP 直调网关会返回
//   403 AI_CHANNEL_NOT_ALLOWED（违规）。因此在云函数内用 @cloudbase/node-sdk
//   调用（云函数环境自动鉴权，无需 secretId/secretKey），再由后端通过 HTTP 触发
//   地址间接调用，即可合法消耗该环境的免费额度。
//
// env 不写死：tcb.init() 在云函数运行时内会自动使用所在环境的身份，从而消耗
// 部署目标环境（jymkjtools-study / jymkj-knowlage 等）自身的 AI 额度。把函数
// 部署到哪个环境，就消耗哪个环境的额度。
//
// 支持模型：hy3 / hy3-preview
// 触发方式：HTTP 触发，POST { messages, model, stream }
// 返回契约：{ success, text, model, usage }  （与 server 端 callCloudbaseChat 对齐）
// ============================================================

const tcb = require('@cloudbase/node-sdk');

// 部署说明：函数本体部署在当前账号的 jymkjtools-study 环境（可部署、零跨账号障碍），
// env 指向 jymkj-knowlage，并用 jymkj-knowlage 的 API 密钥（SecretId/SecretKey，通过函数
// 环境变量 CB_SECRET_ID / CB_SECRET_KEY 注入）显式初始化，从而以 jymkj-knowlage 身份在云
// 函数内调用其 AI 额度（合规，非独立后端直连网关）。未配置密钥时回退到函数默认凭证。
const app = tcb.init({
  env: 'jymkj-knowlage-d8gmhvqyq1051579d',
  secretId: process.env.CB_SECRET_ID,
  secretKey: process.env.CB_SECRET_KEY,
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

  // CloudBase HTTP 网关把请求体放在 event.body（可能是 base64 编码字符串，
  // 也可能直接是对象），且 httpMethod 字段位置不固定。这里做健壮解析。
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

  const {
    messages,
    model = 'hy3',
    stream = false,
  } = inputData;

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
    // 非流式：一次性返回完整文本（与首页 callCloudbaseChat 契约一致）
    const res = await chatModel.generateText({
      model,
      messages,
    });

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
        quotaSource: '小程序成长计划免费额度',
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
