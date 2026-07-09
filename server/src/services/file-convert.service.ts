/**
 * 文件转换服务 - 办公自动化核心模块
 * 支持常见文档/图片格式互转。真实环境可接入 LibreOffice / pandoc / sharp 等，
 * 这里实现结构化转换逻辑 + Mock 产物，预留真实转换钩子。
 */

export interface ConvertResult {
  sourceName: string;
  sourceFormat: string;
  targetFormat: string;
  outputName: string;
  outputSize: number;
  downloadUrl: string;     // 演示用占位 URL
  note: string;
}

// 支持的格式分组
export const SUPPORTED_FORMATS = {
  document: ['pdf', 'docx', 'doc', 'txt', 'md', 'html', 'rtf', 'odt'],
  image: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'svg', 'tiff'],
  data: ['csv', 'xlsx', 'json', 'xml', 'yaml'],
  presentation: ['pptx', 'pdf', 'key'],
};

// 常见跨组转换规则（演示支持矩阵）
const CONVERSION_MATRIX: { from: string[]; to: string[]; label: string }[] = [
  { from: ['pdf'], to: ['docx', 'txt', 'html', 'png'], label: 'PDF 导出' },
  { from: ['docx', 'doc', 'rtf', 'odt'], to: ['pdf', 'txt', 'html', 'md'], label: 'Word 系列转换' },
  { from: ['md', 'txt'], to: ['pdf', 'html', 'docx'], label: '文本转文档' },
  { from: ['html'], to: ['pdf', 'docx', 'md'], label: '网页转文档' },
  { from: ['csv', 'xlsx'], to: ['json', 'xml', 'yaml', 'pdf'], label: '表格数据转换' },
  { from: ['json', 'xml', 'yaml'], to: ['csv', 'xlsx'], label: '结构化数据转表格' },
  { from: ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'gif', 'tiff'], to: ['png', 'jpg', 'webp', 'svg'], label: '图片格式转换' },
  { from: ['pptx'], to: ['pdf', 'png'], label: '演示文稿导出' },
];

export function isConversionSupported(source: string, target: string): boolean {
  const s = source.toLowerCase().replace('.', '');
  const t = target.toLowerCase().replace('.', '');
  return CONVERSION_MATRIX.some(
    (rule) => rule.from.includes(s) && rule.to.includes(t)
  );
}

export function getSupportedConversionList() {
  return CONVERSION_MATRIX;
}

class FileConvertService {
  async convert(
    fileName: string,
    sourceFormat: string,
    targetFormat: string,
    content?: string
  ): Promise<ConvertResult> {
    if (!fileName) throw new Error('文件名不能为空');
    if (!isConversionSupported(sourceFormat, targetFormat)) {
      throw new Error(`暂不支持从 .${sourceFormat} 转换为 .${targetFormat}`);
    }

    // 真实转换钩子（演示：仅模拟产物）
    // 生产环境可调用：pandoc / libreoffice --headless / sharp
    const outputName = fileName.replace(new RegExp(`\\.${sourceFormat}$`, 'i'), '') + '.' + targetFormat;
    const outputSize = Math.max(1024, (content?.length || 2048) * 1.2);

    return {
      sourceName: fileName,
      sourceFormat: sourceFormat.toLowerCase(),
      targetFormat: targetFormat.toLowerCase(),
      outputName,
      outputSize: Math.round(outputSize),
      downloadUrl: `/api/tools/convert/download?file=${encodeURIComponent(outputName)}`,
      note: '演示模式：返回转换结果元数据。生产环境接入 LibreOffice/pandoc 后输出真实文件。',
    };
  }
}

export const fileConvertService = new FileConvertService();
