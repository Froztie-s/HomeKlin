import { Info } from "lucide-react";
import type { ReactNode } from "react";

// One small line at the bottom of pages that show sample data, so nobody mistakes it for real data.
export function SampleNote({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-start gap-2 text-sm text-ink-faint">
      <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
}
