import { getTranslations } from "next-intl/server";
import { connection } from "next/server";
import { getCurrentUser } from "@/lib/auth/dal";
import { SignOutButton } from "./sign-out-button";
import { UserAvatar } from "./user-avatar";

type AccountSummaryProps = {
  /** page: the account page's card. sidebar: the back office's sidebar and narrow-screen menu. */
  variant?: "page" | "sidebar";
};

// Who is signed in, and the way out (T5): the account area of every shell. Reads the session, so it
// sits inside <Suspense>; on a protected page it sits inside <RoleGate> as well. connection() first,
// because Supabase checks the token's expiry against the clock, which belongs to request time.
export async function AccountSummary({ variant = "page" }: AccountSummaryProps) {
  await connection();
  const [user, t] = await Promise.all([getCurrentUser(), getTranslations("AccountSummary")]);
  if (!user) return null;
  const name = user.fullName.trim() || t("noName");

  if (variant === "sidebar") {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <UserAvatar name={user.fullName} size="md" />
          <p className="flex min-w-0 flex-col">
            <span className="text-xs text-ink-muted">{t("signedInAs")}</span>
            <span className="truncate text-sm font-semibold text-ink">{name}</span>
          </p>
        </div>
        <SignOutButton />
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-5 shadow-card md:p-6">
      <div className="flex items-center gap-4">
        <UserAvatar name={user.fullName} size="lg" />
        <p className="flex min-w-0 flex-col gap-0.5">
          <span className="text-sm text-ink-muted">{t("signedInAs")}</span>
          <span className="font-display text-xl font-semibold break-words text-ink">{name}</span>
        </p>
      </div>
      <div className="mt-5 border-t border-border pt-5">
        <SignOutButton className="w-full sm:w-fit" />
      </div>
    </div>
  );
}
