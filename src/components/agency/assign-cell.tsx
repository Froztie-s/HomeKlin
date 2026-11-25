"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { initialsOf } from "@/components/auth/user-avatar";
import { AssignCleaner } from "./assign-cleaner";
import { secondaryButton } from "./styles";

type AssignCellProps = {
  orderId: string;
  cleaners: readonly { id: string; fullName: string }[];
  cleanerId: string | null;
  cleanerName: string | null;
};

// The cleaner of a job nobody has checked in to yet, on "Pekerjaan masuk" (D2, after the mock
// Partner-Jobs): without a cleaner, the assign control; with one, the cleaner's name and "Ganti", which
// opens the same control. It stays one component in one place, so after a change (the page refreshes
// with the new cleaner) the control and its confirmation stay on screen instead of folding away.
// Needs the AgencyOrdersPage client messages.
export function AssignCell({ orderId, cleaners, cleanerId, cleanerName }: AssignCellProps) {
  const t = useTranslations("AgencyOrdersPage");
  const [editing, setEditing] = useState(cleanerName === null);

  if (editing || !cleanerName) return <AssignCleaner orderId={orderId} cleaners={cleaners} cleanerId={cleanerId} />;
  return (
    <span className="flex min-w-0 items-center justify-between gap-3">
      <span className="flex min-w-0 items-center gap-2.5">
        <span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center rounded-full bg-lime-wash text-xs font-semibold text-on-lime-wash">
          {initialsOf(cleanerName)}
        </span>
        <span className="min-w-0 text-ink">{cleanerName}</span>
      </span>
      <button
        type="button"
        onClick={() => setEditing(true)}
        aria-label={t("changeFor", { name: cleanerName })}
        // An outlined button like the row's other actions, not bare bold text (UX audit item 15).
        className={secondaryButton}
      >
        {t("change")}
      </button>
    </span>
  );
}
