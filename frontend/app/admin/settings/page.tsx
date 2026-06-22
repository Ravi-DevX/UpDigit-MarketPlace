"use client";

import { FormEvent, useEffect, useState } from "react";
import { Plus, Save, Trash2 } from "lucide-react";
import { fetchAdminSettings, updateAdminSetting } from "@/lib/api";
import type { AdminRole, AdminSettings } from "@/types/marketplace";
import { actionButtonClass, ErrorState, LoadingState, PageHeader } from "@/app/admin/_components/AdminUI";

type SiteSettingKey =
  | "site_name"
  | "site_tagline"
  | "site_description"
  | "site_logo_url"
  | "support_email"
  | "seo_default_title"
  | "seo_default_description"
  | "announcement_text";

const siteFields: Array<{ key: SiteSettingKey; label: string; help: string; multiline?: boolean }> = [
  { key: "site_name", label: "Website name", help: "Shown in navigation and default page titles." },
  { key: "site_tagline", label: "Short tagline", help: "Small label next to the site name." },
  { key: "site_description", label: "Website description", help: "Shown in footer and brand surfaces.", multiline: true },
  { key: "site_logo_url", label: "Logo URL", help: "Use an HTTPS image URL. Leave empty for the letter logo." },
  { key: "support_email", label: "Support email", help: "Shown in the footer contact link." },
  { key: "seo_default_title", label: "Default SEO title", help: "Fallback browser/search title." },
  { key: "seo_default_description", label: "Default SEO description", help: "Fallback search/social description.", multiline: true },
  { key: "announcement_text", label: "Marketplace announcement", help: "Optional banner text shown on product detail pages.", multiline: true },
];

export default function AdminSettingsIndexPage() {
  const [settings, setSettings] = useState<AdminSettings | null>(null);
  const [roles, setRoles] = useState<AdminRole[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error" | "saved">("loading");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let mounted = true;
    fetchAdminSettings()
      .then((payload) => {
        if (mounted) {
          setSettings(payload);
          setRoles(payload.roles ?? []);
          setState("ready");
        }
      })
      .catch(() => {
        if (mounted) {
          setState("error");
        }
      });
    return () => {
      mounted = false;
    };
  }, []);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const fee = Number(form.get("platform_fee_percent") || 0);
    setSaving(true);
    try {
      await updateAdminSetting("platform_fee_percent", fee);
      setSettings((current) => (current ? { ...current, platform_fee_percent: fee } : { platform_fee_percent: fee }));
      setState("saved");
    } finally {
      setSaving(false);
    }
  };

  const saveSiteSettings = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const next = Object.fromEntries(siteFields.map((field) => [field.key, String(form.get(field.key) || "")])) as Record<SiteSettingKey, string>;
    setSaving(true);
    try {
      await Promise.all(siteFields.map((field) => updateAdminSetting(field.key, next[field.key])));
      setSettings((current) => (current ? { ...current, ...next } : { platform_fee_percent: 0, ...next }));
      setState("saved");
    } finally {
      setSaving(false);
    }
  };

  const updateRole = (index: number, patch: Partial<AdminRole>) => {
    setRoles((items) => items.map((role, roleIndex) => (roleIndex === index ? { ...role, ...patch } : role)));
  };

  const addRole = () => {
    setRoles((items) => [
      ...items,
      {
        key: `custom_${items.length + 1}`,
        label: "Custom role",
        description: "Custom marketplace role.",
        permissions: ["profile.manage"],
        system: false,
      },
    ]);
  };

  const removeRole = (index: number) => {
    setRoles((items) => items.filter((role, roleIndex) => role.system || roleIndex !== index));
  };

  const saveRoles = async () => {
    setSaving(true);
    try {
      await updateAdminSetting("roles", roles);
      setSettings((current) => (current ? { ...current, roles } : current));
      setState("saved");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="space-y-6">
      <PageHeader
        eyebrow="Configuration"
        title="Platform settings"
        description="Update global marketplace settings that are backed by persistent platform configuration."
      />

      {state === "error" ? <ErrorState message="Settings could not load. Check admin session permissions." /> : null}
      {state === "loading" ? <LoadingState label="Loading settings..." /> : null}

      {settings ? (
        <div className="space-y-5">
          <form onSubmit={submit} className="rounded-2xl border border-border bg-surface p-5">
            <div className="grid gap-4 md:grid-cols-[1fr_0.8fr] md:items-end">
              <div>
                <label className="grid gap-2 text-sm text-textSecondary">
                  Platform fee percent
                  <input
                    name="platform_fee_percent"
                    type="number"
                    min="0"
                    step="0.01"
                    defaultValue={settings.platform_fee_percent}
                    className="rounded-xl border border-border bg-surface px-3 py-2 text-sm text-textPrimary outline-none"
                  />
                </label>
                <p className="mt-2 text-xs text-textSecondary">Used by checkout and seller earnings calculations.</p>
              </div>
              <button disabled={saving} type="submit" className={actionButtonClass("primary")}>
                <Save className="size-4" />
                Save settings
              </button>
            </div>
          </form>

          <form onSubmit={saveSiteSettings} className="rounded-2xl border border-border bg-surface p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 className="text-base font-semibold text-textPrimary">Site identity and SEO</h3>
                <p className="mt-1 text-sm text-textSecondary">Manage visible marketplace branding, support contact, and default SEO copy.</p>
              </div>
              <button disabled={saving} type="submit" className={actionButtonClass("primary")}>
                <Save className="size-4" />
                Save site settings
              </button>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {siteFields.map((field) => (
                <label key={field.key} className={`grid gap-2 text-sm text-textSecondary ${field.multiline ? "md:col-span-2" : ""}`}>
                  {field.label}
                  {field.multiline ? (
                    <textarea
                      name={field.key}
                      defaultValue={settings[field.key] ?? ""}
                      rows={3}
                      className="rounded-xl border border-border bg-surface px-3 py-2 text-sm text-textPrimary outline-none"
                    />
                  ) : (
                    <input
                      name={field.key}
                      defaultValue={settings[field.key] ?? ""}
                      className="rounded-xl border border-border bg-surface px-3 py-2 text-sm text-textPrimary outline-none"
                    />
                  )}
                  <span className="text-xs text-textSecondary">{field.help}</span>
                </label>
              ))}
            </div>
          </form>

          <section className="rounded-2xl border border-border bg-surface p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-base font-semibold text-textPrimary">Roles and permissions</h3>
                <p className="mt-1 text-sm text-textSecondary">Define the role catalog used when assigning user access.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={addRole} className={actionButtonClass("neutral")}>
                  <Plus className="size-4" />
                  Add role
                </button>
                <button type="button" disabled={saving || roles.length === 0} onClick={saveRoles} className={actionButtonClass("primary")}>
                  <Save className="size-4" />
                  Save roles
                </button>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              {roles.map((role, index) => (
                <article key={`${role.key}-${index}`} className="rounded-2xl border border-border bg-elevated p-4">
                  <div className="grid gap-3 lg:grid-cols-[0.7fr_0.9fr_1.4fr_auto] lg:items-end">
                    <label className="grid gap-2 text-sm text-textSecondary">
                      Key
                      <input
                        value={role.key}
                        disabled={role.system}
                        onChange={(event) => updateRole(index, { key: event.target.value })}
                        className="rounded-xl border border-border bg-background px-3 py-2 text-sm text-textPrimary outline-none disabled:opacity-60"
                      />
                    </label>
                    <label className="grid gap-2 text-sm text-textSecondary">
                      Label
                      <input
                        value={role.label}
                        onChange={(event) => updateRole(index, { label: event.target.value })}
                        className="rounded-xl border border-border bg-background px-3 py-2 text-sm text-textPrimary outline-none"
                      />
                    </label>
                    <label className="grid gap-2 text-sm text-textSecondary">
                      Permissions
                      <input
                        value={(role.permissions ?? []).join(", ")}
                        onChange={(event) =>
                          updateRole(index, {
                            permissions: event.target.value
                              .split(",")
                              .map((item) => item.trim())
                              .filter(Boolean),
                          })
                        }
                        className="rounded-xl border border-border bg-background px-3 py-2 text-sm text-textPrimary outline-none"
                      />
                    </label>
                    <button
                      type="button"
                      disabled={role.system}
                      onClick={() => removeRole(index)}
                      className={actionButtonClass("danger")}
                    >
                      <Trash2 className="size-4" />
                      Remove
                    </button>
                  </div>
                  <label className="mt-3 grid gap-2 text-sm text-textSecondary">
                    Description
                    <input
                      value={role.description ?? ""}
                      onChange={(event) => updateRole(index, { description: event.target.value })}
                      className="rounded-xl border border-border bg-background px-3 py-2 text-sm text-textPrimary outline-none"
                    />
                  </label>
                </article>
              ))}
            </div>
          </section>

          {state === "saved" ? <p className="text-sm text-success">Settings saved.</p> : null}
        </div>
      ) : null}
    </section>
  );
}
