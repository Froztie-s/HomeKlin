import type { Metadata } from "next";
import { Plus, ShieldCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { Notice } from "@/components/admin/notice";
import { GateFallback } from "@/components/auth/gate-fallback";
import { RoleGate } from "@/components/auth/role-gate";
import { ConfirmAction } from "@/components/owner/confirm-action";
import { CreateAdminForm } from "@/components/owner/create-admin-form";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { ClientMessages } from "@/i18n/client-messages";
import { removeAdmin, type OwnerFailureKey } from "@/lib/owner/actions";
import { listAdminAccounts, OwnerError, type AdminAccount } from "@/lib/owner/owner";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("OwnerAdminsPage");
  return { title: t("title") };
}

// The admin accounts (T29c), the owner only. This is the only place admins are made: the list is read
// with the owner's own session (owner_admins() answers the owner only); creating and removing run as
// Server Actions that check the owner role on the server and then use the secret key there. Removing
// takes the admin role away after a confirm step that says what it does.
export default function OwnerAdminsPage() {
  const t = useTranslations("OwnerAdminsPage");
  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <Suspense fallback={<GateFallback />}>
        <RoleGate roles={["owner"]}>
          <OwnerAdminsContent />
        </RoleGate>
      </Suspense>
    </>
  );
}

const headCell = "px-4 py-3 text-left text-xs font-semibold text-ink-muted";

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

  const created = new Intl.DateTimeFormat(locale === "id" ? "id-ID" : "en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Jakarta" });
  // Removing can only be refused for these reasons; any other key reads as "not saved".
  const general = t("errors.unavailable");
  const errors = {
    notAllowed: t("errors.notAllowed"), nameInvalid: general, areaNotFound: general, agencyNotFound: general,
    statusInvalid: general, emailInvalid: general, emailTaken: general, passwordInvalid: general,
    adminNotFound: t("errors.adminNotFound"), unavailable: general,
  } satisfies Record<OwnerFailureKey, string>;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-muted">{t("summary", { count: admins.length })}</p>
        <a
          href="#buat-admin"
          className="inline-flex min-h-touch items-center gap-2 rounded-full bg-brand-600 px-5 text-sm font-semibold text-on-brand transition-[background-color,transform] duration-150 ease-out-quart hover:bg-brand-700 active:scale-[0.98] active:bg-brand-800"
        >
          <Plus className="size-4 shrink-0" aria-hidden="true" />
          {t("addLink")}
        </a>
      </div>

      {admins.length === 0 ? (
        <EmptyState icon={ShieldCheck} title={t("empty.title")}>
          {t("empty.body")}
        </EmptyState>
      ) : (
        <div className="relative overflow-x-auto rounded-xl border border-border bg-surface">
          <table className="w-full border-collapse text-sm">
            <caption className="sr-only">{t("table.caption")}</caption>
            <thead className="bg-surface-sunken">
              <tr>
                <th scope="col" className={headCell}>{t("table.name")}</th>
                <th scope="col" className={headCell}>{t("table.email")}</th>
                <th scope="col" className={`${headCell} hidden lg:table-cell`}>{t("table.created")}</th>
                <th scope="col" className={headCell}>
                  <span className="sr-only">{t("table.actions")}</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {admins.map((admin) => {
                const name = admin.fullName || admin.email;
                return (
                  <tr key={admin.id} className="align-top transition-colors duration-150 ease-out-quart hover:bg-canvas">
                    <td className="px-4 py-3 font-semibold text-ink">{name}</td>
                    <td className="px-4 py-3 break-all text-ink">{admin.email}</td>
                    <td className="hidden px-4 py-3 whitespace-nowrap text-ink-muted lg:table-cell">
                      {created.format(new Date(admin.createdAt))}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <ConfirmAction
                        action={removeAdmin}
                        fields={{ userId: admin.id }}
                        icon="remove"
                        tone="danger"
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
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <section id="buat-admin" aria-labelledby="buat-admin-title" className="scroll-mt-20 flex flex-col gap-4 rounded-xl border border-border bg-surface p-5 xl:p-8">
        <header className="flex flex-col gap-1">
          <h2 id="buat-admin-title" className="font-display text-lg font-semibold text-ink">
            {t("form.title")}
          </h2>
          <p className="max-w-prose text-sm text-ink-muted">{t("form.description")}</p>
        </header>
        <ClientMessages namespaces={["OwnerAdminsPage"]}>
          <CreateAdminForm />
        </ClientMessages>
      </section>
    </>
  );
}
