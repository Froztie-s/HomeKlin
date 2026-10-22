import type { ReactNode } from "react";
import { ClientMessages } from "@/i18n/client-messages";
import { AppHeader } from "./app-header";
import { BottomNav } from "./bottom-nav";
import type { AppNavKey } from "./navigation";
import { SkipLink } from "./skip-link";

type MobileShellProps = {
  nav: AppNavKey;
  /** For staff shells ("Petugas"): shown next to the wordmark. */
  roleLabel?: string;
  children: ReactNode;
};

// Customer and cleaner shell: mobile-first with a bottom bar; the sections move into the top bar from
// tablet width up. The menus are client components, so this shell sends them the AppNavigation
// messages (customer and cleaner labels only, never the back office's).
export function MobileShell({ nav, roleLabel, children }: MobileShellProps) {
  return (
    <ClientMessages namespaces={["AppNavigation"]}>
      <SkipLink />
      <AppHeader nav={nav} roleLabel={roleLabel} />
      <main id="konten" tabIndex={-1} className="flex flex-1 flex-col pb-clear-nav outline-none md:pb-12">
        {children}
      </main>
      <BottomNav nav={nav} />
    </ClientMessages>
  );
}
