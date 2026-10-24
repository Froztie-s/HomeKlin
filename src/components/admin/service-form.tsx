"use client";

import { LoaderCircle } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useActionState, type MouseEvent } from "react";
import { FormAlert, TextField } from "@/components/auth/form-controls";
import { ButtonLink } from "@/components/ui/button-link";
import { createService, updateService } from "@/lib/catalog/admin-actions";
import type { ServiceField, ServiceFormValues } from "@/lib/validation/service";
import { CheckboxField, FixedField, FormSection, SelectField, TextAreaField, useFocusFirstError, useResultKey } from "./form-fields";

type ServiceFormProps = {
  /** create: a new service with an id to choose; edit: an existing one, whose id stays as it is. */
  mode: "create" | "edit";
  /** The values the form starts with. */
  initial: ServiceFormValues;
  /** The service types with their names in the page's language. */
  categories: readonly { value: string; label: string }[];
};

// Adds or changes one of HomeKlin's services (T7b): its id, type and place in the list, its name and
// description in both languages side by side, its one price and duration, and whether customers see
// it. The form posts to a Server Action (src/lib/catalog/admin-actions.ts) that checks the role and
// every field on the server; each problem comes back per field, in the page's language, and the
// cursor moves to the first one. It also works before JavaScript loads (a plain form post). Browser
// validation is off (noValidate), so every message comes from the server.
// Sources: node_modules/next/dist/docs/01-app/02-guides/forms.md ("Validation errors", "Pending
// states") and https://react.dev/reference/react/useActionState
export function ServiceForm({ mode, initial, categories }: ServiceFormProps) {
  const t = useTranslations("AdminServiceForm");
  const locale = useLocale();
  const [state, formAction, pending] = useActionState(mode === "create" ? createService : updateService, null);
  const form = useFocusFirstError(state);
  const resultKey = useResultKey(state);
  const values = state?.values ?? initial;
  const errors = state?.fieldErrors ?? {};
  const errorCount = Object.keys(errors).length;
  const errorOf = (field: ServiceField) => {
    const key = errors[field];
    return key ? t(`errors.${key}`) : undefined;
  };
  const formMessage = state?.formError
    ? t(`formErrors.${state.formError}`)
    : errorCount > 0
      ? t("errorSummary", { count: errorCount })
      : undefined;

  // A second click while saving would send the same form again; the button keeps its focus instead of
  // being disabled, so a keyboard user stays where they were.
  function holdWhilePending(event: MouseEvent<HTMLButtonElement>) {
    if (pending) event.preventDefault();
  }

  return (
    <form
      ref={form}
      action={formAction}
      noValidate
      className="flex w-full max-w-content flex-col rounded-xl border border-border bg-surface"
    >
      <input type="hidden" name="locale" value={locale} />
      {mode === "edit" ? <input type="hidden" name="id" value={initial.id} /> : null}

      <FormSection legend={t("sections.basics")}>
        <div className="grid gap-5 md:grid-cols-2">
          {mode === "create" ? (
            <TextField
              id="service-id"
              name="id"
              label={t("fields.id")}
              hint={t("fields.idHint")}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              defaultValue={values.id}
              error={errorOf("id")}
            />
          ) : (
            <FixedField id="service-id" label={t("fields.id")} value={initial.id} hint={t("fields.idFixed")} />
          )}
          <SelectField
            id="service-category"
            name="category"
            label={t("fields.category")}
            placeholder={t("fields.categoryPlaceholder")}
            options={categories}
            defaultValue={values.category}
            error={errorOf("category")}
          />
        </div>
      </FormSection>

      <FormSection legend={t("sections.texts")} description={t("textsHint")}>
        {/* Two languages side by side from 1024 px. The grid fills column by column, so the tab order
            is Indonesian first, then English, while the two names (and the two descriptions) share a row. */}
        <div className="grid gap-5 lg:grid-flow-col lg:grid-cols-2 lg:grid-rows-[auto_auto] lg:gap-x-8">
          <TextField
            id="service-name-id"
            name="nameId"
            lang="id"
            label={t("fields.nameId")}
            autoComplete="off"
            defaultValue={values.nameId}
            error={errorOf("nameId")}
          />
          <TextAreaField
            id="service-description-id"
            name="descriptionId"
            lang="id"
            label={t("fields.descriptionId")}
            hint={t("fields.descriptionHint")}
            defaultValue={values.descriptionId}
            error={errorOf("descriptionId")}
          />
          <TextField
            id="service-name-en"
            name="nameEn"
            lang="en"
            label={t("fields.nameEn")}
            autoComplete="off"
            defaultValue={values.nameEn}
            error={errorOf("nameEn")}
          />
          <TextAreaField
            id="service-description-en"
            name="descriptionEn"
            lang="en"
            label={t("fields.descriptionEn")}
            hint={t("fields.descriptionHint")}
            defaultValue={values.descriptionEn}
            error={errorOf("descriptionEn")}
          />
        </div>
      </FormSection>

      <FormSection legend={t("sections.pricing")}>
        <div className="grid gap-5 md:grid-cols-2">
          <TextField
            id="service-price"
            name="priceIdr"
            label={t("fields.price")}
            hint={t("fields.priceHint")}
            inputMode="numeric"
            autoComplete="off"
            defaultValue={values.priceIdr}
            error={errorOf("priceIdr")}
          />
          <TextField
            id="service-duration"
            name="durationMinutes"
            label={t("fields.duration")}
            hint={t("fields.durationHint")}
            inputMode="numeric"
            autoComplete="off"
            defaultValue={values.durationMinutes}
            error={errorOf("durationMinutes")}
          />
        </div>
      </FormSection>

      {/* Whether customers see the service, and where in the catalog. */}
      <FormSection legend={t("sections.visibility")}>
        <CheckboxField
          id="service-active"
          name="isActive"
          label={t("fields.active")}
          hint={t("fields.activeHint")}
          defaultChecked={values.isActive}
        />
        <div className="md:max-w-xs">
          <TextField
            id="service-sort-order"
            name="sortOrder"
            label={t("fields.sortOrder")}
            hint={t("fields.sortOrderHint")}
            inputMode="numeric"
            autoComplete="off"
            defaultValue={values.sortOrder}
            error={errorOf("sortOrder")}
          />
        </div>
      </FormSection>

      <div className="border-t border-border px-5 pb-6 md:px-8">
        <FormAlert message={formMessage} tone="danger" resultKey={resultKey} />
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            type="submit"
            aria-disabled={pending || undefined}
            onClick={holdWhilePending}
            className="inline-flex min-h-touch items-center justify-center gap-2 rounded-full bg-brand-600 px-6 text-sm font-semibold whitespace-nowrap text-on-brand transition-[background-color,transform] duration-150 ease-out-quart hover:bg-brand-700 active:scale-[0.98] active:bg-brand-800 aria-disabled:cursor-progress aria-disabled:bg-brand-700 aria-disabled:active:scale-100"
          >
            {pending ? <LoaderCircle className="size-4.5 shrink-0 animate-spin" aria-hidden="true" /> : null}
            {pending ? t("pending") : t(mode === "create" ? "submitCreate" : "submitEdit")}
          </button>
          <ButtonLink href="/admin/services" variant="secondary">
            {t("cancel")}
          </ButtonLink>
        </div>
      </div>
    </form>
  );
}
