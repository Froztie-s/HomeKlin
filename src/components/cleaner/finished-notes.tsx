"use client";

import { CircleCheck, Info } from "lucide-react";
import { useTranslations } from "next-intl";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

// What check-out said, kept above the job list (T18). A finished job moves from "Hari ini" to
// "Baru selesai", so its card is a new component after the page refreshes and would forget the answer;
// this provider stays put and hands the answer to the finished card: done, or done without a recording.
// The note is for this visit only: after a reload the card simply shows the time it finished.

export type FinishedNote = "done" | "recordingMissing";

type FinishedNotes = {
  notes: ReadonlyMap<string, FinishedNote>;
  remember: (orderId: string, note: FinishedNote) => void;
};

const FinishedNotesContext = createContext<FinishedNotes | null>(null);

export function FinishedNotesProvider({ children }: { children: ReactNode }) {
  const [notes, setNotes] = useState<ReadonlyMap<string, FinishedNote>>(new Map());
  const remember = useCallback((orderId: string, note: FinishedNote) => {
    setNotes((current) => new Map(current).set(orderId, note));
  }, []);
  const value = useMemo(() => ({ notes, remember }), [notes, remember]);
  return <FinishedNotesContext value={value}>{children}</FinishedNotesContext>;
}

export function useRememberFinished(): FinishedNotes["remember"] {
  const context = useContext(FinishedNotesContext);
  if (!context) throw new Error("useRememberFinished needs a FinishedNotesProvider above it");
  return context.remember;
}

// On the finished card: the answer of a check-out made on this visit. It takes the focus once, so the
// cleaner (and a screen reader) lands on the job that just moved down the page.
export function FinishedNoteLine({ orderId }: { orderId: string }) {
  const t = useTranslations("CleanerJobActions");
  const note = useContext(FinishedNotesContext)?.notes.get(orderId);
  const ref = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (!note) return;
    ref.current?.focus();
    ref.current?.scrollIntoView({ block: "center" });
  }, [note]);

  if (!note) return null;
  const missing = note === "recordingMissing";
  const Icon = missing ? Info : CircleCheck;
  return (
    <p
      ref={ref}
      tabIndex={-1}
      className={`flex items-start gap-2.5 rounded-md px-3 py-2.5 text-sm font-medium outline-offset-2 ${
        missing ? "bg-info-surface text-info" : "bg-success-surface text-success"
      }`}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <span>{t(missing ? "recordingMissing" : "doneNote")}</span>
    </p>
  );
}
