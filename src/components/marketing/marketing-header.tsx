import Link from "next/link";
import { Wordmark } from "@/components/brand/wordmark";
import { ButtonLink } from "@/components/ui/button-link";
import { landingContainer } from "./landing-layout";

const copy = {
  nav: "Navigasi situs",
  cta: "Pesan sekarang",
  promise: "Bayar di muka. Harga tampil penuh, tanpa biaya tersembunyi.",
  help: "Bantuan",
  links: [
    { href: "#layanan", label: "Layanan" },
    { href: "#cara-kerja", label: "Cara kerja" },
    { href: "#keamanan", label: "Keamanan" },
    { href: "#pertanyaan", label: "Pertanyaan" },
  ],
};

const linkClass =
  "inline-flex min-h-touch items-center rounded-full px-4 text-sm font-medium text-ink-muted transition-colors duration-150 ease-out-quart hover:bg-sunken hover:text-ink active:bg-lime-wash";

// The landing page's own header (markdown/design.md, Layout): from 1024 px a 44 px dark utility bar
// with a plain price promise and the help link, which scrolls away, then one 64 px row that stays:
// wordmark, the in-page links in the middle, and the one primary action, "Pesan sekarang".
// Phones get the row only (wordmark and the button); the footer carries the help link.
export function MarketingHeader() {
  return (
    <header className="sticky top-0 z-(--z-sticky) bg-canvas lg:-top-utility-bar">
      <div className="on-dark-focus hidden h-utility-bar bg-band text-on-band lg:block">
        <div className={`${landingContainer} flex h-full items-center justify-between gap-6 text-xs`}>
          <p className="text-on-band-muted">{copy.promise}</p>
          <Link
            href="/support"
            className="-mr-3 inline-flex min-h-touch items-center rounded-full px-3 font-semibold text-on-band transition-colors duration-150 ease-out-quart hover:text-lime"
          >
            {copy.help}
          </Link>
        </div>
      </div>
      <div className="border-b border-border">
        <div className={`${landingContainer} flex h-16 items-center justify-between gap-4`}>
          <Link href="/" className="inline-flex min-h-touch items-center rounded-full">
            <Wordmark palette="forest" />
          </Link>
          <nav aria-label={copy.nav} className="hidden lg:block">
            <ul className="flex items-center gap-1">
              {copy.links.map((link) => (
                <li key={link.href}>
                  <a href={link.href} className={linkClass}>
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          <ButtonLink href="/home" variant="forest">
            {copy.cta}
          </ButtonLink>
        </div>
      </div>
    </header>
  );
}
