import { translationService } from '../services/translation.service';
import { planGeneratorService } from '../services/plan-generator.service';
import { fileConvertService, isConversionSupported } from '../services/file-convert.service';
import { mediaGenService } from '../services/media-gen.service';

describe('工具模块单元测试', () => {
  describe('翻译服务', () => {
    it('应返回翻译结果与目标语言', async () => {
      const r = await translationService.translate('Hello', 'zh');
      expect(r.targetLang).toBe('中文');
      expect(r.translatedText.length).toBeGreaterThan(0);
    });
    it('空文本应抛错', async () => {
      await expect(translationService.translate('', 'zh')).rejects.toThrow();
    });
  });

  describe('方案生成', () => {
    it('应生成 Markdown 方案并含大纲', async () => {
      const r = await planGeneratorService.generate({ topic: '测试方案', type: 'business' });
      expect(r.content).toContain('#');
      expect(r.outline.length).toBeGreaterThan(0);
    });
  });

  describe('文件转换', () => {
    it('支持的转换矩阵应识别 docx->pdf', () => {
      expect(isConversionSupported('docx', 'pdf')).toBe(true);
    });
    it('不支持的转换应识别 false', () => {
      expect(isConversionSupported('mp4', 'pdf')).toBe(false);
    });
    it('转换应返回输出文件名', async () => {
      const r = await fileConvertService.convert('doc.docx', 'docx', 'pdf', 'content');
      expect(r.outputName).toBe('doc.pdf');
    });
    it('不支持的转换应抛错', async () => {
      await expect(fileConvertService.convert('a.mp4', 'mp4', 'pdf')).rejects.toThrow();
    });
  });

  describe('媒体生成', () => {
    it('文生视频应返回 processing 任务（异步，需轮询）', async () => {
      const r = await mediaGenService.generate({ type: 'text2video', prompt: '一只猫', duration: 5 });
      expect(r.status).toBe('processing');
      expect(r.duration).toBe(5);
    });
    it('空提示词应抛错', async () => {
      await expect(mediaGenService.generate({ type: 'image2image', prompt: '' })).rejects.toThrow();
    });
  });
});
