import { ArrowRight, type LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

type ButtonLinkProps = {
  href: string;
  icon?: LucideIcon;
  /**
   * primary / secondary: the T3b app buttons, until the apps migrate (markdown/design.md,
   * Migration notes).
   * forest / accent: the redesign (markdown/design.md, Buttons), used on the landing page until the
   * apps migrate: forest is the primary pill with a lime arrow circle, accent is the lime pill for
   * the one main action in a viewport.
   */
  variant?: "primary" | "secondary" | "forest" | "accent";
  /** md (44 px) in the app; lg (52 px) for the landing hero and CTA band. */
  size?: "md" | "lg";
  /** Layout only (width, alignment); colours and shape come from the variant. */
  className?: string;
  children: ReactNode;
};

const variants = {
  primary: "bg-brand-600 text-on-brand hover:bg-brand-700 active:bg-brand-800",
  secondary: "border border-border-control bg-surface text-ink hover:bg-surface-sunken active:bg-brand-50",
  forest: "bg-primary text-on-primary hover:bg-primary-container active:bg-band",
  accent: "bg-lime text-on-lime hover:brightness-95 active:brightness-90",
};

const sizes = {
  md: "min-h-touch px-5 text-sm",
  lg: "min-h-13 px-7 text-base",
};

// The forest pill keeps its label on the left and a 24 px lime circle with an arrow on the right,
// so the right padding is smaller than the left.
const forestSizes = {
  md: "min-h-touch pr-2.5 pl-5 text-sm",
  lg: "min-h-13 pr-3 pl-7 text-base",
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
  const forest = variant === "forest";
  return (
    <Link
      href={href}
      className={`inline-flex items-center justify-center gap-2 rounded-full font-semibold whitespace-nowrap transition-[background-color,color,filter,transform] duration-150 ease-out-quart active:scale-[0.98] ${variants[variant]} ${forest ? forestSizes[size] : sizes[size]} ${className}`}
    >
      {Icon ? <Icon className="size-4.5 shrink-0" aria-hidden="true" /> : null}
      {children}
      {forest ? (
        <span
          aria-hidden="true"
          className="ml-1 flex size-6 shrink-0 items-center justify-center rounded-full bg-lime text-on-lime"
        >
          <ArrowRight className="size-3.5" strokeWidth={2.5} />
        </span>
      ) : null}
    </Link>
  );
}
