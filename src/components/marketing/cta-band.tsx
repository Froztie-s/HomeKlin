import { ButtonLink } from "@/components/ui/button-link";

const copy = {
  title: "Pilih jadwal yang masih kosong di area Anda",
  cta: "Pesan sekarang",
};

// The closing call to action: the same label as the header and the hero (one label per intent).
export function CtaBand() {
  return (
    <section
      id="pesan"
      aria-labelledby="pesan-title"
      className="mx-auto w-full max-w-page px-safe pb-16 lg:px-gutter-wide lg:pb-24"
    >
      <div className="flex flex-col items-start gap-6 rounded-xl bg-brand-50 px-6 py-10 md:flex-row md:items-center md:justify-between md:gap-10 md:px-10 lg:px-14 lg:py-14">
        <h2
          id="pesan-title"
          className="max-w-prose font-display text-3xl font-semibold tracking-display text-ink lg:text-4xl"
        >
          {copy.title}
        </h2>
        <ButtonLink href="/home" size="lg" className="shrink-0">
          {copy.cta}
        </ButtonLink>
      </div>
    </section>
  );
}
