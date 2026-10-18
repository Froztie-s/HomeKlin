import type { ReactNode } from "react";

// Content column for customer and cleaner pages (the back-office shell has its own).
export function PageContainer({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-content flex-col gap-6 px-safe pt-6 md:px-gutter-wide md:pt-8">
      {children}
    </div>
  );
}
