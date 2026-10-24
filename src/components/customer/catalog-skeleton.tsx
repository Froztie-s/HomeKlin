import { LoaderCircle } from "lucide-react";
import { useTranslations } from "next-intl";

// What /services shows while its catalog loads (the <Suspense> fallback, part of the prerendered
// shell): the same blocks in the same sizes as the loaded page (the area panel, the search and type
// row, three service cards), so nothing jumps when the content arrives. The status line says it in
// words; the blocks are decorative and pulse only when motion is allowed.
export function CatalogSkeleton() {
  const t = useTranslations("CatalogResults");
  const bar = "rounded-full bg-surface-sunken";
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-5 motion-safe:animate-pulse" aria-hidden="true">
        <div className="rounded-xl border border-border bg-surface p-4 shadow-card md:grid md:grid-cols-[minmax(0,17rem)_1fr] md:gap-8 md:p-6">
          <div className="flex flex-col gap-1.5">
            <span className={`h-5 w-24 ${bar}`} />
            <span className={`h-11 w-full ${bar}`} />
          </div>
          <div className="mt-4 border-t border-border pt-4 md:mt-0 md:border-t-0 md:border-l md:pt-0 md:pl-8">
            <span className={`block h-7 w-56 max-w-full ${bar}`} />
            <div className="mt-3 flex items-start gap-3">
              <span className="size-10 shrink-0 rounded-full bg-surface-sunken" />
              <div className="flex flex-1 flex-col gap-1.5 pt-0.5">
                <span className={`h-3.5 w-20 ${bar}`} />
                <span className={`h-5 w-44 max-w-full ${bar}`} />
                <span className={`h-4 w-28 ${bar}`} />
              </div>
            </div>
            <span className="mt-2 block h-11" />
          </div>
        </div>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5 md:max-w-md">
            <span className={`h-5 w-28 ${bar}`} />
            <span className={`h-12 w-full ${bar}`} />
          </div>
          <div className="flex flex-wrap gap-2">
            <span className={`h-11 w-20 ${bar}`} />
            <span className={`h-11 w-32 ${bar}`} />
            <span className={`h-11 w-36 ${bar}`} />
            <span className={`h-11 w-44 ${bar}`} />
          </div>
        </div>
      </div>
      <div>
        <p role="status" className="flex h-7 items-center gap-2 text-sm text-ink-faint">
          <LoaderCircle className="size-4 shrink-0 animate-spin" aria-hidden="true" />
          {t("loading")}
        </p>
        <ul className="mt-4 grid gap-4 motion-safe:animate-pulse md:grid-cols-2 md:gap-5" aria-hidden="true">
          {[0, 1, 2].map((index) => (
            <li key={index} className="flex h-40 gap-4 rounded-xl border border-border bg-surface p-4 shadow-card">
              <span className="size-20 shrink-0 rounded-md bg-surface-sunken" />
              <span className="flex flex-1 flex-col gap-2 pt-1">
                <span className={`h-5 w-3/4 ${bar}`} />
                <span className={`h-4 w-full ${bar}`} />
                <span className={`h-4 w-2/3 ${bar}`} />
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
