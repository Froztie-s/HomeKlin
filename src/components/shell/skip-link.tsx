import { useTranslations } from "next-intl";

// First focusable element on every page, so keyboard users can jump past the navigation.
// An in-page anchor, so a plain <a>.
export function SkipLink() {
  const t = useTranslations("SkipLink");
  return (
    <a
      href="#konten"
      className="sr-only rounded-full bg-surface text-sm font-semibold text-brand-700 shadow-raised focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-(--z-toast) focus:px-5 focus:py-3"
    >
      {t("label")}
    </a>
  );
}
