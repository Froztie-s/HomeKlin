import { CircleCheck, CirclePause } from "lucide-react";

type AgencyStatusPillProps = {
  status: "active" | "suspended";
  /** "Aktif" or "Ditangguhkan", in the page's language. */
  label: string;
};

const tones = {
  active: { box: "bg-success-surface text-success", Icon: CircleCheck },
  suspended: { box: "bg-warning-surface text-warning", Icon: CirclePause },
} as const;

// A partner agency's status on the owner pages (T29b, T29c): an icon and a word, never colour alone.
export function AgencyStatusPill({ status, label }: AgencyStatusPillProps) {
  const { box, Icon } = tones[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap ${box}`}>
      <Icon className="size-3.5 shrink-0" aria-hidden="true" />
      {label}
    </span>
  );
}
