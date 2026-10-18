import { House } from "lucide-react";
import { appName } from "@/lib/app-name";

type WordmarkProps = {
  /** "inverse" is for brand-coloured backgrounds such as the home header. */
  tone?: "default" | "inverse";
};

export function Wordmark({ tone = "default" }: WordmarkProps) {
  const inverse = tone === "inverse";
  return (
    <span className="inline-flex items-center gap-2">
      <span
        aria-hidden="true"
        className={`flex size-7 items-center justify-center rounded-sm ${
          inverse ? "bg-on-brand text-brand-700" : "bg-brand-600 text-on-brand"
        }`}
      >
        <House className="size-4" strokeWidth={2.5} />
      </span>
      <span
        className={`text-lg font-bold tracking-heading ${inverse ? "text-on-brand" : "text-ink"}`}
      >
        {appName()}
      </span>
    </span>
  );
}
