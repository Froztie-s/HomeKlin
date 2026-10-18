"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isActivePath } from "./is-active-path";
import { navigation, type NavKey } from "./navigation";

type BottomNavProps = {
  nav: Extract<NavKey, "customer" | "cleaner">;
};

// Phone navigation: fixed to the bottom, labels always visible, 44 px+ targets, clears the home indicator.
export function BottomNav({ nav }: BottomNavProps) {
  const pathname = usePathname();
  const { label, items } = navigation[nav];

  return (
    <nav
      aria-label={label}
      className="fixed inset-x-0 bottom-0 z-(--z-nav) border-t border-border bg-surface pb-safe shadow-nav md:hidden"
    >
      <ul className="mx-auto flex max-w-content px-safe">
        {items.map((item) => {
          const active = isActivePath(pathname, item);
          const Icon = item.icon;
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className="group flex min-h-bottom-nav flex-col items-center justify-center gap-1 text-xs font-medium text-ink-muted transition-colors duration-150 ease-out-quart hover:text-ink active:text-brand-800 aria-[current=page]:font-semibold aria-[current=page]:text-brand-700"
              >
                <span className="flex h-7 w-12 items-center justify-center rounded-full transition-colors duration-150 ease-out-quart group-hover:bg-surface-sunken group-aria-[current=page]:bg-brand-100">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
