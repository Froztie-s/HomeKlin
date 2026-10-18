import { ArrowDown } from "lucide-react";
import Image from "next/image";
import { ButtonLink } from "@/components/ui/button-link";

const copy = {
  title: "Jasa kebersihan rumah yang bisa Anda tonton langsung",
  lead: "Pilih layanan dan jadwal di area Anda, bayar di muka, lalu pantau Petugas HomeKlin bekerja dari ponsel.",
  cta: "Pesan sekarang",
  prices: "Lihat harga",
};

// Pexels photo, credited in docs/image-sources.md.
const photo = {
  src: "/images/hero-wiping-counter.jpg",
  width: 1600,
  height: 1067,
  alt: "Petugas kebersihan mengelap meja dapur",
};

// Asymmetric split: text on 7 of 12 columns, the photo on 5. Phones read the text and see the
// button first, then the photo. Only the text rises in (to set reading order); the photo is
// preloaded and never animated, so it never delays the largest paint.
// The headline stays at two lines from 1024 px: it needs about 1180 px on one line at 48 px, and
// the text column is 547 px wide at 1024 px and 659 px from 1280 px, hence 36 px, then 48 px.
export function Hero() {
  return (
    <section
      aria-labelledby="hero-title"
      className="mx-auto grid w-full max-w-page items-center gap-10 px-safe pt-8 pb-16 md:pt-12 lg:min-h-[calc(100dvh-4rem)] lg:grid-cols-12 lg:gap-x-8 lg:px-gutter-wide lg:py-12"
    >
      <div className="lg:col-span-7">
        <h1
          id="hero-title"
          className="animate-rise font-display text-4xl font-semibold tracking-display text-ink md:text-5xl lg:text-4xl xl:text-5xl"
        >
          {copy.title}
        </h1>
        <p className="mt-5 max-w-prose animate-rise text-lg text-ink-muted animate-delay-80 lg:mt-6">
          {copy.lead}
        </p>
        <div className="mt-8 flex animate-rise flex-wrap items-center gap-x-6 gap-y-3 animate-delay-160 lg:mt-10">
          <ButtonLink href="/home" size="lg">
            {copy.cta}
          </ButtonLink>
          <a
            href="#layanan"
            className="inline-flex min-h-touch items-center gap-1.5 rounded-full px-1 text-base font-semibold text-brand-700 transition-colors duration-150 ease-out-quart hover:text-brand-800 active:text-brand-900"
          >
            {copy.prices}
            <ArrowDown className="size-4" aria-hidden="true" />
          </a>
        </div>
      </div>
      <div className="lg:col-span-5">
        <Image
          src={photo.src}
          width={photo.width}
          height={photo.height}
          alt={photo.alt}
          preload
          sizes="(min-width: 1280px) 480px, (min-width: 1024px) 40vw, 100vw"
          className="aspect-4/3 w-full rounded-xl bg-surface-sunken object-cover object-[40%_50%] lg:aspect-4/5 lg:max-h-[calc(100dvh-10rem)]"
        />
      </div>
    </section>
  );
}
