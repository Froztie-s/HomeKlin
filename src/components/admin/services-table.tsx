import { Pencil } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { AdminService } from "@/lib/catalog/admin";
import { formatRupiah } from "@/lib/format";
import { ServiceSwitch } from "./service-switch";

type ServicesTableProps = {
  services: readonly AdminService[];
};

const cell = "px-4 py-3 align-middle";
const headCell = "px-4 py-3 text-left text-xs font-semibold text-ink-muted";

// HomeKlin's services and the one price list, switched on or off (T7b). A real table on a desk: the
// name in Indonesian with the English name under it, type, price, duration, whether customers see it,
// and Ubah. Narrower screens keep the same rows with fewer columns: below 1280 px the type and duration
// move under the name, below 768 px the price and Ubah too, so the page never scrolls sideways.
// Hidden cells are display: none, so a screen reader meets each fact once.
export function ServicesTable({ services }: ServicesTableProps) {
  const t = useTranslations("AdminServicesPage");
  const locale = useLocale();

  /** 90 -> "1 jam 30 menit", 120 -> "2 jam", 45 -> "45 menit". */
  function durationText(totalMinutes: number): string {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (hours === 0) return t("duration.minutes", { minutes });
    if (minutes === 0) return t("duration.hours", { hours });
    return t("duration.hoursMinutes", { hours, minutes });
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-surface">
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">{t("table.caption")}</caption>
        <thead className="bg-surface-sunken">
          <tr>
            <th scope="col" className={headCell}>
              {t("table.service")}
            </th>
            <th scope="col" className={`${headCell} hidden xl:table-cell`}>
              {t("table.category")}
            </th>
            <th scope="col" className={`${headCell} hidden text-right md:table-cell`}>
              {t("table.price")}
            </th>
            <th scope="col" className={`${headCell} hidden xl:table-cell`}>
              {t("table.duration")}
            </th>
            <th scope="col" className={headCell}>
              {t("table.status")}
            </th>
            <th scope="col" className={`${headCell} hidden md:table-cell`}>
              <span className="sr-only">{t("table.actions")}</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {services.map((service) => {
            const category = t(`categories.${service.category}`);
            const duration = durationText(service.durationMinutes);
            const price = formatRupiah(service.priceIdr, locale);
            // A quiet link rather than a button per row, so eight rows of actions do not outweigh the
            // prices; still a full 44 px target. Its name says which service ("Ubah Pembersihan Rutin").
            const editLink = (
              <Link
                href={`/admin/services/edit?id=${service.id}`}
                className="inline-flex min-h-touch items-center gap-1.5 rounded-full px-3 text-sm font-semibold whitespace-nowrap text-brand-700 transition-colors duration-150 ease-out-quart hover:bg-surface-sunken hover:text-brand-800 active:bg-brand-50"
              >
                <Pencil className="size-4 shrink-0" aria-hidden="true" />
                {t("edit")}
                <span className="sr-only"> {service.name.id}</span>
              </Link>
            );
            return (
              <tr key={service.id} className="transition-colors duration-150 ease-out-quart hover:bg-canvas">
                <td className={cell}>
                  <p lang="id" className="font-semibold text-ink">
                    {service.name.id}
                  </p>
                  <p lang="en" className="text-ink-muted">
                    {service.name.en}
                  </p>
                  {/* The dot travels with the duration, so a wrapped line never ends on a dot. */}
                  <p className="mt-1 flex flex-wrap gap-x-1.5 text-ink-faint xl:hidden">
                    <span>{category}</span>
                    <span className="whitespace-nowrap">
                      <span aria-hidden="true">· </span>
                      {duration}
                    </span>
                  </p>
                  <p className="mt-1 font-semibold whitespace-nowrap text-ink tabular-nums md:hidden">{price}</p>
                  <div className="mt-1 -ml-3 md:hidden">{editLink}</div>
                </td>
                <td className={`${cell} hidden text-ink xl:table-cell`}>{category}</td>
                <td className={`${cell} hidden text-right font-semibold whitespace-nowrap text-ink tabular-nums md:table-cell`}>
                  {price}
                </td>
                <td className={`${cell} hidden whitespace-nowrap text-ink xl:table-cell`}>{duration}</td>
                <td className={cell}>
                  <ServiceSwitch id={service.id} name={service.name.id} isActive={service.isActive} />
                </td>
                <td className={`${cell} hidden text-right md:table-cell`}>{editLink}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
