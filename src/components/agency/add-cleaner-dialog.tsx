"use client";

import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";
import type { AgencyAction } from "./agency-action";
import { AddCleanerForm } from "./add-cleaner-form";

/** The address of the header's "Tambah petugas" (AddCleanerJump); a click on it opens this dialog. */
export const addCleanerHash = "#add-cleaner";

// "Tambah petugas" in a dialog over the page (2026-11-20, UX audit item 17): the header's button only
// jumped to a form at the very end, under the list and the week's windows. The header's link stays a
// plain server-rendered link to #add-cleaner; this component catches a click on it (and an address
// that already ends in #add-cleaner) and opens the form as a modal dialog. Escape or "Tutup" closes it,
// and the browser puts the focus back on the button. After a cleaner is added the form says so and
// empties itself, so another can be added; the list behind it refreshes.
export function AddCleanerDialog({ addCleaner }: { addCleaner: AgencyAction }) {
  const t = useTranslations("AgencyCleanersPage.form");
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const open = () => {
      if (dialog.current && !dialog.current.open) dialog.current.showModal();
    };
    function onClick(event: MouseEvent) {
      const link = event.target instanceof Element ? event.target.closest(`a[href$="${addCleanerHash}"]`) : null;
      if (!link) return;
      event.preventDefault();
      open();
    }
    document.addEventListener("click", onClick);
    if (window.location.hash === addCleanerHash) open();
    return () => document.removeEventListener("click", onClick);
  }, []);

  return (
    <dialog
      ref={dialog}
      id="add-cleaner"
      aria-labelledby="add-cleaner-title"
      className="m-auto max-h-[calc(100dvh-2rem)] w-[min(36rem,calc(100vw-2rem))] max-w-none overflow-y-auto rounded-lg bg-transparent p-0 backdrop:bg-ink/40"
    >
      <div className="relative">
        <button
          type="button"
          onClick={() => dialog.current?.close()}
          aria-label={t("close")}
          className="absolute top-3 right-3 z-10 flex size-11 items-center justify-center rounded-full text-ink-muted transition-colors duration-150 ease-out-quart hover:bg-sunken hover:text-ink"
        >
          <X className="size-5" aria-hidden="true" />
        </button>
        <AddCleanerForm addCleaner={addCleaner} />
      </div>
    </dialog>
  );
}
