import type { ReactNode } from "react";
import { AccountMenuSlot } from "@/components/auth/account-menu-slot";
import { ClientMessages } from "@/i18n/client-messages";
import { AppHeader } from "./app-header";
import { BottomNav } from "./bottom-nav";
import type { AppNavKey } from "./navigation";
import { SkipLink } from "./skip-link";

/** default: the T3b look (customer pages, until D5). forest: the redesign (the cleaner app, D4). */
export type AppTone = "default" | "forest";

type MobileShellProps = {
  nav: AppNavKey;
  /** For staff shells ("Petugas"): shown next to the wordmark. */
  roleLabel?: string;
  /** forest: inside a `theme-forest` wrapper, the cream bar, the forest wordmark and the lime-wash nav pill. */
  tone?: AppTone;
  children: ReactNode;
};

// Customer and cleaner shell: mobile-first with a bottom bar; the sections move into the top bar from
// tablet width up. The menus and the sign-out button are client components, so this shell sends them
// their messages (customer and cleaner labels only, never the back office's). The customer's "Akun" is
// the account menu (account-menu.tsx), which also needs the account strings.
export function MobileShell({ nav, roleLabel, tone = "default", children }: MobileShellProps) {
  return (
    <ClientMessages namespaces={["AppNavigation", "SignOut", "AccountSummary", "AccountChip"]}>
      <SkipLink />
      <AppHeader nav={nav} roleLabel={roleLabel} tone={tone} />
      <main
        id="konten"
        tabIndex={-1}
        className="flex flex-1 flex-col pb-clear-nav outline-none md:pb-12"
      >
        {children}
      </main>
      <BottomNav
        nav={nav}
        tone={tone}
        account={nav === "customer" ? <AccountMenuSlot variant="bottom" tone={tone} /> : undefined}
      />
    </ClientMessages>
  );
}
