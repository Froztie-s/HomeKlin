import { House } from "lucide-react";
import { appName } from "@/lib/app-name";

// The HomeKlin mark: a house on an evergreen tile, then the name in the display face.
export function Wordmark() {
  return (
    <span className="inline-flex items-center gap-2">
      <span
        aria-hidden="true"
        className="flex size-8 items-center justify-center rounded-md bg-brand-600 text-on-brand"
      >
        <House className="size-4.5" strokeWidth={2.5} />
      </span>
      <span className="font-display text-xl font-bold tracking-display text-ink">{appName()}</span>
    </span>
  );
}
