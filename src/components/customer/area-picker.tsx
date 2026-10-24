import { ChevronDown, MapPin } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { ServiceArea } from "@/lib/catalog/catalog";
import { AreaSelect } from "./area-select";

type AreaPickerProps = {
  /** Every service area, in the catalog's order. */
  areas: readonly ServiceArea[];
  value: string;
  /** inline: label beside the select (/home); stacked: label above a full-width select (/services). */
  layout?: "inline" | "stacked";
  id?: string;
};

const layouts = {
  inline: { wrapper: "flex flex-wrap items-center gap-x-3 gap-y-2", select: "" },
  stacked: { wrapper: "flex flex-col gap-1.5", select: "w-full" },
};

// Where the cleaning happens. It comes first because the area decides which free slots exist
// (markdown/SPEC.md, slots combined per area). A native <select> styled as a pill with a map-pin icon
// and a visible "Area layanan" label (markdown/design.md, Forms). 16 px text, so phones never zoom.
// It is the field `area` of the form around it, so the choice goes into the address (?area=).
export function AreaPicker({ areas, value, layout = "inline", id = "area-layanan" }: AreaPickerProps) {
  const t = useTranslations("AreaPicker");
  const locale = useLocale();
  const style = layouts[layout];
  return (
    <div className={style.wrapper}>
      <label htmlFor={id} className="text-sm font-medium text-ink-muted">
        {t("label")}
      </label>
      <span className={`relative inline-flex ${style.select}`}>
        <MapPin
          className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-brand-700"
          aria-hidden="true"
        />
        <AreaSelect
          id={id}
          name="area"
          value={value}
          options={areas.map((area) => ({ value: area.id, label: area.name[locale] }))}
          className={`min-h-touch cursor-pointer appearance-none rounded-full border border-border-control bg-surface pr-11 pl-10 text-base font-semibold text-ink transition-colors duration-150 ease-out-quart hover:border-brand-600 hover:bg-brand-50 active:bg-brand-100 disabled:cursor-not-allowed disabled:border-border disabled:text-ink-faint ${style.select}`}
        />
        <ChevronDown
          className="pointer-events-none absolute top-1/2 right-4 size-4 -translate-y-1/2 text-ink-muted"
          aria-hidden="true"
        />
      </span>
    </div>
  );
}
