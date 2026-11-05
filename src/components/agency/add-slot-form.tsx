"use client";

import { LoaderCircle, Plus } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useActionState, useState, type MouseEvent } from "react";
import { SelectField, useResultKey } from "@/components/admin/form-fields";
import { TextField } from "@/components/auth/form-controls";
import { useRouter } from "@/i18n/navigation";
import type { AgencyFailureKey } from "@/lib/agency/actions";
import type { AgencyAction } from "./agency-action";
import { formatJakartaDay, formatJakartaTime } from "@/lib/catalog/slots-days";
import { ActionFeedback } from "./action-feedback";
import { jakartaDateOf, slotWindowInput, weekOfSlot } from "./schedule-time";
import { primaryButton } from "./styles";

type AddSlotFormProps = {
  /** The agency's own areas, with their names in this language. */
  areas: readonly { id: string; name: string }[];
  /** The area the list shows, if one is chosen: the form starts on it. */
  areaFilter: string | null;
  /** Today in Jakarta and the last day a window may start, as YYYY-MM-DD. */
  minDate: string;
  maxDate: string;
  /** addSlot, passed in by the server page. */
  addSlot: AgencyAction;
};

type Added = { areaId: string; startsAt: string; endsAt: string };
type State = { formError?: AgencyFailureKey | "areaMissing"; added?: Added } | null;

// "Tambah jendela" on the schedule (T27): one of the agency's areas, a date, a start and end time in
// Jakarta time, and how many cleaners it can send. The fields are kept as they are after each answer,
// so a refused window is fixed rather than typed again, and the next window is often the same area on
// another day. The window is written as ISO times with +07:00 here (./schedule-time.ts); addSlot checks
// the role, every field and the agency's own area on the server, and every refusal comes back as words.
// A window that ends before it starts is said at once, without asking the server. After adding, the list
// moves to the week the window falls in, so the agency sees it there.
// Source: https://react.dev/reference/react/useActionState
export function AddSlotForm({ areas, areaFilter, minDate, maxDate, addSlot }: AddSlotFormProps) {
  const t = useTranslations("AgencySchedulePage.form");
  const tError = useTranslations("AgencyErrors");
  const locale = useLocale();
  const router = useRouter();
  const [areaId, setAreaId] = useState(areaFilter ?? (areas.length === 1 ? areas[0].id : ""));
  const [date, setDate] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [capacity, setCapacity] = useState("1");

  const [state, formAction, pending] = useActionState(async (previous: State, formData: FormData): Promise<State> => {
    void previous;
    if (!areaId) return { formError: "areaMissing" };
    const window = slotWindowInput(date, start, end);
    if (!window.ok) return { formError: "windowInvalid" };
    formData.set("startsAt", window.startsAt);
    formData.set("endsAt", window.endsAt);
    const result = await addSlot(null, formData);
    if (!result?.ok) return { formError: result?.formError ?? "unavailable" };
    const added = { areaId, startsAt: window.startsAt, endsAt: window.endsAt };
    const week = weekOfSlot(window.startsAt, new Date());
    router.replace({ pathname: "/agency/schedule", query: areaFilter ? { week: String(week), area: areaFilter } : { week: String(week) } }, { scroll: false });
    return { added };
  }, null);
  const resultKey = useResultKey(state);

  const error = state?.formError ? (state.formError === "areaMissing" ? t("areaMissing") : tError(state.formError)) : undefined;
  const added = state?.added;
  const done = added
    ? t("added", {
        ...formatJakartaDay(jakartaDateOf(added.startsAt), locale),
        start: formatJakartaTime(added.startsAt, locale),
        end: formatJakartaTime(added.endsAt, locale),
        area: areas.find((area) => area.id === added.areaId)?.name ?? added.areaId,
      })
    : undefined;

  // A second click while adding would send the same window again; the button keeps its focus.
  function holdWhilePending(event: MouseEvent<HTMLButtonElement>) {
    if (pending) event.preventDefault();
  }

  return (
    <form
      action={formAction}
      noValidate
      aria-labelledby="add-slot-title"
      aria-describedby="add-slot-description"
      className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5 md:p-6"
    >
      <header className="flex flex-col gap-1">
        <h2 id="add-slot-title" className="font-display text-lg font-semibold text-ink">
          {t("title")}
        </h2>
        <p id="add-slot-description" className="max-w-prose text-sm text-ink-muted">
          {t("description")} {t("timeHint")}
        </p>
      </header>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-[minmax(0,1.2fr)_minmax(10.5rem,1.3fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.7fr)_auto] xl:items-end">
        <SelectField
          id="slot-area"
          name="areaId"
          label={t("area")}
          placeholder={t("areaPlaceholder")}
          options={areas.map((area) => ({ value: area.id, label: area.name }))}
          value={areaId}
          onChange={(event) => setAreaId(event.target.value)}
        />
        <TextField id="slot-date" type="date" label={t("date")} min={minDate} max={maxDate} value={date} onChange={(event) => setDate(event.target.value)} />
        <TextField id="slot-start" type="time" label={t("start")} value={start} onChange={(event) => setStart(event.target.value)} />
        <TextField id="slot-end" type="time" label={t("end")} value={end} onChange={(event) => setEnd(event.target.value)} />
        <TextField
          id="slot-capacity"
          name="capacity"
          type="number"
          inputMode="numeric"
          min={1}
          max={20}
          label={t("capacity")}
          aria-describedby="slot-capacity-hint"
          value={capacity}
          onChange={(event) => setCapacity(event.target.value)}
        />
        <button type="submit" onClick={holdWhilePending} aria-disabled={pending || undefined} className={`${primaryButton} h-12`}>
          {pending ? <LoaderCircle className="size-4 shrink-0 animate-spin" aria-hidden="true" /> : <Plus className="size-4 shrink-0" aria-hidden="true" />}
          {pending ? t("pending") : t("submit")}
        </button>
      </div>
      <p id="slot-capacity-hint" className="px-1 text-sm text-ink-faint">
        {t("capacityHint")}
      </p>
      <ActionFeedback error={error} done={done} resultKey={resultKey} />
    </form>
  );
}
