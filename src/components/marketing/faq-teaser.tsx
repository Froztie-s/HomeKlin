import { ArrowRight, Minus, Plus } from "lucide-react";
import Link from "next/link";
import { Eyebrow } from "./eyebrow";
import { anchorOffset, landingContainer, landingSection } from "./landing-layout";

const copy = {
  eyebrow: "Pertanyaan umum",
  titleStart: "Ada pertanyaan?",
  titleAccent: "Ini jawabannya.",
  all: "Lihat semua pertanyaan",
  questions: [
    {
      question: "Siapa yang datang ke rumah saya?",
      answer: "Petugas HomeKlin. Setelah petugas ditugaskan, nama dan fotonya tampil di pesanan Anda.",
    },
    {
      question: "Siapa yang dapat menonton siaran langsungnya?",
      answer:
        "Anda, selama pekerjaan berlangsung, dan tim pemantau HomeKlin. Pelanggan lain tidak dapat menontonnya.",
    },
    {
      question: "Berapa lama rekaman disimpan?",
      answer: "7 hari setelah pekerjaan selesai. Setelah itu rekaman dihapus dan tidak dapat dibuka lagi.",
    },
    {
      question: "Kapan saya membayar?",
      answer: "Saat memesan. Status pesanan Anda berubah begitu pembayaran berhasil.",
    },
  ],
};

// FAQ (markdown/design.md, Layout): the heading and the help link on 4 of 12 columns, four native
// disclosures on 8 (keyboard and screen-reader support for free), 12 px apart. A lime-wash "+" marks
// a closed question, a dark "-" the open one. Stacked on phones and tablets.
export function FaqTeaser() {
  return (
    <section
      id="pertanyaan"
      aria-labelledby="pertanyaan-title"
      className={`${landingContainer} ${landingSection} ${anchorOffset}`}
    >
      <div className="grid gap-10 lg:grid-cols-12 lg:gap-12">
        <div className="lg:col-span-4">
          <Eyebrow>{copy.eyebrow}</Eyebrow>
          <h2
            id="pertanyaan-title"
            className="mt-4 font-display text-headline-sm font-semibold text-ink md:text-headline-md"
          >
            {copy.titleStart} <em className="serif-accent">{copy.titleAccent}</em>
          </h2>
          <Link
            href="/support"
            className="group mt-6 inline-flex min-h-touch items-center gap-2 rounded-full text-sm font-semibold text-ink"
          >
            {copy.all}
            <span
              aria-hidden="true"
              className="flex size-8 items-center justify-center rounded-full bg-primary text-on-primary transition-transform duration-150 ease-out-quart group-hover:translate-x-0.5"
            >
              <ArrowRight className="size-4" />
            </span>
          </Link>
        </div>
        <div className="flex flex-col gap-3 lg:col-span-8">
          {copy.questions.map((item) => (
            <details key={item.question} className="group rounded-md bg-card">
              <summary className="flex min-h-touch cursor-pointer list-none items-center justify-between gap-4 rounded-md px-5 py-5 text-base font-semibold text-ink md:px-6 [&::-webkit-details-marker]:hidden">
                {item.question}
                <span
                  aria-hidden="true"
                  className="flex size-6 shrink-0 items-center justify-center rounded-full bg-lime-wash text-on-lime-wash transition-colors duration-150 ease-out-quart group-open:bg-band group-open:text-on-band"
                >
                  <Plus className="size-3.5 group-open:hidden" strokeWidth={2.5} />
                  <Minus className="hidden size-3.5 group-open:block" strokeWidth={2.5} />
                </span>
              </summary>
              <p className="max-w-prose px-5 pb-5 text-body text-ink-muted md:px-6">{item.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
