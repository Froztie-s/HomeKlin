import { CalendarCheck, History, MapPinCheck, Video, Wallet, type LucideIcon } from "lucide-react";
import { withNoBreak } from "@/components/ui/no-break";
import { anchorOffset, landingContainer, landingSection } from "./landing-layout";

type Step = { title: string; body: string; icon: LucideIcon };

const copy = {
  titleStart: "Cara kerjanya, dalam",
  titleAccent: "lima langkah",
  lead: "Dari memesan sampai memutar ulang rekaman, semuanya dari ponsel Anda.",
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

// Five cards, no empty cell at any width: five columns from 1280 px; three then two from 768 px
// (a six-column grid, the first three span two, the last two span three); one column on phones.
const spans = ["md:col-span-2", "md:col-span-2", "md:col-span-2", "md:col-span-3", "md:col-span-3"];

// The full-bleed dark band (markdown/design.md, Layout): the heading with the one supporting sentence
// stacked under it, then the steps as raised cards with a lime icon well and a large faint numeral.
// The verb is each step's label; the numerals only echo the order the list already gives.
export function HowItWorks() {
  return (
    <section
      id="cara-kerja"
      aria-labelledby="cara-kerja-title"
      className={`${anchorOffset} bg-band text-on-band`}
    >
      <div className={`${landingContainer} ${landingSection}`}>
        <h2
          id="cara-kerja-title"
          className="max-w-3xl font-display text-headline-sm font-semibold md:text-headline-md xl:text-headline"
        >
          {copy.titleStart} <em className="serif-accent text-lime">{copy.titleAccent}</em>
        </h2>
        <p className="mt-5 max-w-prose text-body-lg text-on-band-muted">{copy.lead}</p>

        <ol className="mt-10 grid gap-5 md:grid-cols-6 lg:mt-14 xl:grid-cols-5">
          {copy.steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <li
                key={step.title}
                className={`flex flex-col rounded-lg border border-on-band/8 bg-band-raised p-6 xl:col-span-1 ${spans[index]}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <span className="flex size-10 items-center justify-center rounded-sm bg-lime text-on-lime">
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  <span aria-hidden="true" className="font-display text-fact font-semibold text-on-band/15">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                </div>
                <h3 className="mt-8 font-display text-lg font-semibold">{step.title}</h3>
                <p className="mt-2 text-body text-on-band-muted">{withNoBreak(step.body, "check-in")}</p>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
