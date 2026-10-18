import { ArrowRight, ChevronDown } from "lucide-react";
import Link from "next/link";

const copy = {
  title: "Pertanyaan umum",
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

// Four native disclosures (keyboard and screen-reader support for free) and a link to the help page.
export function FaqTeaser() {
  return (
    <section
      id="pertanyaan"
      aria-labelledby="pertanyaan-title"
      className="mx-auto w-full max-w-page scroll-mt-16 px-safe pb-16 lg:px-gutter-wide lg:pb-24"
    >
      <div className="grid gap-8 lg:grid-cols-12 lg:gap-12">
        <div className="lg:col-span-4">
          <h2
            id="pertanyaan-title"
            className="font-display text-3xl font-semibold tracking-display text-ink lg:text-4xl"
          >
            {copy.title}
          </h2>
          <Link
            href="/support"
            className="-ml-1 mt-4 inline-flex min-h-touch items-center gap-1.5 rounded-full px-1 text-base font-semibold text-brand-700 transition-colors duration-150 ease-out-quart hover:text-brand-800 active:text-brand-900"
          >
            {copy.all}
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </div>
        <div className="divide-y divide-border rounded-xl border border-border bg-surface lg:col-span-8">
          {copy.questions.map((item) => (
            <details key={item.question} className="group">
              <summary className="flex min-h-touch cursor-pointer list-none items-center justify-between gap-4 rounded-xl px-5 py-4 text-base font-semibold text-ink -outline-offset-2 transition-colors duration-150 ease-out-quart hover:text-brand-700 active:text-brand-800 md:px-6 [&::-webkit-details-marker]:hidden">
                {item.question}
                <ChevronDown
                  className="size-5 shrink-0 text-ink-faint transition-transform duration-200 ease-out-quart group-open:rotate-180 group-hover:text-brand-700"
                  aria-hidden="true"
                />
              </summary>
              <p className="max-w-prose px-5 pb-5 text-base text-ink-muted md:px-6">{item.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
