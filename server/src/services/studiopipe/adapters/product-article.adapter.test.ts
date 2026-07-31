/**
 * 商品详情页文章适配器 — 单元测试
 */
import { generateProductArticle } from "./product-article.adapter";

describe("product-article.adapter", () => {
  const baseInput = {
    productName: "智能蓝牙耳机 Pro",
    category: "电子产品",
    sellingPoints: ["HiFi 音质", "40小时续航", "主动降噪", "IPX5 防水"],
    productImages: [
      "https://cdn.example.com/product1.jpg",
      "https://cdn.example.com/product2.jpg",
    ],
    platform: "taobao" as const,
    tone: "professional" as const,
    imageCount: 4,
  };

  it("基本商品详情页生成应包含标题和卖点", async () => {
    const result = await generateProductArticle(baseInput);

    expect(result.title).toContain("智能蓝牙耳机 Pro");
    expect(result.shortDescription).toContain("HiFi 音质");
    expect(result.detailMarkdown).toContain("智能蓝牙耳机 Pro");
    expect(result.detailMarkdown).toContain("HiFi 音质");
    expect(result.detailMarkdown).toContain("40小时续航");
  });

  it("应生成指定数量的 slide", async () => {
    const result = await generateProductArticle(baseInput);

    expect(result.slides.length).toBe(4);
    expect(result.slides[0].type).toBe("main");
  });

  it("SEO 检测应包含关键词", async () => {
    const result = await generateProductArticle(baseInput);

    expect(result.seoCheck).toBeDefined();
    expect(result.seoCheck.score).toBeGreaterThanOrEqual(0);
    expect(result.seoCheck.score).toBeLessThanOrEqual(100);
  });

  it("不同平台应使用不同模板", async () => {
    const taobao = await generateProductArticle({ ...baseInput, platform: "taobao" });
    const douyin = await generateProductArticle({ ...baseInput, platform: "douyin" });
    const xhs = await generateProductArticle({ ...baseInput, platform: "xiaohongshu" });

    expect(taobao.detailMarkdown).not.toBe(douyin.detailMarkdown);
    expect(douyin.detailMarkdown).not.toBe(xhs.detailMarkdown);
  });

  it("独立站英文模板应包含英文内容", async () => {
    const result = await generateProductArticle({
      ...baseInput,
      platform: "independent",
      tone: "professional",
    });

    expect(result.detailMarkdown).toContain("Product Overview");
  });

  it("奢品调性应包含高端词汇", async () => {
    const luxury = await generateProductArticle({ ...baseInput, tone: "luxury" });

    expect(luxury.detailMarkdown).toContain("奢华臻选");
  });

  it("单张图片时 slide 应循环使用", async () => {
    const result = await generateProductArticle({
      ...baseInput,
      productImages: ["https://cdn.example.com/single.jpg"],
    });

    expect(result.slides.length).toBe(4);
    expect(result.slides.every((s) => s.imageUrl.includes("single.jpg"))).toBe(true);
  });
});
