import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ThemeMode = 'light' | 'dark';

interface UIState {
  // 侧边栏
  sidebarCollapsed: boolean;
  sidebarMobileOpen: boolean;

  // 主题
  themeMode: ThemeMode;

  // 响应式断点状态 (由 ResizeObserver 实时更新)
  isMobile: boolean;   // < 768px
  isTablet: boolean;   // 768-1024px
  isDesktop: boolean;  // >= 1025px
  viewportWidth: number;

  // 全局加载
  globalLoading: boolean;
  loadingText: string;

  // Actions
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setSidebarMobileOpen: (open: boolean) => void;
  toggleMobileSidebar: () => void;
  setThemeMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
  setViewport: (width: number) => void;
  setGlobalLoading: (loading: boolean, text?: string) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      sidebarMobileOpen: false,
      themeMode: 'light',
      isMobile: false,
      isTablet: false,
      isDesktop: true,
      viewportWidth: 1920,
      globalLoading: false,
      loadingText: '加载中...',

      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
      setSidebarMobileOpen: (open) => set({ sidebarMobileOpen: open }),
      toggleMobileSidebar: () => set((s) => ({ sidebarMobileOpen: !s.sidebarMobileOpen })),
      setThemeMode: (mode) => set({ themeMode: mode }),
      toggleTheme: () => set((s) => ({ themeMode: s.themeMode === 'light' ? 'dark' : 'light' })),
      setViewport: (width) =>
        set({
          viewportWidth: width,
          isMobile: width < 768,
          isTablet: width >= 768 && width < 1025,
          isDesktop: width >= 1025,
        }),
      setGlobalLoading: (loading, text = '加载中...') =>
        set({ globalLoading: loading, loadingText: text }),
    }),
    {
      name: 'ui-storage',
      partialize: (state) => ({
        sidebarCollapsed: state.sidebarCollapsed,
        themeMode: state.themeMode,
      }),
    }
  )
);
