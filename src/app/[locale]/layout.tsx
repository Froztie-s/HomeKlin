import type { Metadata, Viewport } from "next";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { ClientMessages } from "@/i18n/client-messages";
import { routing } from "@/i18n/routing";
import { appFontVariables } from "../fonts";
import "../globals.css";

// The root layout, one per language (T4): /home is Indonesian, /en/home English (src/proxy.ts maps the
// addresses). Both languages are prerendered at build time; the language comes from the URL, so no
// page reads cookies or headers to render.
// Sources: node_modules/next/dist/docs/01-app/02-guides/internationalization.md ("Static Rendering")
// and https://next-intl.dev/docs/routing/setup
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Metadata");
  return {
    // The landing page sets no title, so its tab reads "HomeKlin"; other pages read "Layanan · HomeKlin".
    title: { default: "HomeKlin", template: "%s · HomeKlin" },
    description: t("description"),
  };
}

// viewport-fit=cover lets the bottom navigation pad itself for the phone's home indicator.
export const viewport: Viewport = {
  viewportFit: "cover",
};

export default async function LocaleLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  // dynamicParams = false does not exist with Cache Components, so an unknown value is refused here.
  if (!hasLocale(routing.locales, locale)) notFound();

  return (
    <html lang={locale} className={`${appFontVariables} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-canvas font-sans text-ink">
        <ClientMessages>{children}</ClientMessages>
      </body>
    </html>
  );
}
