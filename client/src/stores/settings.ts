import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface UserPreferences {
  // 语言
  locale: 'zh-CN' | 'en-US';
  // 默认 AI 模型
  defaultModel: string;
  // 默认聊天模式
  defaultChatMode: 'qa' | 'plan' | 'execute';
  // 消息通知
  notificationsEnabled: boolean;
  emailNotifications: boolean;
  // API 用量警告阈值 (百分比，默认 80)
  usageWarningThreshold: number;
  // 自动保存对话
  autoSaveChat: boolean;
  // 代码高亮主题
  codeTheme: 'vs-dark' | 'vs-light' | 'monokai';
  // 字体大小
  fontSize: 'small' | 'medium' | 'large';
}

const DEFAULT_PREFERENCES: UserPreferences = {
  locale: 'zh-CN',
  defaultModel: 'agnes/agnes-2.0-flash',
  defaultChatMode: 'qa',
  notificationsEnabled: true,
  emailNotifications: false,
  usageWarningThreshold: 80,
  autoSaveChat: true,
  codeTheme: 'vs-dark',
  fontSize: 'medium',
};

interface SettingsState {
  preferences: UserPreferences;

  // Actions
  setPreferences: (prefs: Partial<UserPreferences>) => void;
  resetPreferences: () => void;
  getPreference: <K extends keyof UserPreferences>(key: K) => UserPreferences[K];
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      preferences: { ...DEFAULT_PREFERENCES },

      setPreferences: (prefs) =>
        set((s) => ({
          preferences: { ...s.preferences, ...prefs },
        })),

      resetPreferences: () => set({ preferences: { ...DEFAULT_PREFERENCES } }),

      getPreference: (key) => {
        return get().preferences[key];
      },
    }),
    {
      name: 'settings-storage',
    }
  )
);
