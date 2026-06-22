"use client";

import { ReactNode, useEffect } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { useAuthStore } from "@/store/auth";
import { queryClient } from "@/lib/query";
import { normalizeAuthUser, parseJwtClaims, refreshSession, apiClient } from "@/lib/api";
import { User } from "@/types/marketplace";

function AuthBootstrapper() {
  const setAuth = useAuthStore((state) => state.setAuth);
  const clearAuth = useAuthStore((state) => state.clearAuth);
  const markSessionChecked = useAuthStore((state) => state.markSessionChecked);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      let hasUsableToken = false;
      try {
        const token = await refreshSession();
        if (!token) {
          if (!cancelled) {
            clearAuth();
          }
          return;
        }
        if (!cancelled) {
          const claims = parseJwtClaims(token);
          if (claims?.id && claims?.username) {
            const fallbackUser: User = {
              id: claims.id,
              username: claims.username,
              role: (claims.role ?? "client") as User["role"],
              display_name: claims.username,
              profile_banner_url: null,
            };
            setAuth(fallbackUser, token, useAuthStore.getState().csrfToken);
            hasUsableToken = true;
          }
        }
        try {
          const response = await apiClient.get<User>("/users/me", {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!response.data) {
            if (!hasUsableToken && !cancelled) {
              clearAuth();
            }
            return;
          }
          const user = normalizeAuthUser(response.data);
          if (user && !cancelled) {
            setAuth(user, token, useAuthStore.getState().csrfToken);
            hasUsableToken = true;
            return;
          }
          if (!hasUsableToken && !cancelled) {
            clearAuth();
          }
        } catch {
          if (!hasUsableToken && !cancelled) {
            clearAuth();
          }
        } finally {
          if (!cancelled) {
            markSessionChecked();
          }
        }
      } catch {
        if (!cancelled) {
          clearAuth();
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [setAuth, clearAuth, markSessionChecked]);

  return null;
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthBootstrapper />
      {children}
      <Toaster richColors position="top-right" />
    </QueryClientProvider>
  );
}
