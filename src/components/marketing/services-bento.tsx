import { ArrowRight, Clock } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { previewServices, type PreviewService } from "@/components/customer/home-preview-data";
import { formatRupiah } from "@/lib/format";

const copy = {
  title: "Layanan dan harga",
  lead: "Satu daftar harga dari HomeKlin. Harga yang tampil adalah harga yang Anda bayar, tanpa biaya tersembunyi.",
  from: "mulai dari",
  note: "Harga contoh selama masa pratinjau. Harga resmi diatur HomeKlin dan selalu tampil penuh sebelum Anda membayar.",
  all: "Lihat semua layanan",
};

// Bento rhythm on the 12-column grid from 1024 px: wide + narrow, then narrow + wide, so the photos
// alternate between panoramic and closer crops while the facts line up across each row.
// Two columns on tablets, one on phones.
const spans = ["lg:col-span-7", "lg:col-span-5", "lg:col-span-5", "lg:col-span-7"];

export function ServicesBento() {
  return (
    <section
      id="layanan"
      aria-labelledby="layanan-title"
      className="mx-auto w-full max-w-page scroll-mt-16 px-safe py-16 lg:px-gutter-wide lg:py-24"
    >
      <h2
        id="layanan-title"
        className="font-display text-3xl font-semibold tracking-display text-ink lg:text-4xl"
      >
        {copy.title}
      </h2>
      <p className="mt-3 max-w-prose text-lg text-ink-muted">{copy.lead}</p>

      <ul className="mt-10 grid gap-4 md:grid-cols-2 lg:mt-12 lg:grid-cols-12 lg:gap-6">
        {previewServices.map((service, index) => (
          <li key={service.id} className={spans[index % spans.length]}>
            <ServiceCell service={service} />
          </li>
        ))}
      </ul>

      <div className="mt-8 flex flex-col gap-3 md:flex-row md:items-center md:justify-between md:gap-8">
        <p className="max-w-prose text-sm text-ink-muted">{copy.note}</p>
        <Link
          href="/services"
          className="-ml-1 inline-flex min-h-touch shrink-0 items-center gap-1.5 self-start rounded-full px-1 text-base font-semibold text-brand-700 transition-colors duration-150 ease-out-quart hover:text-brand-800 active:text-brand-900 md:self-auto"
        >
          {copy.all}
          <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}

// The whole cell is one link to /services (the name is the link text, stretched over the cell),
// so the hover zoom on the photo is honest feedback for something clickable.
function ServiceCell({ service }: { service: PreviewService }) {
  const { photo } = service;
  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-xl border border-border bg-surface transition-colors duration-150 ease-out-quart hover:border-brand-200">
      <div className="relative h-52 overflow-hidden bg-surface-sunken md:h-56 lg:h-60">
        <Image
          src={photo.src}
          alt={photo.alt}
          fill
          sizes="(min-width: 1280px) 680px, (min-width: 1024px) 56vw, (min-width: 768px) 50vw, 100vw"
          style={{ objectPosition: photo.focus }}
          className="object-cover transition-transform duration-500 ease-out-quart motion-safe:group-hover:scale-[1.03]"
        />
      </div>
      <div className="flex flex-1 flex-col p-5 lg:p-6">
        <h3 className="text-xl font-semibold text-ink">
          <Link
            href="/services"
            className="rounded-md after:absolute after:inset-0 after:rounded-xl focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-focus"
          >
            {service.name}
          </Link>
        </h3>
        <p className="mt-2 text-base text-ink-muted">{service.description}</p>
        <div className="mt-auto flex items-end justify-between gap-4 pt-6">
          <p className="flex items-center gap-1.5 text-sm text-ink-muted">
            <Clock className="size-4 shrink-0 text-ink-faint" aria-hidden="true" />
            {service.duration}
          </p>
          <p className="flex flex-col items-end">
            <span className="text-sm text-ink-muted">{copy.from}</span>
            <span className="font-display text-2xl font-semibold text-ink tabular-nums">
              {formatRupiah(service.startingPrice)}
            </span>
          </p>
        </div>
      </div>
    </article>
  );
}
