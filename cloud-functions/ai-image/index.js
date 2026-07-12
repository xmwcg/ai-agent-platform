/**
 * CloudBase 云函数：ai-image
 * 功能：调用 CloudBase AI「混元图像生成」能力，消耗「小程序成长计划」赠送的免费生图额度。
 * 支持：
 *   - 文生图  model = 'HY-Image-3.0-Plus-4090-Tob-v1.0'
 *   - 图生图  model = 'HY-Image-v3.0-I2I-ToB-v1.0.1'
 *
 * 部署说明：
 *   1. 在 CloudBase 控制台创建云函数 ai-image，运行环境 Node.js 16+。
 *   2. 上传本目录（index.js + package.json）。
 *   3. ⚠️ 务必把云函数「超时时间」设为 900 秒（图像生成 + thinking 可能较久）。
 *   4. 确保该环境已加入「小程序成长计划」且 AI 图像能力已开通。
 *   5. 后端通过 CLOUDBASE_IMAGE_URL 环境变量指向本函数的 HTTP 触发地址
 *      （默认：把现有 ai-chat 云函数 URL 的 /ai-chat 替换为 /ai-image 即可）。
 */
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

// CloudBase AI 图像模型实例（混元图像系列）
const ai = cloud.extend.AI;

exports.main = async (event = {}) => {
  const {
    model,
    prompt,
    size = '1024x1024',
    image_urls,
    images,
  } = event;

  if (!model || !prompt) {
    return { success: false, error: 'model 与 prompt 必填', code: 'PARAM_ERROR' };
  }

  const isImage2Image = model.includes('I2I');
  if (isImage2Image && !(images && images.length) && !(image_urls && image_urls.length)) {
    return { success: false, error: '图生图需要传入 images(base64) 或 image_urls', code: 'PARAM_ERROR' };
  }

  try {
    const imageModel = ai.createImageModel('hunyuan-image');

    const params = { model, prompt, size };
    if (images && images.length) params.images = images;
    if (image_urls && image_urls.length) params.image_urls = image_urls;

    const res = await imageModel.generateImage(params);

    // res.data 为 [{ url, revised_prompt }]，URL 24 小时后失效
    return {
      success: true,
      data: res?.data || [],
      model,
      quotaSource: '小程序成长计划免费额度',
    };
  } catch (e) {
    return {
      success: false,
      error: e?.message || String(e),
      code: 'GEN_ERROR',
    };
  }
};
