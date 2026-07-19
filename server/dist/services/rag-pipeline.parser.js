"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DocumentParser = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const logger_1 = require("../lib/logger");
// ── 文档解析器 ────────────────────────────────────────
class DocumentParser {
    /**
     * 解析 Word (.docx) 文档
     */
    async parseDocx(filePath) {
        // 动态导入 mammoth 避免启动时加载
        const mammoth = await Promise.resolve().then(() => __importStar(require('mammoth')));
        const result = await mammoth.extractRawText({ path: filePath });
        if (result.messages.length > 0) {
            logger_1.logger.warn('rag-pipeline', 'Mammoth parse warnings', result.messages);
        }
        return result.value;
    }
    /**
     * 解析 PDF 文档
     */
    async parsePdf(filePath) {
        // pdf-parse 是 CJS 模块，需要特殊导入
        const pdfParseFn = require('pdf-parse');
        const dataBuffer = fs_1.default.readFileSync(filePath);
        const data = await pdfParseFn(dataBuffer);
        return { text: data.text, pageCount: data.numpages };
    }
    /**
     * 解析 Markdown / 纯文本 / HTML
     */
    async parseText(filePath, format) {
        const raw = fs_1.default.readFileSync(filePath, 'utf-8');
        if (format === 'html' || format === 'htm') {
            // 简单 HTML 标签清理
            const cheerio = await Promise.resolve().then(() => __importStar(require('cheerio')));
            const $ = cheerio.load(raw);
            // 移除 script / style
            $('script, style, nav, footer, header').remove();
            return $('body').text().replace(/\s+/g, ' ').trim();
        }
        // Markdown / TXT 直接返回原文
        return raw;
    }
    /**
     * 主入口：根据文件扩展名自动选择解析器
     */
    async parse(filePath, fileName) {
        const startTime = Date.now();
        const ext = path_1.default.extname(fileName).toLowerCase().replace('.', '');
        let text = '';
        let pageCount;
        let wordCount = 0;
        try {
            switch (ext) {
                case 'pdf':
                    const pdfResult = await this.parsePdf(filePath);
                    text = pdfResult.text;
                    pageCount = pdfResult.pageCount;
                    break;
                case 'docx':
                case 'doc':
                    text = await this.parseDocx(filePath);
                    break;
                case 'md':
                case 'txt':
                case 'html':
                case 'htm':
                    text = await this.parseText(filePath, ext);
                    break;
                default:
                    throw new Error(`Unsupported format: .${ext}`);
            }
            // 基本清理
            text = text.replace(/\r\n/g, '\n').replace(/\t/g, ' ').trim();
            if (!text) {
                throw new Error('Parsed document is empty');
            }
            wordCount = text.length;
            return {
                text,
                metadata: {
                    format: ext,
                    fileName,
                    pageCount,
                    wordCount,
                    parseTime: Date.now() - startTime,
                },
            };
        }
        catch (error) {
            logger_1.logger.error('rag-pipeline', `Parse error for ${fileName}`, error);
            throw error;
        }
    }
}
exports.DocumentParser = DocumentParser;
//# sourceMappingURL=rag-pipeline.parser.js.map