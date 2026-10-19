import Image from "next/image";
import { withNoBreak } from "@/components/ui/no-break";
import { anchorOffset, landingContainer } from "./landing-layout";

// Only what markdown/SPEC.md backs: who can watch, consent at booking, the 7-day replay, the check-in.
const copy = {
  titleStart: "Rumah Anda tetap dalam",
  titleAccent: "pantauan Anda",
  body: "Tonton pekerjaan secara langsung dari ponsel Anda. Siaran hanya untuk Anda dan tim pemantau HomeKlin, dan persetujuan Anda ditanyakan saat memesan.",
  replay: { figure: "7 hari", caption: "Rekaman dapat Anda putar ulang, lalu dihapus otomatis." },
  checkIn: { figure: "Check-in", caption: "Petugas HomeKlin check-in di alamat Anda sebelum mulai bekerja." },
};

// Pexels photo, credited in markdown/image-sources.md (the sample cleaner's source photo).
const photo = {
  src: "/images/cleaner-portrait.jpg",
  width: 1000,
  height: 1500,
  alt: "Petugas kebersihan merapikan bantal sofa",
};

// A four-cell bento (markdown/design.md, Layout): a large photo on 7 of 12 columns spanning two rows,
// beside a lime panel with the message and two fact chips under it (dark, then white). Four pieces of
// content, four cells. One column on phones: photo, panel, then the chips side by side from 640 px.
// It follows the services section directly, whose bottom padding already separates the two, so it
// only pads its own bottom edge.
export function Safety() {
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
            alt={photo.alt}
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
            {copy.titleStart} <em className="serif-accent">{copy.titleAccent}</em>
          </h2>
          <p className="mt-5 max-w-prose text-body-lg">{copy.body}</p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:col-span-5">
          <div className="rounded-md bg-band px-6 py-5 text-on-band">
            <p className="font-display text-fact font-semibold text-lime">{copy.replay.figure}</p>
            <p className="mt-3 text-sm text-on-band-muted">{copy.replay.caption}</p>
          </div>
          <div className="rounded-md bg-card px-6 py-5 text-ink">
            <p className="font-display text-fact font-semibold">{copy.checkIn.figure}</p>
            <p className="mt-3 text-sm text-ink-muted">{withNoBreak(copy.checkIn.caption, "check-in")}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
