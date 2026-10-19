import Image from "next/image";
import { previewJob } from "@/components/customer/home-preview-data";
import { LiveIndicator } from "@/components/ui/live-indicator";
import { withNoBreak } from "@/components/ui/no-break";

const copy = {
  label: "Contoh pesanan berjalan",
  sample: "Contoh",
  live: "Sedang berlangsung",
  checkedIn: (time: string) => `Petugas sudah check-in pukul ${time}`,
  cleanerRole: "Petugas HomeKlin",
};

// The redesign's one floating fragment (markdown/design.md, Elevation & Depth): the product's core
// moment, a running job, rendered from the same sample data as the app's job card and labelled
// "Contoh". It floats over the hero photo's left edge from 1024 px (the hero positions it) and sits
// under the photo on phones and tablets.
export function HeroJobCard({ className = "" }: { className?: string }) {
  const { cleaner } = previewJob;
  return (
    <div
      role="group"
      aria-label={copy.label}
      className={`rounded-md bg-card p-4 text-ink shadow-float ${className}`}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="rounded-full bg-lime-wash px-2.5 py-0.5 text-eyebrow font-semibold text-on-lime-wash uppercase">
          {copy.sample}
        </span>
        <span className="text-xs text-ink-muted">{previewJob.scheduled}</span>
      </div>
      <div className="mt-3">
        <LiveIndicator label={copy.live} />
      </div>
      <p className="mt-3 font-display text-base font-semibold">
        {withNoBreak(copy.checkedIn(previewJob.checkedInAt), "check-in")}
      </p>
      <div className="mt-3 flex items-center gap-3 border-t border-border pt-3">
        <Image
          src={cleaner.photo.src}
          width={cleaner.photo.width}
          height={cleaner.photo.height}
          alt={cleaner.photo.alt}
          sizes="40px"
          className="size-10 shrink-0 rounded-full bg-sunken object-cover"
        />
        <p className="flex min-w-0 flex-col">
          <span className="text-sm font-semibold">{cleaner.name}</span>
          <span className="text-xs text-ink-muted">{copy.cleanerRole}</span>
        </p>
      </div>
    </div>
  );
}
