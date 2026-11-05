"use client";

import { LoaderCircle, Lock, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActionState, useEffect, useRef, useState, type MouseEvent } from "react";
import { useResultKey } from "@/components/admin/form-fields";
import type { AgencyActionState } from "@/lib/agency/actions";
import { ActionFeedback } from "./action-feedback";
import type { AgencyAction } from "./agency-action";
import { dangerButton, rowControl, secondaryButton } from "./styles";

type SlotRowActionsProps = {
  slotId: string;
  capacity: number;
  booked: number;
  /** "20.35-22.05 WIB, Jakarta Timur": names the controls for a screen reader. */
  label: { window: string; area: string };
  /** setSlotCapacity and deleteSlot, passed in by the server page. */
  setSlotCapacity: AgencyAction;
  deleteSlot: AgencyAction;
};

// What the agency can do with one of its windows on the schedule (T27): change how many cleaners it can
// send (never below the places already booked; the database refuses that too), and remove a window
// nobody has booked, after a second, explicit "Ya, hapus". "Batal" puts the focus back on "Hapus".
// A booked window says so instead of offering to remove it. Each answer from the server (setSlotCapacity,
// deleteSlot in src/lib/agency/actions.ts) comes back as words under the row.
export function SlotRowActions({ slotId, capacity, booked, label, setSlotCapacity, deleteSlot }: SlotRowActionsProps) {
  const t = useTranslations("AgencySchedulePage");
  const tError = useTranslations("AgencyErrors");
  const [capacityState, capacityAction, saving] = useActionState(setSlotCapacity, null);
  const [removeState, removeAction, removing] = useActionState(deleteSlot, null);
  const [confirming, setConfirming] = useState(false);
  const [last, setLast] = useState<"capacity" | "remove" | null>(null);
  const removeButton = useRef<HTMLButtonElement>(null);
  const yesButton = useRef<HTMLButtonElement>(null);
  const backToRemove = useRef(false);

  const state: AgencyActionState = last === "remove" ? removeState : last === "capacity" ? capacityState : null;
  const resultKey = useResultKey(state);
  const busy = saving || removing;

  useEffect(() => {
    if (confirming) yesButton.current?.focus();
    else if (backToRemove.current) {
      backToRemove.current = false;
      removeButton.current?.focus();
    }
  }, [confirming]);

  function hold(event: MouseEvent<HTMLButtonElement>) {
    if (busy) event.preventDefault();
  }

  function cancel() {
    backToRemove.current = true;
    setConfirming(false);
  }

  const error = state?.formError ? tError(state.formError) : undefined;
  const done = state?.ok && last === "capacity" && !saving ? t("saved") : undefined;

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-2 md:justify-end">
        <form action={capacityAction} noValidate onSubmit={() => setLast("capacity")} className="flex items-center gap-2">
          <input type="hidden" name="slotId" value={slotId} />
          <label htmlFor={`capacity-${slotId}`} className="text-sm text-ink-muted">
            <span aria-hidden="true">{t("capacity")}</span>
            <span className="sr-only">{t("capacityFor", { window: label.window, area: label.area })}</span>
          </label>
          <input
            // A new field whenever the stored capacity changes, so it shows what was saved.
            key={capacity}
            id={`capacity-${slotId}`}
            name="capacity"
            type="number"
            inputMode="numeric"
            min={Math.max(1, booked)}
            max={20}
            defaultValue={capacity}
            aria-invalid={last === "capacity" && capacityState?.formError ? true : undefined}
            className={`${rowControl} w-20 text-center tabular-nums`}
          />
          <button type="submit" onClick={hold} aria-disabled={saving || undefined} className={secondaryButton}>
            {saving ? <LoaderCircle className="size-4 shrink-0 animate-spin" aria-hidden="true" /> : null}
            {saving ? t("saving") : t("save")}
          </button>
        </form>

        {booked > 0 ? (
          <span className="inline-flex min-h-touch items-center gap-1.5 px-2 text-sm text-ink-muted md:min-w-44">
            <Lock className="size-4 shrink-0" aria-hidden="true" />
            {t("bookedLock")}
          </span>
        ) : confirming ? (
          <form action={removeAction} onSubmit={() => setLast("remove")} className="flex items-center gap-2" role="group" aria-label={t("removeConfirm")}>
            <input type="hidden" name="slotId" value={slotId} />
            <span className="text-sm font-medium text-ink">{t("removeConfirm")}</span>
            <button ref={yesButton} type="submit" onClick={hold} aria-disabled={removing || undefined} className={dangerButton}>
              {removing ? <LoaderCircle className="size-4 shrink-0 animate-spin" aria-hidden="true" /> : null}
              {removing ? t("removing") : t("removeYes")}
            </button>
            <button type="button" onClick={cancel} disabled={removing} className={secondaryButton}>
              {t("removeNo")}
            </button>
          </form>
        ) : (
          <button
            ref={removeButton}
            type="button"
            aria-label={t("removeFor", { window: label.window, area: label.area })}
            onClick={() => setConfirming(true)}
            className={`${secondaryButton} text-danger hover:bg-danger-surface md:min-w-44`}
          >
            <Trash2 className="size-4 shrink-0" aria-hidden="true" />
            {t("remove")}
          </button>
        )}
      </div>
      <div className="md:text-right">
        <ActionFeedback error={error} done={done} resultKey={resultKey} size="compact" />
      </div>
    </div>
  );
}
