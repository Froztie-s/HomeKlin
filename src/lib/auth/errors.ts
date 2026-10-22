// Supabase Auth errors, as one of a few plain messages (Auth.errors.<key> in src/messages).
// Sign-in never says whether the email or the password was wrong, so it reveals nothing about which
// accounts exist. Sign-up does say that an email is taken, which is the usual trade-off for a form that
// creates accounts.
// Error codes: https://supabase.com/docs/guides/auth/debugging/error-codes

export type AuthFailureKey =
  | "invalidCredentials"
  | "emailTaken"
  | "rateLimited"
  | "weakPassword"
  | "emailRejected"
  | "confirmEmail"
  | "unavailable";

type AuthErrorLike = { code?: string; status?: number } | null | undefined;

const byCode: Record<string, AuthFailureKey> = {
  invalid_credentials: "invalidCredentials",
  user_already_exists: "emailTaken",
  email_exists: "emailTaken",
  over_request_rate_limit: "rateLimited",
  over_email_send_rate_limit: "rateLimited",
  weak_password: "weakPassword",
  email_address_invalid: "emailRejected",
};

export function authFailureKey(error: AuthErrorLike): AuthFailureKey {
  if (error?.code && error.code in byCode) return byCode[error.code];
  if (error?.status === 429) return "rateLimited";
  return "unavailable";
}
