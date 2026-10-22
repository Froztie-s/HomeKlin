import { Suspense, type ReactNode } from "react";
import { AccountSummary } from "@/components/auth/account-summary";
import { Wordmark } from "@/components/brand/wordmark";
import { ClientMessages } from "@/i18n/client-messages";
import { BackOfficeTopBar } from "./back-office-top-bar";
import { LanguageSwitch } from "./language-switch";
import type { BackOfficeNavKey } from "./navigation";
import { RoleBadge } from "./role-badge";
import { SideNavList } from "./side-nav-list";
import { SkipLink } from "./skip-link";

type SidebarShellProps = {
  nav: BackOfficeNavKey;
  /** Shown next to the wordmark: "Agensi" or "Admin". */
  roleLabel: string;
  children: ReactNode;
};

// Agency and admin shell: desktop-first with a fixed sidebar; a top bar with a menu below 1024 px.
// The sidebar closes with the account (who is signed in, and signing out) and the language switch,
// under the sections, where staff look for settings rather than for work. The account part reads the
// session, so it streams in behind <Suspense> while the rest of the shell stays prerendered. The
// back-office menus' messages are sent to the browser only from here.
export function SidebarShell({ nav, roleLabel, children }: SidebarShellProps) {
  return (
    <ClientMessages namespaces={["BackOfficeNavigation", "BackOfficeShell", "SignOut"]}>
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
          <div className="flex flex-col gap-4 border-t border-border px-5 py-4">
            <Suspense fallback={null}>
              <AccountSummary variant="sidebar" />
            </Suspense>
            {/* A block around the switch keeps it at its own width in this column. */}
            <div>
              <LanguageSwitch />
            </div>
          </div>
        </aside>
        <BackOfficeTopBar
          nav={nav}
          roleLabel={roleLabel}
          account={
            <Suspense fallback={null}>
              <AccountSummary variant="sidebar" />
            </Suspense>
          }
        />
        <main id="konten" tabIndex={-1} className="flex flex-1 flex-col outline-none">
          <div className="mx-auto flex w-full max-w-dashboard flex-col gap-6 px-safe py-6 lg:px-gutter-wide lg:py-8">
            {children}
          </div>
        </main>
      </div>
    </ClientMessages>
  );
}
