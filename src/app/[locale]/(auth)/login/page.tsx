import { Info, KeyRound, Mail, type LucideIcon } from "lucide-react";
import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { AuthCard, AuthFormSkeleton, AuthLead } from "@/components/auth/auth-card";
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

// /login and /en/login (T5, T9b; restyled after the SignIn mocks). Two ways in, a switch at the top of
// the card named by how one signs in (2026-11-20, UX audit item 22 and the user): "Kode email" (a
// 6-digit code to an existing account) and "Kata sandi" (/login?cara=sandi; anyone with a password,
// customers too). Both keep ?next=. The card ends with "Belum punya akun? Daftar" (/signup): ordering
// needs an account since 2026-11-20. An email
// order link that no longer works (/o/<token>) sends the customer here with ?tautan=tidak-berlaku,
// which adds a notice above the form. The card and its h1 are prerendered; the lead, the notice and
// the form depend on the address and on whether the visitor is already signed in, both known only at
// request time, so they stream in behind <Suspense> (Cache Components). The search params are read
// inside the boundary.
// Source: node_modules/next/dist/docs/01-app/01-getting-started/08-caching.md ("Maximizing the static
// shell") and node_modules/next/dist/docs/01-app/02-guides/authentication-with-cache-components.md
export default function LoginPage({ searchParams }: PageProps<"/[locale]/login">) {
  const t = useTranslations("LoginPage");
  return (
    <AuthCard
      title={t("title")}
      below={
        <p className="flex flex-wrap items-center justify-center gap-x-1 text-center text-sm text-ink-muted">
          {t("helpPrompt")}
          <Link href="/support" className={switchLinkClass}>
            {t("helpLink")}
          </Link>
        </p>
      }
    >
      <Suspense fallback={<AuthFormSkeleton fields={1} />}>
        <LoginEntry searchParams={searchParams} />
      </Suspense>
    </AuthCard>
  );
}

const switchRow = "flex flex-wrap items-center justify-center gap-x-1 text-sm text-ink-muted";

async function LoginEntry({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const next = nextFrom(params.next);
  await redirectIfSignedIn(next);
  const t = await getTranslations("AuthLogin");
  const tPage = await getTranslations("LoginPage");
  const withPassword = params.cara === "sandi";
  const linkExpired = params.tautan === "tidak-berlaku";
  const keep: Record<string, string> = next ? { next } : {};

  const modes: { key: "code" | "password"; Icon: LucideIcon; href: { pathname: "/login"; query: Record<string, string> } }[] = [
    { key: "code", Icon: Mail, href: { pathname: "/login", query: keep } },
    { key: "password", Icon: KeyRound, href: { pathname: "/login", query: { ...keep, cara: "sandi" } } },
  ];

  return (
    <>
      <nav aria-label={t("modeLabel")} className="mt-4 grid grid-cols-2 gap-1 rounded-md bg-sunken p-1">
        {modes.map(({ key, Icon, href }) => {
          const active = (key === "password") === withPassword;
          return (
            <Link
              key={key}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-touch items-center gap-2.5 rounded-sm px-3 py-2 text-left transition-colors duration-150 ease-out-quart ${
                active ? "bg-card text-ink shadow-card" : "text-ink-muted hover:bg-card/60 hover:text-ink"
              }`}
            >
              <Icon className={`size-4.5 shrink-0 ${active ? "text-primary" : ""}`} aria-hidden="true" />
              <span className="flex min-w-0 flex-col leading-tight">
                <span className="text-sm font-semibold">{t(`modes.${key}.title`)}</span>
                <span className="text-xs">{t(`modes.${key}.hint`)}</span>
              </span>
            </Link>
          );
        })}
      </nav>
      <div className="mt-3">
        <AuthLead>{withPassword ? tPage("leadPassword") : tPage("leadCode")}</AuthLead>
      </div>
      <div role="status" className="mt-5 empty:hidden">
        {linkExpired ? (
          <p className="flex items-start gap-2.5 rounded-md bg-info-surface px-4 py-3 text-sm font-medium text-info">
            <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>{tPage("linkExpired")}</span>
          </p>
        ) : null}
      </div>
      <div className="mt-6">
        {withPassword ? (
          <LoginForm
            next={next}
            belowFields={
              // There is no password reset: staff sign in with an emailed code instead.
              <p className="-mb-2 flex justify-end text-right text-sm">
                <Link href={{ pathname: "/login", query: keep }} className={switchLinkClass}>
                  {t("forgotPassword")}
                </Link>
              </p>
            }
          />
        ) : (
          <LoginCodeForm next={next} />
        )}
      </div>
      <p className={`${switchRow} mt-5 border-t border-border pt-4`}>
        {t("signupPrompt")}
        <Link href={{ pathname: "/signup", query: keep }} className={switchLinkClass}>
          {t("signupLink")}
        </Link>
      </p>
    </>
  );
}
