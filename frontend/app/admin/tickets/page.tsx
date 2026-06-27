"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Pencil, Plus, RefreshCw, Save, Trash2 } from "lucide-react";
import { ErrorState, LoadingState, PageHeader, StatusBadge, actionButtonClass } from "@/app/admin/_components/AdminUI";
import {
  deleteAdminTicketCategory,
  deleteAdminTicketFeature,
  deleteAdminTicketPriority,
  deleteAdminTicketStatus,
  fetchAdminTicketConfig,
  saveAdminTicketCategory,
  saveAdminTicketFeature,
  saveAdminTicketPriority,
  saveAdminTicketStatus,
} from "@/lib/api";
import type { SupportTicketCategory, SupportTicketFeatureConfig, SupportTicketPriority, SupportTicketStatus } from "@/types/marketplace";

type LoadState = "loading" | "ready" | "error";

const blankCategory = {
  name: "",
  slug: "",
  description: "",
  parent_id: "",
  sort_order: 0,
  is_active: true,
  allow_customer_open: true,
};

const blankStatus = {
  name: "",
  slug: "",
  sort_order: 0,
  is_closed: false,
  include_in_counts: true,
  status_on_customer_reply: "",
  status_on_staff_reply: "",
};

const blankPriority = {
  name: "",
  slug: "",
  sort_order: 0,
  is_active: true,
};

const featureTypes = [
  { value: "prefix", label: "Ticket prefixes" },
  { value: "property", label: "Ticket properties" },
  { value: "custom-field", label: "Custom ticket fields" },
  { value: "canned-response", label: "Ticket responses" },
  { value: "escalation", label: "Ticket escalations" },
  { value: "banned-email", label: "Banned emails" },
  { value: "kb-category", label: "Knowledge base categories" },
  { value: "kb-article", label: "Knowledge base articles" },
  { value: "business-hours", label: "Business hours" },
  { value: "option", label: "Ticket options" },
  { value: "workflow", label: "Workflows" },
  { value: "channel", label: "Channels" },
  { value: "sla", label: "SLA rules" },
];

const blankFeature = {
  feature_type: "prefix",
  title: "",
  slug: "",
  body: "",
  configText: "{}",
  sort_order: 0,
  is_active: true,
};

export default function AdminTicketsPage() {
  const [state, setState] = useState<LoadState>("loading");
  const [categories, setCategories] = useState<SupportTicketCategory[]>([]);
  const [statuses, setStatuses] = useState<SupportTicketStatus[]>([]);
  const [priorities, setPriorities] = useState<SupportTicketPriority[]>([]);
  const [features, setFeatures] = useState<SupportTicketFeatureConfig[]>([]);
  const [categoryForm, setCategoryForm] = useState(blankCategory);
  const [statusForm, setStatusForm] = useState(blankStatus);
  const [priorityForm, setPriorityForm] = useState(blankPriority);
  const [featureForm, setFeatureForm] = useState(blankFeature);
  const [categoryEditID, setCategoryEditID] = useState<string | null>(null);
  const [statusEditID, setStatusEditID] = useState<string | null>(null);
  const [priorityEditID, setPriorityEditID] = useState<string | null>(null);
  const [featureEditID, setFeatureEditID] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setState("loading");
    try {
      const config = await fetchAdminTicketConfig();
      setCategories(config.categories || []);
      setStatuses(config.statuses || []);
      setPriorities(config.priorities || []);
      setFeatures(config.features || []);
      setState("ready");
    } catch {
      setState("error");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const categoryOptions = useMemo(() => categories.filter((category) => category.id !== categoryForm.parent_id), [categories, categoryForm.parent_id]);

  async function saveCategory() {
    await saveAdminTicketCategory({
      id: categoryEditID || undefined,
      name: categoryForm.name,
      slug: categoryForm.slug,
      description: categoryForm.description || null,
      parent_id: categoryForm.parent_id || null,
      sort_order: categoryForm.sort_order,
      is_active: categoryForm.is_active,
      allow_customer_open: categoryForm.allow_customer_open,
    });
    setNotice("Ticket categories saved.");
    setCategoryForm(blankCategory);
    setCategoryEditID(null);
    await load();
  }

  async function saveStatus() {
    await saveAdminTicketStatus({
      id: statusEditID || undefined,
      name: statusForm.name,
      slug: statusForm.slug,
      sort_order: statusForm.sort_order,
      is_closed: statusForm.is_closed,
      include_in_counts: statusForm.include_in_counts,
      status_on_customer_reply: statusForm.status_on_customer_reply || null,
      status_on_staff_reply: statusForm.status_on_staff_reply || null,
    });
    setNotice("Ticket statuses saved.");
    setStatusForm(blankStatus);
    setStatusEditID(null);
    await load();
  }

  async function savePriority() {
    await saveAdminTicketPriority({
      id: priorityEditID || undefined,
      name: priorityForm.name,
      slug: priorityForm.slug,
      sort_order: priorityForm.sort_order,
      is_active: priorityForm.is_active,
    });
    setNotice("Ticket priorities saved.");
    setPriorityForm(blankPriority);
    setPriorityEditID(null);
    await load();
  }

  async function saveFeature() {
    let config: Record<string, unknown> = {};
    try {
      config = JSON.parse(featureForm.configText || "{}") as Record<string, unknown>;
    } catch {
      setNotice("Feature config must be valid JSON.");
      return;
    }
    await saveAdminTicketFeature({
      id: featureEditID || undefined,
      feature_type: featureForm.feature_type,
      title: featureForm.title,
      slug: featureForm.slug,
      body: featureForm.body || null,
      config,
      sort_order: featureForm.sort_order,
      is_active: featureForm.is_active,
    });
    setNotice("Ticket feature saved.");
    setFeatureForm(blankFeature);
    setFeatureEditID(null);
    await load();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Support"
        title="Ticket configuration"
        description="Manage the categories, statuses, and priorities used by the marketplace support desk."
        action={
          <button type="button" onClick={() => void load()} className={actionButtonClass("neutral")}>
            <RefreshCw className="size-4" />
            Refresh
          </button>
        }
      />

      {notice ? <div className="rounded-2xl border border-success/30 bg-success/10 p-3 text-sm text-success">{notice}</div> : null}
      {state === "loading" ? <LoadingState label="Loading ticket configuration..." /> : null}
      {state === "error" ? <ErrorState message="Ticket configuration could not load. Check the admin API and database migrations." /> : null}

      {state === "ready" ? (
        <div className="grid gap-5 xl:grid-cols-[1.1fr_0.95fr]">
          <section className="space-y-4 rounded-2xl border border-border bg-elevated p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-textPrimary">Categories</h3>
                <p className="text-sm text-textSecondary">Use parent categories for product support, billing, and pre-sales groups.</p>
              </div>
              <Plus className="size-5 text-primary" />
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <input className="rounded-xl border border-border bg-background px-3 py-2 text-sm" placeholder="Name" value={categoryForm.name} onChange={(event) => setCategoryForm({ ...categoryForm, name: event.target.value })} />
              <input className="rounded-xl border border-border bg-background px-3 py-2 text-sm" placeholder="Slug" value={categoryForm.slug} onChange={(event) => setCategoryForm({ ...categoryForm, slug: event.target.value })} />
              <select className="rounded-xl border border-border bg-background px-3 py-2 text-sm" value={categoryForm.parent_id} onChange={(event) => setCategoryForm({ ...categoryForm, parent_id: event.target.value })}>
                <option value="">No parent</option>
                {categoryOptions.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
              <input className="rounded-xl border border-border bg-background px-3 py-2 text-sm" type="number" placeholder="Sort" value={categoryForm.sort_order} onChange={(event) => setCategoryForm({ ...categoryForm, sort_order: Number(event.target.value) })} />
              <textarea className="min-h-20 rounded-xl border border-border bg-background px-3 py-2 text-sm md:col-span-2" placeholder="Description" value={categoryForm.description} onChange={(event) => setCategoryForm({ ...categoryForm, description: event.target.value })} />
              <label className="flex items-center gap-2 text-sm text-textSecondary">
                <input type="checkbox" checked={categoryForm.is_active} onChange={(event) => setCategoryForm({ ...categoryForm, is_active: event.target.checked })} />
                Active
              </label>
              <label className="flex items-center gap-2 text-sm text-textSecondary">
                <input type="checkbox" checked={categoryForm.allow_customer_open} onChange={(event) => setCategoryForm({ ...categoryForm, allow_customer_open: event.target.checked })} />
                Customer can open
              </label>
            </div>
            <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => void saveCategory()} className={actionButtonClass("primary")}>
              <Save className="size-4" />
              {categoryEditID ? "Update category" : "Add category"}
            </button>
              {categoryEditID ? (
                <button type="button" onClick={() => { setCategoryEditID(null); setCategoryForm(blankCategory); }} className={actionButtonClass("neutral")}>
                  Cancel edit
                </button>
              ) : null}
            </div>

            <div className="divide-y divide-border rounded-2xl border border-border">
              {categories.map((category) => (
                <div key={category.id} className="grid gap-3 p-3 lg:grid-cols-[1fr_0.8fr_auto] lg:items-center">
                  <div>
                    <p className="font-medium text-textPrimary">{category.name}</p>
                    <p className="text-xs text-textSecondary">{category.slug}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <StatusBadge value={category.is_active} />
                    <span className="rounded-full border border-border px-2.5 py-1 text-xs text-textSecondary">{category.allow_customer_open ? "Customer open" : "Staff only"}</span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setCategoryEditID(category.id);
                        setCategoryForm({
                          name: category.name,
                          slug: category.slug,
                          description: category.description || "",
                          parent_id: category.parent_id || "",
                          sort_order: category.sort_order,
                          is_active: category.is_active,
                          allow_customer_open: category.allow_customer_open,
                        });
                      }}
                      className={actionButtonClass("neutral")}
                    >
                      <Pencil className="size-4" />
                    </button>
                    <button type="button" onClick={() => void deleteAdminTicketCategory(category.id).then(load)} className={actionButtonClass("danger")}>
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <div className="space-y-5">
            <section className="space-y-4 rounded-2xl border border-border bg-elevated p-4">
              <h3 className="text-base font-semibold text-textPrimary">Statuses</h3>
              <div className="grid gap-3 md:grid-cols-2">
                <input className="rounded-xl border border-border bg-background px-3 py-2 text-sm" placeholder="Name" value={statusForm.name} onChange={(event) => setStatusForm({ ...statusForm, name: event.target.value })} />
                <input className="rounded-xl border border-border bg-background px-3 py-2 text-sm" placeholder="Slug" value={statusForm.slug} onChange={(event) => setStatusForm({ ...statusForm, slug: event.target.value })} />
                <input className="rounded-xl border border-border bg-background px-3 py-2 text-sm" type="number" placeholder="Sort" value={statusForm.sort_order} onChange={(event) => setStatusForm({ ...statusForm, sort_order: Number(event.target.value) })} />
                <label className="flex items-center gap-2 text-sm text-textSecondary">
                  <input type="checkbox" checked={statusForm.is_closed} onChange={(event) => setStatusForm({ ...statusForm, is_closed: event.target.checked })} />
                  Closed status
                </label>
              </div>
              <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => void saveStatus()} className={actionButtonClass("primary")}>
                <Save className="size-4" />
                {statusEditID ? "Update status" : "Add status"}
              </button>
                {statusEditID ? (
                  <button type="button" onClick={() => { setStatusEditID(null); setStatusForm(blankStatus); }} className={actionButtonClass("neutral")}>
                    Cancel edit
                  </button>
                ) : null}
              </div>
              <ConfigList
                items={statuses}
                onEdit={(status) => {
                  setStatusEditID(status.id);
                  setStatusForm({
                    name: status.name,
                    slug: status.slug,
                    sort_order: status.sort_order,
                    is_closed: status.is_closed,
                    include_in_counts: status.include_in_counts,
                    status_on_customer_reply: status.status_on_customer_reply || "",
                    status_on_staff_reply: status.status_on_staff_reply || "",
                  });
                }}
                onDelete={(id) => deleteAdminTicketStatus(id).then(load)}
              />
            </section>

            <section className="space-y-4 rounded-2xl border border-border bg-elevated p-4">
              <h3 className="text-base font-semibold text-textPrimary">Priorities</h3>
              <div className="grid gap-3 md:grid-cols-2">
                <input className="rounded-xl border border-border bg-background px-3 py-2 text-sm" placeholder="Name" value={priorityForm.name} onChange={(event) => setPriorityForm({ ...priorityForm, name: event.target.value })} />
                <input className="rounded-xl border border-border bg-background px-3 py-2 text-sm" placeholder="Slug" value={priorityForm.slug} onChange={(event) => setPriorityForm({ ...priorityForm, slug: event.target.value })} />
                <input className="rounded-xl border border-border bg-background px-3 py-2 text-sm" type="number" placeholder="Sort" value={priorityForm.sort_order} onChange={(event) => setPriorityForm({ ...priorityForm, sort_order: Number(event.target.value) })} />
                <label className="flex items-center gap-2 text-sm text-textSecondary">
                  <input type="checkbox" checked={priorityForm.is_active} onChange={(event) => setPriorityForm({ ...priorityForm, is_active: event.target.checked })} />
                  Active
                </label>
              </div>
              <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => void savePriority()} className={actionButtonClass("primary")}>
                <Save className="size-4" />
                {priorityEditID ? "Update priority" : "Add priority"}
              </button>
                {priorityEditID ? (
                  <button type="button" onClick={() => { setPriorityEditID(null); setPriorityForm(blankPriority); }} className={actionButtonClass("neutral")}>
                    Cancel edit
                  </button>
                ) : null}
              </div>
              <ConfigList
                items={priorities}
                onEdit={(priority) => {
                  setPriorityEditID(priority.id);
                  setPriorityForm({
                    name: priority.name,
                    slug: priority.slug,
                    sort_order: priority.sort_order,
                    is_active: priority.is_active,
                  });
                }}
                onDelete={(id) => deleteAdminTicketPriority(id).then(load)}
              />
            </section>
          </div>

          <section className="space-y-4 rounded-2xl border border-border bg-elevated p-4 xl:col-span-2">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h3 className="text-base font-semibold text-textPrimary">Advanced ticket modules</h3>
                <p className="text-sm text-textSecondary">NF-style records for prefixes, custom fields, responses, escalations, banned emails, knowledge base, business hours, options, workflows, channels, and SLA rules.</p>
              </div>
              <span className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs text-primary">{features.length} configured</span>
            </div>

            <div className="grid gap-3 lg:grid-cols-[0.8fr_1fr_1fr_120px]">
              <select className="rounded-xl border border-border bg-background px-3 py-2 text-sm" value={featureForm.feature_type} onChange={(event) => setFeatureForm({ ...featureForm, feature_type: event.target.value })}>
                {featureTypes.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
              <input className="rounded-xl border border-border bg-background px-3 py-2 text-sm" placeholder="Title" value={featureForm.title} onChange={(event) => setFeatureForm({ ...featureForm, title: event.target.value })} />
              <input className="rounded-xl border border-border bg-background px-3 py-2 text-sm" placeholder="Slug / key" value={featureForm.slug} onChange={(event) => setFeatureForm({ ...featureForm, slug: event.target.value })} />
              <input className="rounded-xl border border-border bg-background px-3 py-2 text-sm" type="number" placeholder="Sort" value={featureForm.sort_order} onChange={(event) => setFeatureForm({ ...featureForm, sort_order: Number(event.target.value) })} />
              <textarea className="min-h-24 rounded-xl border border-border bg-background px-3 py-2 text-sm lg:col-span-2" placeholder="Body / response text / article content" value={featureForm.body} onChange={(event) => setFeatureForm({ ...featureForm, body: event.target.value })} />
              <textarea className="min-h-24 rounded-xl border border-border bg-background px-3 py-2 font-mono text-xs lg:col-span-2" placeholder='JSON config, for example {"field_type":"select","choices":["Bug","Billing"]}' value={featureForm.configText} onChange={(event) => setFeatureForm({ ...featureForm, configText: event.target.value })} />
              <label className="flex items-center gap-2 text-sm text-textSecondary">
                <input type="checkbox" checked={featureForm.is_active} onChange={(event) => setFeatureForm({ ...featureForm, is_active: event.target.checked })} />
                Active
              </label>
            </div>

            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => void saveFeature()} className={actionButtonClass("primary")}>
                <Save className="size-4" />
                {featureEditID ? "Update feature" : "Add feature"}
              </button>
              {featureEditID ? (
                <button type="button" onClick={() => { setFeatureEditID(null); setFeatureForm(blankFeature); }} className={actionButtonClass("neutral")}>
                  Cancel edit
                </button>
              ) : null}
            </div>

            <div className="grid gap-3 lg:grid-cols-2">
              {featureTypes.map((type) => {
                const records = features.filter((feature) => feature.feature_type === type.value);
                return (
                  <div key={type.value} className="rounded-2xl border border-border bg-background p-3">
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-textPrimary">{type.label}</p>
                      <span className="text-xs text-textSecondary">{records.length}</span>
                    </div>
                    <div className="space-y-2">
                      {records.length === 0 ? <p className="rounded-xl border border-dashed border-border p-3 text-xs text-textSecondary">No records configured.</p> : null}
                      {records.map((feature) => (
                        <div key={feature.id} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface p-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-textPrimary">{feature.title}</p>
                            <p className="truncate text-xs text-textSecondary">{feature.slug}</p>
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            <StatusBadge value={feature.is_active} />
                            <button
                              type="button"
                              onClick={() => {
                                setFeatureEditID(feature.id);
                                setFeatureForm({
                                  feature_type: feature.feature_type,
                                  title: feature.title,
                                  slug: feature.slug,
                                  body: feature.body || "",
                                  configText: JSON.stringify(feature.config || {}, null, 2),
                                  sort_order: feature.sort_order,
                                  is_active: feature.is_active,
                                });
                              }}
                              className={actionButtonClass("neutral")}
                            >
                              <Pencil className="size-4" />
                            </button>
                            <button type="button" onClick={() => void deleteAdminTicketFeature(feature.id).then(load)} className={actionButtonClass("danger")}>
                              <Trash2 className="size-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}

function ConfigList<T extends { id: string; name: string; slug: string; is_active?: boolean; is_closed?: boolean }>({
  items,
  onEdit,
  onDelete,
}: {
  items: T[];
  onEdit: (item: T) => void;
  onDelete: (id: string) => Promise<void>;
}) {
  return (
    <div className="divide-y divide-border rounded-2xl border border-border">
      {items.map((item) => (
        <div key={item.id} className="grid gap-3 p-3 sm:grid-cols-[1fr_auto] sm:items-center">
          <div>
            <p className="font-medium text-textPrimary">{item.name}</p>
            <p className="text-xs text-textSecondary">{item.slug}</p>
          </div>
          <div className="flex items-center gap-2">
            {"is_closed" in item ? <StatusBadge value={item.is_closed ? "closed" : "open"} /> : <StatusBadge value={item.is_active ?? true} />}
            <button type="button" onClick={() => onEdit(item)} className={actionButtonClass("neutral")}>
              <Pencil className="size-4" />
            </button>
            <button type="button" onClick={() => void onDelete(item.id)} className={actionButtonClass("danger")}>
              <Trash2 className="size-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
