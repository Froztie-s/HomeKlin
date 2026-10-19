import { ArrowUpRight, Clock } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { previewServices, type PreviewService } from "@/components/customer/home-preview-data";
import { formatRupiah } from "@/lib/format";
import { Eyebrow } from "./eyebrow";
import { anchorOffset, landingContainer, landingSection } from "./landing-layout";

const copy = {
  eyebrow: "Daftar harga",
  titleStart: "Layanan dan harga,",
  titleAccent: "tanpa kejutan",
  from: "mulai dari",
  note: "Harga contoh selama masa pratinjau. Harga resmi diatur HomeKlin dan selalu tampil penuh sebelum Anda membayar.",
  all: "Lihat semua layanan",
};

// Services (markdown/design.md, Layout): the heading with the link to the full price list beside it,
// then four soft-bento cards in a row from 1280 px (two from 640 px, one on phones; at 1024 px four
// cards would be too narrow for the duration and the price on one line). Each card is one
// link to /services; on hover or keyboard focus it inverts to forest green, which is the feedback for
// "this is clickable" (the service filter lives on /services, where SPEC puts it).
export function ServicesGrid() {
  return (
    <section
      id="layanan"
      aria-labelledby="layanan-title"
      className={`${landingContainer} ${landingSection} ${anchorOffset}`}
    >
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div>
          <Eyebrow>{copy.eyebrow}</Eyebrow>
          <h2
            id="layanan-title"
            className="mt-4 font-display text-headline-sm font-semibold text-ink md:text-headline-md xl:text-headline"
          >
            {copy.titleStart} <em className="serif-accent">{copy.titleAccent}</em>
          </h2>
        </div>
        <Link
          href="/services"
          className="inline-flex min-h-touch shrink-0 items-center gap-2 self-start rounded-full border-[1.5px] border-outline px-5 text-sm font-semibold text-ink transition-[background-color,color,transform] duration-150 ease-out-quart hover:bg-primary hover:text-on-primary active:scale-[0.98] md:self-auto"
        >
          {copy.all}
          <ArrowUpRight className="size-4" aria-hidden="true" />
        </Link>
      </div>

      <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:mt-14 xl:grid-cols-4">
        {previewServices.map((service, index) => (
          <li key={service.id}>
            <ServiceCard service={service} index={index} />
          </li>
        ))}
      </ul>

      <p className="mt-8 max-w-prose text-sm text-ink-muted">{copy.note}</p>
    </section>
  );
}

// White card, photo inset 10 px with its own radius (a card within a card), an italic index numeral
// and an arrow circle, then the facts in the same place on every card. The name's link is stretched
// over the whole card. Text colours flip with the card so every pair keeps AA (design.md table).
function ServiceCard({ service, index }: { service: PreviewService; index: number }) {
  const { photo } = service;
  return (
    <article className="group relative flex h-full flex-col rounded-lg bg-card p-2.5 text-ink transition-[background-color,color,box-shadow] duration-200 ease-out-quart focus-within:bg-primary focus-within:text-on-primary hover:bg-primary hover:text-on-primary hover:shadow-card-hover">
      <div className="relative aspect-4/3 overflow-hidden rounded-md bg-sunken">
        <Image
          src={photo.src}
          alt={photo.alt}
          fill
          sizes="(min-width: 1280px) 270px, (min-width: 640px) 46vw, 100vw"
          style={{ objectPosition: photo.focus }}
          className="object-cover transition-transform duration-500 ease-out-quart motion-safe:group-hover:scale-[1.03]"
        />
      </div>
      <div className="flex flex-1 flex-col px-3 pt-4 pb-3">
        <div className="flex items-center justify-between">
          <span
            aria-hidden="true"
            className="serif-accent text-2xl text-ink-muted transition-colors duration-200 group-focus-within:text-lime group-hover:text-lime"
          >
            {String(index + 1).padStart(2, "0")}
          </span>
          <span
            aria-hidden="true"
            className="flex size-11 items-center justify-center rounded-full border-[1.5px] border-outline transition-colors duration-200 group-focus-within:border-lime group-focus-within:bg-lime group-focus-within:text-on-lime group-hover:border-lime group-hover:bg-lime group-hover:text-on-lime"
          >
            <ArrowUpRight className="size-4.5" />
          </span>
        </div>
        <h3 className="mt-4 font-display text-title font-semibold">
          <Link
            href="/services"
            className="rounded-sm after:absolute after:inset-0 after:rounded-lg focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:-outline-offset-4 focus-visible:after:outline-lime"
          >
            {service.name}
          </Link>
        </h3>
        <p className="mt-2 text-body text-ink-muted transition-colors duration-200 group-focus-within:text-on-band-muted group-hover:text-on-band-muted">
          {service.description}
        </p>
        <div className="mt-auto flex items-end justify-between gap-3 pt-6">
          <p className="flex items-center gap-1.5 text-sm whitespace-nowrap text-ink-muted transition-colors duration-200 group-focus-within:text-on-band-muted group-hover:text-on-band-muted">
            <Clock className="size-4 shrink-0" aria-hidden="true" />
            {service.duration}
          </p>
          <p className="flex flex-col items-end">
            <span className="text-xs text-ink-muted transition-colors duration-200 group-focus-within:text-on-band-muted group-hover:text-on-band-muted">
              {copy.from}
            </span>
            <span className="font-display text-price font-semibold whitespace-nowrap tabular-nums">
              {formatRupiah(service.startingPrice)}
            </span>
          </p>
        </div>
      </div>
    </article>
  );
}
