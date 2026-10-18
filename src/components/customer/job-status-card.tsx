import { ShieldCheck, Video } from "lucide-react";
import Image from "next/image";
import { ButtonLink } from "@/components/ui/button-link";
import { LiveIndicator } from "@/components/ui/live-indicator";
import { withNoBreak } from "@/components/ui/no-break";
import type { PreviewJob } from "./home-preview-data";

const copy = {
  region: "Pesanan berjalan",
  live: "Sedang berlangsung",
  checkedIn: (time: string) => `Petugas sudah check-in pukul ${time}`,
  cleanerRole: "Petugas HomeKlin",
  detail: (job: PreviewJob) => `${job.service}, selesai sekitar ${job.finishesAround}`,
  privacy: "Hanya Anda dan tim pemantau HomeKlin yang dapat menonton. Rekaman tersimpan 7 hari.",
  watch: "Tonton langsung",
};

type JobStatusCardProps = {
  job: PreviewJob;
  /** 2 on the app home; 3 where the card sits under a section heading (the landing page). */
  headingLevel?: 2 | 3;
  /** "raised" when the card floats on a tinted panel (the landing page). */
  elevation?: "card" | "raised";
};

const elevations = { card: "shadow-card", raised: "shadow-raised" };

// The customer's current job, first on /home and shown live on the landing page: what is happening
// now in plain words, who is in the home (a Petugas HomeKlin, by name and photo), and who can watch.
// The bottom row sits side by side once the card itself is wide enough (container query).
export function JobStatusCard({ job, headingLevel = 2, elevation = "card" }: JobStatusCardProps) {
  const Heading = headingLevel === 2 ? "h2" : "h3";
  const { cleaner } = job;

  return (
    <section
      aria-label={copy.region}
      className={`@container rounded-xl border border-border bg-surface p-5 md:p-6 ${elevations[elevation]}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <LiveIndicator label={copy.live} />
        <span className="text-sm text-ink-faint">{job.scheduled}</span>
      </div>

      <Heading className="mt-4 font-display text-xl font-semibold text-ink">
        {withNoBreak(copy.checkedIn(job.checkedInAt), "check-in")}
      </Heading>

      <div className="mt-4 flex items-center gap-3">
        <Image
          src={cleaner.photo.src}
          width={cleaner.photo.width}
          height={cleaner.photo.height}
          alt={cleaner.photo.alt}
          sizes="48px"
          className="size-12 shrink-0 rounded-full bg-surface-sunken object-cover"
        />
        <p className="flex min-w-0 flex-col">
          <span className="text-base font-semibold text-ink">{cleaner.name}</span>
          <span className="text-sm text-ink-muted">{copy.cleanerRole}</span>
        </p>
      </div>
      <p className="mt-3 text-sm text-ink-muted">{copy.detail(job)}</p>

      <div className="mt-5 flex flex-col gap-4 border-t border-border pt-5 @lg:flex-row @lg:items-center @lg:justify-between @lg:gap-6">
        <p className="flex items-start gap-2 text-sm text-ink-muted">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-live" aria-hidden="true" />
          <span>{copy.privacy}</span>
        </p>
        <ButtonLink href="/orders" icon={Video} className="w-full shrink-0 @lg:w-auto">
          {copy.watch}
        </ButtonLink>
      </div>
    </section>
  );
}
