import { useLocale, useTranslations } from "next-intl";
import { forestFontVariables } from "@/app/fonts-forest";
import { OrderSearch } from "@/components/back-office/order-search";
import { SidebarShell } from "@/components/shell/sidebar-shell";
import { ClientMessages } from "@/i18n/client-messages";

// Admin console: desktop-first with a sidebar. It opts in to the redesign like the landing page
// (Phase 13): `theme-forest` gives the shared token names their redesign values and the wrapper loads
// the redesign's fonts (src/app/fonts-forest.ts). The sidebar is fixed, but it is a descendant of the
// wrapper, so it inherits both. The forest tone (R2) draws the shell as the redesign's dark-green band.
// The wordmark leads to live monitoring, the console's start page (R2b: /admin redirects there too).
// The agency (D2) and owner (D3) consoles use the same forest shell. Admin's order search (audit item 1)
// sits on the band under the role card, and at the top of the menu below 1024 px, so an order can be
// found from every admin page; its own messages go to the browser only here.
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const t = useTranslations("BackOfficeShell");
  const locale = useLocale();
  return (
    <div className={`theme-forest ${forestFontVariables} flex flex-1 flex-col bg-canvas font-sans text-ink`}>
      <SidebarShell
        nav="admin"
        roleLabel={t("adminRole")}
        tone="forest"
        // "Admin Dashboard" is English in both languages (the user's choice), so on the Indonesian page
        // it is marked English and a screen reader says it in English.
        roleCard={{
          label: t("adminDashboard"),
          labelLang: locale === "en" ? undefined : "en",
          title: t("adminOperations"),
        }}
        home={{ href: "/admin/monitor", label: t("adminHome") }}
        tool={
          <ClientMessages namespaces={["AdminOrderSearch"]}>
            <OrderSearch />
          </ClientMessages>
        }
      >
        {children}
      </SidebarShell>
    </div>
  );
}
