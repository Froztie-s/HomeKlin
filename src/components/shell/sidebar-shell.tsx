import type { ReactNode } from "react";
import { Wordmark } from "@/components/brand/wordmark";
import { BackOfficeTopBar } from "./back-office-top-bar";
import type { NavKey } from "./navigation";
import { RoleBadge } from "./role-badge";
import { SideNavList } from "./side-nav-list";
import { SkipLink } from "./skip-link";

type SidebarShellProps = {
  nav: Extract<NavKey, "agency" | "admin">;
  /** Shown next to the wordmark: "Agensi" or "Admin". */
  roleLabel: string;
  children: ReactNode;
};

// Agency and admin shell: desktop-first with a fixed sidebar; a top bar with a menu below 1024 px.
export function SidebarShell({ nav, roleLabel, children }: SidebarShellProps) {
  return (
    <div className="flex flex-1 flex-col lg:pl-sidebar">
      <SkipLink />
      <aside className="fixed inset-y-0 left-0 z-(--z-sticky) hidden w-sidebar flex-col border-r border-border bg-panel lg:flex">
        <div className="flex h-16 items-center gap-2 px-5">
          <Wordmark />
          <RoleBadge label={roleLabel} />
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-3">
          <SideNavList nav={nav} />
        </div>
      </aside>
      <BackOfficeTopBar nav={nav} roleLabel={roleLabel} />
      <main id="konten" tabIndex={-1} className="flex flex-1 flex-col outline-none">
        <div className="mx-auto flex w-full max-w-dashboard flex-col gap-6 px-safe py-6 lg:px-gutter-wide lg:py-8">
          {children}
        </div>
      </main>
    </div>
  );
}
