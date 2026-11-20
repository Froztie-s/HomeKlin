import type { Metadata } from "next";
import { ChevronDown, CircleCheck, Clock, Plus, ShieldCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { Notice } from "@/components/admin/notice";
import { Initials } from "@/components/agency/agency-ui";
import { panel, primaryButton } from "@/components/agency/styles";
import { GateFallback } from "@/components/auth/gate-fallback";
import { RoleGate } from "@/components/auth/role-gate";
import { StatusPill } from "@/components/back-office/status-pill";
import { ConfirmAction } from "@/components/owner/confirm-action";
import { signInDay } from "@/components/owner/numbers";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Link } from "@/i18n/navigation";
import { removeAdmin, type OwnerFailureKey } from "@/lib/owner/actions";
import { listAdminAccounts, OwnerError, type AdminAccount } from "@/lib/owner/owner";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("OwnerAdminsPage");
  return { title: t("title") };
}

// The admin accounts (T29c; D3, after the mock Owner-Admins), the owner only. The list is read with
// the owner's own session (owner_admins() answers the owner only, with each admin's last sign-in).
// Each admin is a row that opens (a native <details>, so it works without JavaScript) to show the
// account and "Hapus admin", which asks once more in place before removeAdmin takes the admin role away; the action checks the owner
// role on the server before it uses the secret key. Creating an admin has its own page (AdminNew).
export default function OwnerAdminsPage() {
  const t = useTranslations("OwnerAdminsPage");
  return (
    <>
      <PageHeader
        size="compact"
        title={t("title")}
        description={t("description")}
        action={
          <Suspense fallback={<GateFallback variant="action" />}>
            <RoleGate roles={["owner"]}>
              <AddAdminLink label={t("addLink")} />
            </RoleGate>
          </Suspense>
        }
      />
      <Suspense fallback={<GateFallback />}>
        <RoleGate roles={["owner"]}>
          <OwnerAdminsContent />
        </RoleGate>
      </Suspense>
    </>
  );
}

/** The mock's primary pill, the plus in a lime circle. */
function AddAdminLink({ label }: { label: string }) {
  return (
    <Link href="/owner/admins/new" className={`${primaryButton} pr-2.5`}>
      {label}
      <span aria-hidden="true" className="flex size-7 items-center justify-center rounded-full bg-lime text-on-lime">
        <Plus className="size-4" />
      </span>
    </Link>
  );
}

/** The columns of a row from 1024 px, as in the mock: name and email, role, created, last sign-in, status, the open arrow. */
const rowGrid =
  "lg:grid lg:grid-cols-[minmax(0,2.2fr)_minmax(0,0.8fr)_minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1.3fr)_auto] lg:items-center lg:gap-4";

async function OwnerAdminsContent() {
  const [t, locale] = await Promise.all([getTranslations("OwnerAdminsPage"), getLocale()]);

  let admins: AdminAccount[];
  try {
    admins = await listAdminAccounts(await createSupabaseServerClient({ writeCookies: false }));
  } catch (error) {
    if (!(error instanceof OwnerError)) throw error;
    console.error(error);
    return (
      <Notice tone="danger" title={t("errorTitle")}>
        {t("errorBody")}
      </Notice>
    );
  }

  if (admins.length === 0) {
    return (
      <EmptyState tone="forest" icon={ShieldCheck} title={t("empty.title")}>
        {t("empty.body")}
      </EmptyState>
    );
  }

  const now = new Date();
  const clock = new Intl.DateTimeFormat(locale === "id" ? "id-ID" : "en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "Asia/Jakarta" });
  const created = new Intl.DateTimeFormat(locale === "id" ? "id-ID" : "en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Jakarta" });
  // Removing can only be refused for these reasons; any other key reads as "not saved".
  const general = t("errors.unavailable");
  const errors = {
    notAllowed: t("errors.notAllowed"), nameInvalid: general, areaNotFound: general, agencyNotFound: general,
    statusInvalid: general, emailInvalid: general, emailTaken: general, passwordInvalid: general,
    adminNotFound: t("errors.adminNotFound"), unavailable: general,
  } satisfies Record<OwnerFailureKey, string>;

  return (
    <section aria-labelledby="daftar-admin" className={`${panel} overflow-hidden`}>
      <header className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 px-5 pt-5 pb-4 md:px-6">
        <h2 id="daftar-admin" className="font-display text-lg font-semibold text-ink">
          {t("list.label")}
        </h2>
        <p className="text-sm text-ink-muted">{t("summary", { count: admins.length })}</p>
      </header>
      {/* The column names, for sighted readers; each row's own words say what every value is. */}
      <div aria-hidden="true" className={`hidden bg-sunken px-5 py-3 text-xs font-semibold text-ink md:px-6 ${rowGrid}`}>
        <span>{t("list.nameEmail")}</span>
        <span>{t("list.role")}</span>
        <span>{t("list.created")}</span>
        <span>{t("list.lastSignIn")}</span>
        <span>{t("list.status")}</span>
        <span className="sr-only">{t("list.detail")}</span>
      </div>
      <ul>
        {admins.map((admin) => {
          const name = admin.fullName || admin.email;
          const date = created.format(new Date(admin.createdAt));
          const signedIn = admin.lastSignInAt;
          const day = signedIn ? signInDay(signedIn, now) : null;
          const lastSignIn = !signedIn
            ? t("list.never")
            : day === "earlier"
              ? created.format(new Date(signedIn))
              : t(day === "today" ? "list.today" : "list.yesterday", { time: clock.format(new Date(signedIn)) });
          const status = signedIn ? (
            <StatusPill Icon={CircleCheck} pill="bg-success-surface text-success" label={t("list.active")} />
          ) : (
            <StatusPill Icon={Clock} pill="bg-warning-surface text-warning" label={t("list.notYet")} />
          );
          return (
            <li key={admin.id} data-admin={admin.email} className="border-t border-border">
              <details className="group">
                <summary
                  className={`flex min-h-17 cursor-pointer list-none items-center gap-3 px-5 py-3 transition-colors duration-150 ease-out-quart hover:bg-canvas active:bg-sunken md:px-6 [&::-webkit-details-marker]:hidden ${rowGrid}`}
                >
                  <span className="flex min-w-0 flex-1 items-center gap-3">
                    <Initials name={name} />
                    <span className="flex min-w-0 flex-col">
                      <span className="font-semibold break-words text-ink">{name}</span>
                      <span className="text-sm break-all text-ink-muted">{admin.email}</span>
                      {/* Below 1024 px the other columns move under the name. */}
                      <span className="text-xs text-ink-muted lg:hidden">
                        {t("list.roleAdmin")} <span aria-hidden="true">·</span> {t("list.created")} {date}
                      </span>
                      <span className="text-xs text-ink-muted lg:hidden">
                        {t("list.lastSignIn")}: {lastSignIn}
                      </span>
                      <span className="mt-1.5 lg:hidden">{status}</span>
                    </span>
                  </span>
                  <span className="hidden text-sm text-ink lg:block">{t("list.roleAdmin")}</span>
                  <span className="hidden text-sm whitespace-nowrap text-ink tabular-nums lg:block">{date}</span>
                  <span className={`hidden text-sm tabular-nums lg:block ${signedIn ? "text-ink" : "text-ink-muted"}`}>{lastSignIn}</span>
                  <span className="hidden lg:block">{status}</span>
                  {/* A word beside the chevron (2026-11-20, owner review): the row opens to the account's
                      details and "Hapus akun", which a bare chevron did not say. */}
                  <span className="inline-flex min-h-touch shrink-0 items-center gap-1 rounded-full px-3 text-sm font-semibold text-primary transition-colors duration-150 ease-out-quart group-hover:bg-sunken">
                    <span aria-hidden="true">{t("list.manage")}</span>
                    <ChevronDown className="size-4.5 transition-transform duration-150 ease-out-quart group-open:rotate-180" aria-hidden="true" />
                  </span>
                  <span className="sr-only">{t("list.open", { name })}</span>
                </summary>
                <div className="flex flex-col gap-4 px-5 pb-5 md:px-6 lg:pl-17">
                  <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-[max-content_minmax(0,1fr)]">
                    <dt className="text-ink-muted">{t("list.email")}</dt>
                    <dd className="break-all text-ink">{admin.email}</dd>
                    <dt className="text-ink-muted">{t("list.created")}</dt>
                    <dd className="text-ink">{date}</dd>
                    <dt className="text-ink-muted">{t("list.access")}</dt>
                    <dd className="text-ink">{t("list.accessValue")}</dd>
                  </dl>
                  <ConfirmAction
                    action={removeAdmin}
                    fields={{ userId: admin.id }}
                    icon="remove"
                    tone="danger"
                    layout="block"
                    labels={{
                      button: t("remove.button"),
                      buttonLabel: t("remove.label", { name }),
                      question: t("remove.question", { name }),
                      body: t("remove.body", { name }),
                      confirm: t("remove.confirm"),
                      pending: t("remove.pending"),
                      cancel: t("remove.cancel"),
                      done: t("remove.done", { name }),
                    }}
                    errors={errors}
                  />
                </div>
              </details>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
