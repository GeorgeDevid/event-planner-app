"use client";

import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useState } from "react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { AdminHeader, Drawer } from "@/components/admin/ui";
import { useMe } from "@/components/shell/role-gate";
import { Button } from "@/components/ui/button";
import { FormAlert, TextField } from "@/components/ui/field";
import { Switch } from "@/components/ui/kit";
import { errorMessage } from "@/lib/errors";

type Data = FunctionReturnType<typeof api.adminEventTypes.list>;
type EventType = Data["types"][number];
type QType = EventType["questions"][number]["type"];
type DraftQuestion = { key?: string; label: string; type: QType; options: string; required: boolean };

const TYPE_LABEL: Record<QType, string> = {
  text: "Text",
  number: "Number",
  date: "Date",
  single_choice: "Single choice",
  multi_choice: "Multiple choice",
  yes_no: "Yes / No",
};

/** A-06: event types, their questions, sub-functions and default services. */
export default function EventTypesPage() {
  const me = useMe();
  const data = useQuery(api.adminEventTypes.list);
  const create = useMutation(api.adminEventTypes.create);
  const setActive = useMutation(api.adminEventTypes.setActive);
  const move = useMutation(api.adminEventTypes.move);
  const remove = useMutation(api.adminEventTypes.remove);
  const [newName, setNewName] = useState("");
  const [editing, setEditing] = useState<Id<"eventTypes"> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const can = (p: string) => me.permissions.includes(p as never);
  const run = async (fn: () => Promise<unknown>) => {
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  if (data === undefined) return <p className="text-sm text-ink-2">Loading…</p>;
  const current = data.types.find((t) => t._id === editing) ?? null;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <AdminHeader title="Event" accent="types" description="What clients can plan, the questions each type asks, and the services ticked by default. Changes apply to new events right away." />
      {error ? <FormAlert>{error}</FormAlert> : null}
      {can("eventTypes:create") ? (
        <form
          className="flex items-end gap-2 rounded-[20px] bg-surface p-4 shadow-card"
          onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              const id = await create({ name: newName });
              setNewName("");
              setEditing(id);
            });
          }}
        >
          <TextField id="new-type" label="New event type" placeholder="e.g. Housewarming" className="flex-1" value={newName} onChange={(e) => setNewName(e.target.value)} />
          <Button type="submit" variant="gold" disabled={newName.trim().length < 2}>Add</Button>
        </form>
      ) : null}

      <ol className="flex flex-col gap-2">
        {data.types.map((t, i) => (
          <li key={t._id} className={`flex flex-wrap items-center gap-3 rounded-[20px] p-4 shadow-card ${t.active ? "bg-surface" : "bg-surface-2"}`}>
            {can("eventTypes:edit") ? (
              <span className="flex flex-col">
                <button type="button" aria-label={`Move ${t.name} up`} disabled={i === 0} onClick={() => run(() => move({ eventTypeId: t._id, direction: "up" }))} className="flex size-8 items-center justify-center rounded-full hover:bg-surface-2 disabled:opacity-30">▲</button>
                <button type="button" aria-label={`Move ${t.name} down`} disabled={i === data.types.length - 1} onClick={() => run(() => move({ eventTypeId: t._id, direction: "down" }))} className="flex size-8 items-center justify-center rounded-full hover:bg-surface-2 disabled:opacity-30">▼</button>
              </span>
            ) : null}
            <div className="min-w-[180px] flex-1">
              <p className="font-semibold">
                {t.name}
                {!t.active ? <span className="ml-2 text-xs text-ink-2">Inactive</span> : null}
              </p>
              <p className="text-xs text-ink-2">
                {t.questions.length} questions · {t.subFunctions.length} functions · {t.defaultCategorySlugs.length} default services · {t.eventCount} events
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="secondary" className="min-h-10 px-4 text-sm" onClick={() => setEditing(t._id)}>
                {can("eventTypes:edit") ? "Edit" : "View"}<span className="sr-only"> {t.name}</span>
              </Button>
              {can("eventTypes:edit") ? (
                <div className="w-36">
                  <Switch checked={t.active} label={t.active ? "Active" : "Inactive"} onChange={(active) => run(() => setActive({ eventTypeId: t._id, active }))} />
                </div>
              ) : null}
              {can("eventTypes:delete") ? (
                <Button
                  type="button"
                  variant="ghost"
                  className="min-h-10 px-3 text-sm text-danger"
                  disabled={t.eventCount > 0}
                  title={t.eventCount > 0 ? "In use: deactivate it instead" : undefined}
                  onClick={() => {
                    if (window.confirm(`Delete ${t.name}?`)) void run(() => remove({ eventTypeId: t._id }));
                  }}
                >
                  Delete<span className="sr-only"> {t.name}</span>
                </Button>
              ) : null}
            </div>
          </li>
        ))}
      </ol>

      <Drawer open={current !== null} onClose={() => setEditing(null)} title={current ? current.name : "Event type"}>
        {current ? (
          <Builder key={current._id} type={current} categories={data.categories} readOnly={!can("eventTypes:edit")} onSaved={() => setEditing(null)} />
        ) : null}
      </Drawer>
    </div>
  );
}

function Builder({
  type,
  categories,
  readOnly,
  onSaved,
}: {
  type: EventType;
  categories: Data["categories"];
  readOnly: boolean;
  onSaved: () => void;
}) {
  const save = useMutation(api.adminEventTypes.save);
  const [name, setName] = useState(type.name);
  const [questions, setQuestions] = useState<DraftQuestion[]>(
    type.questions.map((q) => ({ key: q.key, label: q.label, type: q.type, options: (q.options ?? []).join("\n"), required: q.required })),
  );
  const [functions, setFunctions] = useState(type.subFunctions.join("\n"));
  const [defaults, setDefaults] = useState(new Set(type.defaultCategorySlugs));
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const update = (i: number, patch: Partial<DraftQuestion>) => setQuestions((qs) => qs.map((q, j) => (j === i ? { ...q, ...patch } : q)));
  const moveQ = (i: number, d: -1 | 1) =>
    setQuestions((qs) => {
      const next = [...qs];
      const j = i + d;
      if (!next[j]) return qs;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  return (
    <form
      className="flex flex-col gap-6"
      onSubmit={async (e) => {
        e.preventDefault();
        if (readOnly) return;
        setError(null);
        setPending(true);
        try {
          await save({
            eventTypeId: type._id,
            name,
            questions: questions.map((q) => ({
              key: q.key,
              label: q.label,
              type: q.type,
              options: q.type === "single_choice" || q.type === "multi_choice" ? q.options.split("\n") : undefined,
              required: q.required,
            })),
            subFunctions: functions.split("\n"),
            defaultCategorySlugs: [...defaults],
          });
          onSaved();
        } catch (err) {
          setError(errorMessage(err));
        } finally {
          setPending(false);
        }
      }}
    >
      {error ? <FormAlert>{error}</FormAlert> : null}
      <fieldset disabled={readOnly} className="flex flex-col gap-6">
        <TextField id="type-name" label="Name" value={name} onChange={(e) => setName(e.target.value)} />

        <section className="flex flex-col gap-3">
          <div>
            <h3 className="text-[15px] font-bold">Questions</h3>
            <p className="text-sm text-ink-2">Asked after the basics (date, location, guests, budget), which every event has.</p>
          </div>
          {questions.length === 0 ? <p className="text-sm text-ink-2">No questions yet.</p> : null}
          <ol className="flex flex-col gap-3">
            {questions.map((q, i) => (
              <li key={q.key ?? `new-${i}`} className="flex flex-col gap-3 rounded-2xl border border-line p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-ink-2">Question {i + 1}</p>
                  <div className="flex gap-1">
                    <button type="button" aria-label={`Move question ${i + 1} up`} disabled={i === 0} onClick={() => moveQ(i, -1)} className="flex size-9 items-center justify-center rounded-full hover:bg-surface-2 disabled:opacity-30">▲</button>
                    <button type="button" aria-label={`Move question ${i + 1} down`} disabled={i === questions.length - 1} onClick={() => moveQ(i, 1)} className="flex size-9 items-center justify-center rounded-full hover:bg-surface-2 disabled:opacity-30">▼</button>
                    <button type="button" onClick={() => setQuestions((qs) => qs.filter((_, j) => j !== i))} className="min-h-9 rounded-full px-3 text-sm font-semibold text-danger hover:bg-danger-bg">Remove</button>
                  </div>
                </div>
                <TextField id={`q-${i}-label`} label="Question" value={q.label} onChange={(e) => update(i, { label: e.target.value })} />
                <div className="flex flex-wrap items-end gap-3">
                  <label className="flex flex-1 flex-col gap-1.5">
                    <span className="text-xs font-semibold text-ink-2">Answer type</span>
                    <select value={q.type} onChange={(e) => update(i, { type: e.target.value as QType })} className="h-11 rounded-full border border-control bg-surface px-4 text-sm">
                      {(Object.keys(TYPE_LABEL) as QType[]).map((t) => (
                        <option key={t} value={t}>{TYPE_LABEL[t]}</option>
                      ))}
                    </select>
                  </label>
                  <label className="flex min-h-11 items-center gap-2 text-sm font-semibold">
                    <input type="checkbox" className="size-5 accent-[var(--color-navy-900)]" checked={q.required} onChange={(e) => update(i, { required: e.target.checked })} />
                    Required
                  </label>
                </div>
                {q.type === "single_choice" || q.type === "multi_choice" ? (
                  <label className="flex flex-col gap-1.5">
                    <span className="text-xs font-semibold text-ink-2">Options, one per line</span>
                    <textarea rows={4} value={q.options} onChange={(e) => update(i, { options: e.target.value })} className="rounded-2xl border border-control px-4 py-2 text-sm" />
                  </label>
                ) : null}
              </li>
            ))}
          </ol>
          {!readOnly ? (
            <Button type="button" variant="secondary" className="self-start" onClick={() => setQuestions((qs) => [...qs, { label: "", type: "text", options: "", required: false }])}>
              Add question
            </Button>
          ) : null}
        </section>

        <section className="flex flex-col gap-2">
          <h3 className="text-[15px] font-bold">Functions</h3>
          <p className="text-sm text-ink-2">Parts of the event that each get their own date, guest count and venue, like the wedding functions. One per line; leave empty if not needed.</p>
          <textarea aria-label="Functions, one per line" rows={5} value={functions} onChange={(e) => setFunctions(e.target.value)} className="rounded-2xl border border-control px-4 py-2 text-sm" />
        </section>

        <section className="flex flex-col gap-2">
          <h3 className="text-[15px] font-bold">Services ticked by default</h3>
          <div className="flex flex-wrap gap-2">
            {categories.map((c) => {
              const on = defaults.has(c.slug);
              return (
                <label key={c.slug} className={`flex min-h-10 cursor-pointer items-center rounded-full px-4 text-sm font-semibold has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-gold-text ${on ? "bg-navy-900 text-white" : "bg-surface-2"}`}>
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={on}
                    onChange={() =>
                      setDefaults((s) => {
                        const next = new Set(s);
                        if (on) next.delete(c.slug);
                        else next.add(c.slug);
                        return next;
                      })
                    }
                  />
                  {c.name}
                  {!c.active ? " (inactive)" : ""}
                </label>
              );
            })}
          </div>
        </section>
      </fieldset>
      {!readOnly ? (
        <Button type="submit" variant="gold" disabled={pending}>{pending ? "Saving…" : "Save event type"}</Button>
      ) : null}
    </form>
  );
}
