import Image from "next/image";
import { useTranslations } from "next-intl";
import { withNoBreak } from "@/components/ui/no-break";
import { anchorOffset, landingContainer } from "./landing-layout";

// Pexels photo, credited in markdown/image-sources.md (the sample cleaner's source photo).
// The alt text is Safety.photoAlt.
const photo = {
  src: "/images/cleaner-portrait.jpg",
  width: 1000,
  height: 1500,
};

// A four-cell bento (markdown/design.md, Layout): a large photo on 7 of 12 columns spanning two rows,
// beside a lime panel with the message and two fact chips under it (dark, then white). Four pieces of
// content, four cells. One column on phones: photo, panel, then the chips side by side from 640 px.
// It follows the services section directly, whose bottom padding already separates the two, so it
// only pads its own bottom edge.
// Only what markdown/SPEC.md backs: who can watch, consent at booking, the 7-day replay, the check-in.
export function Safety() {
  const t = useTranslations("Safety");
  return (
    <section
      id="keamanan"
      aria-labelledby="keamanan-title"
      className={`${landingContainer} ${anchorOffset} pb-16 md:pb-24 xl:pb-30`}
    >
      <div className="grid gap-5 lg:grid-cols-12">
        <div className="relative aspect-4/3 overflow-hidden rounded-xl bg-sunken lg:col-span-7 lg:row-span-2 lg:aspect-auto lg:min-h-[32rem]">
          <Image
            src={photo.src}
            alt={t("photoAlt")}
            fill
            sizes="(min-width: 1280px) 650px, (min-width: 1024px) 56vw, 100vw"
            className="object-cover object-[50%_28%]"
          />
        </div>

        <div className="flex flex-col justify-end rounded-lg bg-lime p-7 text-on-lime md:p-10 lg:col-span-5">
          <h2
            id="keamanan-title"
            className="font-display text-headline-sm font-semibold md:text-headline-md"
          >
            {t.rich("title", { accent: (chunks) => <em className="serif-accent">{chunks}</em> })}
          </h2>
          <p className="mt-5 max-w-prose text-body-lg">{t("body")}</p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:col-span-5">
          <div className="rounded-md bg-band px-6 py-5 text-on-band">
            <p className="font-display text-fact font-semibold text-lime">{t("replayFigure")}</p>
            <p className="mt-3 text-sm text-on-band-muted">{t("replayCaption")}</p>
          </div>
          <div className="rounded-md bg-card px-6 py-5 text-ink">
            <p className="font-display text-fact font-semibold">{t("checkInFigure")}</p>
            <p className="mt-3 text-sm text-ink-muted">{withNoBreak(t("checkInCaption"), "check-in")}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
