import { useTranslations } from "next-intl";
import { splitDuration } from "@/lib/catalog/customer-duration";

/** About how long a service takes, in words: "± 2 jam", "± 1 jam 30 menit", "About 45 minutes". */
export function ServiceDuration({ minutes: total }: { minutes: number }) {
  const t = useTranslations("Service");
  const { hours, minutes } = splitDuration(total);
  if (hours === 0) return t("durationMinutes", { minutes });
  if (minutes === 0) return t("durationHours", { hours });
  return t("durationHoursMinutes", { hours, minutes });
}
