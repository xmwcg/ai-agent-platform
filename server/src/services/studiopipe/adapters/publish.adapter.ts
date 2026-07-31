/**
 * 多平台发布调度适配器
 * ----------------------------------------------------------------
 * 将 Studio 生成的视频/图文分发到各大短视频/电商平台。
 *
 * 当前版本采用「系统剪贴板 + 跳转平台」的方式来引导用户一键发布：
 * - 将标题和话题标签写入剪贴板
 * - 返回各平台的发布入口 URL
 * - 用户在浏览器中手动粘贴标题并上传视频
 *
 * 未来版本可扩展：
 * - Cookie 注入自动登录
 * - Selenium/Puppeteer 模拟表单填写
 * - 平台 API 直连（抖音开放平台 / 小红书开放平台等）
 */

/** 支持的发布平台 */
export type PublishPlatform = "douyin" | "xiaohongshu" | "kuaishou" | "bilibili" | "weibo";

/** 发布调度输入 */
export interface PublishDispatchInput {
  /** 视频/图文素材 URL */
  videoUrl: string;
  /** 标题文案 */
  title: string;
  /** 目标平台列表 */
  platforms: PublishPlatform[];
  /** 话题标签 */
  tags: string[];
}

/** 单个平台的发布入口 */
export interface PlatformEntry {
  platform: PublishPlatform;
  /** 平台中文名 */
  name: string;
  /** 发布页 URL（桌面端） */
  publishUrl: string;
  /** 预填文案格式说明 */
  copyTemplate: string;
  /** 平台特有的发布提示 */
  tips: string;
  /** 是否需要登录 */
  requiresAuth: boolean;
  /** 是否支持桌面端发布 */
  desktopReady: boolean;
  /** 图标 emoji */
  icon: string;
}

/** 发布调度结果 */
export interface PublishDispatchResult {
  /** 剪贴板内容（标题 + 标签 + 发布文案模板） */
  clipboardContent: string;
  /** 各平台发布入口 */
  entries: PlatformEntry[];
  /** 发布操作说明 */
  guide: string;
}

/** 平台发布入口配置 */
const PLATFORM_ENTRIES: Record<PublishPlatform, Omit<PlatformEntry, "platform">> = {
  douyin: {
    name: "抖音",
    publishUrl: "https://creator.douyin.com/creator-micro/content/upload",
    copyTemplate: "{title}\n\n{tags}",
    tips: "建议在手机端发布，桌面端需登录创作者平台，视频规格 9:16 竖屏",
    requiresAuth: true,
    desktopReady: true,
    icon: "🎵",
  },
  xiaohongshu: {
    name: "小红书",
    publishUrl: "https://creator.xiaohongshu.com/publish/publish",
    copyTemplate: "{title}\n\n{tags}",
    tips: "小红书桌面端支持图文和视频发布，建议添加人设化文案",
    requiresAuth: true,
    desktopReady: true,
    icon: "📕",
  },
  kuaishou: {
    name: "快手",
    publishUrl: "https://cp.kuaishou.com/article/publish/video",
    copyTemplate: "{title} {tags}",
    tips: "快手创作者中心支持桌面端上传，建议竖屏 9:16 视频",
    requiresAuth: true,
    desktopReady: true,
    icon: "⚡",
  },
  bilibili: {
    name: "B站",
    publishUrl: "https://member.bilibili.com/platform/upload/video/frame",
    copyTemplate: "{title}\n\n{tags}",
    tips: "B站投稿支持 16:9 横屏视频效果更佳，建议添加分P和合集",
    requiresAuth: true,
    desktopReady: true,
    icon: "📺",
  },
  weibo: {
    name: "微博",
    publishUrl: "https://weibo.com/",
    copyTemplate: "{title} {tags}",
    tips: "微博建议搭配 2-3 张预览图，纯视频发布推荐用秒拍",
    requiresAuth: true,
    desktopReady: true,
    icon: "🔵",
  },
};

/**
 * 构建发布剪贴板内容
 */
function buildClipboardContent(title: string, tags: string[]): string {
  const tagStr = tags.length > 0 ? tags.join(" ") : "";
  const separator = "━━━━━━━━━━━━━━━━━━";
  return [
    title,
    "",
    tagStr,
    "",
    separator,
    "📋 以上内容已复制到剪贴板",
    "请在各平台发布页面粘贴使用",
    separator,
  ].join("\n");
}

/**
 * 生成发布操作指南
 */
function buildGuide(platforms: PublishPlatform[]): string {
  if (platforms.length === 1) {
    return `点击「${PLATFORM_ENTRIES[platforms[0]].name}」发布入口，在新页面粘贴标题并上传视频即可`;
  }
  return `共 ${platforms.length} 个平台待发布，请逐一点击各平台入口完成发布。标题和标签已写入剪贴板，在新页面直接 Ctrl+V 粘贴`;
}

/**
 * 主入口：执行多平台发布调度
 *
 * @param input - 发布参数
 * @returns 发布入口列表 + 剪贴板内容
 */
export async function dispatchPublish(
  input: PublishDispatchInput
): Promise<PublishDispatchResult> {
  const { title, tags, platforms } = input;

  // 构建各平台入口
  const entries: PlatformEntry[] = platforms.map((p) => ({
    platform: p,
    ...PLATFORM_ENTRIES[p],
  }));

  // 构建剪贴板内容
  const clipboardContent = buildClipboardContent(title, tags);

  // 生成操作指南
  const guide = buildGuide(platforms);

  return {
    clipboardContent,
    entries,
    guide,
  };
}

/** 获取所有支持的发布平台列表 */
export function listPlatforms(): PlatformEntry[] {
  return Object.entries(PLATFORM_ENTRIES).map(([platform, entry]) => ({
    platform: platform as PublishPlatform,
    ...entry,
  }));
}
