export interface PlanGenerateParams {
    topic: string;
    type?: 'business' | 'marketing' | 'technical' | 'education' | 'general';
    audience?: string;
    length?: 'brief' | 'detailed' | 'comprehensive';
    requirements?: string;
}
export interface PlanResult {
    topic: string;
    type: string;
    content: string;
    outline: string[];
    provider: string;
    model: string;
}
/** 方案生成服务 - 办公自动化核心能力（借鉴 GPT Researcher 思路） */
declare class PlanGeneratorService {
    generate(params: PlanGenerateParams): Promise<PlanResult>;
    private extractOutline;
}
export declare const planGeneratorService: PlanGeneratorService;
export {};
//# sourceMappingURL=plan-generator.service.d.ts.map