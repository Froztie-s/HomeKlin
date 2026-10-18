import { ChevronDown, MapPin, Search, SlidersHorizontal } from "lucide-react";
import Form from "next/form";
import Link from "next/link";
import { Wordmark } from "@/components/brand/wordmark";
import type { ServiceArea } from "./home-preview-data";

const copy = {
  title: "Pilih agensi kebersihan di area Anda",
  area: "Area layanan",
  search: "Cari agensi atau layanan",
  filter: "Filter agensi",
};

type HomeHeaderProps = {
  areas: readonly ServiceArea[];
  selectedArea: string;
};

// The periwinkle header from the visual reference: where (service area) and what (search).
// Submitting opens the agency list with the area and keywords as filters (wired up in T8).
export function HomeHeader({ areas, selectedArea }: HomeHeaderProps) {
  return (
    <header className="rounded-b-xl bg-brand-600 px-safe pt-4 pb-6 text-on-brand [--color-focus:var(--color-on-brand)] md:rounded-xl md:px-8 md:py-8">
      <div className="md:hidden">
        <Wordmark tone="inverse" />
      </div>
      <h1 className="mt-5 text-2xl font-bold text-on-brand md:mt-0 md:text-3xl">{copy.title}</h1>

      <Form action="/agencies" role="search" className="mt-2 flex flex-col gap-2 md:max-w-xl">
        <label htmlFor="home-area" className="sr-only">
          {copy.area}
        </label>
        {/* -ml-2 lines the pin up with the heading; the hover fill extends into the gutter. */}
        <span className="relative -ml-2 inline-flex self-start">
          <MapPin
            className="pointer-events-none absolute top-1/2 left-2 size-4 -translate-y-1/2"
            aria-hidden="true"
          />
          <select
            id="home-area"
            name="area"
            defaultValue={selectedArea}
            className="min-h-touch cursor-pointer appearance-none rounded-md bg-transparent pr-8 pl-8 text-sm font-semibold text-on-brand transition-colors duration-150 ease-out-quart hover:bg-brand-700 active:bg-brand-800 *:bg-surface *:text-ink"
          >
            {areas.map((area) => (
              <option key={area.id} value={area.id}>
                {area.label}
              </option>
            ))}
          </select>
          <ChevronDown
            className="pointer-events-none absolute top-1/2 right-2 size-4 -translate-y-1/2"
            aria-hidden="true"
          />
        </span>

        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-ink-faint"
              aria-hidden="true"
            />
            <input
              type="search"
              name="q"
              aria-label={copy.search}
              placeholder={copy.search}
              className="h-12 w-full rounded-md bg-surface pr-3 pl-11 text-base text-ink shadow-xs"
            />
          </div>
          <Link
            href="/agencies"
            aria-label={copy.filter}
            className="flex size-12 shrink-0 items-center justify-center rounded-md bg-brand-700 text-on-brand transition-colors duration-150 ease-out-quart hover:bg-brand-800 active:bg-brand-900"
          >
            <SlidersHorizontal className="size-5" aria-hidden="true" />
          </Link>
        </div>
      </Form>
    </header>
  );
}
