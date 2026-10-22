import type { ReactNode } from "react";

type AuthCardProps = {
  title: string;
  lead: string;
  children: ReactNode;
};

// The frame of the sign-in and sign-up pages: one task, one column. On phones the form sits straight
// on the page for the full width; from tablet width it rests on a card in the middle of the screen.
export function AuthCard({ title, lead, children }: AuthCardProps) {
  return (
    <div className="mx-auto flex w-full max-w-lg flex-col px-safe pt-8 pb-16 md:pt-16 md:pb-24">
      <div className="md:rounded-xl md:border md:border-border md:bg-surface md:p-8 md:shadow-card">
        <h1 className="font-display text-2xl font-semibold text-ink md:text-3xl md:tracking-display">{title}</h1>
        <p className="mt-2 max-w-prose text-base text-ink-muted">{lead}</p>
        <div className="mt-8">{children}</div>
      </div>
    </div>
  );
}

/** Stands in for the form while the page checks whether the visitor is already signed in. Same heights, so nothing jumps. */
export function AuthFormSkeleton({ fields }: { fields: number }) {
  return (
    <div aria-hidden="true" className="flex flex-col">
      <div className="flex flex-col gap-5">
        {Array.from({ length: fields }, (_, index) => (
          <div key={index} className="flex flex-col gap-2">
            <span className="h-5 w-28 rounded-full bg-surface-sunken" />
            <span className="h-12 rounded-full bg-surface-sunken" />
          </div>
        ))}
      </div>
      <span className="mt-8 h-12 rounded-full bg-surface-sunken" />
    </div>
  );
}
