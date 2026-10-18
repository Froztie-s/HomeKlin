type LiveIndicatorProps = {
  label: string;
};

// Calm "live" status: a slow teal pulse plus words. Never a red REC dot, never colour alone.
export function LiveIndicator({ label }: LiveIndicatorProps) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-live-surface px-2.5 py-1 text-xs font-semibold text-live">
      <span aria-hidden="true" className="size-2 animate-breathe rounded-full bg-live-dot" />
      {label}
    </span>
  );
}
