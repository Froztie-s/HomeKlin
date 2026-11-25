"use server";

import { z } from "zod";
import { normalizeOrderNumber } from "@/components/back-office/admin-order";
import { redirect } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { authorize } from "@/lib/auth/dal";

// Admin's order search (audit item 1): the field in the admin shell posts an order number here. A
// Server Action is a public POST endpoint, so it checks the role itself first and refuses anyone but
// an admin. It reads nothing from the database: it only writes the number the way the database does
// ("hk1170", "1170" -> "HK-1170") and goes to /admin/orders/<number>, whose page checks the role again
// and says when there is no such order. An input that cannot be an order number comes back as a
// message key, so the field shows the error without leaving the page; the form works as a plain post
// before the page's script has loaded too. The language comes from a hidden field (root params do not
// reach Server Actions), so the redirect keeps admin's language.
// Sources: node_modules/next/dist/docs/01-app/02-guides/forms.md ("Validation errors") and
// node_modules/next/dist/docs/01-app/02-guides/server-actions.md

/** Why the search did not go anywhere, as a message key ("AdminOrderSearch.errors.<key>"). */
export type OrderSearchError = "empty" | "invalid" | "forbidden";

export type OrderSearchState = { error: OrderSearchError; value: string } | null;

const locale = z.enum(routing.locales).catch(routing.defaultLocale);

export async function findOrder(_previous: OrderSearchState, formData: FormData): Promise<OrderSearchState> {
  if (!(await authorize(["admin"]))) return { error: "forbidden", value: "" };
  const raw = formData.get("code");
  const value = typeof raw === "string" ? raw.trim().slice(0, 64) : "";
  if (!value) return { error: "empty", value: "" };
  const code = normalizeOrderNumber(value);
  if (!code) return { error: "invalid", value };
  return redirect({ href: `/admin/orders/${code}`, locale: locale.parse(formData.get("locale")) });
}
