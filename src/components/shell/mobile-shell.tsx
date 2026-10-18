import type { ReactNode } from "react";
import { Wordmark } from "@/components/brand/wordmark";
import { BottomNav } from "./bottom-nav";
import type { NavKey } from "./navigation";
import { RoleBadge } from "./role-badge";
import { SkipLink } from "./skip-link";
import { TopNav } from "./top-nav";

type MobileShellProps = {
  nav: Extract<NavKey, "customer" | "cleaner">;
  /** For staff shells ("Petugas"): shows a slim bar with the wordmark and role on phones. */
  roleLabel?: string;
  children: ReactNode;
};

// Customer and cleaner shell: mobile-first with a bottom bar; a top bar from tablet width up.
export function MobileShell({ nav, roleLabel, children }: MobileShellProps) {
  return (
    <>
      <SkipLink />
      <TopNav nav={nav} roleLabel={roleLabel} />
      {roleLabel ? (
        <header className="flex h-top-bar items-center gap-2 border-b border-border bg-surface px-safe md:hidden">
          <Wordmark />
          <RoleBadge label={roleLabel} />
        </header>
      ) : null}
      <main id="konten" tabIndex={-1} className="flex flex-1 flex-col pb-clear-nav outline-none md:pb-12">
        {children}
      </main>
      <BottomNav nav={nav} />
    </>
  );
}
