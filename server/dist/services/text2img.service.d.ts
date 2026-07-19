export interface Text2ImgRequest {
    prompt: string;
    negativePrompt?: string;
    size?: string;
    n?: number;
    style?: 'photorealistic' | 'anime' | 'oil_painting' | 'watercolor';
}
export interface Text2ImgResult {
    success: boolean;
    images: {
        url: string;
        b64_json?: string;
    }[];
    revisedPrompt?: string;
}
declare class Text2ImgService {
    private apiKey;
    private baseURL;
    constructor();
    generate(request: Text2ImgRequest): Promise<Text2ImgResult>;
    generateMock(request: Text2ImgRequest): Promise<Text2ImgResult>;
}
export declare const text2ImgService: Text2ImgService;
export {};
//# sourceMappingURL=text2img.service.d.ts.map