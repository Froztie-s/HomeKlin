import { SidebarShell } from "@/components/shell/sidebar-shell";

const copy = { role: "Agensi" };

// Agency back office: desktop-first with a sidebar.
export default function AgencyLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarShell nav="agency" roleLabel={copy.role}>
      {children}
    </SidebarShell>
  );
}
