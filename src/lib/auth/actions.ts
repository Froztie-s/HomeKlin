"use server";

import { cookies } from "next/headers";
import type { Locale } from "next-intl";
import { redirect } from "@/i18n/navigation";
import { isSessionCookieName } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { claimCustomerAccount } from "./code-session";
import { parseCodeLogin, parseLocale, parseSignIn, parseSignUp, type AuthErrorKey } from "@/lib/validation/auth";
import { parseCode } from "@/lib/validation/booking";
import { authFailureKey, type AuthFailureKey } from "./errors";
import { isAppRole, safeNextPath } from "./roles";

// Signing in, signing up and signing out (T5). Server Actions, so the password goes straight to the
// server and Supabase Auth, and the session lands in cookies set by @supabase/ssr (SameSite=Lax; not
// httpOnly, which is the library's default so that a browser Supabase client can read the session).
// Next.js checks the Origin of every Server Action call (CSRF protection). Every input is parsed with
// Zod first.
// The language comes from a hidden field (root params do not reach Server Actions), so redirects keep
// the visitor's language.
// Sources: https://supabase.com/docs/guides/auth/passwords and
// node_modules/next/dist/docs/01-app/02-guides/authentication.md ("Server Actions")

export type AuthFormState = {
  fieldErrors?: Partial<Record<"fullName" | "email" | "password", AuthErrorKey>>;
  formError?: AuthFailureKey | "codeInvalid";
  /** Sign-in by code: the code was emailed (if the account exists), so the page shows the code step. */
  codeSent?: boolean;
  /** What the visitor typed, to refill the form after an error. Never the password. */
  values?: { email?: string; fullName?: string };
} | null;

function textField(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

export async function signIn(_previous: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const values = { email: textField(formData, "email") };
  const parsed = parseSignIn(formData);
  if (!parsed.ok) return { fieldErrors: parsed.fieldErrors, values };

  const { email, password, locale, next } = parsed.data;
  const supabase = await createSupabaseServerClient({ writeCookies: true });
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) return { formError: authFailureKey(error), values };
  return enter(supabase, data.user.id, next, locale, values);
}

/** After a successful sign-in: on to `next` or the role's home (SPEC: role-based redirect after login). */
async function enter(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userId: string,
  next: string | undefined,
  locale: Locale,
  values: NonNullable<AuthFormState>["values"],
): Promise<AuthFormState> {
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", userId).maybeSingle();
  if (!isAppRole(profile?.role)) {
    // An account without a profile cannot use the site; do not leave it signed in.
    await supabase.auth.signOut({ scope: "local" });
    return { formError: "unavailable", values };
  }
  return redirect({ href: safeNextPath(next, profile.role), locale });
}

/**
 * Sign-in by emailed code, step 1 (T9b): email a 6-digit code to an existing account. It never creates
 * an account (ordering does that) and answers the same whether or not the email has one, so the form
 * cannot be used to find out who is a customer.
 */
export async function sendLoginCode(_previous: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const values = { email: textField(formData, "email") };
  const parsed = parseCodeLogin(formData);
  if (!parsed.ok) return { fieldErrors: parsed.fieldErrors, values };

  const supabase = await createSupabaseServerClient({ writeCookies: true });
  const { error } = await supabase.auth.signInWithOtp({ email: parsed.data.email, options: { shouldCreateUser: false } });
  if (error && (error.status === 429 || error.code?.startsWith("over_"))) return { formError: "rateLimited", values };
  return { codeSent: true, values };
}

/** Sign-in by emailed code, step 2: check the code, then on to `next` or the role's home. */
export async function verifyLoginCode(_previous: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const values = { email: textField(formData, "email") };
  const parsed = parseCodeLogin(formData);
  if (!parsed.ok) return { fieldErrors: parsed.fieldErrors, values };
  const code = parseCode(formData.get("code"));
  if (!code) return { formError: "codeInvalid", codeSent: true, values };

  const { email, locale, next } = parsed.data;
  const supabase = await createSupabaseServerClient({ writeCookies: true });
  const { data, error } = await supabase.auth.verifyOtp({ email, token: code, type: "email" });
  if (error || !data.user) {
    if (error?.status === 429) return { formError: "rateLimited", codeSent: true, values };
    return { formError: "codeInvalid", codeSent: true, values };
  }
  await claimCustomerAccount(supabase, createSupabaseServiceClient(), data.user.id, email);
  return enter(supabase, data.user.id, next, locale, values);
}

export async function signUp(_previous: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const values = { email: textField(formData, "email"), fullName: textField(formData, "fullName") };
  const parsed = parseSignUp(formData);
  if (!parsed.ok) return { fieldErrors: parsed.fieldErrors, values };

  const { fullName, email, password, locale, next } = parsed.data;
  const supabase = await createSupabaseServerClient({ writeCookies: true });
  // Every sign-up is a customer: the database trigger ignores any role in this metadata.
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } },
  });
  if (error) return { formError: authFailureKey(error), values };

  // With "Confirm email" off (the test project, and the live one until 2026-11-27) sign-up signs the
  // customer in at once. With it on, Supabase makes the account but gives no session: it emails a
  // 6-digit code (the confirmation template carries {{ .Token }}, no link), and the form shows the code
  // step, which confirmSignUp finishes. An email that already has a confirmed account comes back with
  // no error either, but with an empty `identities` list (Supabase hides it on purpose), so say
  // "email taken" as the form always has; no code is sent for it.
  // Source: node_modules/@supabase/auth-js/dist/module/GoTrueClient.d.ts (signUp, remarks)
  if (!data.session) {
    if (data.user?.identities?.length === 0) return { formError: "emailTaken", values };
    return { codeSent: true, values };
  }
  return redirect({ href: safeNextPath(next, "customer"), locale });
}

/**
 * Sign-up with "Confirm email" on, step 2: check the code from the confirmation email, which proves the
 * address, then sign the new customer in and send them to `next` or their home.
 *
 * `type: "email"` is the right type for a code sent by sign-up confirmation in this version of the
 * library: its docs list `email` as "an OTP sent to the user's email during sign-up or sign-in" and mark
 * `signup` and `magiclink` as deprecated (node_modules/@supabase/auth-js/dist/module/GoTrueClient.d.ts,
 * verifyOtp; example "Verify Signup One-Time Password (OTP)"). The server looks the token up by the
 * email, so it also covers codes that signInWithOtp sent to an account that is not confirmed yet.
 *
 * This deliberately does NOT call claimCustomerAccount (src/lib/auth/code-session.ts). That function
 * replaces a customer's password with a random one after a code sign-in, because customers sign in by
 * code and anyone could have registered their email with a password first. Here the code is what
 * proves the address, and the customer has just chosen this password and must keep it.
 */
export async function confirmSignUp(_previous: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const values = { email: textField(formData, "email") };
  const parsed = parseCodeLogin(formData);
  if (!parsed.ok) return { fieldErrors: parsed.fieldErrors, values };
  const code = parseCode(formData.get("code"));
  if (!code) return { formError: "codeInvalid", codeSent: true, values };

  const { email, locale, next } = parsed.data;
  const supabase = await createSupabaseServerClient({ writeCookies: true });
  const { data, error } = await supabase.auth.verifyOtp({ email, token: code, type: "email" });
  if (error || !data.user) {
    if (error?.status === 429) return { formError: "rateLimited", codeSent: true, values };
    return { formError: "codeInvalid", codeSent: true, values };
  }
  return enter(supabase, data.user.id, next, locale, values);
}

/**
 * Sign-up with "Confirm email" on: send the confirmation code again. Supabase refuses a new one within
 * a minute of the last (429, which the form's own countdown also waits out). Unlike sendLoginCode, any
 * other failure is reported: this email just signed up, so saying so reveals nothing new.
 */
export async function resendSignUpCode(_previous: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const values = { email: textField(formData, "email") };
  const parsed = parseCodeLogin(formData);
  if (!parsed.ok) return { fieldErrors: parsed.fieldErrors, values };

  const supabase = await createSupabaseServerClient({ writeCookies: true });
  const { error } = await supabase.auth.resend({ type: "signup", email: parsed.data.email });
  if (error) return { formError: authFailureKey(error), codeSent: true, values };
  return { codeSent: true, values };
}

export async function signOut(formData: FormData): Promise<void> {
  const locale = parseLocale(formData.get("locale"));
  const supabase = await createSupabaseServerClient({ writeCookies: true });
  // This browser only; other devices stay signed in.
  const { error } = await supabase.auth.signOut({ scope: "local" });
  if (error) {
    // Supabase could not end the session (for example an expired token while it was unreachable), and
    // then it leaves the cookies in place. Delete them here, so this browser is signed out anyway.
    const cookieStore = await cookies();
    for (const { name } of cookieStore.getAll()) {
      if (isSessionCookieName(name)) cookieStore.delete(name);
    }
  }
  redirect({ href: "/", locale });
}
