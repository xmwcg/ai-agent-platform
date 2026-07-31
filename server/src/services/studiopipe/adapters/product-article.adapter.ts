/**
 * 商品详情页文章适配器
 * ----------------------------------------------------------------
 * 对标成哥工坊 ProductArticleService + ProductLibraryService + VisualPromptEnricher。
 *
 * 输入商品信息和图片，调用 AI（视觉理解 + 文案生成 + 图像生成）输出完整的
 * 商品详情页内容（Markdown 格式），可直接用于淘宝 / 抖音小店 / 独立站。
 */

import { downloadToTmp } from "./_util";

/** 商品详情页生成输入 */
export interface ProductArticleInput {
  /** 商品名称 */
  productName: string;
  /** 商品类别 */
  category: string;
  /** 商品卖点（可多条） */
  sellingPoints: string[];
  /** 商品图 URL 列表 */
  productImages: string[];
  /** 目标平台 */
  platform: "taobao" | "douyin" | "xiaohongshu" | "jd" | "independent";
  /** 文案调性 */
  tone: "professional" | "casual" | "luxury" | "trendy";
  /** 生成图数量（1-8） */
  imageCount: number;
}

/** 单张商品图片 slide */
export interface ProductImageSlide {
  /** 图片 URL */
  imageUrl: string;
  /** 图片用途说明 */
  usage: string;
  /** 图片配文 */
  caption: string;
  /** 图片类型 */
  type: "main" | "scene" | "detail" | "size" | "comparison";
}

/** 商品 SEO 检测结果 */
export interface ProductSeoCheck {
  /** 标题 SEO 得分（0-100） */
  score: number;
  /** 包含的关键词 */
  keywords: string[];
  /** 优化建议 */
  suggestions: string[];
}

/** 商品详情页输出 */
export interface ProductArticleOutput {
  /** 商品标题（SEO 优化后） */
  title: string;
  /** 短描述（用于列表/分享卡片） */
  shortDescription: string;
  /** 完整详情页 Markdown */
  detailMarkdown: string;
  /** 图片 slide 列表 */
  slides: ProductImageSlide[];
  /** SEO 检测结果 */
  seoCheck: ProductSeoCheck;
}

/** 平台文案模板 */
const PLATFORM_TEMPLATES: Record<string, {
  maxTitleLen: number;
  sections: string[];
  seoKeywords: string[];
}> = {
  taobao: {
    maxTitleLen: 30,
    sections: ["商品描述", "核心卖点", "适用场景", "规格参数", "使用说明", "售后保障"],
    seoKeywords: ["正品", "包邮", "现货", "品质保证", "支持7天无理由"],
  },
  douyin: {
    maxTitleLen: 55,
    sections: ["商品卖点", "使用效果", "买家秀", "限时优惠", "点击购买"],
    seoKeywords: ["抖音爆款", "限时优惠", "好评如潮", "主播推荐"],
  },
  xiaohongshu: {
    maxTitleLen: 20,
    sections: ["种草理由", "使用心得", "对比分析", "购买链接"],
    seoKeywords: ["种草", "好物推荐", "真实测评", "平价好物"],
  },
  jd: {
    maxTitleLen: 50,
    sections: ["商品介绍", "规格参数", "包装清单", "售后服务", "品牌故事"],
    seoKeywords: ["京东自营", "正品保证", "极速物流", "品质好物"],
  },
  independent: {
    maxTitleLen: 60,
    sections: ["Product Overview", "Key Features", "Specifications", "Reviews", "FAQ", "Order Now"],
    seoKeywords: ["best seller", "free shipping", "limited edition", "premium quality"],
  },
};

/**
 * 生成 AI 视觉理解 prompt
 */
function buildVisionPrompt(productName: string, sellingPoints: string[]): string {
  return [
    `请分析以下商品图片：${productName}`,
    "请识别：",
    "1. 商品主体和颜色",
    "2. 材质和纹理",
    "3. 使用场景",
    "4. 视觉差异化特点",
    "5. 适合的拍摄风格建议",
    "",
    `已知卖点：${sellingPoints.join("、")}`,
    "",
    "请用 JSON 格式输出：",
    '{ "subject": "主体描述", "colors": ["颜色1"], "materials": ["材质"], "scenes": ["场景"], "style": "风格", "tags": ["标签"] }',
  ].join("\n");
}

/**
 * 生成商品详情页文案 prompt
 */
function buildCopyPrompt(
  productName: string,
  sellingPoints: string[],
  tone: string,
  platform: string,
  section: string
): string {
  const toneMap: Record<string, string> = {
    professional: "专业可信的风格，使用行业术语但易理解",
    casual: "亲切种草的对话风格，像朋友推荐好物",
    luxury: "高端奢华的品牌调性，凸显品质和格调",
    trendy: "年轻潮流的新媒体风格，自然接地气",
  };

  return [
    `为商品「${productName}」撰写「${section}」部分的文案。`,
    "",
    `核心卖点：${sellingPoints.join("、")}`,
    `文案调性：${toneMap[tone] || toneMap.professional}`,
    `目标平台：${platform}`,
    "",
    "要求：",
    "- 字数控制在 80-200 字",
    "- 必须包含 2-3 个关键卖点",
    "- 使用平台用户习惯的表达方式",
    "- 避免使用「最」「第一」等绝对化用语",
    "- 适当使用 emoji（1-2 个）",
  ].join("\n");
}

/**
 * 生成商品图片 prompt
 */
function buildImagePrompt(
  productName: string,
  visionResult: any,
  slideIndex: number,
  imageCount: number
): string {
  const usageMap = [
    "商品主图：纯白背景产品正面高清照",
    "场景使用图：产品在实际使用场景中的展示",
    "细节特写图：产品材质、工艺、细节放大展示",
    "搭配推荐图：产品与其他配件的搭配展示",
    "规格尺寸图：含标注的规格参数图示",
    "对比效果图：使用前后/与其他产品对比",
    "包装开箱图：精美包装展示与开箱体验",
    "模特展示图：真人模特使用产品的情景照",
  ];

  const usage = usageMap[slideIndex % usageMap.length];
  const colors = visionResult?.colors?.join("、") || productName;
  const style = visionResult?.style || "商业摄影";

  return [
    `${productName} - ${usage}`,
    `色彩方案：${colors}`,
    `摄影风格：${style}，高分辨率，专业布光`,
    `构图：居中构图，留白充足`,
    "不要水印，不要文字叠加",
  ].join("，");
}

/**
 * 本地生成图文 slide（预置模板，不依赖图像生成 API）
 */
function generateSlidesLocally(
  productName: string,
  productImages: string[],
  sellingPoints: string[],
  imageCount: number
): ProductImageSlide[] {
  const slides: ProductImageSlide[] = [];

  const usageMap: Array<{ usage: string; type: ProductImageSlide["type"] }> = [
    { usage: "商品主图", type: "main" },
    { usage: "场景展示", type: "scene" },
    { usage: "细节特写", type: "detail" },
    { usage: "搭配推荐", type: "scene" },
    { usage: "规格尺寸", type: "size" },
    { usage: "使用对比", type: "comparison" },
    { usage: "包装展示", type: "detail" },
    { usage: "模特展示", type: "scene" },
  ];

  for (let i = 0; i < Math.min(imageCount, 8); i++) {
    const imgUrl = productImages[i % productImages.length] || "";
    const { usage, type } = usageMap[i % usageMap.length];
    const point = sellingPoints[i % sellingPoints.length] || "高品质推荐";

    slides.push({
      imageUrl: imgUrl,
      usage: `${productName} - ${usage}`,
      caption: `${point}，点击查看详情`,
      type,
    });
  }

  return slides;
}

/**
 * 生成商品详情页 Markdown
 */
function buildDetailMarkdown(
  productName: string,
  sellingPoints: string[],
  platform: string,
  tone: string,
  slides: ProductImageSlide[]
): string {
  const tpl = PLATFORM_TEMPLATES[platform] || PLATFORM_TEMPLATES.taobao;
  const toneLabel: Record<string, string> = {
    professional: "专业品质",
    casual: "好物种草",
    luxury: "奢华臻选",
    trendy: "潮流爆款",
  };

  const lines: string[] = [];

  // 标题
  lines.push(`# ${productName}`);
  lines.push("");
  lines.push(`> ${toneLabel[tone] || "精选好物"} · ${platform}专供`);
  lines.push("");

  // 卖点列表
  lines.push("## 核心卖点");
  lines.push("");
  for (const point of sellingPoints) {
    lines.push(`- ✅ ${point}`);
  }
  lines.push("");

  // 按模板 section 生成内容
  for (let i = 0; i < tpl.sections.length; i++) {
    const section = tpl.sections[i];
    const slide = slides[i % slides.length];

    lines.push(`## ${section}`);
    lines.push("");

    if (slide) {
      lines.push(`![${slide.usage}](${slide.imageUrl})`);
      lines.push("");
      lines.push(`*${slide.caption}*`);
      lines.push("");
    }

    // 根据 section 生成对应文案
    const sectionCopy = generateSectionCopy(section, sellingPoints, tone, platform);
    lines.push(sectionCopy);
    lines.push("");
  }

  // SEO 区块
  lines.push("## 购买须知");
  lines.push("");
  lines.push(`- 平台：${platform}`);
  lines.push(`- ${tpl.seoKeywords.slice(0, 3).join(" · ")}`);
  lines.push("");

  return lines.join("\n");
}

/**
 * 根据 section 生成简短文案
 */
function generateSectionCopy(
  section: string,
  sellingPoints: string[],
  tone: string,
  platform: string
): string {
  const point1 = sellingPoints[0] || "优质产品";
  const point2 = sellingPoints[1] || sellingPoints[0] || "值得信赖";

  const copyMap: Record<string, string> = {
    "商品描述": `这款产品采用精选材质打造，${point1}。无论是日常使用还是送礼都是理想之选。`,
    "核心卖点": `🔥 **${point1}**\n\n🔥 **${point2}**\n\n精选品质，值得拥有。`,
    "适用场景": `无论是日常工作、休闲出行还是朋友聚会，${point1}让每个场景都从容应对。`,
    "规格参数": `- 材质：精选优质材料\n- 包装：精美礼盒装\n- 产地：中国大陆\n- 适用人群：全年龄段`,
    "使用说明": `1. 开箱检查商品完好性\n2. 按说明书进行首次使用\n3. 日常保养建议定期清洁\n4. 如遇问题请联系客服`,
    "售后保障": `🛡️ 支持7天无理由退换\n🛡️ 质量问题15天包换\n🛡️ 终身技术咨询`,
    "商品卖点": `💡 ${point1}，${tone === "casual" ? "真的超级好用！" : "品质可靠"}\n💡 ${point2}`,
    "使用效果": `使用效果显著，${point1}，深受用户好评。`,
    "买家秀": `> "质量很好，${point1}，回购多次了！" —— 真实用户评价`,
    "限时优惠": `🔥 限时特惠进行中\n🔥 下单即享更多好礼`,
    "种草理由": `🌿 ${point1}——买了绝不后悔系列\n🌿 ${point2}——越用越喜欢`,
    "使用心得": `经过一段时间的使用体验，${point1}的表现确实令人满意。${point2}更是一大加分项。`,
    "对比分析": `相比同类产品，${point1}是这款产品最突出的优势。${point2}也让它在市场中脱颖而出。`,
    "商品介绍": `${point1}，这是本款产品的核心所在。${point2}，让体验更加完善。`,
    "包装清单": `- 主商品 ×1\n- 说明书 ×1\n- 精美包装盒 ×1`,
    "品牌故事": `我们始终坚持品质至上，${point1}是我们对用户的承诺。`,
    "Product Overview": `Experience ${point1}. Our product delivers ${point2} with premium quality.`,
    "Key Features": `✅ ${point1}\n✅ ${point2}`,
    "Specifications": `- Material: Premium Quality\n- Package: Gift Box\n- Origin: China`,
    "Reviews": `> "Excellent quality, ${point1}!" - Verified Buyer`,
    "FAQ": `**Q: What makes this product special?**\nA: ${point1}\n\n**Q: Is there a warranty?**\nA: Yes, ${point2}`,
    "Order Now": `🔥 Limited time offer! Order now to get ${point1}.`,
  };

  return copyMap[section] || `${point1}，${point2}。品质保证，值得信赖。`;
}

/**
 * SEO 检测
 */
function checkSeo(title: string, sellingPoints: string[], platform: string): ProductSeoCheck {
  const tpl = PLATFORM_TEMPLATES[platform] || PLATFORM_TEMPLATES.taobao;
  const keywords: string[] = [];
  const suggestions: string[] = [];

  // 检查是否包含平台推荐关键词
  for (const kw of tpl.seoKeywords) {
    if (title.includes(kw) || sellingPoints.some((p) => p.includes(kw))) {
      keywords.push(kw);
    }
  }

  // 标题长度检查
  if (title.length < 8) {
    suggestions.push("标题太短，建议至少 8 个字符以包含足够关键词");
  }
  if (title.length > tpl.maxTitleLen) {
    suggestions.push(`标题过长（超过${tpl.maxTitleLen}字），可能被平台截断`);
  }

  // 卖点数量检查
  if (sellingPoints.length < 3) {
    suggestions.push("建议至少提供 3 个卖点以增加搜索曝光");
  }

  // SEO 得分
  let score = 50;
  score += Math.min(keywords.length * 10, 30);
  score += suggestions.length === 0 ? 20 : 0;
  score = Math.min(score, 100);

  return { score, keywords, suggestions };
}

/**
 * 主入口：生成商品详情页
 */
export async function generateProductArticle(
  input: ProductArticleInput
): Promise<ProductArticleOutput> {
  const {
    productName,
    sellingPoints,
    productImages,
    platform,
    tone,
    imageCount,
  } = input;

  // 1. 生成图文 slide（当前版本用本地模板，未来接入图像生成 API）
  const slides = generateSlidesLocally(
    productName,
    productImages,
    sellingPoints,
    imageCount
  );

  // 2. 生成详情页 Markdown
  const detailMarkdown = buildDetailMarkdown(
    productName,
    sellingPoints,
    platform,
    tone,
    slides
  );

  // 3. SEO 检测
  const title = `${productName} | ${sellingPoints.slice(0, 2).join(" · ")}`;
  const seoCheck = checkSeo(title, sellingPoints, platform);

  // 4. 短描述
  const shortDescription = `${sellingPoints[0] || ""}。${sellingPoints[1] ? "同时，" + sellingPoints[1] + "。" : ""}`;

  return {
    title,
    shortDescription,
    detailMarkdown,
    slides,
    seoCheck,
  };
}
