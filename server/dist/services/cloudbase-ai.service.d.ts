export declare const AIBAK_MODELS: {
    text: string[];
    image: string[];
};
/**
 * 调用 CloudBase ai-chat 云函数（小程序成长计划免费额度）生成文本。
 * 抽离为独立服务，供知识库 RAG、翻译、方案生成、开放 API 市场等模块统一复用。
 * @returns 模型返回的文本
 * @throws 当云函数不可用或返回失败时
 */
export declare function callCloudbaseChat(chatMessages: Array<{
    role: string;
    content: string;
}>, model?: string): Promise<string>;
export interface CloudbaseImageOptions {
    size?: string;
    imageBase64?: string;
    imageUrl?: string;
}
/**
 * 调用 CloudBase ai-image 云函数（小程序成长计划免费额度）生成图像。
 * 支持文生图（HY-Image-3.0-Plus）与图生图（HY-Image-v3.0-I2I）。
 * @returns 图像 URL 数组（主图在前）
 * @throws 当云函数不可用或返回失败时
 */
export declare function callCloudbaseImage(model: string, prompt: string, opts?: CloudbaseImageOptions): Promise<string[]>;
//# sourceMappingURL=cloudbase-ai.service.d.ts.map