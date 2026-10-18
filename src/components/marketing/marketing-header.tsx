import Link from "next/link";
import { Wordmark } from "@/components/brand/wordmark";
import { ButtonLink } from "@/components/ui/button-link";

const copy = {
  nav: "Navigasi situs",
  cta: "Pesan sekarang",
  links: [
    { href: "#layanan", label: "Layanan" },
    { href: "#cara-kerja", label: "Cara kerja" },
    { href: "#keamanan", label: "Keamanan" },
    { href: "/support", label: "Bantuan" },
  ],
};

const linkClass =
  "inline-flex min-h-touch items-center rounded-full px-4 text-sm font-medium text-ink-muted transition-colors duration-150 ease-out-quart hover:bg-surface-sunken hover:text-ink active:bg-brand-50";

// The landing page's own header: one line, 64 px, at every width. In-page links from 1024 px;
// the one primary action, "Pesan sekarang", on every width.
export function MarketingHeader() {
  return (
    <header className="sticky top-0 z-(--z-sticky) border-b border-border bg-canvas">
      <div className="mx-auto flex h-16 max-w-page items-center justify-between gap-4 px-safe lg:px-gutter-wide">
        <Link href="/" className="inline-flex min-h-touch items-center rounded-full">
          <Wordmark />
        </Link>
        <div className="flex items-center gap-2">
          <nav aria-label={copy.nav} className="hidden lg:block">
            <ul className="flex items-center gap-1">
              {copy.links.map((link) => (
                <li key={link.href}>
                  {link.href.startsWith("#") ? (
                    <a href={link.href} className={linkClass}>
                      {link.label}
                    </a>
                  ) : (
                    <Link href={link.href} className={linkClass}>
                      {link.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </nav>
          <ButtonLink href="/home" className="lg:ml-3">
            {copy.cta}
          </ButtonLink>
        </div>
      </div>
    </header>
  );
}
