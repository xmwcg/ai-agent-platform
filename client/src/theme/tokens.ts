/**
 * AIBAK / Reasonix 品牌设计 Token 体系
 * 基于 Ant Design 5.x Design Token，扩展品牌色、字体、间距等专属变量。
 * 所有视觉常量集中管理，一键切换暗/亮模式。
 */

// ─── 品牌色板 ───
export const BRAND = {
  // 主色：深蓝紫科技感
  primary: '#6366f1',
  primaryLight: '#818cf8',
  primaryDark: '#4f46e5',
  // 辅助色
  secondary: '#8b5cf6',
  accent: '#06b6d4',
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
  info: '#3b82f6',
  // 渐变
  gradient: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #a78bfa 100%)',
  gradientWarm: 'linear-gradient(135deg, #6366f1 0%, #06b6d4 100%)',
  gradientSuccess: 'linear-gradient(135deg, #10b981 0%, #06b6d4 100%)',
} as const;

// ─── 语义色（暗/亮自适应） ───
export const COLORS = {
  // 背景层级
  bgBase: 'var(--color-bg-base, #f5f7fa)',
  bgContainer: 'var(--color-bg-container, #ffffff)',
  bgElevated: 'var(--color-bg-elevated, #ffffff)',
  bgLayout: 'var(--color-bg-layout, #f0f2f5)',
  // 文字层级
  textPrimary: 'var(--color-text-primary, #1e293b)',
  textSecondary: 'var(--color-text-secondary, #64748b)',
  textTertiary: 'var(--color-text-tertiary, #94a3b8)',
  textInverse: 'var(--color-text-inverse, #ffffff)',
  // 边框
  border: 'var(--color-border, #e2e8f0)',
  borderLight: 'var(--color-border-light, #f1f5f9)',
} as const;

// ─── 排版 ───
export const TYPOGRAPHY = {
  fontFamily: "'Inter', 'PingFang SC', 'Microsoft YaHei', -apple-system, sans-serif",
  fontFamilyMono: "'JetBrains Mono', 'Fira Code', monospace",
  // 字号层级
  fontSize: {
    xs: '0.75rem',    // 12px
    sm: '0.875rem',   // 14px
    base: '1rem',     // 16px
    lg: '1.125rem',   // 18px
    xl: '1.25rem',    // 20px
    '2xl': '1.5rem',  // 24px
    '3xl': '1.875rem',// 30px
    '4xl': '2.25rem', // 36px
  },
  fontWeight: {
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
    extrabold: 800,
  },
} as const;

// ─── 间距 ───
export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  '2xl': 48,
  '3xl': 64,
  '4xl': 96,
} as const;

// ─── 圆角 ───
export const RADIUS = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  full: 9999,
} as const;

// ─── 阴影 ───
export const SHADOWS = {
  sm: '0 1px 2px rgba(0,0,0,0.05)',
  md: '0 4px 12px rgba(0,0,0,0.08)',
  lg: '0 8px 24px rgba(0,0,0,0.12)',
  xl: '0 16px 48px rgba(0,0,0,0.16)',
  glow: `0 0 20px rgba(99, 102, 241, 0.15)`,
  glowLg: `0 0 40px rgba(99, 102, 241, 0.25)`,
} as const;

// ─── 动效 ───
export const MOTION = {
  fast: '0.15s ease',
  normal: '0.25s ease',
  slow: '0.45s ease',
  spring: '0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
} as const;

// ─── Ant Design 主题覆盖 ───
export const antdTheme = {
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
    colorBgContainer: COLORS.bgContainer,
    colorBgElevated: COLORS.bgElevated,
    colorText: COLORS.textPrimary,
    colorTextSecondary: COLORS.textSecondary,
    colorBorder: COLORS.border,
    boxShadow: SHADOWS.md,
    boxShadowSecondary: SHADOWS.sm,
    motionDurationMid: '0.25s',
    motionEaseInOut: 'cubic-bezier(0.645, 0.045, 0.355, 1)',
  },
  components: {
    Button: {
      borderRadius: RADIUS.md,
      controlHeight: 38,
      fontWeight: TYPOGRAPHY.fontWeight.medium,
    },
    Card: {
      borderRadiusLG: RADIUS.lg,
      paddingLG: SPACING.lg,
    },
    Input: {
      borderRadius: RADIUS.md,
      controlHeight: 40,
    },
    Tag: {
      borderRadiusSM: RADIUS.sm,
    },
  },
} as const;
