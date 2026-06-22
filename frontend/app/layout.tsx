import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { fetchPublicSettings } from "@/lib/api";
import { themeStyle } from "@/lib/theme";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const settings = await fetchPublicSettings().catch(() => null);
  return {
    title: settings?.seo_default_title || "UpDigit Marketplace",
    description: settings?.seo_default_description || "Dark marketplace for digital products, plugins, scripts and game assets.",
    metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "https://updigit.net"),
    openGraph: {
      title: settings?.seo_default_title || "UpDigit Marketplace",
      description: settings?.seo_default_description || "Dark marketplace for digital products, plugins, scripts and game assets.",
      images: settings?.site_logo_url ? [settings.site_logo_url] : undefined,
    },
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const settings = await fetchPublicSettings().catch(() => null);
  return (
    <html lang="en" style={themeStyle(settings?.theme_config)}>
      <body className={`${inter.variable} ${mono.variable} bg-[var(--bg-base)] text-[var(--text-primary)]`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
