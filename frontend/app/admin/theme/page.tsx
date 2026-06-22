"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  Download,
  Eye,
  FileUp,
  Loader2,
  Palette,
  RotateCcw,
  Save,
  SlidersHorizontal,
  Sparkles,
  Type,
} from "lucide-react";
import { fetchAdminSettings, updateAdminSetting } from "@/lib/api";
import { applyTheme, defaultTheme, normalizeTheme, themePresets, type ThemeConfig } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { BadgeDelta } from "@/components/ui/badge-delta";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { Badge as StatusBadge } from "@/components/ui/cvui-badge";
import { PageHeader } from "@/app/admin/_components/AdminUI";

type EditorSection = "colors" | "typography" | "layout" | "components" | "effects";
type ThemeSection = Exclude<keyof ThemeConfig, "version">;

const sections: Array<{ id: EditorSection; label: string; icon: typeof Palette }> = [
  { id: "colors", label: "Colors", icon: Palette },
  { id: "typography", label: "Typography", icon: Type },
  { id: "layout", label: "Layout", icon: SlidersHorizontal },
  { id: "components", label: "Components", icon: Sparkles },
  { id: "effects", label: "Effects", icon: Eye },
];

const colorFields: Array<{ key: keyof ThemeConfig["colors"]; label: string; help: string }> = [
  { key: "background", label: "Page background", help: "The lowest-level background behind every page." },
  { key: "surface", label: "Surface", help: "Cards, inputs, lists, and repeated content areas." },
  { key: "elevated", label: "Elevated surface", help: "Menus, hover states, secondary buttons, and raised controls." },
  { key: "panel", label: "Glass panel base", help: "Navigation, sidebars, and framed operational panels." },
  { key: "border", label: "Border", help: "Default dividers and component outlines." },
  { key: "borderHover", label: "Border hover", help: "Stronger outline for hover and active states." },
  { key: "primary", label: "Primary action", help: "Links, active tabs, primary buttons, and focus rings." },
  { key: "primaryHover", label: "Primary hover", help: "Hover state for primary actions." },
  { key: "primaryForeground", label: "Primary text", help: "Text and icons placed over the primary color." },
  { key: "success", label: "Success", help: "Approved, complete, positive, and increasing states." },
  { key: "warning", label: "Warning", help: "Pending, incomplete, and caution states." },
  { key: "danger", label: "Danger", help: "Errors, rejected states, and destructive actions." },
  { key: "textPrimary", label: "Primary text", help: "Headings and high-emphasis content." },
  { key: "textSecondary", label: "Secondary text", help: "Descriptions, metadata, and supporting content." },
  { key: "textMuted", label: "Muted text", help: "Placeholders and low-emphasis labels." },
];

const fontOptions = [
  { value: "inter", label: "Inter" },
  { value: "system", label: "System UI" },
  { value: "arial", label: "Arial" },
  { value: "georgia", label: "Georgia" },
  { value: "trebuchet", label: "Trebuchet MS" },
];

function hexToLuminance(hex: string) {
  const channels = [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16) / 255).map((value) => value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

function contrastRatio(foreground: string, background: string) {
  const light = Math.max(hexToLuminance(foreground), hexToLuminance(background));
  const dark = Math.min(hexToLuminance(foreground), hexToLuminance(background));
  return (light + 0.05) / (dark + 0.05);
}

function ControlShell({ label, help, value, children }: { label: string; help: string; value?: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-2 border-b border-border pb-4 last:border-0 last:pb-0">
      <span className="flex items-center justify-between gap-3 text-sm font-medium text-textPrimary"><span>{label}</span>{value ? <span className="font-mono text-xs text-textSecondary">{value}</span> : null}</span>
      {children}
      <span className="text-xs leading-5 text-textSecondary">{help}</span>
    </label>
  );
}

function RangeControl({ label, help, value, min, max, step = 1, suffix = "", onChange }: { label: string; help: string; value: number; min: number; max: number; step?: number; suffix?: string; onChange: (value: number) => void }) {
  return (
    <ControlShell label={label} help={help} value={`${value}${suffix}`}>
      <div className="grid grid-cols-[1fr_76px] gap-3">
        <input type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} className="w-full accent-primary" />
        <input type="number" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} className="field-input min-h-9 px-2 py-1 text-right font-mono text-xs" />
      </div>
    </ControlShell>
  );
}

export default function AdminThemePage() {
  const [theme, setTheme] = useState<ThemeConfig>(defaultTheme);
  const [activeSection, setActiveSection] = useState<EditorSection>("colors");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ type: "success" | "warning"; title: string; description: string } | null>(null);
  const [savedTheme, setSavedTheme] = useState<ThemeConfig>(defaultTheme);
  const persistedTheme = useRef<ThemeConfig>(defaultTheme);
  const importInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let mounted = true;
    void fetchAdminSettings()
      .then((settings) => {
        if (!mounted) return;
        const loaded = normalizeTheme(settings.theme_config);
        setTheme(loaded);
        setSavedTheme(loaded);
        persistedTheme.current = loaded;
        applyTheme(loaded);
      })
      .catch(() => setNotice({ type: "warning", title: "Theme could not load", description: "The default theme is shown. Check the admin API before saving." }))
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
      applyTheme(persistedTheme.current);
    };
  }, []);

  useEffect(() => applyTheme(theme), [theme]);

  const dirty = useMemo(() => JSON.stringify(theme) !== JSON.stringify(savedTheme), [savedTheme, theme]);
  const bodyContrast = contrastRatio(theme.colors.textPrimary, theme.colors.background);
  const secondaryContrast = contrastRatio(theme.colors.textSecondary, theme.colors.background);

  const update = <S extends ThemeSection, K extends keyof ThemeConfig[S]>(section: S, key: K, value: ThemeConfig[S][K]) => {
    setTheme((current) => ({ ...current, [section]: { ...current[section], [key]: value } }));
    setNotice(null);
  };

  const save = async () => {
    setSaving(true);
    setNotice(null);
    try {
      const normalized = normalizeTheme(theme);
      await updateAdminSetting("theme_config", normalized);
      setTheme(normalized);
      setSavedTheme(normalized);
      persistedTheme.current = normalized;
      setNotice({ type: "success", title: "Theme published", description: "The new design tokens now apply to public, seller, and admin pages." });
    } catch {
      setNotice({ type: "warning", title: "Theme was not saved", description: "Review the connection and try again. Your local preview is still available." });
    } finally {
      setSaving(false);
    }
  };

  const applyPreset = (preset: ThemeConfig) => {
    setTheme(normalizeTheme(preset));
    setNotice(null);
  };

  const exportTheme = () => {
    const blob = new Blob([JSON.stringify(theme, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "updigit-theme.json";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const importTheme = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      setTheme(normalizeTheme(JSON.parse(await file.text())));
      setNotice({ type: "success", title: "Theme imported", description: "Review the live preview, then publish when ready." });
    } catch {
      setNotice({ type: "warning", title: "Import failed", description: "Choose a valid UpDigit theme JSON file." });
    } finally {
      event.target.value = "";
    }
  };

  if (loading) {
    return <div className="flex min-h-96 items-center justify-center text-textSecondary"><Loader2 className="size-5 animate-spin" /></div>;
  }

  return (
    <section className="space-y-6">
      <PageHeader eyebrow="Appearance" title="Theme Studio" description="Configure the shared design tokens used across marketplace, seller, customer, and admin interfaces." />

      {notice ? <Banner show variant={notice.type} title={notice.title} description={notice.description} closable onHide={() => setNotice(null)} icon={notice.type === "success" ? <Check className="size-4" /> : <Palette className="size-4" />} /> : null}

      <div className="flex flex-col gap-3 border-y border-border py-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-wrap gap-2">
          {themePresets.map((preset) => <Button key={preset.id} type="button" variant="outline" size="sm" title={preset.description} onClick={() => applyPreset(preset.theme)}>{preset.name}</Button>)}
        </div>
        <div className="flex flex-wrap gap-2">
          <input ref={importInput} type="file" accept="application/json" className="sr-only" onChange={(event) => void importTheme(event)} />
          <Button type="button" variant="ghost" size="sm" onClick={() => importInput.current?.click()}><FileUp className="size-4" /> Import</Button>
          <Button type="button" variant="ghost" size="sm" onClick={exportTheme}><Download className="size-4" /> Export</Button>
          <Button type="button" variant="ghost" size="sm" disabled={!dirty} onClick={() => setTheme(savedTheme)}><RotateCcw className="size-4" /> Revert</Button>
          <Button type="button" disabled={saving || !dirty} onClick={() => void save()}>{saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Publish theme</Button>
        </div>
      </div>

      <nav className="overflow-x-auto border-b border-border" aria-label="Theme sections">
        <div className="flex min-w-max gap-1">
          {sections.map(({ id, label, icon: Icon }) => (
            <button key={id} type="button" onClick={() => setActiveSection(id)} className={cn("inline-flex h-11 items-center gap-2 border-b-2 px-4 text-sm", activeSection === id ? "border-primary text-textPrimary" : "border-transparent text-textSecondary hover:text-textPrimary")}>
              <Icon className="size-4" /> {label}
            </button>
          ))}
        </div>
      </nav>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.82fr)]">
        <div className="rounded-lg border border-border bg-surface p-[var(--card-padding)]">
          {activeSection === "colors" ? (
            <div className="grid gap-4 md:grid-cols-2">
              {colorFields.map((field) => (
                <ControlShell key={field.key} label={field.label} help={field.help} value={theme.colors[field.key]}>
                  <div className="grid grid-cols-[44px_1fr] gap-2">
                    <input type="color" value={theme.colors[field.key]} onChange={(event) => update("colors", field.key, event.target.value)} className="size-11 cursor-pointer rounded-md border border-border bg-transparent p-1" />
                    <input value={theme.colors[field.key]} maxLength={7} onChange={(event) => /^#[0-9a-f]{0,6}$/i.test(event.target.value) && update("colors", field.key, event.target.value as string)} onBlur={() => setTheme(normalizeTheme(theme))} className="field-input font-mono uppercase" />
                  </div>
                </ControlShell>
              ))}
            </div>
          ) : null}

          {activeSection === "typography" ? (
            <div className="space-y-4">
              <ControlShell label="Body font" help="Used for navigation, forms, metadata, and long-form content."><select value={theme.typography.bodyFont} onChange={(event) => update("typography", "bodyFont", event.target.value as ThemeConfig["typography"]["bodyFont"])} className="field-input">{fontOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></ControlShell>
              <ControlShell label="Display font" help="Used for page, section, and card headings."><select value={theme.typography.displayFont} onChange={(event) => update("typography", "displayFont", event.target.value as ThemeConfig["typography"]["displayFont"])} className="field-input">{fontOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></ControlShell>
              <ControlShell label="Monospace font" help="Used for code, IDs, slugs, and technical values."><select value={theme.typography.monoFont} onChange={(event) => update("typography", "monoFont", event.target.value as ThemeConfig["typography"]["monoFont"])} className="field-input"><option value="jetbrains">JetBrains Mono</option><option value="system">System monospace</option><option value="courier">Courier New</option></select></ControlShell>
              <RangeControl label="Base text size" help="Scales the default reading size throughout the interface." value={theme.typography.baseSize} min={12} max={20} suffix="px" onChange={(value) => update("typography", "baseSize", value)} />
              <RangeControl label="Line height" help="Controls vertical reading space in paragraphs and controls." value={theme.typography.lineHeight} min={1.2} max={2} step={0.05} onChange={(value) => update("typography", "lineHeight", value)} />
              <RangeControl label="Interface type scale" help="Scales labels, headings, buttons, badges, and responsive utility text together." value={theme.typography.headingScale} min={0.8} max={1.4} step={0.05} onChange={(value) => update("typography", "headingScale", value)} />
              <RangeControl label="Body weight" help="Default weight for interface and paragraph text." value={theme.typography.bodyWeight} min={300} max={600} step={100} onChange={(value) => update("typography", "bodyWeight", value)} />
              <RangeControl label="Heading weight" help="Weight applied to all heading levels." value={theme.typography.headingWeight} min={400} max={800} step={100} onChange={(value) => update("typography", "headingWeight", value)} />
              <RangeControl label="Letter spacing" help="Adds subtle tracking to all body text. Zero is recommended." value={theme.typography.letterSpacing} min={0} max={0.08} step={0.005} suffix="em" onChange={(value) => update("typography", "letterSpacing", value)} />
            </div>
          ) : null}

          {activeSection === "layout" ? <div className="space-y-4"><RangeControl label="Content width" help="Maximum width used by public, seller, and admin page frames." value={theme.layout.contentWidth} min={960} max={2200} step={20} suffix="px" onChange={(value) => update("layout", "contentWidth", value)} /><RangeControl label="Page gutter" help="Responsive breathing room at the left and right viewport edges." value={theme.layout.pageGutter} min={8} max={96} step={2} suffix="px" onChange={(value) => update("layout", "pageGutter", value)} /><RangeControl label="Sidebar width" help="Width of resource, seller, account, and admin sidebars." value={theme.layout.sidebarWidth} min={220} max={420} step={10} suffix="px" onChange={(value) => update("layout", "sidebarWidth", value)} /><RangeControl label="Product grid minimum" help="Smallest product card width before the grid wraps." value={theme.layout.gridMinWidth} min={240} max={520} step={10} suffix="px" onChange={(value) => update("layout", "gridMinWidth", value)} /></div> : null}

          {activeSection === "components" ? <div className="space-y-4"><RangeControl label="Button height" help="Default command button and icon-button size." value={theme.components.buttonHeight} min={32} max={60} suffix="px" onChange={(value) => update("components", "buttonHeight", value)} /><RangeControl label="Input height" help="Minimum height for text, number, select, and editor controls." value={theme.components.inputHeight} min={34} max={64} suffix="px" onChange={(value) => update("components", "inputHeight", value)} /><RangeControl label="Card padding" help="Default interior spacing for cards and framed tools." value={theme.components.cardPadding} min={8} max={40} suffix="px" onChange={(value) => update("components", "cardPadding", value)} /><RangeControl label="Navigation height" help="Target height for the global navigation surface." value={theme.components.navigationHeight} min={48} max={88} suffix="px" onChange={(value) => update("components", "navigationHeight", value)} /><RangeControl label="Small radius" help="Tags, compact fields, and small controls." value={theme.shape.radiusSmall} min={0} max={16} suffix="px" onChange={(value) => update("shape", "radiusSmall", value)} /><RangeControl label="Medium radius" help="Buttons, inputs, tables, and standard components." value={theme.shape.radiusMedium} min={0} max={24} suffix="px" onChange={(value) => update("shape", "radiusMedium", value)} /><RangeControl label="Large radius" help="Cards, media, and repeated content items." value={theme.shape.radiusLarge} min={0} max={32} suffix="px" onChange={(value) => update("shape", "radiusLarge", value)} /><RangeControl label="Panel radius" help="Navigation, sidebars, dashboards, and major framed tools." value={theme.shape.radiusPanel} min={0} max={48} suffix="px" onChange={(value) => update("shape", "radiusPanel", value)} /><RangeControl label="Border width" help="Global structural outline thickness." value={theme.shape.borderWidth} min={0} max={3} step={0.5} suffix="px" onChange={(value) => update("shape", "borderWidth", value)} /></div> : null}

          {activeSection === "effects" ? <div className="space-y-4"><RangeControl label="Shadow strength" help="Opacity of elevated panel and modal shadows." value={theme.effects.shadowStrength} min={0} max={80} suffix="%" onChange={(value) => update("effects", "shadowStrength", value)} /><RangeControl label="Shadow blur" help="Softness and reach of elevated shadows." value={theme.effects.shadowBlur} min={0} max={140} suffix="px" onChange={(value) => update("effects", "shadowBlur", value)} /><RangeControl label="Glass blur" help="Backdrop blur applied to navigation and glass panels." value={theme.effects.glassBlur} min={0} max={48} suffix="px" onChange={(value) => update("effects", "glassBlur", value)} /><RangeControl label="Glass opacity" help="Opacity of the glass panel base color." value={theme.effects.glassOpacity} min={0} max={100} suffix="%" onChange={(value) => update("effects", "glassOpacity", value)} /><RangeControl label="Motion speed" help="Shared transition duration for interactive controls." value={theme.effects.transitionSpeed} min={0} max={500} step={25} suffix="ms" onChange={(value) => update("effects", "transitionSpeed", value)} /></div> : null}
        </div>

        <aside className="space-y-4 xl:sticky xl:top-28">
          <div className="rounded-lg border border-border bg-[var(--bg-panel)] p-[var(--card-padding)] shadow-theme">
            <div className="flex items-start justify-between gap-3 border-b border-border pb-4"><div><p className="text-xs uppercase tracking-[0.16em] text-primary">Live preview</p><h2 className="mt-1 text-xl text-textPrimary">Marketplace surface</h2></div><StatusBadge label="Published tokens" variant="success" appearance="subtle" size="small" /></div>
            <div className="mt-5 space-y-4">
              <div className="rounded-lg border border-border bg-surface p-[var(--card-padding)]"><div className="flex items-center justify-between"><span className="text-sm text-textSecondary">Monthly revenue</span><BadgeDelta variant="solid" deltaType="increase" iconStyle="line" value="9.3%" /></div><p className="mt-4 text-3xl font-semibold text-textPrimary">$24,680</p><p className="mt-1 text-sm text-textSecondary">Across approved marketplace orders</p></div>
              <div className="grid gap-3 sm:grid-cols-2"><Button>Primary action</Button><Button variant="outline">Secondary</Button></div>
              <input className="field-input" placeholder="Theme-aware input" />
              <div className="flex flex-wrap gap-2"><StatusBadge label="Approved" variant="success" appearance="subtle" size="small" /><StatusBadge label="Pending" variant="warning" appearance="subtle" size="small" /><StatusBadge label="Rejected" variant="error" appearance="subtle" size="small" /></div>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-surface p-4"><div className="flex items-center justify-between gap-3"><span className="text-sm font-medium text-textPrimary">Primary text contrast</span><span className={bodyContrast >= 4.5 ? "text-success" : "text-warning"}>{bodyContrast.toFixed(2)}:1</span></div><p className="mt-1 text-xs text-textSecondary">WCAG AA requires at least 4.5:1 for normal text.</p><div className="mt-3 flex items-center justify-between gap-3"><span className="text-sm font-medium text-textPrimary">Secondary text contrast</span><span className={secondaryContrast >= 4.5 ? "text-success" : "text-warning"}>{secondaryContrast.toFixed(2)}:1</span></div></div>
        </aside>
      </div>
    </section>
  );
}
