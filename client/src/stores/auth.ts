import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import apiClient from '@/services/api';

export interface UserProfile {
  _id: string;
  name: string;
  email: string;
  avatar?: string;
  phone?: string;
  wechatOpenid?: string;
  plan: 'free' | 'pro' | 'max' | 'team';
  membershipExpiresAt?: string;
  credits: number;
  role: 'user' | 'admin';
  provider: string;
  createdAt?: string;
}

export type AuthStatus = 'idle' | 'loading' | 'authenticated' | 'unauthenticated';

interface AuthState {
  // 状态
  user: UserProfile | null;
  status: AuthStatus;
  token: string | null;

  // Actions
  fetchProfile: () => Promise<void>;
  setUser: (user: UserProfile | null) => void;
  login: (token: string, user: UserProfile) => void;
  logout: () => void;
  isAuthenticated: () => boolean;
  isAdmin: () => boolean;
  hasPlan: (plan: string) => boolean;
  isPlanExpired: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      status: 'idle',
      token: null,

      fetchProfile: async () => {
        const token = localStorage.getItem('token');
        if (!token) {
          set({ user: null, status: 'unauthenticated', token: null });
          return;
        }

        set({ status: 'loading', token });
        try {
          const res: any = await apiClient.get('/auth/profile');
          if (res?.data) {
            const user = res.data as UserProfile;
            set({ user, status: 'authenticated' });
            localStorage.setItem('user', JSON.stringify(user));
          } else if (res?.user) {
            const user = res.user as UserProfile;
            set({ user, status: 'authenticated' });
            localStorage.setItem('user', JSON.stringify(user));
          }
        } catch {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          set({ user: null, status: 'unauthenticated', token: null });
        }
      },

      setUser: (user) => {
        set({ user, status: user ? 'authenticated' : 'unauthenticated' });
        if (user) {
          localStorage.setItem('user', JSON.stringify(user));
        } else {
          localStorage.removeItem('user');
        }
      },

      login: (token, user) => {
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(user));
        set({ user, token, status: 'authenticated' });
      },

      logout: () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        set({ user: null, token: null, status: 'unauthenticated' });
      },

      isAuthenticated: () => {
        const state = get();
        return state.status === 'authenticated' && !!state.user;
      },

      isAdmin: () => {
        const state = get();
        return state.user?.role === 'admin';
      },

      hasPlan: (plan: string) => {
        const state = get();
        if (!state.user) return false;
        const plans = ['free', 'pro', 'max', 'team'];
        const userIdx = plans.indexOf(state.user.plan);
        const targetIdx = plans.indexOf(plan);
        return userIdx >= targetIdx;
      },

      isPlanExpired: () => {
        const state = get();
        if (!state.user?.membershipExpiresAt) return false;
        return new Date(state.user.membershipExpiresAt) < new Date();
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        status: state.status,
      }),
    }
  )
);
