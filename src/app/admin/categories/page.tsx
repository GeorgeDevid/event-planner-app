"use client";

import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { AdminHeader } from "@/components/admin/ui";
import { useMe } from "@/components/shell/role-gate";
import { Button } from "@/components/ui/button";
import { FormAlert, TextField } from "@/components/ui/field";
import { Switch } from "@/components/ui/kit";
import { errorMessage } from "@/lib/errors";

/** A-05: service categories. */
export default function AdminCategories() {
  const me = useMe();
  const categories = useQuery(api.adminCategories.list);
  const create = useMutation(api.adminCategories.create);
  const rename = useMutation(api.adminCategories.rename);
  const setActive = useMutation(api.adminCategories.setActive);
  const move = useMutation(api.adminCategories.move);
  const remove = useMutation(api.adminCategories.remove);
  const [newName, setNewName] = useState("");
  const [editing, setEditing] = useState<{ id: Id<"categories">; name: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const can = (p: string) => me.permissions.includes(p as never);

  const run = async (fn: () => Promise<unknown>) => {
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <AdminHeader
        title="Service"
        accent="categories"
        description="What clients can search for and vendors can offer. A category in use can't be deleted, only deactivated."
      />
      {error ? <FormAlert>{error}</FormAlert> : null}

      {can("categories:create") ? (
        <form
          className="flex items-end gap-2 rounded-[20px] bg-surface p-4 shadow-card"
          onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              await create({ name: newName });
              setNewName("");
            });
          }}
        >
          <TextField id="new-category" label="New category" className="flex-1" value={newName} onChange={(e) => setNewName(e.target.value)} />
          <Button type="submit" variant="gold" disabled={newName.trim().length < 2}>Add category</Button>
        </form>
      ) : null}

      <ol className="flex flex-col gap-2">
        {categories === undefined ? (
          <li className="rounded-[20px] bg-surface p-5 text-sm text-ink-2 shadow-card">Loading…</li>
        ) : (
          categories.map((c, i) => (
            <li key={c._id} className={`flex flex-wrap items-center gap-3 rounded-[20px] p-4 shadow-card ${c.active ? "bg-surface" : "bg-surface-2"}`}>
              {can("categories:edit") ? (
                <span className="flex flex-col">
                  <button type="button" aria-label={`Move ${c.name} up`} disabled={i === 0} onClick={() => run(() => move({ categoryId: c._id, direction: "up" }))} className="flex size-8 items-center justify-center rounded-full hover:bg-surface-2 disabled:opacity-30">
                    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M6 15l6-6 6 6" /></svg>
                  </button>
                  <button type="button" aria-label={`Move ${c.name} down`} disabled={i === categories.length - 1} onClick={() => run(() => move({ categoryId: c._id, direction: "down" }))} className="flex size-8 items-center justify-center rounded-full hover:bg-surface-2 disabled:opacity-30">
                    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>
                  </button>
                </span>
              ) : null}

              <div className="min-w-[180px] flex-1">
                {editing?.id === c._id ? (
                  <form
                    className="flex items-end gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void run(async () => {
                        await rename({ categoryId: c._id, name: editing.name });
                        setEditing(null);
                      });
                    }}
                  >
                    <TextField id={`rename-${c._id}`} label="Name" className="flex-1" value={editing.name} onChange={(e) => setEditing({ id: c._id, name: e.target.value })} autoFocus />
                    <Button type="submit">Save</Button>
                    <Button type="button" variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
                  </form>
                ) : (
                  <>
                    <p className="font-semibold">
                      {c.name}
                      {!c.active ? <span className="ml-2 text-xs font-semibold text-ink-2">Inactive</span> : null}
                    </p>
                    <p className="text-xs text-ink-2">
                      {c.vendorCount} vendor{c.vendorCount === 1 ? "" : "s"}
                    </p>
                  </>
                )}
              </div>

              {editing?.id !== c._id ? (
                <div className="flex flex-wrap items-center gap-2">
                  {can("categories:edit") ? (
                    <>
                      <Button type="button" variant="ghost" className="min-h-10 px-3 text-sm" onClick={() => setEditing({ id: c._id, name: c.name })}>
                        Rename<span className="sr-only"> {c.name}</span>
                      </Button>
                      <div className="w-40">
                        <Switch checked={c.active} onChange={(active) => run(() => setActive({ categoryId: c._id, active }))} label={c.active ? "Active" : "Inactive"} />
                      </div>
                    </>
                  ) : null}
                  {can("categories:delete") ? (
                    <span title={c.vendorCount > 0 ? `In use by ${c.vendorCount} vendors — deactivate instead` : undefined}>
                      <Button
                        type="button"
                        variant="ghost"
                        className="min-h-10 px-3 text-sm text-danger"
                        disabled={c.vendorCount > 0}
                        aria-describedby={c.vendorCount > 0 ? `in-use-${c._id}` : undefined}
                        onClick={() => {
                          if (window.confirm(`Delete ${c.name}? This can't be undone.`)) void run(() => remove({ categoryId: c._id }));
                        }}
                      >
                        Delete<span className="sr-only"> {c.name}</span>
                      </Button>
                      {c.vendorCount > 0 ? (
                        <span id={`in-use-${c._id}`} className="sr-only">
                          In use by {c.vendorCount} vendors; deactivate instead.
                        </span>
                      ) : null}
                    </span>
                  ) : null}
                </div>
              ) : null}
            </li>
          ))
        )}
      </ol>
    </div>
  );
}
