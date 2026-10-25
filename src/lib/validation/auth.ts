import type { Locale } from "next-intl";
import { z } from "zod";
import { routing } from "@/i18n/routing";

// Server-side checks for the sign-in and sign-up forms (markdown/CONSTRAINTS.md: every server action
// parses its input with Zod). Each problem comes back as a message key per field ("Auth.errors.<key>"
// in src/messages), so both languages show their own text.

export type AuthErrorKey =
  | "emailRequired"
  | "emailInvalid"
  | "passwordRequired"
  | "passwordTooShort"
  | "passwordTooLong"
  | "nameRequired"
  | "nameTooLong";

export type FormResult<Data, Field extends string> =
  | { ok: true; data: Data }
  | { ok: false; locale: Locale; fieldErrors: Partial<Record<Field, AuthErrorKey>> };

// Supabase Auth hashes passwords with bcrypt, which only reads the first 72 bytes.
const maxPasswordBytes = 72;
const bytes = (value: string) => new TextEncoder().encode(value).length;

// The language and the next page are hidden fields a visitor can edit, so neither can fail the form:
// an unknown language becomes Indonesian, an over-long next page is dropped (safeNextPath decides
// later whether a next page may be used at all).
const locale = z.enum(routing.locales).catch(routing.defaultLocale);
const next = z.string().max(512).optional().catch(undefined);

const email = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, { error: "emailRequired" })
  .pipe(z.email({ error: "emailInvalid" }).max(254, { error: "emailInvalid" }));

const passwordRequired = z.string().min(1, { error: "passwordRequired" });
const passwordWithinLimit = (schema: z.ZodString) =>
  schema.refine((value) => bytes(value) <= maxPasswordBytes, { error: "passwordTooLong" });

const signInSchema = z.object({
  email,
  password: passwordWithinLimit(passwordRequired),
  locale,
  next,
});

const signUpSchema = z.object({
  fullName: z.string().trim().min(1, { error: "nameRequired" }).max(120, { error: "nameTooLong" }),
  email,
  // 8 characters is stricter than Supabase's default minimum of 6.
  password: passwordWithinLimit(passwordRequired.min(8, { error: "passwordTooShort" })),
  locale,
  next,
});

// Signing in with an emailed code (T9b): the email first, then the same email with the code.
const codeLoginSchema = z.object({ email, locale, next });

export type SignInInput = z.infer<typeof signInSchema>;
export type SignUpInput = z.infer<typeof signUpSchema>;

/** The text fields of a form; a file or a missing field reads as an empty string. */
function fields(formData: FormData, names: readonly string[]): Record<string, string | undefined> {
  return Object.fromEntries(
    names.map((name) => {
      const value = formData.get(name);
      return [name, typeof value === "string" ? value : undefined];
    }),
  );
}

function parse<Schema extends z.ZodObject>(
  schema: Schema,
  formData: FormData,
): FormResult<z.infer<Schema>, Extract<keyof z.infer<Schema>, string>> {
  const input = fields(formData, Object.keys(schema.shape));
  // A missing text field is treated as empty, so it reports "required" rather than a type error.
  for (const key of ["email", "password", "fullName"]) {
    if (key in input && input[key] === undefined) input[key] = "";
  }

  const result = schema.safeParse(input);
  if (result.success) return { ok: true, data: result.data };

  type Field = Extract<keyof z.infer<Schema>, string>;
  const fieldErrors: Partial<Record<Field, AuthErrorKey>> = {};
  for (const issue of result.error.issues) {
    const field = issue.path[0] as Field;
    // The first problem per field is the one to fix first ("required" before "too short").
    fieldErrors[field] ??= issue.message as AuthErrorKey;
  }
  return { ok: false, locale: locale.parse(input.locale), fieldErrors };
}

/** The language field of a form (sign-out has nothing else to check); unknown values become Indonesian. */
export function parseLocale(value: unknown): Locale {
  return locale.parse(value);
}

export function parseSignIn(formData: FormData) {
  return parse(signInSchema, formData);
}

export function parseSignUp(formData: FormData) {
  return parse(signUpSchema, formData);
}

/** The email (and language and next page) of a sign-in by emailed code. */
export function parseCodeLogin(formData: FormData) {
  return parse(codeLoginSchema, formData);
}
