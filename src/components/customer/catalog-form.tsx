"use client";

import { LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition, type ChangeEvent, type FormEvent, type ReactNode } from "react";

type CatalogFormProps = {
  /** The page's own path in its language ("/services" or "/en/services"). */
  action: string;
  /** The area the page shows without ?area=, left out of the address to keep it short. */
  defaultArea: string;
  /** Said while the new list loads ("Memperbarui daftar…"). */
  pendingLabel: string;
  /** The filter fields: area, keyword, type. */
  filters: ReactNode;
  /** The results, dimmed while new ones load. */
  children: ReactNode;
};

/**
 * The query string a filter change leads to. The first value of each field wins, as on the server
 * (parseCatalogFilters): a pressed type button comes before the hidden field holding the current type,
 * so it replaces it, and "Semua" (an empty value) clears it. Empty fields and the default area are
 * left out.
 */
function queryFrom(form: HTMLFormElement, submitter: HTMLElement | null, defaultArea: string): string {
  const params = new URLSearchParams();
  const seen = new Set<string>();
  for (const [name, value] of new FormData(form, submitter)) {
    if (seen.has(name) || typeof value !== "string") continue;
    seen.add(name);
    const text = value.trim();
    if (text && !(name === "area" && text === defaultArea)) params.set(name, text);
  }
  const text = params.toString();
  return text ? `?${text}` : "";
}

// The catalog's filters are a plain GET form (?area=&type=&q=), so the choice is in the address and
// survives a reload. With JavaScript, a change stays on the page: choosing an area updates the list at
// once (replacing the history entry, so the back button leaves the page rather than stepping through
// areas), and a search or a type button adds a history entry. While the new list loads, the old one
// dims under a short status, and keyboard focus stays where it was.
export function CatalogForm({ action, defaultArea, pendingLabel, filters, children }: CatalogFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function go(href: string, mode: "push" | "replace") {
    startTransition(() => {
      if (mode === "push") router.push(href, { scroll: false });
      else router.replace(href, { scroll: false });
    });
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    go(`${action}${queryFrom(event.currentTarget, submitter, defaultArea)}`, "push");
  }

  // Only the area select changes the list on its own; text fields wait for their submit.
  function onChange(event: ChangeEvent<HTMLFormElement>) {
    if (event.target instanceof HTMLSelectElement) {
      go(`${action}${queryFrom(event.currentTarget, null, defaultArea)}`, "replace");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <form method="get" action={action} onSubmit={onSubmit} onChange={onChange} className="flex flex-col gap-5">
        {filters}
      </form>
      <div className="relative" aria-busy={pending || undefined}>
        <div className={`transition-opacity duration-150 ease-out-quart ${pending ? "opacity-50" : ""}`}>
          {children}
        </div>
        <p
          role="status"
          className={`pointer-events-none absolute inset-x-0 top-0 flex justify-center ${pending ? "" : "sr-only"}`}
        >
          {pending ? (
            <span className="flex items-center gap-2 rounded-full bg-surface px-4 py-2 text-sm font-medium text-ink shadow-raised">
              <LoaderCircle className="size-4 shrink-0 animate-spin text-brand-700" aria-hidden="true" />
              {pendingLabel}
            </span>
          ) : null}
        </p>
      </div>
    </div>
  );
}
