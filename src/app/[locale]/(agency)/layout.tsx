import { useTranslations } from "next-intl";
import { SidebarShell } from "@/components/shell/sidebar-shell";

// Agency back office: desktop-first with a sidebar.
export default function AgencyLayout({ children }: { children: React.ReactNode }) {
  const t = useTranslations("BackOfficeShell");
  return (
    <SidebarShell nav="agency" roleLabel={t("agencyRole")}>
      {children}
    </SidebarShell>
  );
}
