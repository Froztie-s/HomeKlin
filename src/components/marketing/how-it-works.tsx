import { CalendarCheck, History, MapPinCheck, Video, Wallet, type LucideIcon } from "lucide-react";
import { withNoBreak } from "@/components/ui/no-break";

type Step = { title: string; body: string; icon: LucideIcon };

const copy = {
  title: "Cara kerjanya",
  steps: [
    { title: "Pesan", body: "Pilih layanan, area, dan jadwal yang masih kosong.", icon: CalendarCheck },
    { title: "Bayar", body: "Bayar di muka. Harga tampil penuh sebelum Anda membayar.", icon: Wallet },
    {
      title: "Petugas check-in",
      body: "Petugas HomeKlin check-in di alamat Anda. Waktu dan lokasinya tercatat.",
      icon: MapPinCheck,
    },
    {
      title: "Tonton langsung",
      body: "Saat pekerjaan berjalan, Anda dapat menontonnya dari ponsel.",
      icon: Video,
    },
    {
      title: "Putar ulang 7 hari",
      body: "Rekaman dapat Anda putar ulang selama 7 hari, lalu dihapus.",
      icon: History,
    },
  ] satisfies Step[],
};

// An ordered timeline: the verb is the label (no "Step 1"). Horizontal with a connecting line from
// 1024 px; a vertical line down the left on phones and tablets.
export function HowItWorks() {
  return (
    <section
      id="cara-kerja"
      aria-labelledby="cara-kerja-title"
      className="scroll-mt-16 border-y border-border bg-surface"
    >
      <div className="mx-auto w-full max-w-page px-safe py-16 lg:px-gutter-wide lg:py-24">
        <h2
          id="cara-kerja-title"
          className="font-display text-3xl font-semibold tracking-display text-ink lg:text-4xl"
        >
          {copy.title}
        </h2>
        <ol className="mt-10 grid max-w-prose lg:mt-14 lg:max-w-none lg:grid-cols-5 lg:gap-8">
          {copy.steps.map((step, index) => {
            const Icon = step.icon;
            const last = index === copy.steps.length - 1;
            return (
              <li key={step.title} className="relative flex gap-4 pb-8 last:pb-0 lg:flex-col lg:gap-5 lg:pb-0">
                {last ? null : (
                  <span
                    aria-hidden="true"
                    className="absolute top-12 bottom-0 left-6 w-0.5 -translate-x-1/2 bg-brand-300 lg:top-6 lg:-right-8 lg:bottom-auto lg:left-12 lg:h-0.5 lg:w-auto lg:translate-x-0 lg:-translate-y-1/2"
                  />
                )}
                <span className="relative flex size-12 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700 ring-1 ring-brand-200">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <div className="pt-2.5 lg:pt-0">
                  <h3 className="text-lg font-semibold text-ink">{step.title}</h3>
                  <p className="mt-1 text-base text-ink-muted">{withNoBreak(step.body, "check-in")}</p>
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
