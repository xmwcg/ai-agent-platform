/**
 * 多平台发布调度适配器 — 单元测试
 */
import { dispatchPublish, listPlatforms } from "./publish.adapter";

describe("publish.adapter", () => {
  describe("listPlatforms", () => {
    it("应返回 5 个支持的平台", () => {
      const platforms = listPlatforms();
      expect(platforms.length).toBe(5);
      const ids = platforms.map((p) => p.platform).sort();
      expect(ids).toEqual(["bilibili", "douyin", "kuaishou", "weibo", "xiaohongshu"]);
    });

    it("每个平台应有完整的入口属性", () => {
      const platforms = listPlatforms();
      for (const p of platforms) {
        expect(p.platform).toBeTruthy();
        expect(p.name).toBeTruthy();
        expect(p.publishUrl).toBeTruthy();
        expect(p.publishUrl).toMatch(/^https?:\/\//);
        expect(typeof p.requiresAuth).toBe("boolean");
        expect(typeof p.desktopReady).toBe("boolean");
        expect(p.icon).toBeTruthy();
        expect(p.tips).toBeTruthy();
      }
    });
  });

  describe("dispatchPublish", () => {
    it("单平台发布应返回正确的入口和剪贴板内容", async () => {
      const result = await dispatchPublish({
        videoUrl: "https://cdn.example.com/video.mp4",
        title: "测试视频标题",
        platforms: ["douyin"],
        tags: ["#测试", "#短视频"],
      });

      expect(result.entries.length).toBe(1);
      expect(result.entries[0].platform).toBe("douyin");
      expect(result.entries[0].name).toBe("抖音");
      expect(result.clipboardContent).toContain("测试视频标题");
      expect(result.clipboardContent).toContain("#测试");
      expect(result.clipboardContent).toContain("#短视频");
      expect(result.guide).toContain("抖音");
    });

    it("多平台发布应返回所有平台的入口", async () => {
      const result = await dispatchPublish({
        videoUrl: "https://cdn.example.com/video.mp4",
        title: "多平台测试",
        platforms: ["douyin", "xiaohongshu", "bilibili"],
        tags: ["#多平台"],
      });

      expect(result.entries.length).toBe(3);
      expect(result.entries.map((e) => e.platform).sort()).toEqual([
        "bilibili",
        "douyin",
        "xiaohongshu",
      ]);
      expect(result.guide).toContain("3 个平台");
    });

    it("无标签时应正常工作", async () => {
      const result = await dispatchPublish({
        videoUrl: "https://cdn.example.com/video.mp4",
        title: "无标签标题",
        platforms: ["douyin"],
        tags: [],
      });

      expect(result.clipboardContent).toContain("无标签标题");
      expect(result.entries.length).toBe(1);
    });

    it("剪贴板内容应包含发布提示", async () => {
      const result = await dispatchPublish({
        videoUrl: "https://cdn.example.com/video.mp4",
        title: "剪贴板测试",
        platforms: ["kuaishou"],
        tags: [],
      });

      expect(result.clipboardContent).toContain("已复制到剪贴板");
      expect(result.clipboardContent).toContain("粘贴使用");
    });
  });
});
