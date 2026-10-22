"use client";

import { Menu, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { usePathname } from "next/navigation";
import { useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Wordmark } from "@/components/brand/wordmark";
import { LanguageSwitch } from "./language-switch";
import type { BackOfficeNavKey } from "./navigation";
import { RoleBadge } from "./role-badge";
import { SideNavList } from "./side-nav-list";

type BackOfficeTopBarProps = {
  nav: BackOfficeNavKey;
  roleLabel: string;
  /** Who is signed in and the sign-out button, rendered on the server (sidebar-shell.tsx). */
  account?: ReactNode;
};

const menuId = "back-office-menu";

// Below desktop width the sidebar collapses into this bar. The menu opens in the page flow
// (pushing content down), so nothing is covered and no focus trap is needed. The account and the
// language switch sit in the menu, under the sections: at 360 px the bar has no room next to the
// wordmark, the role and the Menu button.
export function BackOfficeTopBar({ nav, roleLabel, account }: BackOfficeTopBarProps) {
  const t = useTranslations("BackOfficeShell");
  // The address as the browser shows it (with /en), so switching the language also counts as
  // navigating; next-intl's usePathname would return the same path in both languages.
  const pathname = usePathname();
  const button = useRef<HTMLButtonElement>(null);
  // Remember which page the menu was opened on: any navigation (link, back button) closes it.
  const [openedOn, setOpenedOn] = useState<string | null>(null);
  const open = openedOn === pathname;

  // Next.js keeps hidden pages mounted (Activity); close the menu when this layout is hidden.
  useLayoutEffect(() => () => setOpenedOn(null), []);

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "Escape" && open) {
      setOpenedOn(null);
      button.current?.focus();
    }
  }

  return (
    <header
      onKeyDown={handleKeyDown}
      className="sticky top-0 z-(--z-sticky) border-b border-border bg-surface lg:hidden"
    >
      <div className="flex h-top-bar items-center justify-between gap-3 px-safe">
        <span className="flex min-w-0 items-center gap-2">
          <Wordmark />
          <RoleBadge label={roleLabel} />
        </span>
        <button
          ref={button}
          type="button"
          aria-expanded={open}
          aria-controls={menuId}
          onClick={() => setOpenedOn(open ? null : pathname)}
          className="-mr-2 inline-flex min-h-touch items-center gap-2 rounded-full px-4 text-sm font-semibold text-ink transition-colors duration-150 ease-out-quart hover:bg-surface-sunken active:bg-brand-50 aria-expanded:bg-surface-sunken"
        >
          {open ? <X className="size-5" aria-hidden="true" /> : <Menu className="size-5" aria-hidden="true" />}
          {t("menu")}
        </button>
      </div>
      <div id={menuId} hidden={!open} className="border-t border-border px-safe py-3">
        <SideNavList nav={nav} onNavigate={() => setOpenedOn(null)} />
        <div className="mt-3 flex flex-col gap-4 border-t border-border px-1 pt-4">
          {account}
          <div>
            <LanguageSwitch />
          </div>
        </div>
      </div>
    </header>
  );
}
