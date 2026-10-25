// The two steps of a form that works with an emailed code (T9b): the sign-in page (email, then code)
// and the order page (the order, then code). One page, so what was typed is kept. These rules decide
// which step shows after an answer from the server.

export type CodeStep = "form" | "code";

/** send: the first code; resend: another code from the code step; verify: the typed code. */
export type CodeIntent = "send" | "resend" | "verify";

/** The parts of a server answer the step depends on. */
export type CodeAnswer = {
  codeSent?: boolean;
  fieldErrors?: Partial<Record<string, string>>;
  formError?: string;
} | null;

export function stepAfter(current: CodeStep, intent: CodeIntent, answer: CodeAnswer): CodeStep {
  if (!answer) return current;
  if (answer.codeSent) return "code";
  // A field of the first step to fix (the email, an address): back to the form, where it is.
  const fields = Object.keys(answer.fieldErrors ?? {}).filter((field) => field !== "code");
  if (fields.length > 0) return "form";
  // Too many tries, or a fault: say so where the visitor is.
  return intent === "send" ? "form" : current;
}
