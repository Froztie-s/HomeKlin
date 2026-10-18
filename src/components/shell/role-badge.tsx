type RoleBadgeProps = {
  label: string;
};

// Tells staff and cleaners which mode they are in ("Petugas", "Agensi", "Admin"), next to the wordmark.
export function RoleBadge({ label }: RoleBadgeProps) {
  return (
    <span className="rounded-xs border border-border bg-surface px-1.5 py-0.5 text-xs font-semibold text-ink-muted">
      {label}
    </span>
  );
}
