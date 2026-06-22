"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthStore } from "@/store/auth";
import { apiClient, exchangeDgenCallback, normalizeAuthUser, parseJwtClaims } from "@/lib/api";
import { User } from "@/types/marketplace";

const callbackExchangePrefix = "dgen-callback-exchange:";

function safeNextPath(next: string | null): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/auth/callback")) {
    return "/dashboard";
  }
  return next;
}

function userFromToken(token: string): User | null {
  const decoded = parseJwtClaims(token);
  if (!decoded) {
    return null;
  }
  return {
    id: decoded.id ?? "",
    username: decoded.username ?? "",
    role: ((decoded.role ?? "client") as User["role"]),
    display_name: decoded.username,
    email: null,
    avatar_url: null,
    profile_banner_url: null,
  };
}

function callbackErrorMessage(error: unknown): string {
  if (!error || typeof error !== "object" || !("response" in error)) {
    return "dgen_callback";
  }
  const response = (error as { response?: { data?: { error?: unknown } } }).response;
  const message = response?.data?.error;
  return typeof message === "string" && message ? message : "dgen_callback";
}

function AuthCallbackHandler() {
  const params = useSearchParams();
  const router = useRouter();
  const setAuth = useAuthStore((state) => state.setAuth);
  const clearAuth = useAuthStore((state) => state.clearAuth);

  useEffect(() => {
    const token = params.get("token");
    const code = params.get("code");
    const state = params.get("state");
    const oauthError = params.get("error");
    const next = safeNextPath(params.get("next"));
    const csrfFromQuery = params.get("csrf");

    if (oauthError) {
      clearAuth();
      router.replace(`/login?error=${encodeURIComponent(oauthError)}`);
      return;
    }

    if (code && state) {
      const exchange = async () => {
        const exchangeKey = `${callbackExchangePrefix}${state}`;
        if (sessionStorage.getItem(exchangeKey)) {
          return;
        }
        sessionStorage.setItem(exchangeKey, "1");
        try {
          const response = await exchangeDgenCallback(code, state);
          const accessToken = response.access_token;
          const user = normalizeAuthUser(response.user) ?? userFromToken(accessToken);
          setAuth(user, accessToken, response.csrf_token ?? null);
          router.replace(safeNextPath(response.next ?? next));
        } catch (error) {
          sessionStorage.removeItem(exchangeKey);
          clearAuth();
          router.replace(`/login?error=${encodeURIComponent(callbackErrorMessage(error))}`);
        }
      };
      void exchange();
      return;
    }

    if (!token) {
      router.replace("/login");
      return;
    }

    const restore = async () => {
      const parsedUser = userFromToken(token);
      let userFromServer: User | null = null;
      if (parsedUser) {
        setAuth(parsedUser, token, csrfFromQuery);
      }
      try {
        const response = await apiClient.get<User>(`/users/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const user = normalizeAuthUser(response.data);
        if (user) {
          setAuth(user, token, csrfFromQuery ?? undefined);
          userFromServer = user;
        }
      } catch {
        // Keep token-only state only if claims could be parsed.
      }
      if (!userFromServer && parsedUser && parsedUser.id && parsedUser.username) {
        setAuth(parsedUser, token, csrfFromQuery);
      }
      if (!parsedUser) {
        if (!userFromServer) {
          clearAuth();
          router.replace("/login");
          return;
        }
      }
      router.replace(next);
    };
    void restore();
  }, [params, router, setAuth, clearAuth]);

  return <main className="mt-20 text-center">Completing authentication…</main>;
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<main className="mt-20 text-center">Completing authentication…</main>}>
      <AuthCallbackHandler />
    </Suspense>
  );
}
