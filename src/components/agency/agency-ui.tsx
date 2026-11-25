import { ArrowRight, CircleCheck, CircleDashed, ClockAlert, Search, UserCheck, type LucideIcon } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { initialsOf } from "@/components/auth/user-avatar";
import { StatusPill } from "@/components/back-office/status-pill";
import { Link } from "@/i18n/navigation";
import type { JobProgress } from "@/lib/jobs/jobs";
import { panel } from "./styles";

// The small pieces the redesigned agency pages share (D2, after the partner mocks; markdown/design.md
// Components): a section card with its heading, a cleaner's initials, a job's status as a word with an
// icon (never colour alone), a segmented filter made of links, the GET search field, the 44 px detail
// arrow and a big number tile. Server-safe: no client code, no messages of their own (the caller passes
// the words).

/** A white `lg` card with an h2 and an optional line under it. */
export function Panel({
  id,
  title,
  description,
  action,
  children,
  flush = false,
}: {
  id: string;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  /** flush: no padding around the children, for a table that runs to the card's edges. */
  flush?: boolean;
}) {
  return (
    <section aria-labelledby={id} className={`${panel} flex min-w-0 flex-col ${flush ? "overflow-hidden" : "gap-5 p-5 md:p-6"}`}>
      <header className={`flex flex-wrap items-start justify-between gap-3 ${flush ? "px-5 pt-5 pb-4 md:px-6 md:pt-6" : ""}`}>
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2 id={id} className="font-display text-lg font-semibold text-ink">
            {title}
          </h2>
          {description ? <p className="text-sm text-ink-muted">{description}</p> : null}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

/** A cleaner's initials in a lime-wash circle; decorative, the name is always beside it. */
export function Initials({ name, size = "sm" }: { name: string; size?: "sm" | "md" }) {
  return (
    <span
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center rounded-full bg-lime-wash font-semibold text-on-lime-wash ${
        size === "md" ? "size-11 text-sm" : "size-8 text-xs"
      }`}
    >
      {initialsOf(name)}
    </span>
  );
}

const jobPills: Record<Exclude<JobProgress, "inProgress">, { Icon: LucideIcon; pill: string }> = {
  unassigned: { Icon: CircleDashed, pill: "bg-warning-surface text-warning" },
  assigned: { Icon: UserCheck, pill: "bg-info-surface text-info" },
  // Checked in, never checked out, hours past the window: a problem to follow up, not a live job.
  overdue: { Icon: ClockAlert, pill: "bg-warning-surface text-warning" },
  completed: { Icon: CircleCheck, pill: "bg-info-surface text-info" },
};

/** Where a job stands: a word with an icon, or the calm breathing dot for a job under way. */
export function JobStatus({ progress, label }: { progress: JobProgress; label: string }) {
  if (progress === "inProgress") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-live-surface px-3 py-1 text-xs font-medium whitespace-nowrap text-live">
        <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-live-dot partner-live-dot" />
        {label}
      </span>
    );
  }
  const { Icon, pill } = jobPills[progress];
  return <StatusPill Icon={Icon} pill={pill} label={label} />;
}

export type FilterOption = { key: string; label: string; href: string | { pathname: string; query: Record<string, string> }; current: boolean };

/**
 * The segmented toggle (design.md, Segmented toggle) as links, so a filter or a range is an address
 * that works without JavaScript and can be shared: the current one is a forest pill with aria-current.
 * Wraps onto a second line on a phone instead of scrolling sideways.
 */
export function FilterLinks({ label, options }: { label: string; options: readonly FilterOption[] }) {
  return (
    <nav aria-label={label} className="max-w-full">
      <ul className="inline-flex max-w-full flex-wrap rounded-lg bg-card px-0.5 inset-ring inset-ring-border-control sm:rounded-full">
        {options.map((option) => (
          <li key={option.key}>
            {/* The link is the full 44 px target; the pill is drawn inside it, so the gap costs no height. */}
            <Link
              href={option.href}
              aria-current={option.current ? "true" : undefined}
              className="group inline-flex min-h-touch items-center rounded-full px-0.5"
            >
              <span className="inline-flex min-h-9 items-center rounded-full px-4 text-sm font-semibold whitespace-nowrap text-ink transition-colors duration-150 ease-out-quart group-hover:bg-sunken group-active:bg-lime-wash group-aria-[current=true]:bg-primary group-aria-[current=true]:text-on-primary">
                {option.label}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/**
 * A search field that sends the form as a GET to the same page (?q=), keeping the other filters in
 * hidden fields; the server filters the list, so it works without JavaScript.
 */
export function SearchField({
  id,
  label,
  placeholder,
  value,
  submit,
  keep = {},
}: {
  id: string;
  label: string;
  placeholder: string;
  value: string;
  /** The button's words, for keyboard and screen-reader users ("Cari"). */
  submit: string;
  /** The other address parameters to keep (?status=...). */
  keep?: Record<string, string>;
}) {
  return (
    <form role="search" method="get" className="flex w-full flex-col gap-1.5 sm:w-auto sm:min-w-72">
      <label htmlFor={id} className="text-xs font-semibold text-ink-muted">
        {label}
      </label>
      {Object.entries(keep).map(([name, keptValue]) => (
        <input key={name} type="hidden" name={name} value={keptValue} />
      ))}
      <div className="flex gap-2">
        <span className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-muted" aria-hidden="true" />
          <input
            id={id}
            type="search"
            name="q"
            defaultValue={value}
            placeholder={placeholder}
            maxLength={80}
            className="h-touch w-full rounded-sm border border-border-control bg-card pr-3.5 pl-10 text-base text-ink transition-colors duration-150 ease-out-quart placeholder:text-ink-muted hover:border-primary lg:text-sm"
          />
        </span>
        <button
          type="submit"
          className="inline-flex min-h-touch shrink-0 cursor-pointer items-center rounded-full border border-border-control bg-card px-4 text-sm font-semibold text-ink transition-[background-color,transform] duration-150 ease-out-quart hover:bg-sunken active:scale-[0.98] active:bg-lime-wash"
        >
          {submit}
        </button>
      </div>
    </form>
  );
}

/** The 44 px arrow at the end of a row that opens the job's detail page. */
export function DetailArrow({ href, label }: { href: { pathname: string; query: Record<string, string> }; label: string }) {
  return (
    <Link
      href={href}
      aria-label={label}
      className="inline-flex size-11 shrink-0 items-center justify-center rounded-full text-primary transition-[background-color,transform] duration-150 ease-out-quart hover:bg-sunken active:scale-95 active:bg-lime-wash"
    >
      <ArrowRight className="size-5" aria-hidden="true" />
    </Link>
  );
}

/** A big number with what it counts under it (the jobs page's tiles); dark: the band look of the last tile. */
/**
 * A count above a list. With `href` it is a link that filters the list to what it counts (2026-11-20,
 * UX audit item 14: the tiles looked pressable but did nothing); `current` marks the filter in use.
 */
export function CountTile({
  value,
  label,
  dark = false,
  href,
  current = false,
}: {
  value: number;
  label: string;
  dark?: boolean;
  href?: ComponentProps<typeof Link>["href"];
  current?: boolean;
}) {
  const body = (
    <>
      <span className="font-display text-fact font-semibold tabular-nums">{value}</span>
      <span className={`text-xs ${dark ? "text-on-band-muted" : "text-ink-muted"}`}>{label}</span>
    </>
  );
  const look = `flex h-full flex-col gap-1.5 rounded-md px-5 py-4 ${dark ? "bg-band text-on-band" : "bg-card text-ink"}`;
  if (!href) return <li className={look}>{body}</li>;
  return (
    <li>
      <Link
        href={href}
        scroll={false}
        aria-current={current ? "true" : undefined}
        className={`${look} transition-[box-shadow,transform] duration-150 ease-out-quart hover:shadow-card-hover active:scale-[0.99] motion-reduce:active:scale-100 ${
          current ? "inset-ring-2 inset-ring-primary" : ""
        }`}
      >
        {body}
      </Link>
    </li>
  );
}
