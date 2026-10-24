import { Check, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { serviceCategories, type ServiceCategory } from "@/lib/catalog/catalog";

// The keyword search and the service-type filter of /services. Both are fields of the catalog form
// (src/components/customer/catalog-form.tsx): `q`, and `type` from the pressed type button. Order
// matters: the search button comes first, so Enter in the search field searches (a form's default
// button is its first), and the hidden `type` field comes after the type buttons, so a pressed
// button's value wins (the first value of a field counts).

/** A keyword in both languages (the catalog searches names and descriptions in Indonesian and English). */
export function CatalogSearch({ query }: { query?: string }) {
  const t = useTranslations("CatalogFilters");
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor="cari-layanan" className="text-sm font-medium text-ink-muted">
        {t("searchLabel")}
      </label>
      <div className="flex gap-2">
        <span className="relative min-w-0 flex-1">
          <Search
            className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-ink-faint"
            aria-hidden="true"
          />
          {/* Keyed by the keyword, so clearing the search from a link empties the field too. */}
          <input
            key={query ?? ""}
            id="cari-layanan"
            name="q"
            type="search"
            defaultValue={query}
            placeholder={t("searchPlaceholder")}
            maxLength={60}
            autoComplete="off"
            enterKeyHint="search"
            className="h-12 w-full rounded-full border border-border-control bg-surface pr-4 pl-10 text-base text-ink caret-brand-700 transition-colors duration-150 ease-out-quart placeholder:text-ink-faint hover:border-brand-600"
          />
        </span>
        <button
          type="submit"
          className="inline-flex h-12 shrink-0 items-center justify-center rounded-full bg-brand-600 px-5 text-sm font-semibold text-on-brand transition-[background-color,transform] duration-150 ease-out-quart hover:bg-brand-700 active:scale-[0.98] active:bg-brand-800"
        >
          {t("searchSubmit")}
        </button>
      </div>
    </div>
  );
}

const chip =
  "inline-flex min-h-touch items-center gap-1.5 rounded-full border px-4 text-sm font-semibold transition-[background-color,border-color,color,transform] duration-150 ease-out-quart active:scale-[0.98]";
const chipStates = {
  pressed: "border-brand-600 bg-brand-600 text-on-brand hover:border-brand-700 hover:bg-brand-700",
  idle: "border-border-control bg-surface text-ink hover:border-brand-600 hover:bg-brand-50 active:bg-brand-100",
};

/**
 * The type filter: one toggle button per type and "Semua". The pressed one is filled and carries a
 * check icon and aria-pressed, so the state never rests on colour alone. The buttons wrap onto a
 * second row at 360 px instead of scrolling sideways.
 */
export function CatalogTypeFilter({ current }: { current?: ServiceCategory }) {
  const t = useTranslations("CatalogFilters");
  const options = [undefined, ...serviceCategories] as const;
  return (
    <>
      <div role="group" aria-label={t("typeLabel")} className="flex flex-wrap gap-2">
        {options.map((category) => {
          const pressed = category === current;
          return (
            <button
              key={category ?? "all"}
              type="submit"
              name="type"
              value={category ?? ""}
              aria-pressed={pressed}
              className={`${chip} ${pressed ? chipStates.pressed : chipStates.idle}`}
            >
              {pressed ? <Check className="size-4 shrink-0" aria-hidden="true" /> : null}
              {t(`types.${category ?? "all"}`)}
            </button>
          );
        })}
      </div>
      <input type="hidden" name="type" value={current ?? ""} />
    </>
  );
}
