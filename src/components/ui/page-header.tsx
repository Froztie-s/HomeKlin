import type { ReactNode } from "react";

type PageHeaderProps = {
  title: string;
  description?: ReactNode;
};

export function PageHeader({ title, description }: PageHeaderProps) {
  return (
    <header className="flex flex-col gap-1">
      <h1 className="text-2xl font-bold text-ink">{title}</h1>
      {description ? <p className="max-w-prose text-sm text-ink-muted">{description}</p> : null}
    </header>
  );
}
