import Link from "next/link";
import { Wordmark } from "@/components/brand/wordmark";

const copy = {
  tagline: "Jasa kebersihan rumah yang bisa Anda tonton langsung.",
  nav: "Tautan situs",
  links: [
    { href: "/services", label: "Layanan" },
    { href: "/orders", label: "Pesanan" },
    { href: "/support", label: "Bantuan" },
    { href: "/account", label: "Akun" },
  ],
  preview: "Situs pratinjau proyek universitas. Harga dan data di situs ini adalah contoh.",
  copyright: "© 2026 HomeKlin",
};

// Links to existing pages only, and a plain line saying this is a preview with sample data.
export function MarketingFooter() {
  return (
    <footer className="border-t border-border bg-panel">
      <div className="mx-auto w-full max-w-page px-safe py-12 lg:px-gutter-wide lg:py-16">
        <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between md:gap-10">
          <div>
            <Wordmark />
            <p className="mt-3 max-w-prose text-base text-ink-muted">{copy.tagline}</p>
          </div>
          <nav aria-label={copy.nav}>
            <ul className="-mx-3 flex flex-wrap gap-x-1 gap-y-1">
              {copy.links.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="inline-flex min-h-touch items-center rounded-full px-3 text-sm font-medium text-ink-muted transition-colors duration-150 ease-out-quart hover:bg-surface-sunken hover:text-ink active:bg-brand-50"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
        <div className="mt-10 flex flex-col gap-2 border-t border-border pt-6 text-sm text-ink-faint md:flex-row md:justify-between md:gap-8">
          <p>{copy.preview}</p>
          <p className="shrink-0">{copy.copyright}</p>
        </div>
      </div>
    </footer>
  );
}
