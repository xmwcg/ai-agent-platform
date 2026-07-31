// ─── Zustand 全局状态管理 — 统一导出 ───
export { useAuthStore } from './auth';
export type { UserProfile, AuthStatus } from './auth';

export { useUIStore } from './ui';
export type { ThemeMode } from './ui';

export { usePaymentStore } from './payment';

export { useSettingsStore } from './settings';
export type { UserPreferences } from './settings';

export { useChatStore } from './chat';
export type { ChatMode, ChatMessage, ChatSession, UploadedFile } from './chat';
