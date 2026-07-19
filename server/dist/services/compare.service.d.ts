export interface CompareItem {
    id: string;
    name: string;
    type: 'model' | 'tool' | 'framework' | 'language' | 'hardware';
    provider?: string;
    description?: string;
    specs?: Record<string, any>;
}
export interface CompareRequest {
    items: string[];
    dimensions?: string[];
}
export interface CompareResult {
    items: CompareItem[];
    dimensions: Dimension[];
    rows: CompareRow[];
    recommendation?: string;
}
export interface Dimension {
    key: string;
    label: string;
    unit?: string;
}
export interface CompareRow {
    dimension: string;
    values: (string | number | boolean)[];
    winner?: number;
}
export declare class CompareService {
    private presets;
    getPresets(): CompareItem[];
    getPresetsByType(type: CompareItem['type']): CompareItem[];
    generateCompare(req: CompareRequest): Promise<CompareResult>;
    private generateCompareWithAI;
    private getDimensions;
    private getDevelopmentReferenceValue;
    private generateRecommendation;
}
export declare const compareService: CompareService;
//# sourceMappingURL=compare.service.d.ts.map