import { ClipboardCheck, History, Lock, MapPin, type LucideIcon } from "lucide-react";
import { previewJob } from "@/components/customer/home-preview-data";
import { JobStatusCard } from "@/components/customer/job-status-card";
import { withNoBreak } from "@/components/ui/no-break";

type Fact = { title: string; body: string; icon: LucideIcon };

// Only what markdown/SPEC.md backs: who can watch, check-in at the address, 7-day recordings, consent at booking.
const copy = {
  title: "Rumah Anda tetap dalam pantauan Anda",
  caption: "Contoh tampilan pesanan berjalan di aplikasi HomeKlin.",
  facts: [
    {
      title: "Hanya untuk Anda",
      body: "Siaran langsung pekerjaan Anda hanya dapat ditonton oleh Anda dan tim pemantau HomeKlin, tidak oleh pelanggan lain.",
      icon: Lock,
    },
    {
      title: "Check-in di alamat Anda",
      body: "Petugas HomeKlin check-in di alamat Anda sebelum mulai bekerja.",
      icon: MapPin,
    },
    {
      title: "Rekaman 7 hari",
      body: "Rekaman disimpan 7 hari, lalu dihapus otomatis.",
      icon: History,
    },
    {
      title: "Persetujuan Anda dulu",
      body: "Persetujuan siaran ditanyakan saat Anda memesan.",
      icon: ClipboardCheck,
    },
  ] satisfies Fact[],
};

// A split on a tinted panel: the real job status card from the app (live component, sample data)
// beside four plain facts. Text first in reading order; from 1024 px the card sits on the left.
export function Safety() {
  return (
    <section
      id="keamanan"
      aria-labelledby="keamanan-title"
      className="mx-auto w-full max-w-page scroll-mt-16 px-safe py-16 lg:px-gutter-wide lg:py-24"
    >
      <div className="grid items-center gap-10 rounded-xl bg-brand-50 px-5 py-8 sm:px-8 md:p-10 lg:grid-cols-12 lg:gap-12 lg:p-14">
        <div className="lg:order-2 lg:col-span-7">
          <h2
            id="keamanan-title"
            className="font-display text-3xl font-semibold tracking-display text-ink lg:text-4xl"
          >
            {copy.title}
          </h2>
          <ul className="mt-8 grid gap-x-8 gap-y-7 sm:grid-cols-2 lg:mt-10 lg:grid-cols-1 lg:gap-y-6">
            {copy.facts.map((fact) => {
              const Icon = fact.icon;
              return (
                <li key={fact.title} className="flex gap-4">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-surface text-brand-700 ring-1 ring-brand-200">
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  <div>
                    <h3 className="text-base font-semibold text-ink">{fact.title}</h3>
                    <p className="mt-1 text-base text-ink-muted">{withNoBreak(fact.body, "check-in")}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
        <figure className="lg:order-1 lg:col-span-5">
          <JobStatusCard job={previewJob} headingLevel={3} elevation="raised" />
          <figcaption className="mt-3 text-sm text-ink-muted">{copy.caption}</figcaption>
        </figure>
      </div>
    </section>
  );
}
