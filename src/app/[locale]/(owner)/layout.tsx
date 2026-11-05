import { useTranslations } from "next-intl";
import { SidebarShell } from "@/components/shell/sidebar-shell";

// The owner's dashboard: desktop-first with a sidebar, like the admin console.
export default function OwnerLayout({ children }: { children: React.ReactNode }) {
  const t = useTranslations("OwnerNavigation");
  return (
    <SidebarShell nav="owner" roleLabel={t("role")}>
      {children}
    </SidebarShell>
  );
}
