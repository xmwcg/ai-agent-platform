import { ParsedDocument } from './rag-pipeline.types';
export declare class DocumentParser {
    /**
     * 解析 Word (.docx) 文档
     */
    parseDocx(filePath: string): Promise<string>;
    /**
     * 解析 PDF 文档
     */
    parsePdf(filePath: string): Promise<{
        text: string;
        pageCount: number;
    }>;
    /**
     * 解析 Markdown / 纯文本 / HTML
     */
    parseText(filePath: string, format: string): Promise<string>;
    /**
     * 主入口：根据文件扩展名自动选择解析器
     */
    parse(filePath: string, fileName: string): Promise<ParsedDocument>;
}
//# sourceMappingURL=rag-pipeline.parser.d.ts.map