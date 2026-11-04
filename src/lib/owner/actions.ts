"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { authorize } from "@/lib/auth/dal";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

// The owner's actions (T29c). Public POST endpoints: each one checks the owner role on the server
// first. Partner agencies go through database functions that refuse anyone but the owner
// (supabase/migrations/20261104160100_owner.sql). Admin accounts need the secret key, so the action
// checks the role itself and then uses the server's client; the new account is marked in app_metadata
// (which users cannot set) and its role is set in profiles, never taken from sign-up metadata. Removing
// an admin takes the role away (the account becomes an ordinary customer). Admins sign in with the
// password the owner gives them; they can change it with a sign-in code.

export type OwnerFailureKey =
  | "notAllowed"
  | "nameInvalid"
  | "areaNotFound"
  | "agencyNotFound"
  | "statusInvalid"
  | "emailInvalid"
  | "emailTaken"
  | "passwordInvalid"
  | "adminNotFound"
  | "unavailable";

export type OwnerActionState = { ok?: true; formError?: OwnerFailureKey } | null;

const refusals: Record<string, OwnerFailureKey> = {
  not_owner: "notAllowed",
  name_invalid: "nameInvalid",
  area_not_found: "areaNotFound",
  agency_not_found: "agencyNotFound",
  status_invalid: "statusInvalid",
};

const failure = (error: { message: string }): OwnerActionState => ({ formError: refusals[error.message] ?? "unavailable" });

const value = (formData: FormData, name: string) => {
  const entry = formData.get(name);
  return entry === null || entry === "" ? undefined : entry;
};

const agencyInput = z.object({
  name: z.string().trim().min(2).max(120),
  areaIds: z.array(z.string().regex(/^[a-z0-9-]{1,60}$/)).max(20),
});

export async function addAgency(_previous: OwnerActionState, formData: FormData): Promise<OwnerActionState> {
  if (!(await authorize(["owner"]))) return { formError: "notAllowed" };
  const parsed = agencyInput.safeParse({ name: value(formData, "name") ?? "", areaIds: formData.getAll("areaIds").filter((area) => area !== "") });
  if (!parsed.success) return { formError: parsed.error.issues.some((issue) => issue.path[0] === "name") ? "nameInvalid" : "areaNotFound" };
  const supabase = await createSupabaseServerClient({ writeCookies: true });
  const { error } = await supabase.rpc("owner_add_agency", { p_name: parsed.data.name, p_areas: parsed.data.areaIds });
  if (error) return failure(error);
  refresh();
  return { ok: true };
}

export async function setAgencyStatus(_previous: OwnerActionState, formData: FormData): Promise<OwnerActionState> {
  if (!(await authorize(["owner"]))) return { formError: "notAllowed" };
  const parsed = z
    .object({ agencyId: z.uuid(), status: z.enum(["active", "suspended"]) })
    .safeParse({ agencyId: value(formData, "agencyId"), status: value(formData, "status") });
  if (!parsed.success) return { formError: parsed.error.issues.some((issue) => issue.path[0] === "status") ? "statusInvalid" : "agencyNotFound" };
  const supabase = await createSupabaseServerClient({ writeCookies: true });
  const { error } = await supabase.rpc("owner_set_agency_status", { p_agency: parsed.data.agencyId, p_status: parsed.data.status });
  if (error) return failure(error);
  refresh();
  return { ok: true };
}

const adminInput = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: z.email().max(254).transform((email) => email.toLowerCase()),
  // The same rule as sign-in (src/lib/validation/auth.ts): 8 characters to 72 bytes.
  password: z.string().min(8).refine((password) => new TextEncoder().encode(password).length <= 72),
});

export async function createAdmin(_previous: OwnerActionState, formData: FormData): Promise<OwnerActionState> {
  if (!(await authorize(["owner"]))) return { formError: "notAllowed" };
  const parsed = adminInput.safeParse({
    fullName: value(formData, "fullName") ?? "",
    email: value(formData, "email") ?? "",
    password: value(formData, "password") ?? "",
  });
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path[0];
    return { formError: field === "email" ? "emailInvalid" : field === "password" ? "passwordInvalid" : "nameInvalid" };
  }

  const server = createSupabaseServiceClient();
  const created = await server.auth.admin.createUser({
    email: parsed.data.email,
    password: parsed.data.password,
    email_confirm: true,
    user_metadata: { full_name: parsed.data.fullName },
    app_metadata: { homeklin_role: "admin" },
  });
  if (created.error || !created.data.user) {
    return { formError: /already|exists|registered/i.test(created.error?.message ?? "") ? "emailTaken" : "unavailable" };
  }
  const profile = await server.from("profiles").update({ role: "admin", full_name: parsed.data.fullName }).eq("id", created.data.user.id);
  if (profile.error) {
    console.error("[owner] could not make the new account an admin:", profile.error.message);
    await server.auth.admin.deleteUser(created.data.user.id);
    return { formError: "unavailable" };
  }
  refresh();
  return { ok: true };
}

export async function removeAdmin(_previous: OwnerActionState, formData: FormData): Promise<OwnerActionState> {
  if (!(await authorize(["owner"]))) return { formError: "notAllowed" };
  const parsed = z.object({ userId: z.uuid() }).safeParse({ userId: value(formData, "userId") });
  if (!parsed.success) return { formError: "adminNotFound" };

  const server = createSupabaseServiceClient();
  // Only an admin loses the role here; the owner and every other account are out of reach.
  const { data, error } = await server
    .from("profiles")
    .update({ role: "customer" })
    .eq("id", parsed.data.userId)
    .eq("role", "admin")
    .select("id");
  if (error) return { formError: "unavailable" };
  if (!data || data.length === 0) return { formError: "adminNotFound" };
  await server.auth.admin.updateUserById(parsed.data.userId, { app_metadata: { homeklin_role: null } });
  refresh();
  return { ok: true };
}
