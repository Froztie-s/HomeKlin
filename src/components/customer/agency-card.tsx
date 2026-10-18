import { BadgeCheck, CalendarClock, MapPin, Star } from "lucide-react";
import { formatRating, formatRupiah } from "@/lib/format";
import type { PreviewAgency } from "./home-preview-data";

const copy = {
  verified: "Terverifikasi",
  outOfFive: "dari 5",
  reviews: (count: number) => `${count} ulasan`,
  nextSlot: "Jadwal terdekat",
  from: "mulai dari",
};

// One agency, with the facts customers compare in the same place on every card:
// rating, district, verification, services, the next free slot and the starting price.
export function AgencyCard({ agency }: { agency: PreviewAgency }) {
  return (
    <article className="flex gap-3 rounded-lg border border-border bg-surface p-4 shadow-card">
      <span
        aria-hidden="true"
        className="flex size-12 shrink-0 items-center justify-center rounded-md bg-brand-100 text-base font-bold text-brand-800"
      >
        {agency.initials}
      </span>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <h3 className="text-base font-semibold text-ink">{agency.name}</h3>
          {agency.verified ? (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700">
              <BadgeCheck className="size-4" aria-hidden="true" />
              {copy.verified}
            </span>
          ) : null}
        </div>

        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-muted">
          <span className="inline-flex items-center gap-1">
            <Star className="size-4 fill-rating text-rating" aria-hidden="true" />
            <span className="font-semibold text-ink">{formatRating(agency.rating)}</span>
            <span className="sr-only">{copy.outOfFive},</span>
            <span>({copy.reviews(agency.reviewCount)})</span>
          </span>
          <span className="inline-flex items-center gap-1">
            <MapPin className="size-4 text-ink-faint" aria-hidden="true" />
            {agency.district}
          </span>
        </p>

        <ul className="mt-2.5 flex flex-wrap gap-1.5">
          {agency.services.map((service) => (
            <li key={service} className="rounded-xs bg-surface-sunken px-2 py-0.5 text-xs text-ink-muted">
              {service}
            </li>
          ))}
        </ul>

        <div className="mt-3 flex items-end justify-between gap-3 border-t border-border pt-3">
          <p className="flex flex-col gap-0.5">
            <span className="inline-flex items-center gap-1 text-xs text-ink-muted">
              <CalendarClock className="size-3.5" aria-hidden="true" />
              {copy.nextSlot}
            </span>
            <span className="text-sm font-medium text-ink">{agency.nextSlot}</span>
          </p>
          <p className="flex flex-col items-end gap-0.5">
            <span className="text-xs text-ink-muted">{copy.from}</span>
            <span className="text-base font-bold text-ink tabular-nums">
              {formatRupiah(agency.startingPrice)}
            </span>
          </p>
        </div>
      </div>
    </article>
  );
}
