"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.text2ImgService = void 0;
// 混元凭据统一为腾讯云 TC3 凭据（SECRET_ID / SECRET_KEY），兼容旧名 HUNYUAN_API_KEY
const HUNYUAN_SECRET_ID = process.env.HUNYUAN_SECRET_ID || process.env.HUNYUAN_API_KEY || '';
const HUNYUAN_SECRET_KEY = process.env.HUNYUAN_SECRET_KEY || process.env.HUNYUAN_API_KEY || '';
const HUNYUAN_API_KEY = process.env.HUNYUAN_API_KEY || '';
const HUNYUAN_BASE_URL = process.env.HUNYUAN_BASE_URL || 'https://hunyuan.tencentcloudapi.com';
const axios_1 = __importDefault(require("axios"));
class Text2ImgService {
    constructor() {
        this.apiKey = HUNYUAN_SECRET_KEY || HUNYUAN_API_KEY || '';
        this.baseURL = HUNYUAN_BASE_URL || 'https://hunyuan.tencentcloudapi.com';
    }
    async generate(request) {
        if (!this.apiKey) {
            throw new Error('混元未配置：请在 .env 设置 HUNYUAN_SECRET_ID / HUNYUAN_SECRET_KEY');
        }
        try {
            const response = await axios_1.default.post(`${this.baseURL}/images/generations`, {
                model: 'hunyuan-image',
                prompt: request.prompt,
                negative_prompt: request.negativePrompt,
                size: request.size || '1024x1024',
                n: request.n || 1,
                style: request.style
            }, {
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                }
            });
            return {
                success: true,
                images: response.data.data || []
            };
        }
        catch (err) {
            console.error('❌ Text2Img error:', err.message);
            throw err;
        }
    }
    // 模拟生成（无 API Key 时用）
    async generateMock(request) {
        // 返回占位图
        const mockImages = Array(request.n || 1).fill(0).map((_, idx) => ({
            url: `https://placehold.co/${request.size?.replace('x', '/') || '1024/1024'}?text=${encodeURIComponent(request.prompt.substring(0, 20))}`,
            b64_json: undefined
        }));
        return {
            success: true,
            images: mockImages,
            revisedPrompt: `[模拟] ${request.prompt}`
        };
    }
}
exports.text2ImgService = new Text2ImgService();
//# sourceMappingURL=text2img.service.js.map