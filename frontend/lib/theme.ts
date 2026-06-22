import type { CSSProperties } from "react";

export type ThemeConfig = {
  version: 1;
  colors: {
    background: string;
    surface: string;
    elevated: string;
    panel: string;
    border: string;
    borderHover: string;
    primary: string;
    primaryHover: string;
    primaryForeground: string;
    success: string;
    warning: string;
    danger: string;
    textPrimary: string;
    textSecondary: string;
    textMuted: string;
  };
  typography: {
    bodyFont: "inter" | "system" | "arial" | "georgia" | "trebuchet";
    displayFont: "inter" | "system" | "arial" | "georgia" | "trebuchet";
    monoFont: "jetbrains" | "system" | "courier";
    baseSize: number;
    lineHeight: number;
    headingScale: number;
    bodyWeight: number;
    headingWeight: number;
    letterSpacing: number;
  };
  layout: {
    contentWidth: number;
    pageGutter: number;
    sidebarWidth: number;
    gridMinWidth: number;
  };
  shape: {
    radiusSmall: number;
    radiusMedium: number;
    radiusLarge: number;
    radiusPanel: number;
    borderWidth: number;
  };
  components: {
    buttonHeight: number;
    inputHeight: number;
    cardPadding: number;
    navigationHeight: number;
  };
  effects: {
    shadowStrength: number;
    shadowBlur: number;
    glassBlur: number;
    glassOpacity: number;
    transitionSpeed: number;
  };
};

export const defaultTheme: ThemeConfig = {
  version: 1,
  colors: {
    background: "#0a0a0a",
    surface: "#111111",
    elevated: "#1a1a1a",
    panel: "#11151e",
    border: "#2f3746",
    borderHover: "#3d485c",
    primary: "#6366f1",
    primaryHover: "#4f46e5",
    primaryForeground: "#ffffff",
    success: "#22c55e",
    warning: "#f59e0b",
    danger: "#ef4444",
    textPrimary: "#f9fafb",
    textSecondary: "#9ca3af",
    textMuted: "#6b7280",
  },
  typography: {
    bodyFont: "inter",
    displayFont: "inter",
    monoFont: "jetbrains",
    baseSize: 14,
    lineHeight: 1.6,
    headingScale: 1,
    bodyWeight: 400,
    headingWeight: 600,
    letterSpacing: 0,
  },
  layout: {
    contentWidth: 1680,
    pageGutter: 32,
    sidebarWidth: 300,
    gridMinWidth: 340,
  },
  shape: {
    radiusSmall: 5,
    radiusMedium: 8,
    radiusLarge: 16,
    radiusPanel: 24,
    borderWidth: 1,
  },
  components: {
    buttonHeight: 40,
    inputHeight: 44,
    cardPadding: 20,
    navigationHeight: 64,
  },
  effects: {
    shadowStrength: 34,
    shadowBlur: 90,
    glassBlur: 24,
    glassOpacity: 7,
    transitionSpeed: 150,
  },
};

export const themePresets: Array<{ id: string; name: string; description: string; theme: ThemeConfig }> = [
  { id: "updigit", name: "UpDigit", description: "Current dark marketplace theme.", theme: defaultTheme },
  {
    id: "graphite",
    name: "Graphite",
    description: "Neutral surfaces with a crisp cyan action color.",
    theme: {
      ...defaultTheme,
      colors: { ...defaultTheme.colors, background: "#0b0d0f", surface: "#121519", elevated: "#1a1f24", panel: "#14191f", border: "#303842", borderHover: "#44515e", primary: "#16b8c4", primaryHover: "#0e929d" },
      shape: { ...defaultTheme.shape, radiusLarge: 12, radiusPanel: 16 },
    },
  },
  {
    id: "carbon",
    name: "Carbon Gold",
    description: "High-contrast black with restrained gold accents.",
    theme: {
      ...defaultTheme,
      colors: { ...defaultTheme.colors, background: "#070707", surface: "#101010", elevated: "#181818", panel: "#121212", border: "#303030", borderHover: "#4a4a4a", primary: "#d6a84b", primaryHover: "#b98b34", primaryForeground: "#0a0a0a", textSecondary: "#b7b7b7" },
      typography: { ...defaultTheme.typography, displayFont: "georgia", headingWeight: 600 },
    },
  },
  {
    id: "daylight",
    name: "Daylight",
    description: "Accessible light palette for bright environments.",
    theme: {
      ...defaultTheme,
      colors: { ...defaultTheme.colors, background: "#f5f7fa", surface: "#ffffff", elevated: "#eef1f5", panel: "#ffffff", border: "#d8dee8", borderHover: "#b7c1cf", primary: "#2457d6", primaryHover: "#1944ad", primaryForeground: "#ffffff", textPrimary: "#172033", textSecondary: "#526079", textMuted: "#738098", success: "#15803d", warning: "#b45309", danger: "#c92a2a" },
      effects: { ...defaultTheme.effects, shadowStrength: 12, glassOpacity: 88, glassBlur: 12 },
    },
  },
];

const hexPattern = /^#[0-9a-f]{6}$/i;
const bodyFonts = ["inter", "system", "arial", "georgia", "trebuchet"] as const;
const monoFonts = ["jetbrains", "system", "courier"] as const;

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function color(value: unknown, fallback: string) {
  return typeof value === "string" && hexPattern.test(value) ? value.toLowerCase() : fallback;
}

function numberValue(value: unknown, fallback: number, minimum: number, maximum: number) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? Math.min(maximum, Math.max(minimum, parsed)) : fallback;
}

function choice<T extends readonly string[]>(value: unknown, values: T, fallback: T[number]): T[number] {
  return typeof value === "string" && values.includes(value) ? value as T[number] : fallback;
}

export function normalizeTheme(value: unknown): ThemeConfig {
  const source = record(value);
  const colors = record(source.colors);
  const typography = record(source.typography);
  const layout = record(source.layout);
  const shape = record(source.shape);
  const components = record(source.components);
  const effects = record(source.effects);
  return {
    version: 1,
    colors: Object.fromEntries(Object.entries(defaultTheme.colors).map(([key, fallback]) => [key, color(colors[key], fallback)])) as ThemeConfig["colors"],
    typography: {
      bodyFont: choice(typography.bodyFont, bodyFonts, defaultTheme.typography.bodyFont),
      displayFont: choice(typography.displayFont, bodyFonts, defaultTheme.typography.displayFont),
      monoFont: choice(typography.monoFont, monoFonts, defaultTheme.typography.monoFont),
      baseSize: numberValue(typography.baseSize, 14, 12, 20),
      lineHeight: numberValue(typography.lineHeight, 1.6, 1.2, 2),
      headingScale: numberValue(typography.headingScale, 1, 0.8, 1.4),
      bodyWeight: numberValue(typography.bodyWeight, 400, 300, 600),
      headingWeight: numberValue(typography.headingWeight, 600, 400, 800),
      letterSpacing: numberValue(typography.letterSpacing, 0, 0, 0.08),
    },
    layout: {
      contentWidth: numberValue(layout.contentWidth, 1680, 960, 2200),
      pageGutter: numberValue(layout.pageGutter, 32, 8, 96),
      sidebarWidth: numberValue(layout.sidebarWidth, 300, 220, 420),
      gridMinWidth: numberValue(layout.gridMinWidth, 340, 240, 520),
    },
    shape: {
      radiusSmall: numberValue(shape.radiusSmall, 5, 0, 16),
      radiusMedium: numberValue(shape.radiusMedium, 8, 0, 24),
      radiusLarge: numberValue(shape.radiusLarge, 16, 0, 32),
      radiusPanel: numberValue(shape.radiusPanel, 24, 0, 48),
      borderWidth: numberValue(shape.borderWidth, 1, 0, 3),
    },
    components: {
      buttonHeight: numberValue(components.buttonHeight, 40, 32, 60),
      inputHeight: numberValue(components.inputHeight, 44, 34, 64),
      cardPadding: numberValue(components.cardPadding, 20, 8, 40),
      navigationHeight: numberValue(components.navigationHeight, 64, 48, 88),
    },
    effects: {
      shadowStrength: numberValue(effects.shadowStrength, 34, 0, 80),
      shadowBlur: numberValue(effects.shadowBlur, 90, 0, 140),
      glassBlur: numberValue(effects.glassBlur, 24, 0, 48),
      glassOpacity: numberValue(effects.glassOpacity, 7, 0, 100),
      transitionSpeed: numberValue(effects.transitionSpeed, 150, 0, 500),
    },
  };
}

const fontStacks = {
  inter: "var(--font-sans), Inter, ui-sans-serif, system-ui, sans-serif",
  system: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  arial: "Arial, Helvetica, sans-serif",
  georgia: "Georgia, 'Times New Roman', serif",
  trebuchet: "'Trebuchet MS', Arial, sans-serif",
  jetbrains: "var(--font-mono), 'JetBrains Mono', ui-monospace, monospace",
  courier: "'Courier New', Courier, monospace",
};

function hexToRGB(value: string) {
  const normalized = value.slice(1);
  return `${parseInt(normalized.slice(0, 2), 16)} ${parseInt(normalized.slice(2, 4), 16)} ${parseInt(normalized.slice(4, 6), 16)}`;
}

function isLightColor(value: string) {
  const channels = value.slice(1).match(/.{2}/g)?.map((channel) => parseInt(channel, 16)) ?? [0, 0, 0];
  return (channels[0] * 0.299 + channels[1] * 0.587 + channels[2] * 0.114) / 255 > 0.62;
}

export function themeVariables(value: unknown): Record<`--${string}`, string> {
  const theme = normalizeTheme(value);
  return {
    "--bg-base": theme.colors.background,
    "--bg-surface": theme.colors.surface,
    "--bg-elevated": theme.colors.elevated,
    "--bg-panel": theme.colors.panel,
    "--border": theme.colors.border,
    "--border-hover": theme.colors.borderHover,
    "--accent": theme.colors.primary,
    "--accent-rgb": hexToRGB(theme.colors.primary),
    "--accent-muted": `rgb(${hexToRGB(theme.colors.primary)} / 0.12)`,
    "--accent-hover": theme.colors.primaryHover,
    "--accent-foreground": theme.colors.primaryForeground,
    "--success": theme.colors.success,
    "--warning": theme.colors.warning,
    "--danger": theme.colors.danger,
    "--text-primary": theme.colors.textPrimary,
    "--text-secondary": theme.colors.textSecondary,
    "--text-muted": theme.colors.textMuted,
    "--theme-font-sans": fontStacks[theme.typography.bodyFont],
    "--theme-font-display": fontStacks[theme.typography.displayFont],
    "--theme-font-mono": fontStacks[theme.typography.monoFont],
    "--font-size-base": `${theme.typography.baseSize}px`,
    "--line-height-base": String(theme.typography.lineHeight),
    "--heading-scale": String(theme.typography.headingScale),
    "--body-weight": String(theme.typography.bodyWeight),
    "--heading-weight": String(theme.typography.headingWeight),
    "--letter-spacing-base": `${theme.typography.letterSpacing}em`,
    "--content-width": `${theme.layout.contentWidth}px`,
    "--page-gutter": `${theme.layout.pageGutter}px`,
    "--sidebar-width": `${theme.layout.sidebarWidth}px`,
    "--grid-min-width": `${theme.layout.gridMinWidth}px`,
    "--radius-sm": `${theme.shape.radiusSmall}px`,
    "--radius-md": `${theme.shape.radiusMedium}px`,
    "--radius-lg": `${theme.shape.radiusLarge}px`,
    "--radius-panel": `${theme.shape.radiusPanel}px`,
    "--border-width": `${theme.shape.borderWidth}px`,
    "--button-height": `${theme.components.buttonHeight}px`,
    "--input-height": `${theme.components.inputHeight}px`,
    "--card-padding": `${theme.components.cardPadding}px`,
    "--navigation-height": `${theme.components.navigationHeight}px`,
    "--shadow-strength": String(theme.effects.shadowStrength / 100),
    "--shadow-blur": `${theme.effects.shadowBlur}px`,
    "--glass-blur": `${theme.effects.glassBlur}px`,
    "--glass-opacity": `${theme.effects.glassOpacity}%`,
    "--transition-speed": `${theme.effects.transitionSpeed}ms`,
    "--color-scheme": isLightColor(theme.colors.background) ? "light" : "dark",
  };
}

export function themeStyle(value: unknown): CSSProperties {
  return themeVariables(value) as CSSProperties;
}

export function applyTheme(value: unknown) {
  if (typeof document === "undefined") return;
  const variables = themeVariables(value);
  for (const [key, setting] of Object.entries(variables)) {
    document.documentElement.style.setProperty(key, setting);
  }
}
