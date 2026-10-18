import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

type ButtonLinkProps = {
  href: string;
  icon?: LucideIcon;
  variant?: "primary" | "secondary";
  /** Layout only (width, alignment); colours come from the variant. */
  className?: string;
  children: ReactNode;
};

const variants = {
  primary: "bg-brand-600 text-on-brand hover:bg-brand-700 active:bg-brand-800",
  secondary: "border border-border bg-surface text-ink hover:bg-surface-sunken active:bg-brand-50",
};

// A link that looks like a button: for navigation actions such as "Tonton langsung".
export function ButtonLink({
  href,
  icon: Icon,
  variant = "primary",
  className = "",
  children,
}: ButtonLinkProps) {
  return (
    <Link
      href={href}
      className={`inline-flex min-h-touch items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold transition-colors duration-150 ease-out-quart ${variants[variant]} ${className}`}
    >
      {Icon ? <Icon className="size-4.5" aria-hidden="true" /> : null}
      {children}
    </Link>
  );
}
