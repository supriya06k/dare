import { create } from "zustand";
import { clearToken, setToken } from "../lib/api";

interface AuthState {
  token: string | null;
  userId: number | null;
  phone: string | null;
  isHydrated: boolean;
  setAuth: (token: string, userId: number, phone: string) => Promise<void>;
  logout: () => Promise<void>;
  hydrate: (token: string | null) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  userId: null,
  phone: null,
  isHydrated: false,

  setAuth: async (token, userId, phone) => {
    await setToken(token);
    set({ token, userId, phone });
  },

  logout: async () => {
    await clearToken();
    set({ token: null, userId: null, phone: null });
  },

  hydrate: (token) => {
    set({ token, isHydrated: true });
  },
}));
