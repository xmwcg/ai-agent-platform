/**
 * 响应式工具 Hook
 * 基于 UI Store 的视口状态提供便捷的响应式查询方法
 */
import { useUIStore } from '@/stores/ui';

/**
 * 响应式断点常量
 */
export const BREAKPOINTS = {
  mobile: 768,
  tablet: 1024,
  desktop: 1280,
  wide: 1600,
} as const;

/**
 * 响应式 Hook — 从全局 UI Store 读取视口状态
 */
export function useResponsive() {
  const isMobile = useUIStore((s) => s.isMobile);
  const isTablet = useUIStore((s) => s.isTablet);
  const isDesktop = useUIStore((s) => s.isDesktop);
  const viewportWidth = useUIStore((s) => s.viewportWidth);

  return {
    isMobile,
    isTablet,
    isDesktop,
    viewportWidth,
    isSmallScreen: isMobile || isTablet,
    isLargeScreen: isDesktop,
    gt: (breakpoint: number) => viewportWidth > breakpoint,
    lt: (breakpoint: number) => viewportWidth < breakpoint,
  };
}

/**
 * 根据断点返回不同值（类似 CSS clamp 但用 JS）
 * 注意：所有 hooks 必须先执行，不能条件返回
 */
export function useBreakpointValue<T>(values: {
  mobile?: T;
  tablet?: T;
  desktop?: T;
  default: T;
}): T {
  const { isMobile, isTablet } = useResponsive();
  // 先计算所有可能值，最后返回 — 避免 hooks 顺序变化导致 React #310
  let result: T = values.default;
  if (isMobile && values.mobile !== undefined) result = values.mobile;
  else if (isTablet && values.tablet !== undefined) result = values.tablet;
  else if (values.desktop !== undefined) result = values.desktop;
  return result;
}

/**
 * 响应式间距工具
 */
export function useResponsiveSpacing() {
  const { isMobile } = useResponsive();
  return {
    pagePadding: isMobile ? 8 : 16,
    cardPadding: isMobile ? 16 : 24,
    gutter: isMobile ? 8 : 16,
    fontSize: {
      title: isMobile ? 18 : 24,
      subtitle: isMobile ? 14 : 16,
      body: isMobile ? 13 : 14,
    },
  };
}