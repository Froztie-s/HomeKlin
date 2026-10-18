import type { ReactNode } from "react";

type PageHeaderProps = {
  title: string;
  description?: ReactNode;
  /** "large" for customer pages: the title grows to text-3xl from tablet width. Back office keeps text-2xl. */
  size?: "default" | "large";
};

const sizes = {
  default: { title: "text-2xl", description: "text-sm" },
  large: { title: "text-2xl md:text-3xl md:tracking-display", description: "text-sm md:text-base" },
};

export function PageHeader({ title, description, size = "default" }: PageHeaderProps) {
  return (
    <header className="flex flex-col gap-1.5">
      <h1 className={`font-display font-semibold text-ink ${sizes[size].title}`}>{title}</h1>
      {description ? (
        <p className={`max-w-prose text-ink-muted ${sizes[size].description}`}>{description}</p>
      ) : null}
    </header>
  );
}
