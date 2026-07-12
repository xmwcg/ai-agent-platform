/**
 * AIBAK / Reasonix 品牌设计 Token 体系 v2
 * 完整的亮色/暗色双主题，CSS 变量驱动，零运行时开销。
 * 涵盖：品牌色板、语义色、渐变、排版、间距、圆角、阴影、动效、Z-index
 */

// ─── 品牌色板（主色不变，主题双向） ───
export const BRAND = {
  primary: '#6c5ce7',
  primaryLight: '#a29bfe',
  primaryDark: '#5541d7',
  primaryBg: 'rgba(108,92,231,0.08)',
  secondary: '#00cec9',
  secondaryLight: '#55efc4',
  accent: '#fdcb6e',
  success: '#00b894',
  warning: '#fdcb6e',
  danger: '#e17055',
  info: '#6c5ce7',
} as const;

// ─── 渐变体系 ───
export const GRADIENTS = {
  brand: 'linear-gradient(135deg, #6c5ce7 0%, #a29bfe 50%, #81ecec 100%)',
  brandWarm: 'linear-gradient(135deg, #6c5ce7 0%, #fd79a8 100%)',
  brandCool: 'linear-gradient(135deg, #6c5ce7 0%, #00cec9 100%)',
  success: 'linear-gradient(135deg, #00b894 0%, #55efc4 100%)',
  warning: 'linear-gradient(135deg, #fdcb6e 0%, #e17055 100%)',
  dark: 'linear-gradient(180deg, #0c0e1a 0%, #1a1d35 100%)',
  glass: 'linear-gradient(135deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.04) 100%)',
} as const;

// ─── 双主题配色（亮/暗） ───
export const THEME_COLORS = {
  light: {
    bgBase: '#f8f9fc',
    bgContainer: '#ffffff',
    bgElevated: '#ffffff',
    bgLayout: '#f0f2f8',
    bgSidebar: '#ffffff',
    bgSidebarHover: '#f5f3ff',
    textPrimary: '#1a1d35',
    textSecondary: '#5a6170',
    textTertiary: '#9ca3af',
    textInverse: '#ffffff',
    border: '#e8ecf2',
    borderLight: '#f1f4f9',
    shadow: 'rgba(108, 92, 231, 0.06)',
  },
  dark: {
    bgBase: '#0c0e1a',
    bgContainer: '#141727',
    bgElevated: '#1a1d35',
    bgLayout: '#0a0c18',
    bgSidebar: '#0c0e1a',
    bgSidebarHover: 'rgba(108,92,231,0.12)',
    textPrimary: '#e8ecf2',
    textSecondary: '#9ca3af',
    textTertiary: '#6b7280',
    textInverse: '#0c0e1a',
    border: '#1f2340',
    borderLight: '#181b30',
    shadow: 'rgba(0,0,0,0.3)',
  },
} as const;

// ─── 排版体系 ───
export const TYPOGRAPHY = {
  fontFamily: "'Inter', 'PingFang SC', 'HarmonyOS Sans', 'Microsoft YaHei', -apple-system, sans-serif",
  fontFamilyMono: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
  fontSize: {
    caption: '0.6875rem',  // 11px
    xs: '0.75rem',         // 12px
    sm: '0.8125rem',       // 13px
    base: '0.875rem',      // 14px
    md: '0.9375rem',       // 15px
    lg: '1rem',            // 16px
    xl: '1.125rem',        // 18px
    '2xl': '1.25rem',      // 20px
    '3xl': '1.5rem',       // 24px
    '4xl': '1.875rem',     // 30px
    '5xl': '2.25rem',      // 36px
  },
  fontWeight: { normal: 400, medium: 500, semibold: 600, bold: 700, extrabold: 800 },
  lineHeight: { tight: 1.25, normal: 1.5, relaxed: 1.75 },
  letterSpacing: { tight: '-0.02em', normal: '0', wide: '0.02em' },
} as const;

// ─── 间距体系（基于 4px） ───
export const SPACING = {
  xxs: 2, xs: 4, sm: 8, md: 12, lg: 16, xl: 20, '2xl': 24, '3xl': 32, '4xl': 40, '5xl': 48, '6xl': 64, '7xl': 80,
} as const;

// ─── 圆角体系 ───
export const RADIUS = {
  xs: 4, sm: 6, md: 8, lg: 12, xl: 16, '2xl': 20, '3xl': 24, full: 9999,
} as const;

// ─── 阴影体系 ───
export const SHADOWS = {
  xs: '0 1px 2px var(--shadow-color, rgba(0,0,0,0.04))',
  sm: '0 1px 3px var(--shadow-color, rgba(0,0,0,0.06)), 0 1px 2px var(--shadow-color, rgba(0,0,0,0.04))',
  md: '0 4px 6px var(--shadow-color, rgba(0,0,0,0.07)), 0 2px 4px var(--shadow-color, rgba(0,0,0,0.04))',
  lg: '0 10px 15px var(--shadow-color, rgba(0,0,0,0.08)), 0 4px 6px var(--shadow-color, rgba(0,0,0,0.04))',
  xl: '0 20px 25px var(--shadow-color, rgba(0,0,0,0.10)), 0 8px 10px var(--shadow-color, rgba(0,0,0,0.04))',
  glow: '0 0 20px rgba(108,92,231,0.15)',
  glowLg: '0 0 40px rgba(108,92,231,0.25)',
  card: '0 0 0 1px rgba(108,92,231,0.06), 0 1px 3px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.03)',
  cardHover: '0 0 0 1px rgba(108,92,231,0.12), 0 8px 24px rgba(0,0,0,0.08)',
} as const;

// ─── 动效体系 ───
export const MOTION = {
  fast: '0.15s cubic-bezier(0.4, 0, 0.2, 1)',
  normal: '0.25s cubic-bezier(0.4, 0, 0.2, 1)',
  slow: '0.4s cubic-bezier(0.4, 0, 0.2, 1)',
  spring: '0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
  pageEnter: '0.35s cubic-bezier(0.4, 0, 0.2, 1)',
  pageExit: '0.2s cubic-bezier(0.4, 0, 1, 1)',
} as const;

// ─── Z-index 层级 ───
export const Z_INDEX = {
  base: 1,
  dropdown: 1000,
  sticky: 1020,
  fixed: 1030,
  modalBackdrop: 1040,
  modal: 1050,
  popover: 1060,
  tooltip: 1070,
  toast: 1080,
} as const;

// ─── 布局常量 ───
export const LAYOUT = {
  sidebarWidth: 240,
  sidebarCollapsedWidth: 72,
  headerHeight: 56,
  mobileHeaderHeight: 48,
  mobileTabBarHeight: 56,
  contentMaxWidth: 1280,
  mobileBreakpoint: 768,
  tabletBreakpoint: 1024,
  desktopBreakpoint: 1280,
} as const;

// ─── Ant Design 主题覆盖（双主题） ───
export const antdLightTheme = {
  token: {
    colorPrimary: BRAND.primary,
    colorPrimaryHover: BRAND.primaryLight,
    colorPrimaryActive: BRAND.primaryDark,
    colorSuccess: BRAND.success,
    colorWarning: BRAND.warning,
    colorError: BRAND.danger,
    colorInfo: BRAND.info,
    colorLink: BRAND.primary,
    borderRadius: RADIUS.md,
    fontFamily: TYPOGRAPHY.fontFamily,
    colorBgContainer: '#ffffff',
    colorBgElevated: '#ffffff',
    colorBgLayout: '#f8f9fc',
    colorText: THEME_COLORS.light.textPrimary,
    colorTextSecondary: THEME_COLORS.light.textSecondary,
    colorTextTertiary: THEME_COLORS.light.textTertiary,
    colorBorder: THEME_COLORS.light.border,
    colorBorderSecondary: THEME_COLORS.light.borderLight,
    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
    boxShadowSecondary: '0 4px 12px rgba(0,0,0,0.06)',
    motionDurationMid: '0.2s',
    motionEaseInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
    fontSize: 14,
    fontSizeHeading1: 30,
    fontSizeHeading2: 24,
    fontSizeHeading3: 20,
    fontSizeHeading4: 16,
    fontSizeHeading5: 14,
    lineHeight: 1.5714,
    controlHeight: 36,
    controlHeightLG: 42,
    controlHeightSM: 30,
    wireframe: false,
  },
  components: {
    Button: {
      borderRadius: RADIUS.md,
      controlHeight: 36,
      controlHeightLG: 42,
      controlHeightSM: 30,
      fontWeight: TYPOGRAPHY.fontWeight.medium,
    },
    Card: {
      borderRadiusLG: RADIUS.lg,
      paddingLG: 20,
      boxShadow: '0 0 0 1px rgba(108,92,231,0.04), 0 1px 2px rgba(0,0,0,0.04)',
    },
    Input: {
      borderRadius: RADIUS.md,
      controlHeight: 38,
      activeShadow: '0 0 0 2px rgba(108,92,231,0.12)',
    },
    Tag: { borderRadiusSM: RADIUS.sm },
    Menu: {
      itemBorderRadius: RADIUS.md,
      itemMarginInline: 8,
    },
    Layout: {
      siderBg: '#ffffff',
      triggerBg: 'transparent',
      triggerColor: THEME_COLORS.light.textSecondary,
    },
    Segmented: {
      trackBg: '#f1f4f9',
    },
  },
} as const;

export const antdDarkTheme = {
  token: {
    ...antdLightTheme.token,
    colorBgContainer: '#141727',
    colorBgElevated: '#1a1d35',
    colorBgLayout: '#0a0c18',
    colorText: THEME_COLORS.dark.textPrimary,
    colorTextSecondary: THEME_COLORS.dark.textSecondary,
    colorTextTertiary: THEME_COLORS.dark.textTertiary,
    colorBorder: THEME_COLORS.dark.border,
    colorBorderSecondary: THEME_COLORS.dark.borderLight,
    boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
    boxShadowSecondary: '0 4px 12px rgba(0,0,0,0.3)',
  },
  components: {
    ...antdLightTheme.components,
    Card: {
      ...antdLightTheme.components.Card,
      boxShadow: '0 0 0 1px rgba(108,92,231,0.08), 0 1px 2px rgba(0,0,0,0.2)',
    },
    Layout: {
      ...antdLightTheme.components.Layout,
      siderBg: '#0c0e1a',
    },
    Segmented: {
      trackBg: '#1a1d35',
    },
  },
} as const;
