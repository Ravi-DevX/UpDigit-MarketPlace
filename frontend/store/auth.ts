import { create } from "zustand";
import { User } from "@/types/marketplace";

interface AuthState {
  user: User | null;
  accessToken: string | null;
  csrfToken: string | null;
  isAuthenticated: boolean;
  hasCheckedSession: boolean;
  setAuth: (user: User | null | undefined, token: string, csrfToken?: string | null) => void;
  setToken: (token: string, csrfToken?: string | null) => void;
  clearAuth: () => void;
  markSessionChecked: () => void;
  updateUser: (user: Partial<User>) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  csrfToken: null,
  isAuthenticated: false,
  hasCheckedSession: false,
  setAuth: (user, token, csrfToken = null) =>
    set((state) => ({
      user: user === undefined ? state.user : user,
      accessToken: token,
      csrfToken,
      isAuthenticated: true,
      hasCheckedSession: true,
    })),
  setToken: (token, csrfToken = null) =>
    set({
      accessToken: token,
      csrfToken,
      isAuthenticated: true,
    }),
  clearAuth: () =>
    set({
      user: null,
      accessToken: null,
      csrfToken: null,
      isAuthenticated: false,
      hasCheckedSession: true,
    }),
  markSessionChecked: () => set({ hasCheckedSession: true }),
  updateUser: (nextUser) =>
    set((state) => ({
      user: state.user ? { ...state.user, ...nextUser } : null,
    })),
}));
