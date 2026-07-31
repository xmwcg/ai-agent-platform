/**
 * 混剪视频适配器 — 单元测试
 */
import { composeMixCut } from "./mixcut.adapter";

// Mock ffmpeg
jest.mock("./_util", () => ({
  execFileP: jest.fn().mockResolvedValue({
    stdout: JSON.stringify({
      streams: [{ width: 1920, height: 1080 }],
      format: { duration: "30.5" },
    }),
  }),
  tmpFile: jest.fn().mockImplementation((ext: string) => `/tmp/test_${Date.now()}.${ext}`),
  runFfmpeg: jest.fn().mockResolvedValue(undefined),
  uploadBuffer: jest.fn().mockResolvedValue("https://cdn.example.com/studio/output.mp4"),
}));

jest.mock("fs/promises", () => ({
  readFile: jest.fn().mockResolvedValue(Buffer.from("mock-video-data")),
  writeFile: jest.fn().mockResolvedValue(undefined),
}));

describe("mixcut.adapter", () => {
  const mockAssets = [
    "https://cdn.example.com/video1.mp4",
    "https://cdn.example.com/video2.mp4",
    "https://cdn.example.com/video3.mp4",
  ];

  it("基本混剪应返回正确的片段数量", async () => {
    const result = await composeMixCut({
      assets: mockAssets,
      targetDurationSec: 0,
      style: "fast",
    });

    expect(result.segments.length).toBe(3);
    expect(result.assetCount).toBe(3);
    expect(result.videoUrl).toBe("https://cdn.example.com/studio/output.mp4");
  });

  it("指定目标时长应生成足够片段", async () => {
    const result = await composeMixCut({
      assets: mockAssets,
      targetDurationSec: 30,
      style: "fast",
    });

    // fast 风格每段 2.5s，30s 需要 12 段
    expect(result.segments.length).toBe(12);
    expect(result.durationSec).toBe(30);
  });

  it("不同风格应有不同片段时长", async () => {
    const fast = await composeMixCut({ assets: [mockAssets[0]], targetDurationSec: 0, style: "fast" });
    const cinematic = await composeMixCut({ assets: [mockAssets[0]], targetDurationSec: 0, style: "cinematic" });

    expect(fast.segments[0].duration).toBeLessThan(cinematic.segments[0].duration);
  });

  it("无素材应抛错", async () => {
    await expect(
      composeMixCut({ assets: [], targetDurationSec: 0, style: "fast" })
    ).rejects.toThrow("至少 1 个素材");
  });
});
