"use server";

import { updateTag } from "next/cache";
import { redirect } from "@/i18n/navigation";
import { authorize } from "@/lib/auth/dal";
import { catalogCacheTag } from "@/lib/catalog/catalog";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  parseServiceForm,
  parseServiceSwitch,
  serviceFormValues,
  type ServiceErrorKey,
  type ServiceField,
  type ServiceFormValues,
  type ServiceInput,
} from "@/lib/validation/service";

// Admin adds and changes HomeKlin's services and their prices (T7b, /admin/services). A Server Action
// is a public POST endpoint whatever page shows the form, so every action here:
// 1. checks the role itself first (authorize, src/lib/auth/dal.ts) and refuses anyone but an admin
//    with a message, before reading the form;
// 2. parses the form with Zod (src/lib/validation/service.ts), so invalid input never reaches the
//    database;
// 3. writes through the signed-in admin's own client, so row-level security checks the role a second
//    time (supabase/migrations/20261024120000_admin_services.sql). Nobody deletes a service: switching
//    it off keeps it for past orders;
// 4. after a successful write only, expires the catalog's cache tag with updateTag, so the customer
//    pages (which cache their catalog reads with cacheTag(catalogCacheTag)) show the change at once.
// Database messages never reach the browser; the answer is a message key the page translates.
// The language comes from a hidden field (root params do not reach Server Actions), so the redirect
// keeps admin's language.
// Sources: node_modules/next/dist/docs/01-app/02-guides/server-actions.md ("Security"),
// node_modules/next/dist/docs/01-app/03-api-reference/04-functions/updateTag.md and
// node_modules/next/dist/docs/01-app/02-guides/forms.md

/** Why a change could not be saved, as a message key ("AdminServiceForm.formErrors.<key>"). */
export type ServiceFailureKey = "forbidden" | "notFound" | "unavailable";

export type ServiceFormState = {
  fieldErrors?: Partial<Record<ServiceField, ServiceErrorKey>>;
  formError?: ServiceFailureKey;
  /** What admin typed, to refill the form after an error. */
  values?: ServiceFormValues;
} | null;

export type ServiceSwitchState = { ok: true; isActive: boolean } | { ok: false; formError: ServiceFailureKey } | null;

type DatabaseError = { code?: string };

// Postgres error codes: https://www.postgresql.org/docs/current/errcodes-appendix.html
const uniqueViolation = "23505";
const insufficientPrivilege = "42501";

/** A refusal by row-level security means "not allowed"; anything else is a problem to try again later. */
function failureOf(error: DatabaseError): ServiceFailureKey {
  return error.code === insufficientPrivilege ? "forbidden" : "unavailable";
}

/** The columns admin may change. The id is never among them: it names the row. */
function changedColumns(service: ServiceInput) {
  return {
    category: service.category,
    name_id: service.nameId,
    name_en: service.nameEn,
    description_id: service.descriptionId,
    description_en: service.descriptionEn,
    price_idr: service.priceIdr,
    duration_minutes: service.durationMinutes,
    sort_order: service.sortOrder,
    is_active: service.isActive,
  };
}

export async function createService(_previous: ServiceFormState, formData: FormData): Promise<ServiceFormState> {
  if (!(await authorize(["admin"]))) return { formError: "forbidden" };

  const values = serviceFormValues(formData);
  const parsed = parseServiceForm(formData);
  if (!parsed.ok) return { fieldErrors: parsed.fieldErrors, values };

  const service = parsed.data;
  const supabase = await createSupabaseServerClient({ writeCookies: true });
  const { error } = await supabase.from("services").insert({ id: service.id, ...changedColumns(service) });
  if (error) {
    if (error.code === uniqueViolation) return { fieldErrors: { id: "idTaken" }, values };
    return { formError: failureOf(error), values };
  }

  updateTag(catalogCacheTag);
  return redirect({ href: { pathname: "/admin/services", query: { created: service.id } }, locale: parsed.locale });
}

export async function updateService(_previous: ServiceFormState, formData: FormData): Promise<ServiceFormState> {
  if (!(await authorize(["admin"]))) return { formError: "forbidden" };

  const values = serviceFormValues(formData);
  const parsed = parseServiceForm(formData);
  if (!parsed.ok) return { fieldErrors: parsed.fieldErrors, values };

  const service = parsed.data;
  const supabase = await createSupabaseServerClient({ writeCookies: true });
  // select() returns the changed rows: none means there is no such service (row-level security also
  // hides every row from anyone but admin, so nothing would change for them either).
  const { data, error } = await supabase
    .from("services")
    .update(changedColumns(service))
    .eq("id", service.id)
    .select("id");
  if (error) return { formError: failureOf(error), values };
  if (!data || data.length === 0) return { formError: "notFound", values };

  updateTag(catalogCacheTag);
  return redirect({ href: { pathname: "/admin/services", query: { saved: service.id } }, locale: parsed.locale });
}

/** The switch in the list: shows a service in the customer catalog, or takes it out. */
export async function setServiceActive(_previous: ServiceSwitchState, formData: FormData): Promise<ServiceSwitchState> {
  if (!(await authorize(["admin"]))) return { ok: false, formError: "forbidden" };

  // The list builds this form itself, so a request it cannot read was not sent by the page.
  const parsed = parseServiceSwitch(formData);
  if (!parsed.ok) return { ok: false, formError: "unavailable" };

  const { id, isActive } = parsed.data;
  const supabase = await createSupabaseServerClient({ writeCookies: true });
  const { data, error } = await supabase.from("services").update({ is_active: isActive }).eq("id", id).select("id");
  if (error) return { ok: false, formError: failureOf(error) };
  if (!data || data.length === 0) return { ok: false, formError: "notFound" };

  updateTag(catalogCacheTag);
  return { ok: true, isActive };
}
