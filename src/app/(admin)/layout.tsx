import { SidebarShell } from "@/components/shell/sidebar-shell";

const copy = { role: "Admin" };

// Admin console: desktop-first with a sidebar.
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarShell nav="admin" roleLabel={copy.role}>
      {children}
    </SidebarShell>
  );
}
