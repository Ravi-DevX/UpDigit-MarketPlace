"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Check, ExternalLink, ImageIcon, Lock, Save, Trash2, UserRound } from "lucide-react";
import { deleteMe, updateMe, uploadAvatar, uploadProfileBanner } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import type { User } from "@/types/marketplace";

type Tab = "account" | "privacy" | "preferences" | "identities" | "removal";

const preferenceDefaults = {
  onlineStatus: true,
  currentActivity: true,
  wishlistEmails: true,
  purchaseRecommendations: true,
  reviewReminders: true,
  profilePosts: true,
  conversations: true,
  pushPurchases: false,
  pushReviews: false,
  discordAlerts: false,
};

function readPrefs() {
  if (typeof window === "undefined") {
    return preferenceDefaults;
  }
  const raw = window.localStorage.getItem("updigit:account-preferences");
  if (!raw) {
    return preferenceDefaults;
  }
  try {
    return { ...preferenceDefaults, ...(JSON.parse(raw) as Partial<typeof preferenceDefaults>) };
  } catch {
    return preferenceDefaults;
  }
}

function fieldValue(value?: string | null) {
  return value ?? "";
}

export default function SettingsPage() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const updateUser = useAuthStore((state) => state.updateUser);
  const clearAuth = useAuthStore((state) => state.clearAuth);
  const [activeTab, setActiveTab] = useState<Tab>("account");
  const [prefs, setPrefs] = useState(preferenceDefaults);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [avatarProgress, setAvatarProgress] = useState(0);
  const [bannerProgress, setBannerProgress] = useState(0);
  const [deleteText, setDeleteText] = useState("");

  useEffect(() => {
    setPrefs(readPrefs());
  }, []);

  const tabs = useMemo(
    () => [
      { key: "account" as const, label: "Account details" },
      { key: "privacy" as const, label: "Privacy" },
      { key: "preferences" as const, label: "Preferences" },
      { key: "identities" as const, label: "Identities" },
      { key: "removal" as const, label: "Account removal" },
    ],
    [],
  );

  const savePrefs = (next: typeof preferenceDefaults) => {
    setPrefs(next);
    window.localStorage.setItem("updigit:account-preferences", JSON.stringify(next));
    setStatus("saved");
  };

  const togglePref = (key: keyof typeof preferenceDefaults) => {
    savePrefs({ ...prefs, [key]: !prefs[key] });
  };

  const submitProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user) {
      return;
    }
    const form = new FormData(event.currentTarget);
    const payload = {
      username: String(form.get("username") || "").trim(),
      email: String(form.get("email") || "").trim(),
      bio: String(form.get("bio") || "").trim() || null,
      website_url: String(form.get("website_url") || "").trim() || null,
      discord_tag: String(form.get("discord_tag") || "").trim() || null,
    };
    setStatus("saving");
    try {
      const updated = await updateMe(payload);
      updateUser(updated);
      setStatus("saved");
    } catch {
      setStatus("error");
    }
  };

  const uploadUserAvatar = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    setAvatarProgress(1);
    setStatus("saving");
    try {
      const payload = await uploadAvatar(file, setAvatarProgress);
      updateUser({ avatar_url: payload.avatar_url } as Partial<User>);
      setStatus("saved");
    } catch {
      setStatus("error");
    } finally {
      setAvatarProgress(0);
    }
  };

  const uploadUserBanner = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    setBannerProgress(1);
    setStatus("saving");
    try {
      const payload = await uploadProfileBanner(file, setBannerProgress);
      updateUser({ profile_banner_url: payload.profile_banner_url } as Partial<User>);
      setStatus("saved");
    } catch {
      setStatus("error");
    } finally {
      setBannerProgress(0);
    }
  };

  const removeAccount = async () => {
    if (deleteText !== "DELETE") {
      return;
    }
    setStatus("saving");
    try {
      await deleteMe();
      clearAuth();
      router.replace("/");
    } catch {
      setStatus("error");
    }
  };

  return (
    <section className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.16em] text-primary">Settings</p>
        <h1 className="mt-2 text-2xl font-semibold text-textPrimary">Account settings</h1>
        <p className="mt-2 text-sm text-textSecondary">
          Manage profile details, privacy, identity links, preferences, and account removal.
        </p>
      </div>

      {status === "saved" ? (
        <div className="rounded-2xl border border-success/30 bg-success/10 p-4 text-sm text-success">
          Changes saved.
        </div>
      ) : null}
      {status === "error" ? (
        <div className="rounded-2xl border border-danger/30 bg-danger/10 p-4 text-sm text-danger">
          Could not save changes. Check required fields and try again.
        </div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[260px_1fr]">
        <aside className="h-max rounded-2xl border border-border bg-surface p-2">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`w-full rounded-xl px-3 py-2.5 text-left text-sm transition ${
                activeTab === tab.key ? "bg-primary/15 text-primary-foreground" : "text-textSecondary hover:bg-elevated hover:text-textPrimary"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </aside>

        <div className="min-w-0 rounded-2xl border border-border bg-surface p-5">
          {activeTab === "account" ? (
            <form onSubmit={submitProfile} className="space-y-5">
              <div className="space-y-3">
                <div className="relative h-36 overflow-hidden rounded-2xl border border-border bg-surface sm:h-44">
                  {user?.profile_banner_url ? (
                    <img src={user.profile_banner_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center bg-[linear-gradient(135deg,rgba(20,184,166,0.22),rgba(99,102,241,0.22),rgba(244,63,94,0.16))] text-textSecondary">
                      <ImageIcon className="size-7" />
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <label className="inline-flex w-max cursor-pointer items-center gap-2 rounded-full border border-border bg-surface px-4 py-2 text-sm text-textSecondary transition hover:border-primary/40 hover:text-textPrimary">
                    <ImageIcon className="size-4 text-primary" />
                    Change public banner
                    <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="sr-only" onChange={uploadUserBanner} />
                  </label>
                  {bannerProgress > 0 ? (
                    <div className="h-2 w-full max-w-64 overflow-hidden rounded-full bg-white/10">
                      <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${bannerProgress}%` }} />
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <div className="relative size-20 overflow-hidden rounded-[1.35rem] border border-border bg-surface">
                  {user?.avatar_url ? (
                    <img src={user.avatar_url} alt="" className="size-20 object-cover" />
                  ) : (
                    <span className="flex size-20 items-center justify-center text-textSecondary">
                      <UserRound className="size-7" />
                    </span>
                  )}
                </div>
                <div>
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-border bg-surface px-4 py-2 text-sm text-textSecondary transition hover:border-primary/40 hover:text-textPrimary">
                    <Camera className="size-4 text-primary" />
                    Change avatar
                    <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={uploadUserAvatar} />
                  </label>
                  {avatarProgress > 0 ? (
                    <div className="mt-3 h-2 w-56 overflow-hidden rounded-full bg-white/10">
                      <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${avatarProgress}%` }} />
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="grid gap-2 text-sm text-textSecondary">
                  Username
                  <input name="username" required minLength={3} defaultValue={fieldValue(user?.username)} className="rounded-xl border border-border bg-surface px-3 py-2.5 text-textPrimary outline-none focus:border-primary/50" />
                </label>
                <label className="grid gap-2 text-sm text-textSecondary">
                  Email
                  <input name="email" required type="email" defaultValue={fieldValue(user?.email)} className="rounded-xl border border-border bg-surface px-3 py-2.5 text-textPrimary outline-none focus:border-primary/50" />
                </label>
                <label className="grid gap-2 text-sm text-textSecondary">
                  Website
                  <input name="website_url" placeholder="https://example.com" defaultValue={fieldValue(user?.website_url)} className="rounded-xl border border-border bg-surface px-3 py-2.5 text-textPrimary outline-none focus:border-primary/50" />
                </label>
                <label className="grid gap-2 text-sm text-textSecondary">
                  Discord
                  <input name="discord_tag" placeholder="@username" defaultValue={fieldValue(user?.discord_tag)} className="rounded-xl border border-border bg-surface px-3 py-2.5 text-textPrimary outline-none focus:border-primary/50" />
                </label>
              </div>
              <label className="grid gap-2 text-sm text-textSecondary">
                About you
                <textarea name="bio" rows={6} defaultValue={fieldValue(user?.bio)} className="resize-y rounded-xl border border-border bg-surface px-3 py-2.5 text-textPrimary outline-none focus:border-primary/50" />
              </label>
              <button disabled={status === "saving"} type="submit" className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition hover:bg-[var(--accent-hover)] disabled:opacity-60">
                <Save className="size-4" />
                Save account details
              </button>
            </form>
          ) : null}

          {activeTab === "privacy" ? (
            <div className="space-y-4">
              {[
                ["onlineStatus", "Show your online status", "Allow members to see when you are online."],
                ["currentActivity", "Show current activity", "Allow members to see what marketplace page you are viewing."],
                ["profilePosts", "Allow profile posts", "Let members post messages on your public profile."],
                ["conversations", "Allow conversations", "Let signed-in members start conversations with you."],
              ].map(([key, title, detail]) => (
                <button key={key} type="button" onClick={() => togglePref(key as keyof typeof preferenceDefaults)} className="flex w-full items-center justify-between gap-4 rounded-xl border border-border bg-elevated p-4 text-left">
                  <span>
                    <span className="block text-sm font-medium text-textPrimary">{title}</span>
                    <span className="mt-1 block text-xs text-textSecondary">{detail}</span>
                  </span>
                  <span className={`flex size-9 shrink-0 items-center justify-center rounded-full border ${prefs[key as keyof typeof preferenceDefaults] ? "border-success/30 bg-success/10 text-success" : "border-border text-textSecondary"}`}>
                    {prefs[key as keyof typeof preferenceDefaults] ? <Check className="size-4" /> : <Lock className="size-4" />}
                  </span>
                </button>
              ))}
            </div>
          ) : null}

          {activeTab === "preferences" ? (
            <div className="space-y-4">
              {[
                ["wishlistEmails", "Wishlist sale emails"],
                ["purchaseRecommendations", "Purchase recommendations"],
                ["reviewReminders", "Review reminders"],
                ["pushPurchases", "Push notification for purchases"],
                ["pushReviews", "Push notification for reviews"],
                ["discordAlerts", "Discord alert delivery"],
              ].map(([key, title]) => (
                <button key={key} type="button" onClick={() => togglePref(key as keyof typeof preferenceDefaults)} className="flex w-full items-center justify-between rounded-xl border border-border bg-elevated p-4 text-sm text-textPrimary">
                  {title}
                  <span className={`h-6 w-11 rounded-full p-1 transition ${prefs[key as keyof typeof preferenceDefaults] ? "bg-primary" : "bg-white/10"}`}>
                    <span className={`block size-4 rounded-full bg-white transition ${prefs[key as keyof typeof preferenceDefaults] ? "translate-x-5" : ""}`} />
                  </span>
                </button>
              ))}
            </div>
          ) : null}

          {activeTab === "identities" ? (
            <div className="space-y-4">
              {[
                ["Email", user?.email || "Not set"],
                ["Discord", user?.discord_tag || "Not set"],
                ["Portfolio", user?.website_url || "Not set"],
                ["DGEN external ID", user?.external_id || "Linked through auth"],
              ].map(([label, value]) => (
                <div key={label} className="flex flex-col gap-2 rounded-xl border border-border bg-elevated p-4 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-sm text-textSecondary">{label}</span>
                  <span className="break-all text-sm text-textPrimary">{value}</span>
                </div>
              ))}
              {user?.username ? (
                <a href={`/members/${user.username}`} className="inline-flex items-center gap-2 text-sm text-primary hover:text-textPrimary">
                  Open public profile
                  <ExternalLink className="size-4" />
                </a>
              ) : null}
            </div>
          ) : null}

          {activeTab === "removal" ? (
            <div className="space-y-4">
              <div className="rounded-2xl border border-danger/30 bg-danger/10 p-4 text-sm leading-6 text-danger">
                Deleting an account removes access to marketplace account data. Completed purchases may no longer be recoverable through this account.
              </div>
              <label className="grid gap-2 text-sm text-textSecondary">
                Type DELETE to confirm
                <input value={deleteText} onChange={(event) => setDeleteText(event.target.value)} className="rounded-xl border border-border bg-surface px-3 py-2.5 text-textPrimary outline-none focus:border-danger/50" />
              </label>
              <button disabled={deleteText !== "DELETE" || status === "saving"} type="button" onClick={removeAccount} className="inline-flex items-center gap-2 rounded-full bg-danger px-5 py-2.5 text-sm font-medium text-primary-foreground transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50">
                <Trash2 className="size-4" />
                Delete account
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
