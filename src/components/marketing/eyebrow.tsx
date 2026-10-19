// The small uppercase label above a section heading, with a 6 px forest dot (markdown/design.md,
// Typography). Rationed: at most one per three landing sections (Layanan and Pertanyaan umum today).
export function Eyebrow({ children }: { children: string }) {
  return (
    <p className="flex items-center gap-2 text-eyebrow font-semibold text-ink-muted uppercase">
      <span aria-hidden="true" className="size-1.5 rounded-full bg-primary" />
      {children}
    </p>
  );
}
