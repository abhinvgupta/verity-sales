import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { JwtPayload } from '@verity/shared';
import { decodeJwt } from '../lib/jwt';

interface AuthState {
  token: string | null;
  user: JwtPayload | null;
  setToken: (token: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      setToken: (token) => set({ token, user: decodeJwt(token) }),
      logout: () => set({ token: null, user: null }),
    }),
    {
      name: 'verity-auth',
      // Rehydrate user from the persisted token so it survives reloads.
      onRehydrateStorage: () => (state) => {
        if (state?.token) state.user = decodeJwt(state.token);
      },
    },
  ),
);
