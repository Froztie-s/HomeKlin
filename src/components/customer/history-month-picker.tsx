"use client";

import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { useTransition } from "react";
import { Link, useRouter } from "@/i18n/navigation";

type MonthOption = { value: string; label: string; href: string };

type HistoryMonthPickerProps = {
  /** The months that have orders, the latest first. */
  options: readonly MonthOption[];
  selected: string;
  labels: { select: string; older: string; newer: string };
};

const arrow =
  "flex size-11 shrink-0 items-center justify-center rounded-full text-ink inset-ring-1 inset-ring-border transition-colors duration-150 ease-out-quart hover:bg-sunken active:bg-lime-wash";
const arrowOff = "flex size-11 shrink-0 items-center justify-center rounded-full text-ink-muted/40 inset-ring-1 inset-ring-border";

// The history page shows one month at a time (2026-11-20, user: the whole history was one long
// scroll). The month sits in the address (?bulan=2026-11), so a reload, the back button and a link
// keep it. The arrows are plain links to the older and newer month; the native select jumps to any
// month and navigates as soon as one is chosen.
export function HistoryMonthPicker({ options, selected, labels }: HistoryMonthPickerProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const index = Math.max(
    0,
    options.findIndex((option) => option.value === selected),
  );
  const older = options[index + 1];
  const newer = options[index - 1];

  return (
    <div className="flex items-center gap-2 rounded-lg bg-card p-2" aria-busy={pending || undefined}>
      {older ? (
        <Link href={older.href} scroll={false} className={arrow} aria-label={`${labels.older}: ${older.label}`}>
          <ChevronLeft className="size-5" aria-hidden="true" />
        </Link>
      ) : (
        <span className={arrowOff} aria-hidden="true">
          <ChevronLeft className="size-5" />
        </span>
      )}
      <label className="relative min-w-0 flex-1">
        <span className="sr-only">{labels.select}</span>
        <select
          value={options[index]?.value}
          onChange={(event) => {
            const option = options.find((candidate) => candidate.value === event.target.value);
            if (option) startTransition(() => router.push(option.href, { scroll: false }));
          }}
          className="min-h-touch w-full cursor-pointer appearance-none rounded-full bg-transparent pr-8 pl-3 text-center font-display text-sm font-semibold sm:px-10 sm:text-base text-ink transition-colors duration-150 ease-out-quart hover:bg-sunken"
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-4 sm:right-4 -translate-y-1/2 text-ink-muted" aria-hidden="true" />
      </label>
      {newer ? (
        <Link href={newer.href} scroll={false} className={arrow} aria-label={`${labels.newer}: ${newer.label}`}>
          <ChevronRight className="size-5" aria-hidden="true" />
        </Link>
      ) : (
        <span className={arrowOff} aria-hidden="true">
          <ChevronRight className="size-5" />
        </span>
      )}
    </div>
  );
}
