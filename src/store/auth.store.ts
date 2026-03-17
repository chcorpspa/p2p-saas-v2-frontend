import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthState {
  token: string | null;
  refreshToken: string | null;
  tenant: { id: string; email: string; plan: string; isAdmin?: boolean } | null;
  setAuth: (token: string, tenant: { id: string; email: string; plan: string; isAdmin?: boolean }, refreshToken?: string | null) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      refreshToken: null,
      tenant: null,
      setAuth: (token, tenant, refreshToken) => {
        if (refreshToken && typeof window !== 'undefined') {
          document.cookie = `refresh_token=${refreshToken}; path=/; max-age=${30 * 24 * 3600}`;
        }
        set({ token, tenant, refreshToken: refreshToken ?? null });
      },
      logout: () => {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('token');
          document.cookie = 'token=; path=/; max-age=0';
          document.cookie = 'refresh_token=; path=/; max-age=0';
        }
        set({ token: null, tenant: null, refreshToken: null });
      },
    }),
    { name: 'auth-store' },
  ),
);
