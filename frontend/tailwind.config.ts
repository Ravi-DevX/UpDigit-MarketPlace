import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: ["./app/**/*.{js,ts,jsx,tsx}", "./components/**/*.{js,ts,jsx,tsx}", "./lib/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "var(--color-background)",
        surface: "var(--color-surface)",
        elevated: "var(--color-elevated)",
        border: "var(--color-border)",
        primary: "var(--color-primary)",
        "primary-foreground": "var(--accent-foreground)",
        foreground: "var(--text-primary)",
        input: "var(--border)",
        ring: "var(--accent)",
        accent: "var(--bg-elevated)",
        "accent-foreground": "var(--text-primary)",
        secondary: "var(--bg-elevated)",
        "secondary-foreground": "var(--text-primary)",
        muted: "var(--bg-elevated)",
        "muted-foreground": "var(--text-secondary)",
        destructive: "var(--danger)",
        "destructive-foreground": "var(--accent-foreground)",
        success: "var(--color-success)",
        warning: "var(--color-warning)",
        danger: "var(--color-danger)",
        textPrimary: "var(--color-text-primary)",
        textSecondary: "var(--color-text-secondary)",
        textMuted: "var(--text-muted)",
        tremor: {
          background: { subtle: "var(--bg-elevated)" },
          "content-emphasis": "var(--text-primary)",
        },
        "dark-tremor": {
          background: { subtle: "var(--bg-elevated)" },
          "content-emphasis": "var(--text-primary)",
        },
      },
      fontFamily: {
        sans: ["var(--theme-font-sans)"],
        display: ["var(--theme-font-display)"],
        mono: ["var(--theme-font-mono)"],
      },
      borderRadius: {
        sm: "var(--radius-sm)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
        xl: "var(--radius-lg)",
        "2xl": "var(--radius-panel)",
        panel: "var(--radius-panel)",
        "tremor-small": "var(--radius-sm)",
        "tremor-default": "var(--radius-md)",
      },
      fontSize: {
        "tremor-label": "0.75rem",
        xs: "calc(0.75rem * var(--heading-scale))",
        sm: "calc(0.875rem * var(--heading-scale))",
        base: "calc(1rem * var(--heading-scale))",
        lg: "calc(1.125rem * var(--heading-scale))",
        xl: "calc(1.25rem * var(--heading-scale))",
        "2xl": "calc(1.5rem * var(--heading-scale))",
        "3xl": "calc(1.875rem * var(--heading-scale))",
        "4xl": "calc(2.25rem * var(--heading-scale))",
        "5xl": "calc(3rem * var(--heading-scale))",
      },
      boxShadow: {
        theme: "0 24px var(--shadow-blur) rgba(0, 0, 0, var(--shadow-strength))",
      },
    },
  },
  plugins: [],
};

export default config;
