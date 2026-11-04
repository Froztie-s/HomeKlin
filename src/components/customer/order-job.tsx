import { Circle, CircleCheck, CircleDot, UserRound, type LucideIcon } from "lucide-react";
import Image from "next/image";
import { getLocale, getTranslations } from "next-intl/server";
import type { CustomerOrder } from "@/lib/booking/orders";
import { formatJakartaTime } from "@/lib/catalog/slots-days";
import { initialsOf, progressSteps, type StepState } from "./job-progress";

// Who does a paid job and how far it has got, on the order's details (T15). The cleaner appears as
// HomeKlin's own "Petugas HomeKlin", by name and photo (initials without one), never with the agency
// they work for (markdown/PRODUCT.md principle 6; listMyOrders never returns it). The progress is three
// steps, each in words with an icon, so it never depends on colour: assigned, checked in, finished.

const stepIcons: Record<StepState, { Icon: LucideIcon; tone: string; text: string }> = {
  done: { Icon: CircleCheck, tone: "text-success", text: "font-medium text-ink" },
  current: { Icon: CircleDot, tone: "text-brand-700", text: "font-semibold text-ink" },
  upcoming: { Icon: Circle, tone: "text-ink-faint", text: "text-ink-muted" },
};

export async function OrderJob({ order }: { order: Pick<CustomerOrder, "cleanerName" | "cleanerPhotoUrl" | "checkedInAt" | "completedAt"> }) {
  const locale = await getLocale();
  const t = await getTranslations("OrderConfirmation");
  const steps = progressSteps(order);

  return (
    <section aria-label={t("job.region")} className="flex flex-col gap-4 border-t border-border p-5 md:p-6">
      <div className="flex items-center gap-3">
        {order.cleanerName ? (
          <CleanerAvatar name={order.cleanerName} photoUrl={order.cleanerPhotoUrl} alt={t("job.photoAlt", { name: order.cleanerName })} />
        ) : (
          <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700">
            <UserRound className="size-6" aria-hidden="true" />
          </span>
        )}
        <p className="flex min-w-0 flex-col">
          <span className="text-base font-semibold text-ink">{order.cleanerName ?? t("job.unassignedName")}</span>
          <span className="text-sm text-ink-muted">{order.cleanerName ? t("job.role") : t("job.unassignedBody")}</span>
        </p>
      </div>

      <ol aria-label={t("job.progressLabel")} className="flex flex-col gap-2.5">
        {steps.map((step) => {
          const { Icon, tone, text } = stepIcons[step.state];
          const time = step.at ? formatJakartaTime(step.at, locale) : "";
          return (
            <li
              key={step.key}
              aria-current={step.state === "current" ? "step" : undefined}
              className="flex items-start gap-3 text-sm"
            >
              <Icon className={`mt-0.5 size-4.5 shrink-0 ${tone}`} aria-hidden="true" />
              <span className={text}>
                <span className="sr-only">{t(`job.state.${step.state}`)} </span>
                {t(`job.steps.${step.key}.${step.state}`, { time })}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function CleanerAvatar({ name, photoUrl, alt }: { name: string; photoUrl: string | null; alt: string }) {
  if (!photoUrl) {
    return (
      <span
        aria-hidden="true"
        className="flex size-12 shrink-0 items-center justify-center rounded-full bg-brand-100 font-display text-base font-semibold text-brand-800"
      >
        {initialsOf(name)}
      </span>
    );
  }
  return (
    <Image
      src={photoUrl}
      width={96}
      height={96}
      alt={alt}
      sizes="48px"
      // The site's own photos (/images/...) are optimised; a photo elsewhere (https) is shown as it is.
      unoptimized={!photoUrl.startsWith("/")}
      className="size-12 shrink-0 rounded-full bg-surface-sunken object-cover"
    />
  );
}
