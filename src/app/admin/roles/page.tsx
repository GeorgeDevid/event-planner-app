"use client";

import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { api } from "../../../../convex/_generated/api";
import { AdminHeader } from "@/components/admin/ui";
import { useMe } from "@/components/shell/role-gate";
import { Button } from "@/components/ui/button";
import { FormAlert, TextField } from "@/components/ui/field";
import { errorMessage } from "@/lib/errors";

const MODULE_LABEL: Record<string, string> = {
  users: "Users",
  vendors: "Vendors",
  categories: "Categories",
  eventTypes: "Event types",
  events: "Events",
  bookings: "Bookings",
  messages: "Messages",
  reports: "Reports (moderation)",
  content: "Site content",
  roles: "Roles & permissions",
  auditLog: "Audit log",
};
const ACTION_LABEL: Record<string, string> = {
  view: "View",
  create: "Create",
  edit: "Edit",
  delete: "Delete",
  approve: "Approve",
  suspend: "Suspend",
  resetPassword: "Reset password",
};

/** A-10: roles and what each can do. Changes apply on the admin's next action. */
export default function RolesPage() {
  const me = useMe();
  const data = useQuery(api.adminRoles.list);
  const create = useMutation(api.adminRoles.create);
  const [selected, setSelected] = useState("admin");
  const [newName, setNewName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const can = (p: string) => me.permissions.includes(p as never);

  if (data === undefined) return <p className="text-sm text-ink-2">Loading…</p>;
  const role = data.roles.find((r) => r.key === selected) ?? data.roles[0];

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <AdminHeader title="Roles &" accent="permissions" description="Choose a role to see or change what it can do. Changes apply to everyone with that role on their next action." />
      {error ? <FormAlert>{error}</FormAlert> : null}
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <aside className="flex flex-col gap-2 lg:w-64 lg:shrink-0">
          <ul role="tablist" aria-label="Roles" className="flex flex-col gap-2">
            {data.roles.map((r) => (
              <li key={r.key}>
                <button
                  type="button"
                  role="tab"
                  aria-selected={r.key === role.key}
                  onClick={() => setSelected(r.key)}
                  className={`flex min-h-12 w-full items-center justify-between gap-2 rounded-[18px] px-4 text-left text-sm ${
                    r.key === role.key ? "bg-navy-900 text-white" : "bg-surface shadow-card hover:bg-surface-2"
                  }`}
                >
                  <span className="font-semibold">{r.name}</span>
                  <span className={`text-xs ${r.key === role.key ? "text-gold-300" : "text-ink-2"}`}>
                    {r.members} {r.members === 1 ? "admin" : "admins"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {can("roles:create") ? (
            <form
              className="mt-2 flex flex-col gap-2 rounded-[18px] bg-surface p-4 shadow-card"
              onSubmit={async (e) => {
                e.preventDefault();
                setError(null);
                try {
                  const key = await create({ name: newName, copyFrom: role.key });
                  setNewName("");
                  setSelected(key);
                } catch (err) {
                  setError(errorMessage(err));
                }
              }}
            >
              <TextField id="new-role" label="New role" placeholder="e.g. Content editor" value={newName} onChange={(e) => setNewName(e.target.value)} />
              <p className="text-xs text-ink-2">Starts with the permissions of {role.name}{role.locked ? " (none, since Super Admin can't be copied)" : ""}.</p>
              <Button type="submit" variant="secondary" disabled={newName.trim().length < 2}>Create role</Button>
            </form>
          ) : null}
        </aside>
        <RoleEditor key={`${role.key}:${role.permissions.join(",")}`} role={role} modules={data.modules} canEdit={can("roles:edit")} canDelete={can("roles:delete")} onDeleted={() => setSelected("admin")} />
      </div>
    </div>
  );
}

function RoleEditor({
  role,
  modules,
  canEdit,
  canDelete,
  onDeleted,
}: {
  role: { key: string; name: string; builtIn: boolean; locked: boolean; permissions: string[]; members: number };
  modules: { module: string; actions: string[] }[];
  canEdit: boolean;
  canDelete: boolean;
  onDeleted: () => void;
}) {
  const save = useMutation(api.adminRoles.savePermissions);
  const reset = useMutation(api.adminRoles.resetToDefaults);
  const remove = useMutation(api.adminRoles.remove);
  const [perms, setPerms] = useState(new Set(role.permissions));
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const editable = canEdit && !role.locked;
  const dirty = perms.size !== role.permissions.length || role.permissions.some((p) => !perms.has(p));
  const allActions = ["view", "create", "edit", "delete", "approve", "suspend", "resetPassword"];

  const toggle = (p: string, on: boolean) => {
    setSaved(false);
    setPerms((s) => {
      const next = new Set(s);
      if (on) next.add(p);
      else next.delete(p);
      // Anything beyond View needs View.
      const [m, a] = p.split(":");
      if (on && a !== "view") next.add(`${m}:view`);
      if (!on && a === "view") for (const x of [...next]) if (x.startsWith(`${m}:`)) next.delete(x);
      return next;
    });
  };

  return (
    <section className="min-w-0 flex-1 rounded-[20px] bg-surface p-5 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-[20px] font-bold">{role.name}</h2>
          <p className="text-sm text-ink-2">
            {role.locked
              ? "Super Admin always has every permission and can't be changed or deleted."
              : role.builtIn
                ? "Built-in role. You can change its permissions or reset them to the defaults."
                : "Custom role."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {editable && role.builtIn ? (
            <Button type="button" variant="ghost" className="min-h-10 px-3 text-sm" onClick={() => reset({ key: role.key }).catch((e) => setError(errorMessage(e)))}>
              Reset to defaults
            </Button>
          ) : null}
          {canDelete && !role.builtIn ? (
            <Button
              type="button"
              variant="ghost"
              className="min-h-10 px-3 text-sm text-danger"
              onClick={async () => {
                if (!window.confirm(`Delete the ${role.name} role?`)) return;
                try {
                  await remove({ key: role.key });
                  onDeleted();
                } catch (e) {
                  setError(errorMessage(e));
                }
              }}
            >
              Delete role
            </Button>
          ) : null}
        </div>
      </div>
      {error ? <div className="mt-3"><FormAlert>{error}</FormAlert></div> : null}

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[680px] border-collapse text-sm">
          <caption className="sr-only">Permissions for {role.name}</caption>
          <thead>
            <tr>
              <th scope="col" className="border-b border-line px-3 py-2 text-left text-xs font-semibold text-ink-2">Module</th>
              {allActions.map((a) => (
                <th key={a} scope="col" className="border-b border-line px-2 py-2 text-center text-xs font-semibold text-ink-2">{ACTION_LABEL[a]}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {modules.map(({ module, actions }) => (
              <tr key={module}>
                <th scope="row" className="border-b border-line px-3 py-2 text-left font-semibold">{MODULE_LABEL[module] ?? module}</th>
                {allActions.map((a) => {
                  const p = `${module}:${a}`;
                  if (!actions.includes(a)) return <td key={a} className="border-b border-line text-center text-ink-2/40">—</td>;
                  return (
                    <td key={a} className="border-b border-line text-center">
                      <input
                        type="checkbox"
                        aria-label={`${MODULE_LABEL[module]}: ${ACTION_LABEL[a]}`}
                        className="size-5 accent-[var(--color-navy-900)]"
                        checked={perms.has(p)}
                        disabled={!editable}
                        onChange={(e) => toggle(p, e.target.checked)}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editable ? (
        <div className="mt-4 flex items-center gap-3">
          <Button
            type="button"
            variant="gold"
            disabled={!dirty}
            onClick={async () => {
              setError(null);
              try {
                await save({ key: role.key, permissions: [...perms] });
                setSaved(true);
              } catch (e) {
                setError(errorMessage(e));
              }
            }}
          >
            Save permissions
          </Button>
          {saved && !dirty ? <p role="status" className="text-sm text-success">Saved.</p> : null}
        </div>
      ) : null}
    </section>
  );
}
