import { ArrowDown, Sparkle } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { ButtonLink } from "@/components/ui/button-link";
import { HeroJobCard } from "./hero-job-card";
import { landingContainer } from "./landing-layout";

// Pexels photo, credited in markdown/image-sources.md. The alt text is Hero.photoAlt.
const photo = {
  src: "/images/hero-wiping-counter.jpg",
  width: 1600,
  height: 1067,
};

// Asymmetric split (markdown/design.md, Layout): text on 7 of 12 columns, a tall photo frame on 5,
// with a lime quarter-circle in its top corner and the sample job card floating over its left edge.
// The card sits low on the photo: the cleaner stands on the photo's left, so a high card would cover
// her face.
// The headline states what HomeKlin is (T3b decision); the serif marks the benefit words, which the
// message wraps in <accent> so each language puts them where its sentence has them. It is three lines
// at most from 1024 px: about 20 characters fit a line at 52 px in the 543 px column at 1024 px, and
// at 64 px in the 637 px column from 1280 px.
// Phones and tablets read the text and see the button first, then the photo, then the card.
// Only the text rises in (reading order); the photo is preloaded and never animated.
export function Hero() {
  const t = useTranslations("Hero");
  return (
    <section
      aria-labelledby="hero-title"
      className={`${landingContainer} grid items-center gap-x-10 gap-y-10 pt-8 pb-16 md:pt-12 lg:min-h-[calc(100dvh-6.75rem)] lg:grid-cols-12 lg:py-12`}
    >
      <div className="lg:col-span-7">
        <h1
          id="hero-title"
          className="animate-rise font-display text-display-sm font-semibold text-ink md:text-display-md xl:text-display"
        >
          {t.rich("title", { accent: (chunks) => <em className="serif-accent">{chunks}</em> })}
        </h1>
        <p className="mt-6 max-w-prose animate-rise text-body-lg text-ink-muted animate-delay-80 lg:mt-7 lg:max-w-[34rem]">
          {t("lead")}
        </p>
        <div className="mt-8 flex animate-rise flex-wrap items-center gap-x-6 gap-y-4 animate-delay-160 lg:mt-10">
          <ButtonLink href="/home" variant="accent" size="lg">
            {t("cta")}
          </ButtonLink>
          <a
            href="#layanan"
            className="group inline-flex min-h-touch items-center gap-3 rounded-full pr-2 text-sm font-semibold text-ink"
          >
            <span
              aria-hidden="true"
              className="flex size-11 items-center justify-center rounded-full border-[1.5px] border-outline transition-colors duration-150 ease-out-quart group-hover:bg-primary group-hover:text-on-primary group-active:scale-[0.98]"
            >
              <ArrowDown className="size-4" />
            </span>
            {t("prices")}
          </a>
        </div>
      </div>

      <div className="relative lg:col-span-5">
        <div className="relative overflow-hidden rounded-xl bg-sunken">
          <Image
            src={photo.src}
            width={photo.width}
            height={photo.height}
            alt={t("photoAlt")}
            preload
            sizes="(min-width: 1280px) 445px, (min-width: 1024px) 38vw, 100vw"
            className="aspect-4/3 w-full object-cover object-[30%_50%] md:aspect-16/10 lg:aspect-4/5 lg:max-h-[calc(100dvh-10rem)]"
          />
          <span
            aria-hidden="true"
            className="absolute top-0 right-0 flex size-28 items-start justify-end rounded-bl-full bg-lime p-5 text-on-lime md:size-36 md:p-7"
          >
            <Sparkle className="size-6 fill-current md:size-7" />
          </span>
        </div>
        <HeroJobCard className="mt-4 w-full sm:max-w-xs lg:absolute lg:bottom-10 lg:-left-10 lg:mt-0 lg:w-72" />
      </div>
    </section>
  );
}
