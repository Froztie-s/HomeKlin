import type { Locale } from "next-intl";
import { z } from "zod";
import type { AdminService } from "@/lib/catalog/admin";
import { serviceCategories, type ServiceCategory } from "@/lib/catalog/catalog";
import { routing } from "@/i18n/routing";

// Server-side checks for the admin's service form (T7b; markdown/CONSTRAINTS.md: every server action
// parses its input with Zod). The limits are the database's own (public.services in
// supabase/migrations/20261024100000_catalog.sql), so nothing the database would refuse is sent to it;
// the price also has an upper limit of Rp 100.000.000 against a typing slip. Each problem comes back as
// a message key per field ("AdminServiceForm.errors.<key>" in src/messages), so the page shows it in its
// own language.

export const serviceLimits = {
  idMax: 40,
  nameMax: 80,
  descriptionMax: 300,
  priceMax: 100_000_000,
  durationMin: 30,
  durationMax: 720,
  sortOrderMax: 9999,
} as const;

/** The form's text fields, in the order they appear. */
export const serviceTextFields = [
  "id",
  "category",
  "nameId",
  "descriptionId",
  "nameEn",
  "descriptionEn",
  "priceIdr",
  "durationMinutes",
  "sortOrder",
] as const;

/** A field that can have a problem (the active checkbox cannot be wrong). */
export type ServiceField = (typeof serviceTextFields)[number];

export type ServiceErrorKey =
  | "idRequired"
  | "idInvalid"
  | "idTooLong"
  | "idTaken"
  | "categoryRequired"
  | "nameRequired"
  | "nameTooLong"
  | "descriptionRequired"
  | "descriptionTooLong"
  | "priceRequired"
  | "priceInvalid"
  | "priceTooLow"
  | "priceTooHigh"
  | "durationRequired"
  | "durationInvalid"
  | "durationRange"
  | "sortOrderInvalid";

/** A service as admin enters it, checked and typed. */
export type ServiceInput = {
  id: string;
  category: ServiceCategory;
  nameId: string;
  nameEn: string;
  descriptionId: string;
  descriptionEn: string;
  /** Whole rupiah. */
  priceIdr: number;
  durationMinutes: number;
  sortOrder: number;
  isActive: boolean;
};

/** What the form shows: every field as typed, and the checkbox. */
export type ServiceFormValues = Record<ServiceField, string> & { isActive: boolean };

export type ServiceParseResult =
  | { ok: true; locale: Locale; data: ServiceInput }
  | { ok: false; locale: Locale; fieldErrors: Partial<Record<ServiceField, ServiceErrorKey>> };

const idPattern = /^[a-z0-9]+(-[a-z0-9]+)*$/;

// The language is a hidden field a visitor can edit, so it can never fail the form.
const locale = z.enum(routing.locales).catch(routing.defaultLocale);

const id = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, { error: "idRequired" })
  .max(serviceLimits.idMax, { error: "idTooLong" })
  .regex(idPattern, { error: "idInvalid" });

/** Trimmed, with every run of spaces or line breaks as one space (names and descriptions are one line). */
const oneLine = (required: ServiceErrorKey, tooLong: ServiceErrorKey, max: number) =>
  z
    .string()
    .transform((value) => value.trim().replace(/\s+/g, " "))
    .pipe(z.string().min(1, { error: required }).max(max, { error: tooLong }));

// A price in whole rupiah, as people write it: "85000", "85.000", "85 000" or "Rp 85.000". Anything that
// could be read two ways ("85,5", "85,000", "85.5") is refused rather than guessed: in Indonesian the
// comma is the decimal mark, in English the thousands separator.
const price = z
  .string()
  .trim()
  .min(1, { error: "priceRequired" })
  .transform((value) => value.replace(/^rp\.?\s*/i, ""))
  .pipe(
    z
      .string()
      .max(20, { error: "priceInvalid" })
      .regex(/^(\d{1,3}([.\s]\d{3})+|\d+)$/, { error: "priceInvalid" }),
  )
  .transform((value) => Number(value.replace(/[.\s]/g, "")))
  .pipe(
    z
      .number()
      .min(1, { error: "priceTooLow" })
      .max(serviceLimits.priceMax, { error: "priceTooHigh" }),
  );

const duration = z
  .string()
  .trim()
  .min(1, { error: "durationRequired" })
  .regex(/^\d{1,4}$/, { error: "durationInvalid" })
  .transform(Number)
  .pipe(
    z
      .number()
      .min(serviceLimits.durationMin, { error: "durationRange" })
      .max(serviceLimits.durationMax, { error: "durationRange" }),
  );

// 0 to 9999: four digits at most.
const sortOrder = z.string().trim().regex(/^\d{1,4}$/, { error: "sortOrderInvalid" }).transform(Number);

const serviceSchema = z.object({
  id,
  category: z.enum(serviceCategories, { error: "categoryRequired" }),
  nameId: oneLine("nameRequired", "nameTooLong", serviceLimits.nameMax),
  nameEn: oneLine("nameRequired", "nameTooLong", serviceLimits.nameMax),
  descriptionId: oneLine("descriptionRequired", "descriptionTooLong", serviceLimits.descriptionMax),
  descriptionEn: oneLine("descriptionRequired", "descriptionTooLong", serviceLimits.descriptionMax),
  priceIdr: price,
  durationMinutes: duration,
  sortOrder,
  // A ticked checkbox posts "on"; an unticked one posts nothing.
  isActive: z.boolean(),
});

function text(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

/**
 * The form that adds or changes a service. When it changes one, the id says which service and is never
 * changed itself (src/lib/catalog/admin-actions.ts).
 */
export function parseServiceForm(formData: FormData): ServiceParseResult {
  const input: Record<string, unknown> = Object.fromEntries(serviceTextFields.map((name) => [name, text(formData, name)]));
  input.isActive = formData.get("isActive") === "on";
  const language = locale.parse(formData.get("locale"));

  const result = serviceSchema.safeParse(input);
  if (result.success) return { ok: true, locale: language, data: result.data };

  const fieldErrors: Partial<Record<ServiceField, ServiceErrorKey>> = {};
  for (const issue of result.error.issues) {
    const field = issue.path[0] as ServiceField;
    // The first problem per field is the one to fix first ("required" before "too long").
    fieldErrors[field] ??= issue.message as ServiceErrorKey;
  }
  return { ok: false, locale: language, fieldErrors };
}

/** A service id from an address or a hidden field, in lower case, or null if no service could have it. */
export function parseServiceId(value: unknown): string | null {
  const result = id.safeParse(value);
  return result.success ? result.data : null;
}

const switchSchema = z.object({
  id,
  isActive: z.enum(["true", "false"]).transform((value) => value === "true"),
});

/** The switch in the list: which service, and whether it should be on. */
export function parseServiceSwitch(formData: FormData): { ok: true; data: { id: string; isActive: boolean } } | { ok: false } {
  const result = switchSchema.safeParse({ id: formData.get("id"), isActive: formData.get("isActive") });
  return result.success ? { ok: true, data: result.data } : { ok: false };
}

/** Longest value sent back to refill the form; the real limits are far below it. */
const maxEcho = 400;

/** What admin typed, as typed (cut to a sane length), to refill the form after an error. */
export function serviceFormValues(formData: FormData): ServiceFormValues {
  const values = Object.fromEntries(serviceTextFields.map((name) => [name, text(formData, name).slice(0, maxEcho)]));
  return { ...(values as Record<ServiceField, string>), isActive: formData.get("isActive") === "on" };
}

/** A stored service as the form's starting values. */
export function serviceToFormValues(service: AdminService): ServiceFormValues {
  return {
    id: service.id,
    category: service.category,
    nameId: service.name.id,
    nameEn: service.name.en,
    descriptionId: service.description.id,
    descriptionEn: service.description.en,
    priceIdr: String(service.priceIdr),
    durationMinutes: String(service.durationMinutes),
    sortOrder: String(service.sortOrder),
    isActive: service.isActive,
  };
}
