import { useTranslations } from "next-intl";
import { Wordmark } from "@/components/brand/wordmark";
import { LanguageSwitch } from "@/components/shell/language-switch";
import { ButtonLink } from "@/components/ui/button-link";
import { Link } from "@/i18n/navigation";
import { landingContainer } from "./landing-layout";

// In-page sections: plain anchors, the same in both languages.
const sectionLinks = [
  { href: "#layanan", key: "services" },
  { href: "#cara-kerja", key: "howItWorks" },
  { href: "#keamanan", key: "safety" },
  { href: "#pertanyaan", key: "questions" },
] as const;

const linkClass =
  "inline-flex min-h-touch items-center rounded-full px-4 text-sm font-medium text-ink-muted transition-colors duration-150 ease-out-quart hover:bg-sunken hover:text-ink active:bg-lime-wash";

// The landing page's own header (markdown/design.md, Layout): from 1024 px a 44 px dark utility bar
// with a plain price promise, the help link and the language switch, which scrolls away, then one
// 64 px row that stays: wordmark, the in-page links in the middle, and the one primary action,
// "Pesan sekarang". Below 1024 px the switch joins that row: the full ID | EN toggle from 640 px,
// and on phones one link to the other language, measured to fit a 360 px row beside the wordmark
// and the button (which drops its arrow circle there). The footer carries the help link on phones.
export function MarketingHeader() {
  const t = useTranslations("MarketingHeader");
  return (
    <header className="sticky top-0 z-(--z-sticky) bg-canvas lg:-top-utility-bar">
      <div className="on-dark-focus hidden h-utility-bar bg-band text-on-band lg:block">
        <div className={`${landingContainer} flex h-full items-center justify-between gap-6 text-xs`}>
          <p className="text-on-band-muted">{t("promise")}</p>
          <div className="flex items-center gap-3">
            <Link
              href="/support"
              className="inline-flex min-h-touch items-center rounded-full px-3 font-semibold text-on-band transition-colors duration-150 ease-out-quart hover:text-lime"
            >
              {t("help")}
            </Link>
            <LanguageSwitch palette="forest" onDark />
          </div>
        </div>
      </div>
      <div className="border-b border-border">
        <div className={`${landingContainer} flex h-16 items-center justify-between gap-1 sm:gap-4`}>
          <Link href="/" className="inline-flex min-h-touch shrink-0 items-center rounded-full">
            <Wordmark palette="forest" />
          </Link>
          <nav aria-label={t("nav")} className="hidden lg:block">
            <ul className="flex items-center gap-1">
              {sectionLinks.map((link) => (
                <li key={link.href}>
                  <a href={link.href} className={linkClass}>
                    {t(`links.${link.key}`)}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="flex sm:hidden">
              <LanguageSwitch palette="forest" compact />
            </div>
            <div className="hidden sm:flex lg:hidden">
              <LanguageSwitch palette="forest" />
            </div>
            <ButtonLink href="/home" variant="forest" hideArrowOnPhones>
              {t("cta")}
            </ButtonLink>
          </div>
        </div>
      </div>
    </header>
  );
}
