import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

type ButtonLinkProps = {
  href: string;
  icon?: LucideIcon;
  variant?: "primary" | "secondary";
  /** md (44 px) in the app; lg (52 px) for the landing hero and CTA band. */
  size?: "md" | "lg";
  /** Layout only (width, alignment); colours and shape come from the variant. */
  className?: string;
  children: ReactNode;
};

const variants = {
  primary: "bg-brand-600 text-on-brand hover:bg-brand-700 active:bg-brand-800",
  secondary: "border border-border-control bg-surface text-ink hover:bg-surface-sunken active:bg-brand-50",
};

const sizes = {
  md: "min-h-touch px-5 text-sm",
  lg: "min-h-13 px-7 text-base",
};

// A link that looks like a button, for navigation actions such as "Pesan sekarang" or
// "Tonton langsung". Pill-shaped like every interactive element; never wraps its label.
export function ButtonLink({
  href,
  icon: Icon,
  variant = "primary",
  size = "md",
  className = "",
  children,
}: ButtonLinkProps) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center justify-center gap-2 rounded-full font-semibold whitespace-nowrap transition-[background-color,color,transform] duration-150 ease-out-quart active:scale-[0.98] ${variants[variant]} ${sizes[size]} ${className}`}
    >
      {Icon ? <Icon className="size-4.5 shrink-0" aria-hidden="true" /> : null}
      {children}
    </Link>
  );
}
