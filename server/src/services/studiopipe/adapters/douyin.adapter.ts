/**
 * 抖音链接提取适配器
 * ----------------------------------------------------------------
 * 使用 Puppeteer 解析抖音分享链接，提取视频素材信息（无水印视频地址、
 * 标题、话题标签、作者信息等），供 NexMind Studio 短视频成片场景使用。
 *
 * 策略：
 * - 优先 Puppeteer headless 浏览器（模拟移动端 UA，绕过反爬）
 * - 降级：axios + cheerio（轻量但可能被限流）
 * - 所有提取操作带超时保护（默认 15s）
 */

import type { Browser } from "puppeteer";

/** 抖音链接提取结果 */
export interface DouyinExtractResult {
  /** 原始分享链接 */
  originalUrl: string;
  /** 解析后的完整链接 */
  resolvedUrl: string;
  /** 视频标题（含话题标签） */
  title: string;
  /** 提取的话题标签列表（如 ["#穿搭", "#夏日"]） */
  hashtags: string[];
  /** 无水印视频直链（有时效性，约 30 分钟） */
  videoUrl: string;
  /** 视频封面图 */
  coverUrl: string;
  /** 作者昵称 */
  authorName: string;
  /** 作者抖音号 */
  authorId: string;
  /** 点赞数（字符串，如 "1.2w"） */
  likeCount: string;
  /** 视频时长（秒） */
  durationSec: number;
}

/** 提取错误 */
export class DouyinExtractError extends Error {
  constructor(
    message: string,
    public readonly url: string,
    public readonly stage: string
  ) {
    super(`抖音提取失败[${stage}]: ${message}`);
    this.name = "DouyinExtractError";
  }
}

/**
 * 判断是否为有效的抖音分享链接
 */
function isValidDouyinUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return (
      u.hostname === "v.douyin.com" ||
      u.hostname.endsWith(".douyin.com") ||
      u.hostname === "www.iesdouyin.com" ||
      /douyin\.com\/video\/\d+/.test(url)
    );
  } catch {
    return false;
  }
}

/**
 * 从文本中提取话题标签
 */
function extractHashtags(text: string): string[] {
  const matches = text.match(/#[\u4e00-\u9fa5\w]+/g);
  return matches ? [...new Set(matches)] : [];
}

/**
 * 从页面 _ROUTER_DATA 中提取视频数据
 */
function extractVideoData(
  pageData: any
): Pick<
  DouyinExtractResult,
  "videoUrl" | "coverUrl" | "authorName" | "authorId" | "likeCount" | "durationSec"
> | null {
  try {
    let itemList: any[] = [];

    if (pageData?.loaderData?.["video_(id)_0"]?.videoInfoRes?.item_list) {
      itemList = pageData.loaderData["video_(id)_0"].videoInfoRes.item_list;
    } else if (pageData?.SSRTemplateRenderedData) {
      try {
        const ssr = JSON.parse(pageData.SSRTemplateRenderedData);
        itemList = ssr?.video?.videoInfoRes?.item_list || [];
      } catch { /* ignore */ }
    } else if (Array.isArray(pageData?.item_list)) {
      itemList = pageData.item_list;
    } else if (pageData?.item_list) {
      itemList = pageData.item_list;
    }

    if (!itemList || itemList.length === 0) return null;

    const video = itemList[0];
    const videoInfo = video?.video;

    const videoUrl =
      videoInfo?.play_addr?.url_list?.[2] ||
      videoInfo?.play_addr?.url_list?.[0] ||
      videoInfo?.download_addr?.url_list?.[2] ||
      videoInfo?.download_addr?.url_list?.[0] ||
      "";

    const coverUrl =
      video?.video?.dynamic_cover?.url_list?.[0] ||
      video?.video?.cover?.url_list?.[0] ||
      video?.video?.origin_cover?.url_list?.[0] ||
      "";

    const authorName = video?.author?.nickname || "";
    const authorId = video?.author?.unique_id || video?.author?.short_id || "";

    const likeCount = video?.statistics?.digg_count
      ? formatCount(video.statistics.digg_count)
      : "";

    const durationSec = Math.round((videoInfo?.duration || 0) / 1000);

    return { videoUrl, coverUrl, authorName, authorId, likeCount, durationSec };
  } catch {
    return null;
  }
}

function formatCount(n: number): string {
  if (n >= 10000) return (n / 10000).toFixed(1).replace(/\.0$/, "") + "w";
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "k";
  return String(n);
}

/**
 * 通过 Puppeteer 浏览器提取抖音视频信息
 */
async function extractWithPuppeteer(
  shareUrl: string
): Promise<DouyinExtractResult> {
  const puppeteer = await import("puppeteer");
  let browser: Browser | null = null;

  try {
    browser = await puppeteer.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-blink-features=AutomationControlled",
      ],
    });

    const page = await browser.newPage();

    await page.setUserAgent(
      "Mozilla/5.0 (Linux; Android 13; SM-S9080) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"
    );
    await page.setViewport({ width: 390, height: 844 });
    await page.setExtraHTTPHeaders({
      "Accept-Language": "zh-CN,zh;q=0.9",
    });

    // 拦截网络请求，捕获视频数据 API 响应
    let apiVideoData: any = null;
    await page.setRequestInterception(true);
    page.on("request", (req) => req.continue());
    page.on("response", async (resp) => {
      const url = resp.url();
      if (
        apiVideoData === null &&
        resp.ok() &&
        (url.includes("/aweme/v1/web/aweme/detail/") ||
          url.includes("/aweme/detail/"))
      ) {
        try {
          const json: any = await resp.json();
          if (json?.aweme_detail || json?.aweme_list) {
            apiVideoData = json;
          }
        } catch { /* ignore */ }
      }
    });

    await page.goto(shareUrl, {
      waitUntil: "networkidle0",
      timeout: 15000,
    });

    await new Promise((r) => setTimeout(r, 2000));

    const finalUrl = page.url();

    // 使用字符串版 evaluate 提取 DOM 数据（避免 Node.js target 下 document 类型冲突）
    const title = String(
      await page.evaluate(`
        (() => {
          const metaOg = document.querySelector('meta[property="og:title"]');
          if (metaOg) return metaOg.getAttribute('content') || '';
          return document.title || '';
        })()
      `)
    );

    const hashtags = extractHashtags(title);

    let pageData: any = null;
    try {
      const rawText = String(
        await page.evaluate(`
          (() => {
            var el = document.getElementById('RENDER_DATA');
            return el ? el.textContent : null;
          })()
        `)
      );
      if (rawText && rawText !== "null") {
        try {
          pageData = JSON.parse(decodeURIComponent(rawText));
        } catch { /* ignore */ }
      }
    } catch { /* ignore */ }

    const videoData = extractVideoData(
      apiVideoData?.aweme_detail
        ? { item_list: [apiVideoData.aweme_detail] }
        : pageData
    );

    if (!videoData || !videoData.videoUrl) {
      throw new DouyinExtractError(
        "未能从页面提取视频数据，链接可能已失效或为私密视频",
        shareUrl,
        "video-extract"
      );
    }

    const cleanVideoUrl = videoData.videoUrl.replace(/playwm\./g, "play.");

    return {
      originalUrl: shareUrl,
      resolvedUrl: finalUrl,
      title: title || "",
      hashtags,
      videoUrl: cleanVideoUrl,
      coverUrl: videoData.coverUrl,
      authorName: videoData.authorName,
      authorId: videoData.authorId,
      likeCount: videoData.likeCount,
      durationSec: videoData.durationSec || 0,
    };
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
  }
}

/**
 * 降级方法：axios + cheerio 轻量提取
 */
async function extractWithHttp(
  shareUrl: string
): Promise<Pick<DouyinExtractResult, "title" | "hashtags" | "resolvedUrl">> {
  const axios = (await import("axios")).default;

  const resp = await axios.get(shareUrl, {
    maxRedirects: 5,
    timeout: 10000,
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Linux; Android 13; SM-S9080) AppleWebKit/537.36",
      "Accept-Language": "zh-CN,zh;q=0.9",
    },
    validateStatus: () => true,
  });

  const html: string = resp.data;
  const finalUrl = resp.request?.res?.responseUrl || shareUrl;

  const titleMatch = html.match(
    /<meta[^>]+property="og:title"[^>]+content="([^"]*)"/
  );
  const title = titleMatch?.[1] || "";
  const hashtags = extractHashtags(title);

  return { title, hashtags, resolvedUrl: finalUrl };
}

/**
 * 主入口：提取抖音视频信息
 */
export async function extractDouyinVideo(
  shareUrl: string,
  usePuppeteer = true
): Promise<DouyinExtractResult> {
  if (!shareUrl || !isValidDouyinUrl(shareUrl)) {
    throw new DouyinExtractError(
      "请输入有效的抖音分享链接（如 https://v.douyin.com/xxxxx/）",
      shareUrl,
      "validate"
    );
  }

  if (usePuppeteer) {
    try {
      return await extractWithPuppeteer(shareUrl);
    } catch (err: any) {
      if (err instanceof DouyinExtractError) throw err;

      console.warn(
        `[douyin.adapter] Puppeteer 提取失败，降级到 HTTP: ${err.message}`
      );

      const httpResult = await extractWithHttp(shareUrl);
      return {
        ...httpResult,
        originalUrl: shareUrl,
        videoUrl: "",
        coverUrl: "",
        authorName: "",
        authorId: "",
        likeCount: "",
        durationSec: 0,
      };
    }
  }

  const httpResult = await extractWithHttp(shareUrl);
  return {
    ...httpResult,
    originalUrl: shareUrl,
    videoUrl: "",
    coverUrl: "",
    authorName: "",
    authorId: "",
    likeCount: "",
    durationSec: 0,
  };
}
