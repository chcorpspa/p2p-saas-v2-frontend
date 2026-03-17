import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthState {
  token: string | null;
  tenant: { id: string; email: string; plan: string; isAdmin?: boolean } | null;
  setAuth: (token: string, tenant: { id: string; email: string; plan: string; isAdmin?: boolean }) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      tenant: null,
      setAuth: (token, tenant) => set({ token, tenant }),
      logout: () => {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('token');
          document.cookie = 'token=; path=/; max-age=0';
        }
        set({ token: null, tenant: null });
      },
    }),
    { name: 'auth-store' },
  ),
);
