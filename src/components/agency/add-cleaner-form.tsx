"use client";

import { ImageUp, LoaderCircle, UserPlus, X } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { startTransition, useActionState, useEffect, useRef, useState, type FormEvent, type MouseEvent } from "react";
import { useResultKey } from "@/components/admin/form-fields";
import { TextField } from "@/components/auth/form-controls";
import type { AgencyFailureKey } from "@/lib/agency/actions";
import type { AgencyAction } from "./agency-action";
import { ActionFeedback } from "./action-feedback";
import { primaryButton, secondaryButton } from "./styles";

// The same rule as addCleaner on the server (src/lib/agency/actions.ts), checked here first so a wrong
// file is refused before it is sent.
const photoTypes = ["image/jpeg", "image/png", "image/webp"];
const maxPhotoBytes = 2 * 1024 * 1024;

type State = { formError?: AgencyFailureKey; added?: { name: string; email: string } } | null;

// "Tambah petugas" (T28): the cleaner's full name, the email they sign in with, and an optional photo
// with a preview. The cleaner gets no password: they sign in on /login with a 6-digit code sent to that
// email, which the form says. addCleaner checks the role and every field on the server, makes the
// sign-in account, uploads the photo and adds the cleaner to the caller's own agency only. The form is
// sent by hand (not React's form action), so a refusal never clears what was typed or the chosen photo;
// after a success it empties itself for the next cleaner.
// Sources: https://react.dev/reference/react/useActionState and
// https://developer.mozilla.org/docs/Web/API/URL/createObjectURL_static
export function AddCleanerForm({ addCleaner }: { addCleaner: AgencyAction }) {
  const t = useTranslations("AgencyCleanersPage.form");
  const tError = useTranslations("AgencyErrors");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const [state, formAction, pending] = useActionState(async (previous: State, formData: FormData): Promise<State> => {
    void previous;
    const result = await addCleaner(null, formData);
    if (!result?.ok) return { formError: result?.formError ?? "unavailable" };
    return { added: { name: String(formData.get("fullName") ?? "").trim(), email: String(formData.get("email") ?? "").trim() } };
  }, null);
  const resultKey = useResultKey(state);

  // The preview is a local address for the chosen file, given back when the photo changes or goes.
  const shownUrl = useRef<string | null>(null);
  function showPreview(file: File | null) {
    if (shownUrl.current) URL.revokeObjectURL(shownUrl.current);
    shownUrl.current = file ? URL.createObjectURL(file) : null;
    setPhoto(file);
    setPreview(shownUrl.current);
  }
  useEffect(
    () => () => {
      if (shownUrl.current) URL.revokeObjectURL(shownUrl.current);
    },
    [],
  );

  // After a cleaner was added the form starts again, empty.
  const [handled, setHandled] = useState<State>(null);
  if (state !== handled) {
    setHandled(state);
    if (state?.added) {
      setName("");
      setEmail("");
      setPhoto(null);
      setPreview(null);
    }
  }
  useEffect(() => {
    if (!state?.added) return;
    if (fileInput.current) fileInput.current.value = "";
    if (shownUrl.current) URL.revokeObjectURL(shownUrl.current);
    shownUrl.current = null;
  }, [state]);

  function choose(file: File | undefined) {
    if (file && (!photoTypes.includes(file.type) || file.size > maxPhotoBytes)) {
      showPreview(null);
      setPhotoError(true);
      if (fileInput.current) fileInput.current.value = "";
      return;
    }
    setPhotoError(false);
    showPreview(file ?? null);
  }

  function clearPhoto() {
    showPreview(null);
    setPhotoError(false);
    if (fileInput.current) {
      fileInput.current.value = "";
      fileInput.current.focus();
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPhotoError(false);
    const formData = new FormData(event.currentTarget);
    startTransition(() => formAction(formData));
  }

  function holdWhilePending(event: MouseEvent<HTMLButtonElement>) {
    if (pending) event.preventDefault();
  }

  const serverError = state?.formError ? tError(state.formError) : undefined;
  const error = photoError ? tError("photoInvalid") : serverError;
  const done = state?.added ? t("added", state.added) : undefined;

  return (
    <form
      onSubmit={submit}
      noValidate
      aria-labelledby="add-cleaner-title"
      className="flex flex-col gap-5 rounded-xl border border-border bg-surface p-5 md:p-6"
    >
      <h2 id="add-cleaner-title" className="font-display text-lg font-semibold text-ink">
        {t("title")}
      </h2>
      <TextField
        id="cleaner-name"
        name="fullName"
        label={t("name")}
        autoComplete="off"
        value={name}
        onChange={(event) => setName(event.target.value)}
        aria-invalid={state?.formError === "nameInvalid" ? true : undefined}
      />
      <TextField
        id="cleaner-email"
        name="email"
        type="email"
        label={t("email")}
        hint={t("emailHint")}
        autoComplete="off"
        autoCapitalize="none"
        spellCheck={false}
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        aria-invalid={state?.formError === "emailInvalid" || state?.formError === "emailTaken" ? true : undefined}
      />

      <div className="flex flex-col gap-2">
        <label htmlFor="cleaner-photo" className="px-1 text-sm font-medium text-ink">
          {t("photo")}
        </label>
        <div className="flex items-center gap-4">
          {preview ? (
            <Image
              src={preview}
              alt={t("previewAlt")}
              width={128}
              height={128}
              unoptimized
              className="size-16 shrink-0 rounded-full bg-surface-sunken object-cover"
            />
          ) : (
            <span aria-hidden="true" className="flex size-16 shrink-0 items-center justify-center rounded-full border border-dashed border-border-control bg-surface-sunken">
              <UserPlus className="size-6 text-ink-faint" />
            </span>
          )}
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            {/* The browser's own file button names itself in the browser's language, not the page's, so
                the input is hidden visually and a button-styled label in the page's language opens it.
                The input keeps the keyboard focus, and the label shows the focus ring. */}
            <input
              ref={fileInput}
              id="cleaner-photo"
              name="photo"
              type="file"
              accept={photoTypes.join(",")}
              aria-describedby="cleaner-photo-hint"
              aria-invalid={photoError || state?.formError === "photoInvalid" ? true : undefined}
              onChange={(event) => choose(event.target.files?.[0])}
              className="peer sr-only"
            />
            <label
              htmlFor="cleaner-photo"
              className={`${secondaryButton} cursor-pointer peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus`}
            >
              <ImageUp className="size-4 shrink-0" aria-hidden="true" />
              {photo ? t("changePhoto") : t("choosePhoto")}
            </label>
            {photo ? (
              <button type="button" onClick={clearPhoto} className={`${secondaryButton} min-h-touch`}>
                <X className="size-4 shrink-0" aria-hidden="true" />
                {t("removePhoto")}
              </button>
            ) : null}
          </div>
        </div>
        <p id="cleaner-photo-hint" className="px-1 text-sm text-ink-faint">
          {t("photoHint")}
        </p>
      </div>

      <ActionFeedback error={error} done={done} resultKey={resultKey + (photoError ? 1000 : 0)} />

      <button type="submit" onClick={holdWhilePending} aria-disabled={pending || undefined} className={`${primaryButton} h-12 w-full`}>
        {pending ? <LoaderCircle className="size-4 shrink-0 animate-spin" aria-hidden="true" /> : <UserPlus className="size-4 shrink-0" aria-hidden="true" />}
        {pending ? t("pending") : t("submit")}
      </button>
    </form>
  );
}
