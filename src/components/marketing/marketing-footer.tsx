import Link from "next/link";
import { Wordmark } from "@/components/brand/wordmark";
import { appName } from "@/lib/app-name";
import { landingContainer } from "./landing-layout";

const copy = {
  tagline: "Jasa kebersihan rumah yang bisa Anda tonton langsung.",
  columns: [
    {
      title: "Aplikasi",
      links: [
        { href: "/home", label: "Beranda" },
        { href: "/services", label: "Layanan" },
        { href: "/orders", label: "Pesanan" },
      ],
    },
    {
      title: "Bantuan",
      links: [
        { href: "/support", label: "Pusat bantuan" },
        { href: "/account", label: "Akun" },
      ],
    },
  ],
  preview: "Situs pratinjau proyek universitas. Harga dan data di situs ini adalah contoh.",
  copyright: "© 2026 HomeKlin",
};

// The footer (markdown/design.md, Layout): the dark band, wordmark and tagline on the left, link
// columns with lime headings on the right (existing pages only), the line saying this is a preview
// with sample data, and the oversized ghost wordmark cropped by the bottom edge (decoration only).
export function MarketingFooter() {
  return (
    <footer className="on-dark-focus overflow-hidden bg-band text-on-band">
      <div className={`${landingContainer} pt-16 lg:pt-20`}>
        <div className="grid gap-10 md:grid-cols-12">
          <div className="md:col-span-6 lg:col-span-7">
            <Wordmark palette="forest" onDark />
            <p className="mt-4 max-w-sm text-body text-on-band-muted">{copy.tagline}</p>
          </div>
          <div className="grid grid-cols-2 gap-8 md:col-span-6 lg:col-span-5">
            {copy.columns.map((column) => (
              <nav key={column.title} aria-labelledby={`footer-${column.title}`}>
                <h2
                  id={`footer-${column.title}`}
                  className="text-eyebrow font-semibold text-lime uppercase"
                >
                  {column.title}
                </h2>
                <ul className="mt-3">
                  {column.links.map((link) => (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        className="inline-flex min-h-touch items-center rounded-full text-sm text-on-band-muted transition-colors duration-150 ease-out-quart hover:text-on-band"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>
        </div>
        <div className="mt-12 flex flex-col gap-2 border-t border-on-band/10 pt-6 text-sm text-on-band-muted md:flex-row md:justify-between md:gap-8">
          <p>{copy.preview}</p>
          <p className="shrink-0">{copy.copyright}</p>
        </div>
        <p
          aria-hidden="true"
          className="mt-10 -mb-[0.2em] text-center font-display text-ghost font-bold whitespace-nowrap text-wordmark-ghost select-none"
        >
          {appName()}
        </p>
      </div>
    </footer>
  );
}
