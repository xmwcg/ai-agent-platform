// ============================================================
// aibak.site AI Image Generation Cloud Function
// 调用 CloudBase AI 混元图像模型，消耗「小程序成长计划」免费生图额度。
// 支持：
//   - 文生图  model = 'HY-Image-3.0-Plus-4090-Tob-v1.0'
//   - 图生图  model = 'HY-Image-v3.0-I2I-ToB-v1.0.1'（需传 images/base64 或 image_urls）
//
// 关键修复（相对旧版）：
//   1. 把 images / image_urls 透传给 generateImage（旧版只认单 image 字段，图生图易失败）
//   2. 混元 3.0 系列关闭 revise；图生图(I2I)模型不支持 enable_thinking，仅文生图加
//   3. 返回契约统一为 { success, data: [{ url, revised_prompt }] }（与前端对齐）
//   4. 超时设为 180s（云函数配置同步调大）
// ============================================================

const tcb = require('@cloudbase/node-sdk');

const app = tcb.init({
  env: 'jymkjtools-study-d6eipek12446b18',
  timeout: 180000,
});

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// 允许调用的免费图像模型（小程序成长计划）
const ALLOWED_MODELS = [
  'HY-Image-3.0-Plus-4090-Tob-v1.0', // 文生图
  'HY-Image-v3.0-I2I-ToB-v1.0.1',     // 图生图
];

exports.main = async (event, context) => {
  // CORS 预检
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' };
  }

  // HTTP 触发器把请求体放在 event.body（字符串），需解析
  let inputData = event;
  if (event.httpMethod === 'POST' && event.body) {
    try {
      inputData = JSON.parse(event.body);
    } catch (e) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
        body: JSON.stringify({ success: false, error: 'Invalid JSON body' }),
      };
    }
  }

  const {
    prompt,
    model = 'HY-Image-3.0-Plus-4090-Tob-v1.0',
    size = '1024x1024',
    images,
    image_urls,
  } = inputData;

  // 模型白名单
  if (!ALLOWED_MODELS.includes(model)) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      body: JSON.stringify({
        success: false,
        error: `unsupported model "${model}". allowed: ${ALLOWED_MODELS.join(', ')}`,
      }),
    };
  }

  if (!prompt) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      body: JSON.stringify({ success: false, error: 'prompt is required' }),
    };
  }

  const isImage2Image = String(model).includes('I2I');
  if (isImage2Image && !(images && images.length) && !(image_urls && image_urls.length)) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      body: JSON.stringify({ success: false, error: '图生图需要传入 images(base64) 或 image_urls' }),
    };
  }

  const ai = app.ai();
  const imageModel = ai.createImageModel('hunyuan-image');

  // 混元图像 3.0 系列：关闭 prompt 改写；图生图(I2I)模型不支持 enable_thinking，仅文生图加
  const isV3 = /Image-3\.0/i.test(model);
  const v3Params = isV3
    ? {
        revise: { value: false },
        ...(isImage2Image ? {} : { enable_thinking: { value: false } }),
      }
    : {};

  try {
    const res = await imageModel.generateImage({
      model,
      prompt,
      size,
      ...v3Params,
      ...(images && images.length ? { images } : {}),
      ...(image_urls && image_urls.length ? { image_urls } : {}),
    });

    const { data, error } = res;
    if (error) {
      return {
        statusCode: 502,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
        body: JSON.stringify({
          success: false,
          error: error.message || '图像生成失败',
          code: error.code || 'GEN_ERROR',
        }),
      };
    }

    const imgs = (data || []).map((d) => ({
      url: d.url,
      revised_prompt: d.revised_prompt || d.revisedPrompt || '',
    }));

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      body: JSON.stringify({
        success: true,
        data: imgs,
        model,
        size,
        quotaSource: '小程序成长计划免费额度',
      }),
    };
  } catch (error) {
    console.error('Image generation failed:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      body: JSON.stringify({
        success: false,
        error: error.message,
        code: error.code || 'UNKNOWN',
      }),
    };
  }
};
