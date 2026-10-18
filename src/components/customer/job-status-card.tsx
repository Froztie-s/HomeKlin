import { ShieldCheck, Video } from "lucide-react";
import { ButtonLink } from "@/components/ui/button-link";
import { LiveIndicator } from "@/components/ui/live-indicator";
import type { PreviewJob } from "./home-preview-data";

const copy = {
  region: "Pesanan berjalan",
  live: "Sedang berlangsung",
  detail: (job: PreviewJob) => `${job.service} oleh ${job.agency}. Petugas tiba pukul ${job.arrivedAt}.`,
  privacy: "Hanya Anda yang dapat menonton",
  retention: "Rekaman tersimpan 7 hari.",
  watch: "Tonton langsung",
};

// The customer's current job comes first on the home screen: what is happening now, in plain words.
export function JobStatusCard({ job }: { job: PreviewJob }) {
  return (
    <section aria-label={copy.region} className="rounded-lg border border-border bg-surface p-4 shadow-card md:p-5">
      <div className="flex items-center justify-between gap-3">
        <LiveIndicator label={copy.live} />
        <span className="text-xs text-ink-faint">{job.scheduled}</span>
      </div>
      <h2 className="mt-3 text-lg font-semibold text-ink">{job.status}</h2>
      <p className="mt-0.5 text-sm text-ink-muted">{copy.detail(job)}</p>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-start gap-2 text-xs text-ink-muted">
          <ShieldCheck className="size-4 shrink-0 text-live" aria-hidden="true" />
          <span>
            <span className="font-medium text-ink">{copy.privacy}</span>. {copy.retention}
          </span>
        </p>
        <ButtonLink href="/orders" icon={Video} className="w-full sm:w-auto">
          {copy.watch}
        </ButtonLink>
      </div>
    </section>
  );
}
