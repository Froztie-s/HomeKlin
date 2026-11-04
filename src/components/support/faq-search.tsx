import { Search } from "lucide-react";
import Form from "next/form";
import { getLocale, getTranslations } from "next-intl/server";
import { getPathname } from "@/i18n/navigation";

// The FAQ's search box (T19): a GET form to /support?q=<words>, so a search is in the address, survives
// a reload and works without JavaScript; with it, next/form opens the results without a full page load.
// The search button comes after the field, so Enter in the field searches.
// Source: node_modules/next/dist/docs/01-app/03-api-reference/02-components/form.md
export async function FaqSearch({ query }: { query: string }) {
  const [t, locale] = await Promise.all([getTranslations("SupportPage"), getLocale()]);
  return (
    <Form action={getPathname({ href: "/support", locale })} role="search" aria-label={t("search.formLabel")}>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="cari-bantuan" className="text-sm font-medium text-ink-muted">
          {t("search.label")}
        </label>
        <div className="flex gap-2">
          <span className="relative min-w-0 flex-1">
            <Search
              className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-ink-faint"
              aria-hidden="true"
            />
            {/* Keyed by the words, so "Tampilkan semua pertanyaan" empties the field too. */}
            <input
              key={query}
              id="cari-bantuan"
              name="q"
              type="search"
              defaultValue={query}
              placeholder={t("search.placeholder")}
              maxLength={100}
              autoComplete="off"
              enterKeyHint="search"
              className="h-12 w-full rounded-full border border-border-control bg-surface pr-4 pl-10 text-base text-ink caret-brand-700 transition-colors duration-150 ease-out-quart placeholder:text-ink-faint hover:border-brand-600"
            />
          </span>
          <button
            type="submit"
            className="inline-flex h-12 shrink-0 items-center justify-center rounded-full bg-brand-600 px-5 text-sm font-semibold text-on-brand transition-[background-color,transform] duration-150 ease-out-quart hover:bg-brand-700 active:scale-[0.98] active:bg-brand-800"
          >
            {t("search.submit")}
          </button>
        </div>
      </div>
    </Form>
  );
}
