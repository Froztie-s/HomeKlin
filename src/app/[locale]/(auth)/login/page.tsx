import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { AuthCard, AuthFormSkeleton } from "@/components/auth/auth-card";
import { LoginCodeForm } from "@/components/auth/login-code-form";
import { LoginForm } from "@/components/auth/login-form";
import { nextFrom, redirectIfSignedIn } from "@/components/auth/redirect-signed-in";
import { switchLinkClass } from "@/components/auth/switch-link";
import { Link } from "@/i18n/navigation";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("LoginPage");
  return { title: t("metaTitle") };
}

type SearchParams = PageProps<"/[locale]/login">["searchParams"];

// /login and /en/login (T5, T9b). Customers sign in by emailed code (no password; their account was
// made by ordering); staff, cleaners and the demo accounts use "Masuk dengan kata sandi", which opens
// the password form at /login?cara=sandi. Both keep ?next=. The heading is prerendered; the form needs
// the address and whether the visitor is already signed in, both known only at request time, so it
// streams in behind <Suspense> (Cache Components). The search params are read inside the boundary.
// Source: node_modules/next/dist/docs/01-app/01-getting-started/08-caching.md ("Maximizing the static
// shell") and node_modules/next/dist/docs/01-app/02-guides/authentication-with-cache-components.md
export default function LoginPage({ searchParams }: PageProps<"/[locale]/login">) {
  const t = useTranslations("LoginPage");
  return (
    <AuthCard title={t("title")} lead={t("lead")}>
      <Suspense fallback={<AuthFormSkeleton fields={1} />}>
        <LoginEntry searchParams={searchParams} />
      </Suspense>
    </AuthCard>
  );
}

const switchRow = "mt-6 flex flex-wrap items-center justify-center gap-x-1 text-sm text-ink-muted";

async function LoginEntry({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const next = nextFrom(params.next);
  await redirectIfSignedIn(next);
  const t = await getTranslations("AuthLogin");
  const withPassword = params.cara === "sandi";
  const keep = next ? { next } : {};

  return (
    <>
      {withPassword ? (
        <>
          <div className="mb-6 rounded-md bg-surface-sunken px-4 py-3">
            <h2 className="text-base font-semibold text-ink">{t("passwordTitle")}</h2>
            <p className="mt-0.5 text-sm text-ink-muted">{t("passwordNote")}</p>
          </div>
          <LoginForm next={next} />
          <p className={switchRow}>
            <Link href={{ pathname: "/login", query: keep }} className={switchLinkClass}>
              {t("withCode")}
            </Link>
          </p>
        </>
      ) : (
        <>
          <LoginCodeForm next={next} />
          <p className={switchRow}>
            <Link href={{ pathname: "/login", query: { ...keep, cara: "sandi" } }} className={switchLinkClass}>
              {t("withPassword")}
            </Link>
          </p>
        </>
      )}
      <p className={`${switchRow} border-t border-border pt-6`}>
        {t("firstTimePrompt")}
        <Link href="/services" className={switchLinkClass}>
          {t("firstTimeLink")}
        </Link>
      </p>
    </>
  );
}
