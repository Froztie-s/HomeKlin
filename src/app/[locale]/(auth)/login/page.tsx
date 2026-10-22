import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { AuthCard, AuthFormSkeleton } from "@/components/auth/auth-card";
import { LoginForm } from "@/components/auth/login-form";
import { nextFrom, redirectIfSignedIn } from "@/components/auth/redirect-signed-in";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("LoginPage");
  return { title: t("metaTitle") };
}

type SearchParams = PageProps<"/[locale]/login">["searchParams"];

// /login and /en/login (T5). The heading is prerendered; the form needs the address's ?next= and
// whether the visitor is already signed in, both known only at request time, so it streams in behind
// <Suspense> (Cache Components). The search params are read inside the boundary, not at the top, so
// the rest of the page stays in the static shell.
// Source: node_modules/next/dist/docs/01-app/01-getting-started/08-caching.md ("Maximizing the static
// shell") and node_modules/next/dist/docs/01-app/02-guides/authentication-with-cache-components.md
export default function LoginPage({ searchParams }: PageProps<"/[locale]/login">) {
  const t = useTranslations("LoginPage");
  return (
    <AuthCard title={t("title")} lead={t("lead")}>
      <Suspense fallback={<AuthFormSkeleton fields={2} />}>
        <LoginEntry searchParams={searchParams} />
      </Suspense>
    </AuthCard>
  );
}

async function LoginEntry({ searchParams }: { searchParams: SearchParams }) {
  const next = nextFrom((await searchParams).next);
  await redirectIfSignedIn(next);
  return <LoginForm next={next} />;
}
