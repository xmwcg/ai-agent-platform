/**
 * 文件转换服务 - 办公自动化核心模块
 *
 * 真实实现文本族格式互转（零外部依赖，纯 JS）：md / html / txt / csv / json / yaml / xml。
 * 二进制格式（docx / pdf / pptx / 图片）依赖 LibreOffice / pandoc 等外部工具，
 * 未安装时明确报错（不返回假占位文件），避免误导用户。
 */
export interface ConvertResult {
    sourceName: string;
    sourceFormat: string;
    targetFormat: string;
    outputName: string;
    outputSize: number;
    outputId: string;
    contentType: string;
    note: string;
}
export declare function getStoredConversion(id: string): Promise<{
    content: string;
    ctype: string;
    name: string;
} | undefined>;
export declare function isConversionSupported(source: string, target: string): boolean;
export declare function getSupportedConversionList(): {
    from: string[];
    to: string[];
    label: string;
}[];
declare class FileConvertService {
    convert(fileName: string, sourceFormat: string, targetFormat: string, content?: string): Promise<ConvertResult>;
}
export declare const fileConvertService: FileConvertService;
export {};
//# sourceMappingURL=file-convert.service.d.ts.map