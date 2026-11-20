import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { AuthCard, AuthFormSkeleton, AuthLead } from "@/components/auth/auth-card";
import { nextFrom, redirectIfSignedIn } from "@/components/auth/redirect-signed-in";
import { SignupForm } from "@/components/auth/signup-form";
import { switchLinkClass } from "@/components/auth/switch-link";
import { Link } from "@/i18n/navigation";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("SignupPage");
  return { title: t("metaTitle") };
}

type SearchParams = PageProps<"/[locale]/signup">["searchParams"];

// /signup and /en/signup: a new customer account. Back on 2026-11-20 (the user): ordering needs an
// account, so a visitor signs up here (or signs in) before step 2; until then /signup led to the order
// page, where a guest's emailed code made the account. Built like the sign-in page: the card and its
// h1 are prerendered, the form streams in once the page knows ?next= and that the visitor is not
// signed in. A signed-in visitor is sent on (redirectIfSignedIn).
export default function SignupPage({ searchParams }: PageProps<"/[locale]/signup">) {
  const t = useTranslations("SignupPage");
  return (
    <AuthCard title={t("title")}>
      <Suspense fallback={<AuthFormSkeleton fields={3} />}>
        <SignupEntry searchParams={searchParams} />
      </Suspense>
    </AuthCard>
  );
}

async function SignupEntry({ searchParams }: { searchParams: SearchParams }) {
  const next = nextFrom((await searchParams).next);
  await redirectIfSignedIn(next);
  const [t, tAuth] = await Promise.all([getTranslations("SignupPage"), getTranslations("Auth")]);
  return (
    <>
      <AuthLead>{t("lead")}</AuthLead>
      <div className="mt-6">
        <SignupForm next={next} />
      </div>
      <p className="mt-5 flex flex-wrap items-center justify-center gap-x-1 border-t border-border pt-4 text-sm text-ink-muted">
        {tAuth("signup.switchPrompt")}
        <Link href={{ pathname: "/login", query: next ? { next } : {} }} className={switchLinkClass}>
          {tAuth("signup.switchLink")}
        </Link>
      </p>
    </>
  );
}
