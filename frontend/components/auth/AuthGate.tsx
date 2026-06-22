"use client";

import { ReactNode, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { useAuthStore } from "@/store/auth";
import type { Role } from "@/types/marketplace";

type AuthGateProps = {
  children: ReactNode;
  allowedRoles?: Role[];
  redirectTo?: string;
  loginRedirect?: boolean;
  label?: string;
};

function loadingState(label: string) {
  return (
    <div className="flex min-h-[45vh] items-center justify-center">
      <div className="rounded-2xl border border-border bg-surface px-5 py-4 text-sm text-textSecondary backdrop-blur-xl">
        <span className="inline-flex items-center gap-2">
          <ShieldCheck className="size-4 text-primary" />
          {label}
        </span>
      </div>
    </div>
  );
}

export function AuthGate({
  children,
  allowedRoles,
  redirectTo = "/",
  loginRedirect = false,
  label = "Checking session...",
}: AuthGateProps) {
  const router = useRouter();
  const pathname = usePathname();
  const hasCheckedSession = useAuthStore((state) => state.hasCheckedSession);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const user = useAuthStore((state) => state.user);

  const hasUser = Boolean(isAuthenticated && user);
  const hasRole = !allowedRoles || (user ? allowedRoles.includes(user.role) : false);
  const authorized = hasUser && hasRole;

  useEffect(() => {
    if (!hasCheckedSession) {
      return;
    }
    if (!hasUser) {
      if (loginRedirect) {
        router.replace(`/login?next=${encodeURIComponent(pathname)}`);
        return;
      }
      router.replace(redirectTo);
      return;
    }
    if (!hasRole) {
      router.replace(redirectTo);
    }
  }, [hasCheckedSession, hasRole, hasUser, loginRedirect, pathname, redirectTo, router]);

  if (!hasCheckedSession || !authorized) {
    return loadingState(label);
  }

  return <>{children}</>;
}
