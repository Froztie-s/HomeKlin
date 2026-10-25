import { stepAfter, type CodeAnswer, type CodeStep } from "@/components/auth/code-steps";

// The order page's steps (T9b). A guest fills in the order and sends it for a code (sendOrderCode),
// then types the code to place it (placeOrder); a signed-in customer books straight away
// (bookService). When the code was right but the order still failed (the window was taken in the
// meantime), the guest is signed in now and finishes on the signed-in path, without a new code.

export type OrderView = { step: CodeStep; signedIn: boolean };

/** send / resend: sendOrderCode; place: placeOrder; book: bookService. */
export type OrderIntent = "send" | "resend" | "place" | "book";

export type OrderAnswer = (CodeAnswer & { signedIn?: boolean }) | null;

/** What the main button sends from this view. */
export function intentFor(view: OrderView): OrderIntent {
  if (view.signedIn) return "book";
  return view.step === "code" ? "place" : "send";
}

export function viewAfter(view: OrderView, intent: OrderIntent, answer: OrderAnswer): OrderView {
  if (view.signedIn || answer?.signedIn) return { step: "form", signedIn: true };
  const step = stepAfter(view.step, intent === "place" ? "verify" : intent === "book" ? "send" : intent, answer);
  return { step, signedIn: false };
}
