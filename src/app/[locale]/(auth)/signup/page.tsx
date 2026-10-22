import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { AuthCard, AuthFormSkeleton } from "@/components/auth/auth-card";
import { nextFrom, redirectIfSignedIn } from "@/components/auth/redirect-signed-in";
import { SignupForm } from "@/components/auth/signup-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("SignupPage");
  return { title: t("metaTitle") };
}

type SearchParams = PageProps<"/[locale]/signup">["searchParams"];

// /signup and /en/signup (T5): a new customer account. Built like the sign-in page: the heading is
// prerendered, the form streams in once the page knows ?next= and that the visitor is not signed in.
export default function SignupPage({ searchParams }: PageProps<"/[locale]/signup">) {
  const t = useTranslations("SignupPage");
  return (
    <AuthCard title={t("title")} lead={t("lead")}>
      <Suspense fallback={<AuthFormSkeleton fields={3} />}>
        <SignupEntry searchParams={searchParams} />
      </Suspense>
    </AuthCard>
  );
}

async function SignupEntry({ searchParams }: { searchParams: SearchParams }) {
  const next = nextFrom((await searchParams).next);
  await redirectIfSignedIn(next);
  return <SignupForm next={next} />;
}
