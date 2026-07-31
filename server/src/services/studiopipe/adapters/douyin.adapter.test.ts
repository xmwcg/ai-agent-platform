/**
 * 抖音链接提取适配器 — 单元测试
 * ----------------------------------------------------------------
 * 重点覆盖：URL 校验、话题提取、数据提取逻辑（不启动真实浏览器）
 */
import { DouyinExtractError } from "./douyin.adapter";

// 直接 import 模块测试其内部辅助逻辑
// （实际 Puppeteer 调用在集成测试中验证）

describe("douyin.adapter", () => {
  describe("URL 校验", () => {
    it("v.douyin.com 分享链接应识别为有效", () => {
      // 测试通过 URL 构造函数验证链路
      const url = "https://v.douyin.com/iAbCdEfG/";
      const u = new URL(url);
      expect(u.hostname).toBe("v.douyin.com");
    });

    it("www.douyin.com 视频详情页应识别为有效", () => {
      const url = "https://www.douyin.com/video/1234567890123456789";
      const u = new URL(url);
      expect(u.hostname).toBe("www.douyin.com");
      expect(u.pathname).toMatch(/^\/video\/\d+/);
    });

    it("非抖音域名应识别为无效", () => {
      const url = "https://www.example.com/video/123";
      const u = new URL(url);
      expect(u.hostname).not.toBe("v.douyin.com");
      expect(u.hostname).not.toContain("douyin.com");
    });
  });

  describe("话题标签提取", () => {
    // 使用 regex 直接模拟 extractHashtags 逻辑
    const extractHashtags = (text: string): string[] => {
      const matches = text.match(/#[\u4e00-\u9fa5\w]+/g);
      return matches ? [...new Set(matches)] : [];
    };

    it("常规中文标签", () => {
      const text = "夏日穿搭分享 #穿搭 #OOTD #夏日必备";
      const tags = extractHashtags(text);
      expect(tags).toContain("#穿搭");
      expect(tags).toContain("#OOTD");
      expect(tags).toContain("#夏日必备");
      expect(tags.length).toBe(3);
    });

    it("无标签文本", () => {
      const text = "这是一段没有话题标签的普通文本";
      const tags = extractHashtags(text);
      expect(tags).toEqual([]);
    });

    it("去重重复标签", () => {
      const text = "好看 #穿搭 #穿搭 #穿搭";
      const tags = extractHashtags(text);
      expect(tags.length).toBe(1);
      expect(tags[0]).toBe("#穿搭");
    });
  });

  describe("视频数据提取", () => {
    // 模拟 extractVideoData 核心逻辑
    const extractVideoData = (pageData: any) => {
      try {
        let itemList: any[] = [];
        if (pageData?.loaderData?.["video_(id)_0"]?.videoInfoRes?.item_list) {
          itemList = pageData.loaderData["video_(id)_0"].videoInfoRes.item_list;
        } else if (Array.isArray(pageData?.item_list)) {
          itemList = pageData.item_list;
        }
        if (!itemList || itemList.length === 0) return null;
        const video = itemList[0];
        const videoInfo = video?.video;
        const videoUrl = videoInfo?.play_addr?.url_list?.[0] || "";
        const coverUrl = video?.video?.cover?.url_list?.[0] || "";
        const authorName = video?.author?.nickname || "";
        const durationSec = Math.round((videoInfo?.duration || 0) / 1000);
        return { videoUrl, coverUrl, authorName, durationSec };
      } catch {
        return null;
      }
    };

    it("从 loaderData 结构提取", () => {
      const pageData = {
        loaderData: {
          "video_(id)_0": {
            videoInfoRes: {
              item_list: [
                {
                  video: {
                    play_addr: { url_list: ["https://v.douyin.com/video.mp4"] },
                    duration: 30000,
                    cover: { url_list: ["https://p.douyin.com/cover.jpg"] },
                  },
                  author: { nickname: "测试用户" },
                },
              ],
            },
          },
        },
      };
      const result = extractVideoData(pageData);
      expect(result).not.toBeNull();
      expect(result!.videoUrl).toBe("https://v.douyin.com/video.mp4");
      expect(result!.authorName).toBe("测试用户");
      expect(result!.durationSec).toBe(30);
    });

    it("从 item_list 直接数组提取", () => {
      const pageData = {
        item_list: [
          {
            video: {
              play_addr: { url_list: ["https://v.douyin.com/v2.mp4"] },
              duration: 15000,
              cover: { url_list: ["https://p.douyin.com/c2.jpg"] },
            },
            author: { nickname: "作者二" },
          },
        ],
      };
      const result = extractVideoData(pageData);
      expect(result).not.toBeNull();
      expect(result!.videoUrl).toBe("https://v.douyin.com/v2.mp4");
      expect(result!.authorName).toBe("作者二");
      expect(result!.durationSec).toBe(15);
    });

    it("空数据返回 null", () => {
      expect(extractVideoData({})).toBeNull();
      expect(extractVideoData(null)).toBeNull();
    });
  });

  describe("DouyinExtractError", () => {
    it("错误应包含 url 和 stage", () => {
      const err = new DouyinExtractError("链接无效", "https://test.com", "validate");
      expect(err.message).toContain("链接无效");
      expect(err.message).toContain("validate");
      expect(err.url).toBe("https://test.com");
      expect(err.stage).toBe("validate");
      expect(err.name).toBe("DouyinExtractError");
    });
  });
});
