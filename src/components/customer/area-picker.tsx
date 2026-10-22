import { ChevronDown, MapPin } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ServiceAreaId } from "./home-preview-data";

type AreaPickerProps = {
  areas: readonly ServiceAreaId[];
  defaultArea: ServiceAreaId;
};

// Where the cleaning happens. Booking starts with the area because it decides which free slots
// exist (SPEC "slots aggregated per area"). Display only until T8 wires it to the catalog.
export function AreaPicker({ areas, defaultArea }: AreaPickerProps) {
  const t = useTranslations("AreaPicker");
  const preview = useTranslations("PreviewData");
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <label htmlFor="area-layanan" className="text-sm font-medium text-ink-muted">
        {t("label")}
      </label>
      <span className="relative inline-flex">
        <MapPin
          className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-brand-700"
          aria-hidden="true"
        />
        <select
          id="area-layanan"
          name="area"
          defaultValue={defaultArea}
          className="min-h-touch cursor-pointer appearance-none rounded-full border border-border-control bg-surface pr-11 pl-10 text-sm font-semibold text-ink transition-colors duration-150 ease-out-quart hover:border-brand-600 hover:bg-brand-50 active:bg-brand-100 disabled:cursor-not-allowed disabled:border-border disabled:text-ink-faint"
        >
          {areas.map((area) => (
            <option key={area} value={area}>
              {preview(`areas.${area}`)}
            </option>
          ))}
        </select>
        <ChevronDown
          className="pointer-events-none absolute top-1/2 right-4 size-4 -translate-y-1/2 text-ink-muted"
          aria-hidden="true"
        />
      </span>
    </div>
  );
}
