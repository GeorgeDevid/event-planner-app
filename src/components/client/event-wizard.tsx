"use client";

import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { LocationField, type Place } from "@/components/client/location-field";
import { useQueryState } from "@/components/client/vendor-results";
import { Button } from "@/components/ui/button";
import { FormAlert, TextField } from "@/components/ui/field";
import { PageHeader, Segmented, Stepper } from "@/components/ui/kit";
import { FullPageLoader } from "@/components/ui/loader";
import { errorField, errorMessage } from "@/lib/errors";
import { parseDollars, torontoTodayIso } from "@/lib/format";

type EventTypes = FunctionReturnType<typeof api.catalog.eventTypes>;
type EventType = EventTypes[number];
type EventData = NonNullable<FunctionReturnType<typeof api.events.get>>;
type Step = "type" | "basics" | "questions" | "services";

const STEP_LABEL: Record<Step, string> = {
  type: "Event type",
  basics: "The basics",
  questions: "A few questions",
  services: "Services",
};

function stepsFor(type: Pick<EventType, "questions" | "subFunctions"> | null | undefined): Step[] {
  const hasQuestions = !!type && (type.questions.length > 0 || type.subFunctions.length > 0);
  return ["type", "basics", ...(hasQuestions ? (["questions"] as const) : []), "services"];
}

/**
 * Create or edit an event (C-04 to C-06). The step and the chosen type live in
 * the URL. The event is saved as a draft after "The basics", so the client can
 * leave and continue later; finishing "Services" makes it active.
 */
export function EventWizard({ eventId }: { eventId?: Id<"events"> }) {
  const router = useRouter();
  const [params, setParams] = useQueryState();
  const types = useQuery(api.catalog.eventTypes);
  const event = useQuery(api.events.get, eventId ? { eventId } : "skip");

  if (types === undefined || (eventId && event === undefined)) return <FullPageLoader />;
  if (eventId && !event) {
    return <p className="p-6 text-sm text-ink-2">This event isn&apos;t available.</p>;
  }

  const typeId = (params.get("type") as Id<"eventTypes"> | null) ?? event?.eventType?._id ?? null;
  const type = types.find((t) => t._id === typeId) ?? null;
  const steps = stepsFor(type);
  const requested = params.get("step") as Step | null;
  const step: Step = requested && steps.includes(requested) ? requested : eventId ? "basics" : "type";
  // Changing an active event's type resets its questions and services, so
  // walk through the rest of the steps again instead of returning early.
  const retyped = !!event && !!typeId && typeId !== event.eventType?._id;
  const fullFlow = params.get("flow") === "full";
  const editing = event?.status === "active" && !retyped && !fullFlow;
  const index = steps.indexOf(step);

  const go = (next: Step) => setParams({ step: next });
  const done = (id: Id<"events">) => router.push(`/app/events/${id}`);
  const after = (current: Step, id: Id<"events">) => {
    const next = stepsFor(type)[stepsFor(type).indexOf(current) + 1];
    if (editing || !next) done(id);
    else router.replace(`/app/events/${id}/setup?step=${next}${event?.status === "active" ? "&flow=full" : ""}`);
  };

  const backHref = eventId ? (editing ? `/app/events/${eventId}` : "/app/events") : "/app";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={editing ? `Edit ${event?.name ?? "event"}` : eventId ? "Finish your event" : "Plan an event"}
        backHref={backHref}
      />
      {!editing ? <Stepper step={index + 1} total={steps.length} label={STEP_LABEL[step]} /> : null}

      {step === "type" ? (
        <TypeStep
          types={types}
          value={typeId}
          changing={!!event}
          onPick={(id) => setParams({ type: id, step: "basics" })}
        />
      ) : null}
      {step === "basics" && type ? (
        <BasicsStep
          key={type._id}
          type={type}
          event={event ?? null}
          onChangeType={() => go("type")}
          onSaved={(id) => after("basics", id)}
          editing={editing}
        />
      ) : null}
      {step === "basics" && !type ? (
        <Button type="button" onClick={() => go("type")}>Choose an event type</Button>
      ) : null}
      {step === "questions" && event && event.eventType ? (
        <QuestionsStep event={event} onSaved={() => after("questions", event._id)} editing={editing} />
      ) : null}
      {step === "services" && event ? (
        <ServicesStep event={event} onSaved={() => done(event._id)} editing={editing} />
      ) : null}
      {(step === "questions" || step === "services") && !event ? (
        <Button type="button" onClick={() => go("basics")}>Start with the basics</Button>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------

function TypeStep({
  types,
  value,
  changing,
  onPick,
}: {
  types: EventTypes;
  value: Id<"eventTypes"> | null;
  changing: boolean;
  onPick: (id: Id<"eventTypes">) => void;
}) {
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="text-[22px] font-bold tracking-tight">What are you planning?</legend>
      {changing ? (
        <p className="text-sm text-ink-2">Changing the type resets the event questions and the services list.</p>
      ) : null}
      <div className="mt-2 grid grid-cols-2 gap-3">
        {types.map((t) => (
          <button
            key={t._id}
            type="button"
            aria-pressed={t._id === value}
            onClick={() => onPick(t._id)}
            className={`flex min-h-24 flex-col justify-end rounded-[20px] p-4 text-left shadow-card transition-colors ${
              t._id === value ? "bg-navy-900 text-white" : "bg-surface text-navy-900 hover:bg-surface-2"
            }`}
          >
            <span className="font-display text-[22px] leading-none font-bold">{t.name}</span>
            <span className={`mt-1 text-xs ${t._id === value ? "text-on-navy-2" : "text-ink-2"}`}>
              {t.defaultCategorySlugs.length > 0 ? `${t.defaultCategorySlugs.length} suggested services` : "Pick your own services"}
            </span>
          </button>
        ))}
      </div>
    </fieldset>
  );
}

// ---------------------------------------------------------------------------

function BasicsStep({
  type,
  event,
  onChangeType,
  onSaved,
  editing,
}: {
  type: EventType;
  event: EventData | null;
  onChangeType: () => void;
  onSaved: (id: Id<"events">) => void;
  editing: boolean;
}) {
  const save = useMutation(api.events.saveBasics);
  const [name, setName] = useState(event?.name ?? "");
  const [date, setDate] = useState(event?.date ?? "");
  const [place, setPlace] = useState<Place | null>(
    event?.address && event.location ? { address: event.address, ...event.location } : null,
  );
  const [guests, setGuests] = useState(event?.guestCount ? String(event.guestCount) : "");
  const [min, setMin] = useState(event?.budgetMinCents != null ? String(event.budgetMinCents / 100) : "");
  const [max, setMax] = useState(event?.budgetMaxCents != null ? String(event.budgetMaxCents / 100) : "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const today = torontoTodayIso();

  async function submit() {
    setFormError(null);
    const next: Record<string, string> = {};
    if (!date) next.date = "Choose the event date.";
    else if (date < today) next.date = "The date can't be in the past.";
    if (!place) next.address = "Pick the event location from the suggestions.";
    const guestCount = Number(guests);
    if (!guests.trim()) next.guestCount = "Enter how many guests you expect.";
    else if (!Number.isInteger(guestCount) || guestCount < 1) next.guestCount = "Enter a whole number of 1 or more.";
    const minCents = min.trim() ? parseDollars(min) : null;
    const maxCents = max.trim() ? parseDollars(max) : null;
    if (min.trim() && minCents === null) next.budgetMin = "Enter an amount in dollars.";
    if (max.trim() && maxCents === null) next.budgetMax = "Enter an amount in dollars.";
    if (minCents !== null && maxCents !== null && minCents > maxCents) next.budgetMin = "The minimum can't be more than the maximum.";
    setErrors(next);
    if (Object.keys(next).length > 0 || !place) return;

    setPending(true);
    try {
      const id = await save({
        eventId: event?._id,
        eventTypeId: type._id,
        name: name.trim() || undefined,
        date,
        address: place.address,
        lat: place.lat,
        lng: place.lng,
        guestCount,
        budgetMinCents: minCents ?? undefined,
        budgetMaxCents: maxCents ?? undefined,
      });
      onSaved(id);
    } catch (err) {
      const field = errorField(err);
      if (field) setErrors({ [field]: errorMessage(err) });
      else setFormError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      noValidate
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <div className="flex items-center justify-between gap-3 rounded-[20px] bg-surface-2 px-4 py-3">
        <p className="text-sm">
          <span className="text-ink-2">Event type: </span>
          <span className="font-semibold">{type.name}</span>
        </p>
        <button type="button" onClick={onChangeType} className="min-h-11 px-2 text-sm font-semibold text-gold-text">
          Change
        </button>
      </div>
      {formError ? <FormAlert>{formError}</FormAlert> : null}
      <TextField
        id="event-name"
        label="Event name (optional)"
        placeholder={`My ${type.name.toLowerCase()}`}
        maxLength={80}
        value={name}
        error={errors.name}
        onChange={(e) => setName(e.target.value)}
      />
      <TextField
        id="event-date"
        label="Date"
        type="date"
        min={today}
        required
        value={date}
        error={errors.date}
        helper={type.subFunctions.length > 0 ? "The main day. You can add dates for each function next." : undefined}
        onChange={(e) => setDate(e.target.value)}
      />
      <LocationField
        id="event-location"
        label="Event location"
        pinLabel="Event location"
        value={place}
        onChange={setPlace}
        error={errors.address}
        helper="We use this to find vendors near your event."
      />
      <TextField
        id="event-guests"
        label="Guest count"
        inputMode="numeric"
        required
        value={guests}
        error={errors.guestCount}
        onChange={(e) => setGuests(e.target.value.replace(/[^\d]/g, ""))}
      />
      <fieldset className="flex flex-col gap-2">
        <legend className="text-xs font-semibold text-ink-2">Budget range in CAD (optional)</legend>
        <div className="flex gap-3">
          <TextField id="budget-min" label="Min" inputMode="decimal" className="flex-1" value={min} error={errors.budgetMin} onChange={(e) => setMin(e.target.value)} />
          <TextField id="budget-max" label="Max" inputMode="decimal" className="flex-1" value={max} error={errors.budgetMax} onChange={(e) => setMax(e.target.value)} />
        </div>
        <p className="text-[13px] text-ink-2">Used to pre-filter vendors by their average price.</p>
      </fieldset>
      <Button type="submit" disabled={pending} className="mt-2">
        {pending ? "Saving…" : editing ? "Save changes" : "Next"}
      </Button>
    </form>
  );
}

// ---------------------------------------------------------------------------

type FunctionRow = { name: string; date: string; guests: string; venue: string };

function QuestionsStep({ event, onSaved, editing }: { event: EventData; onSaved: () => void; editing: boolean }) {
  const save = useMutation(api.events.saveDetails);
  const type = event.eventType!;
  const [answers, setAnswers] = useState<Record<string, unknown>>(event.answers ?? {});
  const [rows, setRows] = useState<FunctionRow[]>(
    event.functions.map((f) => ({
      name: f.name,
      date: f.date ?? "",
      guests: f.guestCount ? String(f.guestCount) : "",
      venue: f.venue ?? "",
    })),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const today = torontoTodayIso();

  const toggleFunction = (name: string) =>
    setRows((r) => (r.some((x) => x.name === name) ? r.filter((x) => x.name !== name) : [...r, { name, date: "", guests: "", venue: "" }]));
  const updateRow = (name: string, patch: Partial<FunctionRow>) =>
    setRows((r) => r.map((x) => (x.name === name ? { ...x, ...patch } : x)));
  const ordered = type.subFunctions.filter((n) => rows.some((r) => r.name === n)).map((n) => rows.find((r) => r.name === n)!);

  async function submit() {
    setFormError(null);
    const next: Record<string, string> = {};
    for (const q of type.questions) {
      const v = answers[q.key];
      if (q.required && (v === undefined || v === "" || (Array.isArray(v) && v.length === 0))) next[q.key] = "Please answer this.";
    }
    if (type.subFunctions.length > 0 && rows.length === 0) next.functions = "Pick at least one function.";
    ordered.forEach((r, i) => {
      if (r.date && r.date < today) next[`functions.${i}.date`] = "Can't be in the past.";
      if (r.guests && (!Number.isInteger(Number(r.guests)) || Number(r.guests) < 1)) next[`functions.${i}.guestCount`] = "1 or more.";
    });
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    setPending(true);
    try {
      await save({
        eventId: event._id,
        answers,
        functions: ordered.map((r) => ({
          name: r.name,
          date: r.date || undefined,
          guestCount: r.guests ? Number(r.guests) : undefined,
          venue: r.venue.trim() || undefined,
        })),
      });
      onSaved();
    } catch (err) {
      const field = errorField(err);
      if (field) setErrors({ [field]: errorMessage(err) });
      else setFormError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      noValidate
      className="flex flex-col gap-6"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <h2 className="text-[22px] font-bold tracking-tight">About your {type.name.toLowerCase()}</h2>
      {formError ? <FormAlert>{formError}</FormAlert> : null}

      {type.subFunctions.length > 0 ? (
        <fieldset className="flex flex-col gap-3" aria-describedby={errors.functions ? "functions-error" : undefined}>
          <legend className="text-[15px] font-semibold">Which functions are you planning?</legend>
          <div className="mt-1 flex flex-wrap gap-2">
            {type.subFunctions.map((name) => {
              const on = rows.some((r) => r.name === name);
              return (
                <label
                  key={name}
                  className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-full px-4 text-sm font-semibold has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-gold-text ${
                    on ? "bg-navy-900 text-white" : "bg-surface text-navy-900 shadow-card"
                  }`}
                >
                  <input type="checkbox" className="sr-only" checked={on} onChange={() => toggleFunction(name)} />
                  {on ? "✓ " : ""}
                  {name}
                </label>
              );
            })}
          </div>
          {errors.functions ? <p id="functions-error" className="text-[13px] font-medium text-danger">{errors.functions}</p> : null}
          {ordered.map((r, i) => (
            <div key={r.name} className="flex flex-col gap-3 rounded-[20px] bg-surface p-4 shadow-card">
              <p className="font-semibold">{r.name}</p>
              <div className="flex gap-3">
                <TextField id={`fn-${i}-date`} label="Date" type="date" min={today} className="flex-1" value={r.date} error={errors[`functions.${i}.date`]} onChange={(e) => updateRow(r.name, { date: e.target.value })} />
                <TextField id={`fn-${i}-guests`} label="Guests" inputMode="numeric" className="w-28" value={r.guests} error={errors[`functions.${i}.guestCount`]} onChange={(e) => updateRow(r.name, { guests: e.target.value.replace(/[^\d]/g, "") })} />
              </div>
              <TextField id={`fn-${i}-venue`} label="Venue (optional)" maxLength={120} value={r.venue} error={errors[`functions.${i}.venue`]} onChange={(e) => updateRow(r.name, { venue: e.target.value })} />
            </div>
          ))}
        </fieldset>
      ) : null}

      {type.questions.map((q) => (
        <QuestionInput
          key={q.key}
          question={q}
          value={answers[q.key]}
          error={errors[q.key]}
          onChange={(v) => setAnswers((a) => ({ ...a, [q.key]: v }))}
        />
      ))}

      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : editing ? "Save changes" : "Next"}
      </Button>
    </form>
  );
}

function QuestionInput({
  question: q,
  value,
  error,
  onChange,
}: {
  question: EventType["questions"][number];
  value: unknown;
  error?: string;
  onChange: (v: unknown) => void;
}) {
  const label = `${q.label}${q.required ? "" : " (optional)"}`;
  const id = `q-${q.key}`;
  const errorNode = error ? <p className="text-[13px] font-medium text-danger">{error}</p> : null;

  if (q.type === "yes_no") {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-[15px] font-semibold" id={`${id}-label`}>{label}</p>
        <Segmented
          label={q.label}
          value={value === true ? "yes" : value === false ? "no" : ("" as "yes")}
          onChange={(v) => onChange(v === "yes")}
          options={[{ value: "yes", label: "Yes" }, { value: "no", label: "No" }]}
        />
        {errorNode}
      </div>
    );
  }
  if (q.type === "single_choice" || q.type === "multi_choice") {
    const multi = q.type === "multi_choice";
    const selected = multi ? ((value as string[] | undefined) ?? []) : value ? [value as string] : [];
    return (
      <fieldset className="flex flex-col gap-2">
        <legend className="text-[15px] font-semibold">{label}</legend>
        <div className="mt-1 flex flex-wrap gap-2">
          {(q.options ?? []).map((o) => {
            const on = selected.includes(o);
            return (
              <label
                key={o}
                className={`flex min-h-11 cursor-pointer items-center rounded-full px-4 text-sm font-semibold has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-gold-text ${
                  on ? "bg-navy-900 text-white" : "bg-surface text-navy-900 shadow-card"
                }`}
              >
                <input
                  type={multi ? "checkbox" : "radio"}
                  name={id}
                  className="sr-only"
                  checked={on}
                  onChange={() =>
                    onChange(multi ? (on ? selected.filter((x) => x !== o) : [...selected, o]) : o)
                  }
                />
                {o}
              </label>
            );
          })}
        </div>
        {errorNode}
      </fieldset>
    );
  }
  return (
    <TextField
      id={id}
      label={label}
      type={q.type === "date" ? "date" : "text"}
      inputMode={q.type === "number" ? "numeric" : undefined}
      value={value === undefined || value === null ? "" : String(value)}
      error={error}
      maxLength={200}
      onChange={(e) => {
        const raw = e.target.value;
        if (q.type === "number") onChange(raw === "" ? undefined : Number(raw.replace(/[^\d.]/g, "")));
        else onChange(raw === "" ? undefined : raw);
      }}
    />
  );
}

// ---------------------------------------------------------------------------

function ServicesStep({ event, onSaved, editing }: { event: EventData; onSaved: () => void; editing: boolean }) {
  const categories = useQuery(api.catalog.categories);
  const save = useMutation(api.events.setServices);
  const [selected, setSelected] = useState<Id<"categories">[]>(event.selectedCategoryIds);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (!categories) return <p className="text-sm text-ink-2">Loading…</p>;

  return (
    <form
      noValidate
      className="flex flex-col gap-5"
      onSubmit={async (e) => {
        e.preventDefault();
        setError(null);
        if (selected.length === 0) {
          setError("Choose at least one service.");
          return;
        }
        setPending(true);
        try {
          await save({ eventId: event._id, categoryIds: selected });
          onSaved();
        } catch (err) {
          setError(errorMessage(err));
        } finally {
          setPending(false);
        }
      }}
    >
      <div>
        <h2 className="text-[22px] font-bold tracking-tight">What do you need?</h2>
        <p className="mt-1 text-sm text-ink-2">
          We&apos;ve ticked what a {event.eventType?.name.toLowerCase() ?? "event"} usually needs. Change anything.
        </p>
      </div>
      {error ? <FormAlert>{error}</FormAlert> : null}
      <fieldset>
        <legend className="sr-only">Services</legend>
        <ul className="flex flex-col gap-2">
          {categories.map((c) => {
            const on = selected.includes(c._id);
            return (
              <li key={c._id}>
                <label className="flex min-h-14 cursor-pointer items-center gap-4 rounded-[20px] bg-surface px-4 shadow-card has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-gold-text">
                  <input
                    type="checkbox"
                    className="peer sr-only"
                    checked={on}
                    onChange={() => setSelected((s) => (on ? s.filter((x) => x !== c._id) : [...s, c._id]))}
                  />
                  <span
                    aria-hidden="true"
                    className={`flex size-6 shrink-0 items-center justify-center rounded-lg border-2 ${on ? "border-navy-900 bg-navy-900 text-white" : "border-control"}`}
                  >
                    {on ? (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5 9-10" /></svg>
                    ) : null}
                  </span>
                  <span className="flex-1 text-[15px] font-semibold">{c.name}</span>
                </label>
              </li>
            );
          })}
        </ul>
      </fieldset>
      <p className="text-sm text-ink-2" aria-live="polite">
        {selected.length} {selected.length === 1 ? "service" : "services"} selected
      </p>
      <Button type="submit" variant="gold" disabled={pending}>
        {pending ? "Saving…" : editing ? "Save services" : "Finish and see vendors"}
      </Button>
    </form>
  );
}
