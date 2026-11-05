import { LoaderCircle } from "lucide-react";

type OwnerSubmitButtonProps = { pending: boolean; label: string; pendingLabel: string };

// The owner forms' one action (T29c): a primary pill, disabled with a spinner and words while the
// server works, so a double click sends one request.
export function OwnerSubmitButton({ pending, label, pendingLabel }: OwnerSubmitButtonProps) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex min-h-touch w-fit items-center justify-center gap-2 rounded-full bg-brand-600 px-6 text-sm font-semibold text-on-brand transition-[background-color,transform] duration-150 ease-out-quart hover:bg-brand-700 active:scale-[0.98] active:bg-brand-800 disabled:cursor-progress disabled:bg-brand-700 disabled:active:scale-100"
    >
      {pending ? <LoaderCircle className="size-4 shrink-0 animate-spin" aria-hidden="true" /> : null}
      {pending ? pendingLabel : label}
    </button>
  );
}
