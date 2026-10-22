import { useTranslations } from "next-intl";
import { SidebarShell } from "@/components/shell/sidebar-shell";

// Admin console: desktop-first with a sidebar.
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const t = useTranslations("BackOfficeShell");
  return (
    <SidebarShell nav="admin" roleLabel={t("adminRole")}>
      {children}
    </SidebarShell>
  );
}
