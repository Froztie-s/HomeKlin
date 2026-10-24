import { CircleAlert, CircleCheck } from "lucide-react";

type NoticeProps = {
  /** success: a change was saved; danger: something could not be done. */
  tone: "success" | "danger";
  /** The fact in a few words, in bold. */
  title: string;
  /** What it means, or what to do next. */
  children: string;
};

const tones = {
  success: { box: "bg-success-surface text-success", Icon: CircleCheck, role: "status" },
  danger: { box: "bg-danger-surface text-danger", Icon: CircleAlert, role: "alert" },
} as const;

// A one-line message at the top of a back-office page, with an icon and words, never colour alone.
export function Notice({ tone, title, children }: NoticeProps) {
  const { box, Icon, role } = tones[tone];
  return (
    <div role={role} className={`flex items-start gap-2.5 rounded-xl px-4 py-3 text-sm ${box}`}>
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <p>
        <span className="font-semibold">{title}</span> {children}
      </p>
    </div>
  );
}
