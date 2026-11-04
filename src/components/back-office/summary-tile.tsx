import { ArrowRight, CircleAlert, type LucideIcon } from "lucide-react";
import { Link } from "@/i18n/navigation";

type SummaryTileProps = {
  /** Which number this is, for the page's tests. */
  id: string;
  label: string;
  /** The number, or null when it could not be read. */
  value: number | null;
  /** Where the tile leads, and what is there ("Buka monitor langsung"). */
  hint: string;
  /** A page path ("/admin/monitor"), or a place on this page ("#today-jobs"). */
  href: string;
  icon: LucideIcon;
  /** "attention" when the number asks admin to act (jobs without a cleaner, urgent tickets). */
  tone?: "default" | "attention";
};

const wells = {
  default: "bg-brand-50 text-brand-700",
  attention: "bg-warning-surface text-warning",
};

const tileClass =
  "group flex min-w-0 flex-col gap-3 rounded-xl border border-border bg-surface p-5 shadow-card transition-colors duration-150 ease-out-quart hover:border-brand-200 hover:bg-canvas active:bg-brand-50";

// One number on the admin dashboard (T24): what it counts, the number, and where it leads. The whole
// tile is one link, named by its words and the number, so it is one stop on the keyboard. The number
// never stands alone: the label says what it is, and the "attention" tone adds no meaning of its own.
export function SummaryTile({ id, label, value, hint, href, icon: Icon, tone = "default" }: SummaryTileProps) {
  const body = (
    <>
      <span className="flex items-start justify-between gap-3">
        <span className="text-sm font-semibold text-ink-muted">{label}</span>
        <span className={`flex size-9 shrink-0 items-center justify-center rounded-full ${wells[tone]}`}>
          <Icon className="size-4.5" aria-hidden="true" />
        </span>
      </span>
      {/* No number when it could not be read: the hint says so, and a made-up 0 would mislead. */}
      <span data-value className="flex h-10 items-center font-display text-4xl font-semibold text-ink tabular-nums">
        {value ?? <CircleAlert className="size-6 text-ink-faint" aria-hidden="true" />}
      </span>
      {/* The arrow flows with the words, so a hint that wraps keeps it beside its last word. */}
      <span className="mt-auto text-sm font-medium text-brand-700 group-hover:text-brand-800">
        {hint}
        <ArrowRight
          className="ml-1.5 inline-block size-4 align-middle transition-transform duration-150 ease-out-quart group-hover:translate-x-0.5"
          aria-hidden="true"
        />
      </span>
    </>
  );

  // A place on this page is a plain anchor: the language-aware Link is for other pages.
  return href.startsWith("#") ? (
    <a href={href} data-tile={id} className={tileClass}>
      {body}
    </a>
  ) : (
    <Link href={href} data-tile={id} className={tileClass}>
      {body}
    </Link>
  );
}
