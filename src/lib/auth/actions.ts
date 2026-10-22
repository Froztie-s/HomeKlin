"use server";

import { cookies } from "next/headers";
import { redirect } from "@/i18n/navigation";
import { isSessionCookieName } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { parseLocale, parseSignIn, parseSignUp, type AuthErrorKey } from "@/lib/validation/auth";
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
  formError?: AuthFailureKey;
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

  // Where to go depends on the role (SPEC: role-based redirect after login).
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", data.user.id).maybeSingle();
  if (!isAppRole(profile?.role)) {
    // An account without a profile cannot use the site; do not leave it signed in.
    await supabase.auth.signOut({ scope: "local" });
    return { formError: "unavailable", values };
  }
  return redirect({ href: safeNextPath(next, profile.role), locale });
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

  // The project skips email confirmation, so sign-up signs the customer in at once. Should confirmation
  // ever be switched back on, there is no session yet and the form says to check the inbox.
  if (!data.session) return { formError: "confirmEmail", values };
  return redirect({ href: safeNextPath(next, "customer"), locale });
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
