"use client";

import axios from "axios";
import { AlertCircle, ExternalLink, Loader2, RefreshCw, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  createDgenEmbedSession,
  type DgenEmbedSession,
  exchangeDgenCallback,
  normalizeAuthUser,
  parseJwtClaims,
  requestDgenRedirectLogin,
} from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { User } from "@/types/marketplace";

const DGEN_AUTH_ORIGIN = "https://auth.dgenx.net";
const DEFAULT_FRAME_HEIGHT = 540;

type EmbeddedMessage = {
  sdk?: string;
  type?: string;
  code?: string;
  state?: string;
  error?: string;
  height?: number;
};

function safeNextPath(next?: string | null): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/auth/callback")) {
    return "/dashboard";
  }
  return next;
}

function browserBackgroundColor(): string {
  const value = getComputedStyle(document.body).backgroundColor.trim();
  if (/^#[0-9a-f]{6}$/i.test(value)) {
    return value;
  }
  const rgb = value.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (!rgb) {
    return "#0b0f16";
  }
  return `#${rgb
    .slice(1, 4)
    .map((channel) => Math.max(0, Math.min(255, Number(channel))).toString(16).padStart(2, "0"))
    .join("")}`;
}

function callbackUser(token: string, payload: unknown): User | null {
  const user = normalizeAuthUser(payload);
  if (user?.id && user.username) {
    return user;
  }
  const claims = parseJwtClaims(token);
  if (!claims?.id || !claims.username) {
    return null;
  }
  return {
    id: claims.id,
    username: claims.username,
    role: (claims.role ?? "client") as User["role"],
    display_name: claims.username,
    email: null,
    avatar_url: null,
    profile_banner_url: null,
  };
}

function readableError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const message = error.response?.data?.error;
    if (typeof message === "string" && message) {
      return message;
    }
    if (!error.response) {
      return "Could not reach the authentication service. Check your connection and try again.";
    }
  }
  return "DGEN could not complete authentication. Try again or use the redirect fallback.";
}

export function DgenEmbeddedLogin({ next }: { next?: string | null }) {
  const router = useRouter();
  const setAuth = useAuthStore((state) => state.setAuth);
  const clearAuth = useAuthStore((state) => state.clearAuth);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const exchangeStarted = useRef(false);
  const requestSequence = useRef(0);
  const [session, setSession] = useState<DgenEmbedSession | null>(null);
  const [frameHeight, setFrameHeight] = useState(DEFAULT_FRAME_HEIGHT);
  const [status, setStatus] = useState<"loading" | "ready" | "exchanging" | "error">("loading");
  const [error, setError] = useState<string | null>(null);

  const startSession = useCallback(async () => {
    const sequence = ++requestSequence.current;
    exchangeStarted.current = false;
    setStatus("loading");
    setError(null);
    setSession(null);
    setFrameHeight(DEFAULT_FRAME_HEIGHT);
    try {
      const nextSession = await createDgenEmbedSession(next, browserBackgroundColor());
      if (sequence !== requestSequence.current) return;
      if (nextSession.auth_origin !== DGEN_AUTH_ORIGIN) {
        throw new Error("Unexpected DGEN authorization origin");
      }
      if (nextSession.parent_origin !== window.location.origin) {
        throw new Error("Embedded login origin does not match this site");
      }
      setSession(nextSession);
    } catch (sessionError) {
      if (sequence !== requestSequence.current) return;
      setError(readableError(sessionError));
      setStatus("error");
    }
  }, [next]);

  useEffect(() => {
    void startSession();
    return () => {
      requestSequence.current += 1;
    };
  }, [startSession]);

  useEffect(() => {
    if (!session) return;

    const onMessage = (event: MessageEvent<EmbeddedMessage>) => {
      if (event.origin !== DGEN_AUTH_ORIGIN || event.source !== iframeRef.current?.contentWindow) return;
      const message = event.data;
      if (!message || message.sdk !== "dgen-embedded-sso") return;

      if (message.type === "DGEN_EMBED_RESIZE" && Number.isFinite(message.height)) {
        setFrameHeight(Math.max(380, Math.min(820, Number(message.height))));
        return;
      }
      if (message.type === "DGEN_EMBED_AUTH_ERROR") {
        if (message.state !== session.state) return;
        setError(message.error || "DGEN could not complete authentication.");
        setStatus("error");
        return;
      }
      if (message.type !== "DGEN_EMBED_AUTH_SUCCESS") return;
      if (!message.code || message.state !== session.state || exchangeStarted.current) return;

      exchangeStarted.current = true;
      setStatus("exchanging");
      setError(null);
      void exchangeDgenCallback(message.code, message.state)
        .then((response) => {
          const user = callbackUser(response.access_token, response.user);
          setAuth(user, response.access_token, response.csrf_token ?? null);
          router.replace(safeNextPath(response.next ?? next));
          router.refresh();
        })
        .catch((exchangeError) => {
          exchangeStarted.current = false;
          clearAuth();
          setError(readableError(exchangeError));
          setStatus("error");
        });
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [clearAuth, next, router, session, setAuth]);

  if (status === "error") {
    return (
      <div className="border border-red-500/30 bg-red-500/5 p-5 text-left">
        <div className="flex gap-3">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-400" aria-hidden="true" />
          <div>
            <p className="font-medium text-red-200">Embedded sign-in was interrupted</p>
            <p className="mt-1 text-sm text-textSecondary">{error}</p>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => void startSession()}
            className="inline-flex h-9 items-center gap-2 rounded bg-primary px-4 text-sm font-medium text-primary-foreground"
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" /> Retry embedded sign-in
          </button>
          <button
            type="button"
            onClick={() => requestDgenRedirectLogin(next)}
            className="inline-flex h-9 items-center gap-2 rounded border border-border px-4 text-sm font-medium hover:bg-surfaceHover"
          >
            <ExternalLink className="h-4 w-4" aria-hidden="true" /> Open DGEN directly
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-[420px] overflow-hidden border border-border bg-background">
      {session ? (
        <iframe
          ref={iframeRef}
          src={session.authorization_url}
          title="Sign in with DGEN"
          allow="publickey-credentials-get *"
          referrerPolicy="strict-origin-when-cross-origin"
          onLoad={() => setStatus((current) => (current === "loading" ? "ready" : current))}
          className="block w-full border-0 bg-background transition-[height] duration-200"
          style={{ height: frameHeight }}
        />
      ) : null}
      {status === "loading" || status === "exchanging" ? (
        <div className="absolute inset-0 flex items-center justify-center bg-background/90">
          <div className="text-center">
            <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" aria-hidden="true" />
            <p className="mt-3 text-sm text-textSecondary">
              {status === "exchanging" ? "Securing your session..." : "Loading DGEN sign-in..."}
            </p>
          </div>
        </div>
      ) : null}
      <div className="flex items-center gap-2 border-t border-border px-4 py-3 text-xs text-textSecondary">
        <ShieldCheck className="h-4 w-4 text-emerald-400" aria-hidden="true" />
        Credentials are handled by DGEN Auth. Updigit only receives the approved account profile.
      </div>
    </div>
  );
}
