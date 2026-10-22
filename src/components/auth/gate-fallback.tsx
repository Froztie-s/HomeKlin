import { LoaderCircle } from "lucide-react";
import { useTranslations } from "next-intl";

// What a protected page shows where its content goes while <RoleGate> checks who is signed in: the
// <Suspense> fallback, so it is part of the prerendered shell and appears at once. Usually only for a
// moment; a visitor with the wrong role is sent on from here and never sees the content.
export function GateFallback() {
  const t = useTranslations("GateFallback");
  return (
    <div className="flex min-h-48 items-center justify-center rounded-xl border border-dashed border-border bg-surface px-6 py-12">
      <p role="status" className="flex items-center gap-2 text-sm text-ink-faint">
        <LoaderCircle className="size-4 shrink-0 animate-spin" aria-hidden="true" />
        {t("loading")}
      </p>
    </div>
  );
}
