"use client";

import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import {
  AdminHeader,
  Drawer,
  EmptyRow,
  FilterSelect,
  formatDateTime,
  Initials,
  ReasonDialog,
  SearchInput,
  TableCard,
  td,
  th,
  timeAgo,
} from "@/components/admin/ui";
import { useMe } from "@/components/shell/role-gate";
import { Button } from "@/components/ui/button";
import { FormAlert, TextField } from "@/components/ui/field";
import { StatusPill, VendorStatusPill } from "@/components/ui/status-pill";
import { errorMessage } from "@/lib/errors";

type Role = "client" | "vendor" | "admin";
type Status = "active" | "suspended";
type Joined = "7" | "30" | "90";

const ROLE_LABEL: Record<string, string> = { client: "Client", vendor: "Vendor", admin: "Admin" };
const ADMIN_ROLE: Record<string, string> = { super_admin: "Super Admin", admin: "Admin", moderator: "Moderator", support: "Support" };

/** A-03: manage user accounts. */
export default function AdminUsers() {
  const [search, setSearch] = useState("");
  const [role, setRole] = useState<Role | "">("");
  const [status, setStatus] = useState<Status | "">("");
  const [joined, setJoined] = useState<Joined | "">("");
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<Id<"users"> | null>(null);
  const [now] = useState(() => Date.now());

  const data = useQuery(api.adminUsers.list, {
    search: search || undefined,
    role: role || undefined,
    status: status || undefined,
    signedUpAfter: joined ? now - Number(joined) * 86_400_000 : undefined,
    page,
  });
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const resetPage = <T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    setPage(1);
  };

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <AdminHeader title="Users" description="Everyone with an account: clients, vendors and admins." />
      <div className="flex flex-wrap gap-2">
        <SearchInput value={search} onChange={resetPage(setSearch)} label="Search name or email" />
        <FilterSelect label="Role" value={role} onChange={resetPage(setRole)} options={[{ value: "client", label: "Client" }, { value: "vendor", label: "Vendor" }, { value: "admin", label: "Admin" }]} />
        <FilterSelect label="Status" value={status} onChange={resetPage(setStatus)} options={[{ value: "active", label: "Active" }, { value: "suspended", label: "Suspended" }]} />
        <FilterSelect label="Joined" value={joined} onChange={resetPage(setJoined)} options={[{ value: "7", label: "Last 7 days" }, { value: "30", label: "Last 30 days" }, { value: "90", label: "Last 90 days" }]} />
      </div>

      <TableCard caption="Users">
        <thead>
          <tr>
            <th scope="col" className={th}>Name</th>
            <th scope="col" className={th}>Role</th>
            <th scope="col" className={th}>Status</th>
            <th scope="col" className={th}>Joined</th>
            <th scope="col" className={th}>Last active</th>
            <th scope="col" className={th}><span className="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          {data === undefined ? (
            <EmptyRow colSpan={6}>Loading…</EmptyRow>
          ) : data.rows.length === 0 ? (
            <EmptyRow colSpan={6}>No users match these filters.</EmptyRow>
          ) : (
            data.rows.map((u) => (
              <tr key={u._id} className="hover:bg-[#faf7f2]">
                <td className={td}>
                  <div className="flex items-center gap-3">
                    <Initials name={u.name ?? u.email} />
                    <div className="min-w-0">
                      <p className="font-semibold">{u.name ?? "Not set up yet"}</p>
                      <p className="truncate text-xs text-ink-2">{u.email ?? "—"}</p>
                    </div>
                  </div>
                </td>
                <td className={td}>{u.role === "admin" ? (ADMIN_ROLE[u.adminRole ?? "admin"] ?? u.adminRole) : ROLE_LABEL[u.role]}</td>
                <td className={td}>
                  {u.status === "active" ? <StatusPill tone="success">Active</StatusPill> : <StatusPill tone="muted">Suspended</StatusPill>}
                </td>
                <td className={`${td} text-ink-2`}>{timeAgo(u.createdAt)}</td>
                <td className={`${td} text-ink-2`}>{u.lastSeenAt ? timeAgo(u.lastSeenAt) : "—"}</td>
                <td className={`${td} text-right`}>
                  <Button type="button" variant="secondary" className="min-h-10 px-4 text-sm" onClick={() => setOpenId(u._id)}>
                    Open<span className="sr-only"> {u.name ?? u.email}</span>
                  </Button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </TableCard>

      {data && data.total > 0 ? (
        <nav aria-label="Pagination" className="flex items-center justify-between gap-3 text-sm">
          <p className="text-ink-2">
            {(data.page - 1) * data.pageSize + 1}–{Math.min(data.page * data.pageSize, data.total)} of {data.total}
          </p>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
            <Button type="button" variant="secondary" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Next</Button>
          </div>
        </nav>
      ) : null}

      <Drawer open={openId !== null} onClose={() => setOpenId(null)} title="User">
        {openId ? <UserDetail userId={openId} onDeleted={() => setOpenId(null)} /> : null}
      </Drawer>
    </div>
  );
}

function UserDetail({ userId, onDeleted }: { userId: Id<"users">; onDeleted: () => void }) {
  const me = useMe();
  const user = useQuery(api.adminUsers.detail, { userId });
  const setSuspended = useMutation(api.adminUsers.setSuspended);
  const updateName = useMutation(api.adminUsers.updateName);
  const remove = useMutation(api.adminUsers.remove);
  const sendReset = useMutation(api.account.adminSendReset);
  const [notice, setNotice] = useState<string | null>(null);
  const [dialog, setDialog] = useState<"suspend" | "reactivate" | "delete" | null>(null);
  const [name, setName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const can = (p: string) => me.permissions.includes(p as never);

  if (user === undefined) return <p className="text-sm text-ink-2">Loading…</p>;
  if (user === null) return <p className="text-sm text-ink-2">User not found.</p>;
  const self = user._id === me._id;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <span className="flex size-14 items-center justify-center rounded-full bg-gold-300 text-lg font-bold text-navy-900">
          {(user.name ?? user.email ?? "?").slice(0, 1).toUpperCase()}
        </span>
        <div className="min-w-0">
          <h3 className="truncate text-[20px] font-bold">{user.name ?? "Not set up yet"}</h3>
          <p className="truncate text-sm text-ink-2">{user.email ?? "—"}</p>
        </div>
      </div>
      {error ? <FormAlert>{error}</FormAlert> : null}

      <dl className="grid grid-cols-2 gap-4 text-sm">
        <div><dt className="text-xs font-semibold text-ink-2">Role</dt><dd>{user.role === "admin" ? (ADMIN_ROLE[user.adminRole ?? "admin"] ?? user.adminRole) : ROLE_LABEL[user.role]}</dd></div>
        <div><dt className="text-xs font-semibold text-ink-2">Status</dt><dd>{user.status === "active" ? "Active" : "Suspended"}</dd></div>
        <div><dt className="text-xs font-semibold text-ink-2">Joined</dt><dd>{formatDateTime(user.createdAt)}</dd></div>
        <div><dt className="text-xs font-semibold text-ink-2">Last active</dt><dd>{user.lastSeenAt ? formatDateTime(user.lastSeenAt) : "—"}</dd></div>
        {user.vendor ? (
          <div className="col-span-2"><dt className="text-xs font-semibold text-ink-2">Business</dt><dd className="flex items-center gap-2">{user.vendor.companyName} <VendorStatusPill status={user.vendor.status} /></dd></div>
        ) : null}
      </dl>

      {can("users:edit") ? (
        <form
          className="flex items-end gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (name === null) return;
            setError(null);
            try {
              await updateName({ userId, name });
              setName(null);
            } catch (err) {
              setError(errorMessage(err));
            }
          }}
        >
          <TextField id="user-name" label="Display name" className="flex-1" value={name ?? user.name ?? ""} onChange={(e) => setName(e.target.value)} />
          <Button type="submit" variant="secondary" disabled={name === null || name === user.name}>Save</Button>
        </form>
      ) : null}

      {can("roles:edit") && !self && user.role !== "vendor" ? <RoleAssign userId={userId} current={user.role === "admin" ? (user.adminRole ?? null) : null} /> : null}

      <div className="flex flex-col gap-2">
        {can("users:suspend") && !self ? (
          user.status === "active" ? (
            <Button type="button" variant="secondary" onClick={() => setDialog("suspend")}>Suspend account</Button>
          ) : (
            <Button type="button" variant="navy" onClick={() => setDialog("reactivate")}>Reactivate account</Button>
          )
        ) : null}
        {can("users:resetPassword") && user.status === "active" && user.email ? (
          <Button
            type="button"
            variant="secondary"
            onClick={async () => {
              setError(null);
              setNotice(null);
              try {
                await sendReset({ userId });
                setNotice(`Reset link sent to ${user.email}. It expires in 1 hour.`);
              } catch (err) {
                setError(errorMessage(err));
              }
            }}
          >
            Send password reset link
          </Button>
        ) : null}
        {notice ? <p role="status" className="rounded-2xl bg-success-bg px-4 py-3 text-sm font-medium text-success">{notice}</p> : null}
        {can("users:delete") && !self ? (
          <Button type="button" variant="ghost" className="text-danger" onClick={() => setDialog("delete")}>Delete account</Button>
        ) : null}
        {self ? <p className="text-sm text-ink-2">This is your account. Another admin manages it.</p> : null}
      </div>

      {user.history.length > 0 ? (
        <section>
          <h4 className="text-sm font-bold">History</h4>
          <ol className="mt-2 flex flex-col gap-2 text-sm">
            {user.history.map((h, i) => (
              <li key={i} className="flex justify-between gap-3">
                <span>{h.action.replace("user.", "").replace(/_/g, " ")}</span>
                <span className="text-ink-2">{formatDateTime(h.at)}</span>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      <ReasonDialog
        open={dialog === "suspend"}
        onClose={() => setDialog(null)}
        title={`Suspend ${user.name ?? "this user"}?`}
        consequence="They're logged out everywhere and can't log in. If they own a business, it's suspended and removed from search."
        confirmLabel="Suspend account"
        onConfirm={(reason) => setSuspended({ userId, suspended: true, reason })}
      />
      <ReasonDialog
        open={dialog === "reactivate"}
        onClose={() => setDialog(null)}
        title={`Reactivate ${user.name ?? "this user"}?`}
        consequence="They can log in again. A suspended business stays suspended until you reactivate it under Vendors."
        confirmLabel="Reactivate"
        tone="navy"
        requireReason={false}
        reasonLabel="Note"
        onConfirm={(reason) => setSuspended({ userId, suspended: false, reason: reason || undefined })}
      />
      <ReasonDialog
        open={dialog === "delete"}
        onClose={() => setDialog(null)}
        title={`Delete ${user.name ?? "this account"}?`}
        consequence="Their personal details are erased and they can't log in again. Bookings and records are kept for reporting. This can't be undone."
        confirmLabel="Delete account"
        onConfirm={async (reason) => {
          await remove({ userId, reason });
          onDeleted();
        }}
      />
    </div>
  );
}

/** A-01 #2, A-10 #3: give or change admin access (needs Roles: Edit). */
function RoleAssign({ userId, current }: { userId: Id<"users">; current: string | null }) {
  const options = useQuery(api.adminRoles.options);
  const setRole = useMutation(api.adminRoles.setUserRole);
  const [value, setValue] = useState(current ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  return (
    <form
      className="flex flex-col gap-2 rounded-2xl bg-surface-2 p-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setError(null);
        setSaved(false);
        try {
          await setRole({ userId, role: value || null });
          setSaved(true);
        } catch (err) {
          setError(errorMessage(err));
        }
      }}
    >
      <label htmlFor="admin-role" className="text-xs font-semibold text-ink-2">Admin access</label>
      <div className="flex gap-2">
        <select id="admin-role" value={value} onChange={(e) => setValue(e.target.value)} className="h-11 flex-1 rounded-full border border-control bg-surface px-4 text-sm">
          <option value="">No admin access (client)</option>
          {(options ?? []).map((o) => (
            <option key={o.key} value={o.key}>{o.name}</option>
          ))}
        </select>
        <Button type="submit" variant="secondary" className="min-h-11 px-4 text-sm" disabled={value === (current ?? "")}>Save</Button>
      </div>
      {error ? <p className="text-[13px] font-medium text-danger">{error}</p> : null}
      {saved ? <p role="status" className="text-[13px] text-success">Saved. It applies on their next action.</p> : null}
    </form>
  );
}
