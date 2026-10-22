"use client";

import { Languages } from "lucide-react";
import { useLinkStatus } from "next/link";
import { useLocale, useTranslations, type Locale } from "next-intl";
import type { ReactNode } from "react";
import { Link, usePathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

type LanguageSwitchProps = {
  /**
   * evergreen: the T3b app shells, until they migrate. forest: the redesign (the landing page), with
   * `onDark` for its dark utility bar.
   */
  palette?: "evergreen" | "forest";
  onDark?: boolean;
  /** Only a link to the other language: the landing header on phones, where the toggle does not fit. */
  compact?: boolean;
};

// The segmented toggle ID | EN (markdown/design.md, Forms): a track with a 1 px control edge, the
// current language a filled pill. The current language is plain text marked aria-current="true", not a
// link: choosing it again would only reload the page, and leaving it out of the tab order leaves one
// stop. The other language is a real link to the same page (next-intl's Link with `locale`), so the
// switch works without JavaScript: next-intl writes the NEXT_LOCALE cookie on click, and without
// JavaScript the proxy writes it when the linked page loads. Only the path is kept: no page uses query
// strings yet, and reading them (useSearchParams) would move this component's rendering to the browser.
// Every segment is a 44 px target; its pill is drawn inside a transparent border (bg-clip-padding),
// which gives the 4 px gap to the track without shrinking the target.
const tones = {
  evergreen: {
    track: "h-11 bg-surface ring-1 ring-border-control ring-inset",
    segment: "h-11 border-4",
    current: "bg-brand-600 text-on-brand",
    link: "text-ink hover:bg-surface-sunken active:bg-brand-50",
  },
  forest: {
    track: "h-11 bg-card ring-1 ring-border-control ring-inset",
    segment: "h-11 border-4",
    current: "bg-primary text-on-primary",
    link: "text-ink hover:bg-sunken active:bg-lime-wash",
  },
  // In the 44 px utility bar the track is drawn 36 px tall and the targets overflow it by 4 px.
  forestOnDark: {
    track: "h-9 ring-1 ring-on-band-muted/60 ring-inset",
    segment: "-my-1 h-11 border-x-3 border-y-7 text-xs",
    current: "bg-on-band text-band",
    link: "text-on-band-muted hover:bg-band-raised hover:text-on-band",
  },
};

const segmentBase =
  "inline-flex min-w-11 items-center justify-center rounded-full border-transparent bg-clip-padding px-2.5 font-semibold";

const linkMotion = "transition-[background-color,color,transform] duration-150 ease-out-quart active:scale-[0.97]";

// Show or hide it per breakpoint from a wrapping element, so no display utility competes with its own.
export function LanguageSwitch({
  palette = "evergreen",
  onDark = false,
  compact = false,
}: LanguageSwitchProps) {
  const t = useTranslations("LanguageSwitch");
  const current = useLocale();
  const pathname = usePathname();
  const tone = tones[palette === "forest" && onDark ? "forestOnDark" : palette];
  const others = routing.locales.filter((locale) => locale !== current);

  if (compact) {
    return (
      <div role="group" aria-label={t("label")} className="inline-flex">
        {others.map((locale) => (
          <Link
            key={locale}
            href={pathname}
            locale={locale}
            hrefLang={locale}
            lang={locale}
            rel="alternate"
            className={`inline-flex size-11 items-center justify-center gap-1 rounded-full text-sm font-semibold ${tone.link} ${linkMotion}`}
          >
            <Languages className="size-4 shrink-0" aria-hidden="true" />
            <Label locale={locale} name={t(locale)} />
          </Link>
        ))}
      </div>
    );
  }

  return (
    <div
      role="group"
      aria-label={t("label")}
      className={`inline-flex items-center rounded-full text-sm ${tone.track}`}
    >
      {routing.locales.map((locale) =>
        locale === current ? (
          <span
            key={locale}
            aria-current="true"
            lang={locale}
            className={`${segmentBase} ${tone.segment} ${tone.current}`}
          >
            {locale.toUpperCase()}
            <span className="sr-only"> {t(locale)}</span>
          </span>
        ) : (
          <Link
            key={locale}
            href={pathname}
            locale={locale}
            hrefLang={locale}
            lang={locale}
            rel="alternate"
            className={`${segmentBase} ${tone.segment} ${tone.link} ${linkMotion}`}
          >
            <Label locale={locale} name={t(locale)} />
          </Link>
        ),
      )}
    </div>
  );
}

// The visible code ("EN") first, then the language's own name for screen readers, so the accessible
// name starts with what is on screen (WCAG 2.5.3): "EN English", "ID Bahasa Indonesia".
// While the other language loads (the link is not prefetched), the code dims.
function Label({ locale, name }: { locale: Locale; name: string }): ReactNode {
  const { pending } = useLinkStatus();
  return (
    <>
      <span className={`transition-opacity duration-150 ${pending ? "opacity-50" : ""}`}>
        {locale.toUpperCase()}
      </span>
      <span className="sr-only"> {name}</span>
    </>
  );
}
