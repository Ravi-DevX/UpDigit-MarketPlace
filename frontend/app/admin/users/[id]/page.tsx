"use client";

import { useEffect, useState } from "react";
import { Ban, CircleDollarSign, Mail, Save, ShieldCheck, UserRound } from "lucide-react";
import { fetchAdminSettings, fetchAdminUser, setAdminUserBanned, setAdminUserRole } from "@/lib/api";
import type { User } from "@/types/marketplace";
import { actionButtonClass } from "@/app/admin/_components/AdminUI";

const defaultRoleOptions: Array<{ value: User["role"]; label: string }> = [
  { value: "admin", label: "Admin" },
  { value: "staff", label: "Staff" },
  { value: "seller", label: "Seller" },
  { value: "client", label: "Client" },
  { value: "member", label: "Member" },
  { value: "buyer", label: "Buyer legacy" },
];

export default function AdminUserDetailPage({ params }: { params: { id: string } }) {
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "blocked">("loading");
  const [role, setRole] = useState<User["role"]>("member");
  const [roleOptions, setRoleOptions] = useState(defaultRoleOptions);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setStatus("loading");
    try {
      const payload = await fetchAdminUser(params.id);
      setUser(payload);
      setRole(payload.role);
      setStatus("ready");
    } catch {
      setStatus("blocked");
    }
  };

  useEffect(() => {
    let mounted = true;
    setStatus("loading");
    Promise.all([
      fetchAdminUser(params.id),
      fetchAdminSettings().catch(() => null),
    ])
      .then(([payload, settings]) => {
        if (!mounted) {
          return;
        }
        setUser(payload);
        setRole(payload.role);
        if (settings?.roles?.length) {
          setRoleOptions(
            settings.roles.map((item) => ({
              value: item.key as User["role"],
              label: item.label || item.key,
            })),
          );
        }
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
  }, [params.id]);

  const toggleBan = async () => {
    if (!user) {
      return;
    }
    setBusy(true);
    try {
      await setAdminUserBanned(user.id, !user.is_banned);
      await load();
    } finally {
      setBusy(false);
    }
  };

  const saveRole = async () => {
    if (!user) {
      return;
    }
    setBusy(true);
    try {
      await setAdminUserRole(user.id, role);
      await load();
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.16em] text-primary">User detail</p>
        <h2 className="mt-2 text-2xl font-semibold text-textPrimary">{user?.display_name || user?.username || "Loading user"}</h2>
        <p className="mt-2 text-sm text-textSecondary">User ID: {params.id}</p>
      </div>

      {status === "blocked" ? (
        <div className="rounded-2xl border border-warning/30 bg-warning/10 p-4 text-sm text-warning">
          User detail could not load. A valid admin session is required.
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
        <article className="rounded-2xl border border-border bg-surface p-5">
          <div className="flex items-center gap-4">
            <span className="flex size-16 items-center justify-center rounded-[1.25rem] bg-elevated text-textPrimary">
              {user?.avatar_url ? <img src={user.avatar_url} alt="" className="size-16 rounded-[1.25rem] object-cover" /> : <UserRound className="size-6" />}
            </span>
            <div className="min-w-0">
              <p className="truncate text-lg font-semibold text-textPrimary">{user?.display_name || user?.username || "..."}</p>
              <p className="truncate text-sm text-textSecondary">@{user?.username || "unknown"}</p>
            </div>
          </div>
          <div className="mt-6 space-y-3 text-sm">
            <div className="flex items-center gap-3 rounded-xl border border-border bg-elevated px-4 py-3 text-textSecondary">
              <Mail className="size-4 text-primary" />
              {user?.email || "No email"}
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-border bg-elevated px-4 py-3 text-textSecondary">
              <CircleDollarSign className="size-4 text-success" />
              Balance ${(user?.balance ?? 0).toFixed(2)}
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-border bg-elevated px-4 py-3 text-textSecondary">
              {user?.is_banned ? <Ban className="size-4 text-danger" /> : <ShieldCheck className="size-4 text-success" />}
              {user?.is_banned ? "Banned account" : "Active account"} · {user?.role || "role"}
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy || !user}
              onClick={toggleBan}
              className={actionButtonClass(user?.is_banned ? "primary" : "danger")}
            >
              {user?.is_banned ? <ShieldCheck className="size-4" /> : <Ban className="size-4" />}
              {user?.is_banned ? "Unban account" : "Ban account"}
            </button>
          </div>
        </article>

        <article className="rounded-2xl border border-border bg-surface p-5">
          <h3 className="text-base font-semibold text-textPrimary">Admin controls</h3>
          <p className="mt-2 text-sm leading-6 text-textSecondary">
            Update account role and access state. Changes are written directly through the admin user endpoints.
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
            <label className="grid gap-2 text-sm text-textSecondary">
              Role
              <select
                value={role}
                onChange={(event) => setRole(event.target.value as User["role"])}
                className="rounded-xl border border-border bg-background px-3 py-2 text-sm text-textPrimary outline-none"
              >
                {roleOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" disabled={busy || !user || role === user.role} onClick={saveRole} className={actionButtonClass("primary")}>
              <Save className="size-4" />
              Save role
            </button>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {[
              ["External ID", user?.external_id || "Not returned"],
              ["Verified", user?.is_verified ? "Yes" : "No"],
              ["Joined", user?.created_at ? new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(user.created_at)) : "Unknown"],
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-border bg-elevated p-4">
                <p className="text-sm text-textSecondary">{label}</p>
                <p className="mt-2 break-all text-sm font-semibold text-textPrimary">{value}</p>
              </div>
            ))}
          </div>
        </article>
      </div>
    </section>
  );
}
