import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Wordmark } from "@/components/brand/wordmark";
import { SkipLink } from "@/components/shell/skip-link";
import { ButtonLink } from "@/components/ui/button-link";
import { Link } from "@/i18n/navigation";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("NotFound");
  return { title: t("title") };
}

// The 404 page inside a language (/agencies, /en/agencies; see [...rest]/page.tsx), in the app look:
// the wordmark, what happened in one sentence, and one way back. It sits outside the route groups, so
// it brings its own bar.
export default function NotFound() {
  const t = useTranslations("NotFound");
  return (
    <>
      <SkipLink />
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex h-top-bar max-w-content items-center px-safe md:h-16 md:px-gutter-wide">
          <Link href="/" className="inline-flex min-h-touch items-center rounded-full">
            <Wordmark />
          </Link>
        </div>
      </header>
      <main id="konten" tabIndex={-1} className="flex flex-1 flex-col outline-none">
        <div className="mx-auto flex w-full max-w-content flex-col items-start gap-4 px-safe py-16 md:px-gutter-wide md:py-24">
          <h1 className="font-display text-2xl font-semibold text-ink md:text-3xl md:tracking-display">
            {t("title")}
          </h1>
          <p className="max-w-prose text-base text-ink-muted">{t("body")}</p>
          <ButtonLink href="/" className="mt-2">
            {t("home")}
          </ButtonLink>
        </div>
      </main>
    </>
  );
}
