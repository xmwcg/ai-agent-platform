import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ChatMode = 'qa' | 'plan' | 'execute';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  thinking?: string;
  timestamp: number;
  model?: string;
  mode?: ChatMode;
}

export interface ChatSession {
  id: string;
  title: string;
  mode: ChatMode;
  messages: ChatMessage[];
  model: string;
  createdAt: number;
  updatedAt: number;
  /** 智能体(Agent)系统提示词：创建时配置，对话时自动注入 */
  systemPrompt?: string;
  /** 智能体描述（可选） */
  description?: string;
}

export interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  progress: number;
  status: 'uploading' | 'done' | 'error';
  url?: string;
}

interface ChatState {
  sessions: ChatSession[];
  activeSessionId: string | null;
  mode: ChatMode;
  model: string;
  loading: boolean;
  files: UploadedFile[];
  rightPanelOpen: boolean;

  // 会话管理
  createSession: (init?: Partial<Pick<ChatSession, 'title' | 'mode' | 'model' | 'systemPrompt' | 'description'>>) => string;
  switchSession: (id: string) => void;
  deleteSession: (id: string) => void;
  renameSession: (id: string, title: string) => void;

  // 消息管理
  addMessage: (msg: Omit<ChatMessage, 'id' | 'timestamp'>) => void;
  updateMessage: (id: string, updates: Partial<ChatMessage>) => void;
  clearMessages: () => void;

  // 模式/模型切换
  setMode: (mode: ChatMode) => void;
  setModel: (model: string) => void;
  setLoading: (loading: boolean) => void;

  // 文件管理
  addFile: (file: UploadedFile) => void;
  updateFile: (id: string, updates: Partial<UploadedFile>) => void;
  removeFile: (id: string) => void;
  clearFiles: () => void;

  // UI 控制
  toggleRightPanel: () => void;

  // 获取活跃会话
  getActiveSession: () => ChatSession | undefined;
}

let msgCounter = 0;
function nextMsgId() { return `msg_${Date.now()}_${++msgCounter}`; }
function nextSessionId() { return `sess_${Date.now()}_${++msgCounter}`; }

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      sessions: [],
      activeSessionId: null,
      mode: 'qa',
      model: 'deepseek/deepseek-v4-flash',
      loading: false,
      files: [],
      rightPanelOpen: false,

      createSession: (init) => {
        const id = nextSessionId();
        const session: ChatSession = {
          id,
          title: init?.title ?? '新对话',
          mode: init?.mode ?? get().mode,
          messages: [],
          model: init?.model ?? get().model,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          systemPrompt: init?.systemPrompt,
          description: init?.description,
        };
        set((s) => ({
          sessions: [session, ...s.sessions],
          activeSessionId: id,
        }));
        return id;
      },

      switchSession: (id) => {
        const session = get().sessions.find((s) => s.id === id);
        if (session) {
          set({
            activeSessionId: id,
            mode: session.mode,
            model: session.model,
          });
        }
      },

      deleteSession: (id) => {
        set((s) => {
          const sessions = s.sessions.filter((ss) => ss.id !== id);
          const activeSessionId = s.activeSessionId === id
            ? (sessions[0]?.id || null)
            : s.activeSessionId;
          return { sessions, activeSessionId };
        });
      },

      renameSession: (id, title) => {
        set((s) => ({
          sessions: s.sessions.map((ss) =>
            ss.id === id ? { ...ss, title, updatedAt: Date.now() } : ss
          ),
        }));
      },

      addMessage: (msg) => {
        const message: ChatMessage = {
          ...msg,
          id: nextMsgId(),
          timestamp: Date.now(),
        };
        set((s) => ({
          sessions: s.sessions.map((ss) =>
            ss.id === s.activeSessionId
              ? {
                  ...ss,
                  messages: [...ss.messages, message],
                  updatedAt: Date.now(),
                  title: ss.messages.length === 0
                    ? msg.role === 'user' ? msg.content.slice(0, 30) : ss.title
                    : ss.title,
                }
              : ss
          ),
        }));
      },

      updateMessage: (id, updates) => {
        set((s) => ({
          sessions: s.sessions.map((ss) =>
            ss.id === s.activeSessionId
              ? {
                  ...ss,
                  messages: ss.messages.map((m) =>
                    m.id === id ? { ...m, ...updates } : m
                  ),
                }
              : ss
          ),
        }));
      },

      clearMessages: () => {
        set((s) => ({
          sessions: s.sessions.map((ss) =>
            ss.id === s.activeSessionId
              ? { ...ss, messages: [], title: '新对话' }
              : ss
          ),
        }));
      },

      setMode: (mode) => set({ mode }),
      setModel: (model) => set({ model }),
      setLoading: (loading) => set({ loading }),

      addFile: (file) => set((s) => ({ files: [...s.files, file] })),
      updateFile: (id, updates) =>
        set((s) => ({
          files: s.files.map((f) => (f.id === id ? { ...f, ...updates } : f)),
        })),
      removeFile: (id) => set((s) => ({ files: s.files.filter((f) => f.id !== id) })),
      clearFiles: () => set({ files: [] }),

      toggleRightPanel: () => set((s) => ({ rightPanelOpen: !s.rightPanelOpen })),

      getActiveSession: () => {
        const state = get();
        return state.sessions.find((s) => s.id === state.activeSessionId);
      },
    }),
    {
      name: 'ai-chat-storage',
      partialize: (state) => ({
        sessions: state.sessions.map((s) => ({
          ...s,
          messages: s.messages.slice(-50), // 最多保留 50 条消息
        })),
        activeSessionId: state.activeSessionId,
        mode: state.mode,
        model: state.model,
      }),
    }
  )
);
