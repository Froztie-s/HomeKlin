import { Bath, BrushCleaning, Sofa, SprayCan, type LucideIcon } from "lucide-react";
import Link from "next/link";

type ServiceCategory = { type: string; label: string; icon: LucideIcon };

const copy = { title: "Layanan" };

// The four service types customers filter by (SPEC: search by area and service type).
const categories: readonly ServiceCategory[] = [
  { type: "regular", label: "Pembersihan Rutin", icon: BrushCleaning },
  { type: "deep", label: "Deep Cleaning", icon: SprayCan },
  { type: "sofa-carpet", label: "Sofa & Karpet", icon: Sofa },
  { type: "kitchen-bathroom", label: "Dapur & Kamar Mandi", icon: Bath },
];

export function ServiceCategories() {
  return (
    <section aria-labelledby="service-categories-title">
      <h2 id="service-categories-title" className="text-lg font-semibold text-ink">
        {copy.title}
      </h2>
      {/* Phones: round icon tiles, four across. Tablet and up: one row of horizontal cards. */}
      <ul className="mt-3 grid grid-cols-4 gap-1 md:gap-3">
        {categories.map(({ type, label, icon: Icon }) => (
          <li key={type}>
            <Link
              href={`/agencies?type=${type}`}
              className="group flex h-full flex-col items-center gap-2 rounded-md py-2 text-center transition-colors duration-150 ease-out-quart md:flex-row md:gap-3 md:rounded-lg md:border md:border-border md:bg-surface md:p-3 md:text-left md:shadow-xs md:hover:border-brand-200 md:active:bg-brand-50"
            >
              <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700 ring-1 ring-brand-100 transition-colors duration-150 ease-out-quart group-hover:bg-brand-100 group-active:bg-brand-200 md:size-11">
                <Icon className="size-6 md:size-5" aria-hidden="true" />
              </span>
              <span className="text-xs font-medium wrap-break-word text-ink md:text-sm">{label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
