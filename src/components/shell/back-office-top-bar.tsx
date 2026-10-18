"use client";

import { Menu, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { Wordmark } from "@/components/brand/wordmark";
import type { NavKey } from "./navigation";
import { RoleBadge } from "./role-badge";
import { SideNavList } from "./side-nav-list";

type BackOfficeTopBarProps = {
  nav: Extract<NavKey, "agency" | "admin">;
  roleLabel: string;
};

const copy = { menu: "Menu" };
const menuId = "back-office-menu";

// Below desktop width the sidebar collapses into this bar. The menu opens in the page flow
// (pushing content down), so nothing is covered and no focus trap is needed.
export function BackOfficeTopBar({ nav, roleLabel }: BackOfficeTopBarProps) {
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
          className="-mr-2 inline-flex min-h-touch items-center gap-2 rounded-md px-3 text-sm font-semibold text-ink transition-colors duration-150 ease-out-quart hover:bg-surface-sunken active:bg-brand-50 aria-expanded:bg-surface-sunken"
        >
          {open ? <X className="size-5" aria-hidden="true" /> : <Menu className="size-5" aria-hidden="true" />}
          {copy.menu}
        </button>
      </div>
      <div id={menuId} hidden={!open} className="border-t border-border px-safe py-3">
        <SideNavList nav={nav} onNavigate={() => setOpenedOn(null)} />
      </div>
    </header>
  );
}
