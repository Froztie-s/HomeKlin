"use server";

import { randomUUID } from "node:crypto";
import { refresh } from "next/cache";
import { z } from "zod";
import { authorize } from "@/lib/auth/dal";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { getMyAgency } from "./agency";

// The partner agency's back office actions (T27, T28). Public POST endpoints: each checks the agency
// role and parses its input. The windows go through database functions that work only on the caller's
// own agency (supabase/migrations/20261104150000_agency_back_office.sql). Adding a cleaner needs a
// sign-in account, which only the secret key can create: the action finds the caller's agency with
// the caller's own session first, so an agency can only ever add cleaners to itself. The new cleaner
// signs in with an emailed code (/login), like every customer; no password is set or sent.

export type AgencyFailureKey =
  | "notAllowed"
  | "areaNotServed"
  | "windowInvalid"
  | "capacityInvalid"
  | "slotExists"
  | "slotNotFound"
  | "capacityBelowBooked"
  | "slotBooked"
  | "nameInvalid"
  | "emailInvalid"
  | "emailTaken"
  | "photoInvalid"
  | "unavailable";

export type AgencyActionState = { ok?: true; formError?: AgencyFailureKey } | null;

const refusals: Record<string, AgencyFailureKey> = {
  not_agency: "notAllowed",
  area_not_served: "areaNotServed",
  window_invalid: "windowInvalid",
  capacity_invalid: "capacityInvalid",
  slot_exists: "slotExists",
  slot_not_found: "slotNotFound",
  capacity_below_booked: "capacityBelowBooked",
  slot_booked: "slotBooked",
};

const failure = (error: { message: string }): AgencyActionState => ({ formError: refusals[error.message] ?? "unavailable" });

const value = (formData: FormData, name: string) => {
  const entry = formData.get(name);
  return entry === null || entry === "" ? undefined : entry;
};

const capacity = z.coerce.number().int().min(1).max(20);

const slotInput = z.object({
  areaId: z.string().regex(/^[a-z0-9-]{1,60}$/),
  startsAt: z.iso.datetime({ offset: true }),
  endsAt: z.iso.datetime({ offset: true }),
  capacity,
});

export async function addSlot(_previous: AgencyActionState, formData: FormData): Promise<AgencyActionState> {
  if (!(await authorize(["agency"]))) return { formError: "notAllowed" };
  const parsed = slotInput.safeParse({
    areaId: value(formData, "areaId"),
    startsAt: value(formData, "startsAt"),
    endsAt: value(formData, "endsAt"),
    capacity: value(formData, "capacity"),
  });
  if (!parsed.success) {
    return { formError: parsed.error.issues.some((issue) => issue.path[0] === "capacity") ? "capacityInvalid" : "windowInvalid" };
  }
  const supabase = await createSupabaseServerClient({ writeCookies: true });
  const { error } = await supabase.rpc("add_slot", {
    p_area: parsed.data.areaId,
    p_starts_at: parsed.data.startsAt,
    p_ends_at: parsed.data.endsAt,
    p_capacity: parsed.data.capacity,
  });
  if (error) return failure(error);
  refresh();
  return { ok: true };
}

export async function setSlotCapacity(_previous: AgencyActionState, formData: FormData): Promise<AgencyActionState> {
  if (!(await authorize(["agency"]))) return { formError: "notAllowed" };
  const parsed = z.object({ slotId: z.uuid(), capacity }).safeParse({ slotId: value(formData, "slotId"), capacity: value(formData, "capacity") });
  if (!parsed.success) return { formError: parsed.error.issues.some((issue) => issue.path[0] === "capacity") ? "capacityInvalid" : "slotNotFound" };
  const supabase = await createSupabaseServerClient({ writeCookies: true });
  const { error } = await supabase.rpc("set_slot_capacity", { p_slot: parsed.data.slotId, p_capacity: parsed.data.capacity });
  if (error) return failure(error);
  refresh();
  return { ok: true };
}

export async function deleteSlot(_previous: AgencyActionState, formData: FormData): Promise<AgencyActionState> {
  if (!(await authorize(["agency"]))) return { formError: "notAllowed" };
  const parsed = z.object({ slotId: z.uuid() }).safeParse({ slotId: value(formData, "slotId") });
  if (!parsed.success) return { formError: "slotNotFound" };
  const supabase = await createSupabaseServerClient({ writeCookies: true });
  const { error } = await supabase.rpc("delete_slot", { p_slot: parsed.data.slotId });
  if (error) return failure(error);
  refresh();
  return { ok: true };
}

const cleanerPhotoBucket = "cleaner-photos";
const photoTypes = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" } as const;
const maxPhotoBytes = 2 * 1024 * 1024;

const cleanerInput = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: z.email().max(254).transform((email) => email.toLowerCase()),
});

/** Adds a cleaner to the signed-in agency: a sign-in account with the cleaner role, a name and a photo. */
export async function addCleaner(_previous: AgencyActionState, formData: FormData): Promise<AgencyActionState> {
  if (!(await authorize(["agency"]))) return { formError: "notAllowed" };
  const parsed = cleanerInput.safeParse({ fullName: value(formData, "fullName") ?? "", email: value(formData, "email") ?? "" });
  if (!parsed.success) return { formError: parsed.error.issues.some((issue) => issue.path[0] === "email") ? "emailInvalid" : "nameInvalid" };

  const photo = formData.get("photo");
  const hasPhoto = photo instanceof File && photo.size > 0;
  if (hasPhoto && (!(photo.type in photoTypes) || photo.size > maxPhotoBytes)) return { formError: "photoInvalid" };

  const agency = await getMyAgency(await createSupabaseServerClient({ writeCookies: true }));
  if (!agency) return { formError: "notAllowed" };

  const server = createSupabaseServiceClient();
  const created = await server.auth.admin.createUser({
    email: parsed.data.email,
    email_confirm: true,
    user_metadata: { full_name: parsed.data.fullName },
    // Marks the account as made by HomeKlin's server for this agency (users cannot set app_metadata).
    app_metadata: { homeklin_role: "cleaner", agency_id: agency.id },
  });
  if (created.error || !created.data.user) {
    return { formError: /already|exists|registered/i.test(created.error?.message ?? "") ? "emailTaken" : "unavailable" };
  }
  const userId = created.data.user.id;

  try {
    let photoUrl: string | null = null;
    if (hasPhoto) {
      const extension = photoTypes[photo.type as keyof typeof photoTypes];
      const path = `${agency.id}/${userId}-${randomUUID().slice(0, 8)}.${extension}`;
      const upload = await server.storage.from(cleanerPhotoBucket).upload(path, photo, { contentType: photo.type });
      if (upload.error) throw new Error(upload.error.message);
      photoUrl = server.storage.from(cleanerPhotoBucket).getPublicUrl(path).data.publicUrl;
    }
    const profile = await server.from("profiles").update({ role: "cleaner", full_name: parsed.data.fullName }).eq("id", userId);
    if (profile.error) throw new Error(profile.error.message);
    const cleaner = await server.from("cleaners").insert({ user_id: userId, agency_id: agency.id, full_name: parsed.data.fullName, photo_url: photoUrl });
    if (cleaner.error) throw new Error(cleaner.error.message);
  } catch (cause) {
    // Never leave half a cleaner behind: the account goes again when its role or row could not be set.
    console.error("[agency] could not add the cleaner:", cause);
    await server.auth.admin.deleteUser(userId);
    return { formError: "unavailable" };
  }
  refresh();
  return { ok: true };
}
