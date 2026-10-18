const copy = { label: "Langsung ke konten utama" };

// First focusable element on every page, so keyboard users can jump past the navigation.
export function SkipLink() {
  return (
    <a
      href="#konten"
      className="sr-only rounded-md bg-surface text-sm font-semibold text-brand-700 shadow-raised focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-(--z-toast) focus:px-4 focus:py-3"
    >
      {copy.label}
    </a>
  );
}
