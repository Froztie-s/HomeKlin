import { useTranslations } from "next-intl";
import { Wordmark } from "@/components/brand/wordmark";
import { Link } from "@/i18n/navigation";
import { appName } from "@/lib/app-name";
import { landingContainer } from "./landing-layout";

// The link columns (existing pages only); headings and labels are MarketingFooter.columns / .links.
const columns = [
  {
    key: "app",
    links: [
      { href: "/home", key: "home" },
      { href: "/services", key: "services" },
      { href: "/orders", key: "orders" },
    ],
  },
  {
    key: "help",
    links: [
      { href: "/support", key: "helpCenter" },
      { href: "/account", key: "account" },
    ],
  },
] as const;

// The footer (markdown/design.md, Layout): the dark band, wordmark and tagline on the left, link
// columns with lime headings on the right, the line saying this is a preview with sample data, and
// the oversized ghost wordmark cropped by the bottom edge (decoration only).
export function MarketingFooter() {
  const t = useTranslations("MarketingFooter");
  return (
    <footer className="on-dark-focus overflow-hidden bg-band text-on-band">
      <div className={`${landingContainer} pt-16 lg:pt-20`}>
        <div className="grid gap-10 md:grid-cols-12">
          <div className="md:col-span-6 lg:col-span-7">
            <Wordmark palette="forest" onDark />
            <p className="mt-4 max-w-sm text-body text-on-band-muted">{t("tagline")}</p>
          </div>
          <div className="grid grid-cols-2 gap-8 md:col-span-6 lg:col-span-5">
            {columns.map((column) => (
              <nav key={column.key} aria-labelledby={`footer-${column.key}`}>
                <h2 id={`footer-${column.key}`} className="text-eyebrow font-semibold text-lime uppercase">
                  {t(`columns.${column.key}`)}
                </h2>
                <ul className="mt-3">
                  {column.links.map((link) => (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        className="inline-flex min-h-touch items-center rounded-full text-sm text-on-band-muted transition-colors duration-150 ease-out-quart hover:text-on-band"
                      >
                        {t(`links.${link.key}`)}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>
        </div>
        <div className="mt-12 flex flex-col gap-2 border-t border-on-band/10 pt-6 text-sm text-on-band-muted md:flex-row md:justify-between md:gap-8">
          <p>{t("preview")}</p>
          <p className="shrink-0">{t("copyright")}</p>
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
