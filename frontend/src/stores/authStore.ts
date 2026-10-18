import { create } from 'zustand';
import { login as apiLogin, loginTwoFactor, getMe, type UserData } from '@/lib/api';

export type User = UserData;

interface AuthState {
  token: string | null;
  user: User | null;
  isLoading: boolean;
  error: string | null;
  /** Resolves to a challenge token when the account requires a 2FA code. */
  login: (email: string, password: string) => Promise<{ challengeToken: string | null }>;
  verifyTwoFactor: (challengeToken: string, code: string) => Promise<void>;
  setUser: (user: User) => void;
  logout: () => void;
  checkAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => {
  const startSession = async (token: string) => {
    localStorage.setItem('token', token);
    set({ token });
    const user = await getMe();
    set({ user, isLoading: false });
  };

  const fail = (err: unknown, fallback: string) => {
    const message = err instanceof Error ? err.message : fallback;
    set({ error: message, isLoading: false });
    throw err;
  };

  return {
    token: localStorage.getItem('token'),
    user: null,
    isLoading: false,
    error: null,

    login: async (email, password) => {
      set({ isLoading: true, error: null });
      try {
        const data = await apiLogin(email, password);
        if (data.requires_2fa && data.challenge_token) {
          set({ isLoading: false });
          return { challengeToken: data.challenge_token };
        }
        await startSession(data.access_token!);
        return { challengeToken: null };
      } catch (err) {
        return fail(err, 'Login failed');
      }
    },

    verifyTwoFactor: async (challengeToken, code) => {
      set({ isLoading: true, error: null });
      try {
        const data = await loginTwoFactor(challengeToken, code);
        await startSession(data.access_token);
      } catch (err) {
        fail(err, 'Verification failed');
      }
    },

    setUser: (user) => set({ user }),

    logout: () => {
      localStorage.removeItem('token');
      set({ token: null, user: null });
    },

    checkAuth: async () => {
      const token = localStorage.getItem('token');
      if (!token) return;
      try {
        const user = await getMe();
        set({ token, user });
      } catch {
        localStorage.removeItem('token');
        set({ token: null, user: null });
      }
    },
  };
});
