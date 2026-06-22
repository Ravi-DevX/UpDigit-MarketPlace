"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Ban, ShieldCheck, UserRound } from "lucide-react";
import { fetchAdminUsers } from "@/lib/api";
import type { User } from "@/types/marketplace";

function date(value?: string) {
  if (!value) {
    return "Unknown";
  }
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "blocked">("loading");

  useEffect(() => {
    let mounted = true;
    fetchAdminUsers()
      .then((payload) => {
        if (!mounted) {
          return;
        }
        setUsers(payload);
        setStatus("ready");
      })
      .catch(() => {
        if (mounted) {
          setStatus("blocked");
        }
      });
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <section className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.16em] text-primary">Identity</p>
        <h2 className="mt-2 text-2xl font-semibold text-textPrimary">Users</h2>
        <p className="mt-2 text-sm text-textSecondary">
          DGEN-linked marketplace accounts, roles, balance, ban state, and profile metadata.
        </p>
      </div>

      {status === "blocked" ? (
        <div className="rounded-2xl border border-warning/30 bg-warning/10 p-4 text-sm text-warning">
          User list could not load. A valid admin session is required.
        </div>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-border bg-surface">
        <div className="grid grid-cols-[1.3fr_0.8fr_0.7fr_0.7fr_40px] gap-3 border-b border-border px-4 py-3 text-xs uppercase tracking-[0.12em] text-textSecondary max-md:hidden">
          <span>User</span>
          <span>Role</span>
          <span>Balance</span>
          <span>Joined</span>
          <span />
        </div>
        <div className="divide-y divide-white/10">
          {status === "loading" ? (
            <div className="px-4 py-8 text-center text-sm text-textSecondary">Loading users...</div>
          ) : users.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-textSecondary">No users returned by the admin API.</div>
          ) : (
            users.map((user) => (
              <Link
                key={user.id}
                href={`/admin/users/${user.id}`}
                className="grid gap-3 px-4 py-4 transition hover:bg-surface md:grid-cols-[1.3fr_0.8fr_0.7fr_0.7fr_40px] md:items-center"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-elevated text-sm font-semibold text-textPrimary">
                    {user.avatar_url ? (
                      <img src={user.avatar_url} alt="" className="size-10 rounded-2xl object-cover" />
                    ) : (
                      <UserRound className="size-4" />
                    )}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-textPrimary">{user.display_name || user.username}</span>
                    <span className="block truncate text-xs text-textSecondary">{user.email || user.username}</span>
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-border bg-surface px-2 py-1 text-xs text-textSecondary">
                    {user.role}
                  </span>
                  {user.is_banned ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-danger/30 bg-danger/10 px-2 py-1 text-xs text-danger">
                      <Ban className="size-3" />
                      Banned
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full border border-success/30 bg-success/10 px-2 py-1 text-xs text-success">
                      <ShieldCheck className="size-3" />
                      Active
                    </span>
                  )}
                </div>
                <span className="text-sm text-textSecondary">${(user.balance ?? 0).toFixed(2)}</span>
                <span className="text-sm text-textSecondary">{date((user as User & { created_at?: string }).created_at)}</span>
                <ArrowRight className="hidden size-4 text-textSecondary md:block" />
              </Link>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
