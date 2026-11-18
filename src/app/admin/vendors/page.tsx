"use client";

import { useMutation, useQuery } from "convex/react";
import Image from "next/image";
import { useState } from "react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import {
  AdminHeader,
  Drawer,
  EmptyRow,
  formatDateTime,
  Initials,
  ReasonDialog,
  SearchInput,
  TableCard,
  Tabs,
  td,
  th,
  timeAgo,
} from "@/components/admin/ui";
import { useMe } from "@/components/shell/role-gate";
import { Button } from "@/components/ui/button";
import { FormAlert } from "@/components/ui/field";
import { Switch } from "@/components/ui/kit";
import { VendorStatusPill } from "@/components/ui/status-pill";
import { errorMessage } from "@/lib/errors";
import { formatBytes, formatCents, formatPrice } from "@/lib/format";

type Tab = "pending" | "approved" | "rejected" | "suspended" | "draft" | "deactivated" | "all";

/** A-04: vendor approval queue and management. */
export default function AdminVendors() {
  const [tab, setTab] = useState<Tab>("pending");
  const [search, setSearch] = useState("");
  const [openId, setOpenId] = useState<Id<"vendors"> | null>(null);
  const counts = useQuery(api.adminVendors.counts);
  const rows = useQuery(api.adminVendors.list, {
    status: tab === "all" ? undefined : tab,
    search: search || undefined,
  });

  const tabs: { value: Tab; label: string; count?: number }[] = [
    { value: "pending", label: "Pending", count: counts?.pending ?? 0 },
    { value: "approved", label: "Approved", count: counts?.approved ?? 0 },
    { value: "rejected", label: "Changes requested", count: counts?.rejected ?? 0 },
    { value: "suspended", label: "Suspended", count: counts?.suspended ?? 0 },
    { value: "draft", label: "In setup", count: counts?.draft ?? 0 },
    { value: "deactivated", label: "Deactivated", count: counts?.deactivated ?? 0 },
    { value: "all", label: "All", count: counts?.all ?? 0 },
  ];

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <AdminHeader
        title="Vendor"
        accent="approvals"
        description="Review new businesses, then approve them or ask for changes. Approved vendors appear in client search straight away."
      />
      <Tabs label="Vendor status" value={tab} onChange={setTab} tabs={tabs} />
      <SearchInput value={search} onChange={setSearch} label="Search company, owner or email" />

      <TableCard caption="Vendors">
        <thead>
          <tr>
            <th scope="col" className={th}>Company</th>
            <th scope="col" className={th}>Services</th>
            <th scope="col" className={th}>Status</th>
            <th scope="col" className={th}>{tab === "pending" ? "Submitted" : "Joined"}</th>
            <th scope="col" className={th}>Documents</th>
            <th scope="col" className={th}><span className="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          {rows === undefined ? (
            <EmptyRow colSpan={6}>Loading…</EmptyRow>
          ) : rows.length === 0 ? (
            <EmptyRow colSpan={6}>
              {tab === "pending" ? "No vendors are waiting for review." : "No vendors here."}
            </EmptyRow>
          ) : (
            rows.map((r) => (
              <tr key={r._id} className="hover:bg-[#faf7f2]">
                <td className={td}>
                  <div className="flex items-center gap-3">
                    <Initials name={r.companyName} />
                    <div className="min-w-0">
                      <p className="font-semibold">
                        {r.companyName}
                        {r.verified ? <span className="ml-2 text-xs font-semibold text-gold-text">Verified</span> : null}
                        {r.featured ? <span className="ml-2 text-xs font-semibold text-info">Featured</span> : null}
                      </p>
                      <p className="truncate text-xs text-ink-2">
                        {r.ownerName} · {r.ownerEmail ?? "no email"}
                      </p>
                    </div>
                  </div>
                </td>
                <td className={`${td} text-ink-2`}>{r.categories.join(", ") || "—"}</td>
                <td className={td}><VendorStatusPill status={r.status} /></td>
                <td className={`${td} text-ink-2`}>
                  {tab === "pending" && r.submittedAt ? timeAgo(r.submittedAt) : timeAgo(r.createdAt)}
                </td>
                <td className={`${td} text-ink-2`}>{r.documentCount}</td>
                <td className={`${td} text-right`}>
                  <Button type="button" variant={r.status === "pending" ? "navy" : "secondary"} className="min-h-10 px-4 text-sm" onClick={() => setOpenId(r._id)}>
                    {r.status === "pending" ? "Review" : "Open"}
                    <span className="sr-only"> {r.companyName}</span>
                  </Button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </TableCard>

      <Drawer open={openId !== null} onClose={() => setOpenId(null)} title="Vendor">
        {openId ? <VendorReview vendorId={openId} /> : null}
      </Drawer>
    </div>
  );
}

type Change = "approve" | "reject" | "suspend" | "reactivate" | "deactivate";

const CHANGE_COPY: Record<Change, { title: string; consequence: string; confirm: string; tone: "danger" | "navy" | "gold"; needsReason: boolean; reasonLabel?: string }> = {
  approve: { title: "Approve this vendor?", consequence: "They'll appear in client search within a minute.", confirm: "Approve vendor", tone: "gold", needsReason: false, reasonLabel: "Note" },
  reject: { title: "Ask for changes?", consequence: "The vendor sees your reason on their dashboard and can fix and resubmit.", confirm: "Send back to vendor", tone: "danger", needsReason: true, reasonLabel: "What needs to change (shared with the vendor)" },
  suspend: { title: "Suspend this vendor?", consequence: "They're removed from search immediately and can't change their profile.", confirm: "Suspend vendor", tone: "danger", needsReason: true },
  reactivate: { title: "Reactivate this vendor?", consequence: "They'll appear in client search again.", confirm: "Reactivate", tone: "navy", needsReason: false, reasonLabel: "Note" },
  deactivate: { title: "Deactivate this vendor?", consequence: "The business is closed for good and removed from search. Their records are kept.", confirm: "Deactivate vendor", tone: "danger", needsReason: true },
};

function VendorReview({ vendorId }: { vendorId: Id<"vendors"> }) {
  const me = useMe();
  const vendor = useQuery(api.adminVendors.detail, { vendorId });
  const changeStatus = useMutation(api.adminVendors.changeStatus);
  const setVerified = useMutation(api.adminVendors.setVerified);
  const setFeatured = useMutation(api.adminVendors.setFeatured);
  const removeImage = useMutation(api.adminVendors.removeImage);
  const [change, setChange] = useState<Change | null>(null);
  const [removing, setRemoving] = useState<Id<"vendorImages"> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const can = (p: string) => me.permissions.includes(p as never);

  if (vendor === undefined) return <p className="text-sm text-ink-2">Loading…</p>;
  if (vendor === null) return <p className="text-sm text-ink-2">Vendor not found.</p>;

  const actions: { change: Change; label: string; variant: "gold" | "navy" | "secondary" | "danger" }[] = [];
  if (can("vendors:approve") && (vendor.status === "pending" || vendor.status === "rejected")) {
    actions.push({ change: "approve", label: "Approve", variant: "gold" });
  }
  if (can("vendors:approve") && vendor.status === "pending") actions.push({ change: "reject", label: "Ask for changes", variant: "secondary" });
  if (can("vendors:suspend") && vendor.status === "suspended") actions.push({ change: "reactivate", label: "Reactivate", variant: "navy" });
  if (can("vendors:suspend") && (vendor.status === "approved" || vendor.status === "pending")) actions.push({ change: "suspend", label: "Suspend", variant: "secondary" });
  if (can("vendors:delete") && vendor.status !== "deactivated") actions.push({ change: "deactivate", label: "Deactivate", variant: "secondary" });

  return (
    <div className="flex flex-col gap-6">
      <div className="relative h-36 overflow-hidden rounded-[20px] bg-dusk">
        {vendor.coverUrl ? <Image src={vendor.coverUrl} alt="Cover photo" fill sizes="480px" className="object-cover" /> : null}
      </div>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-[30px] leading-tight font-bold">{vendor.companyName}</h3>
          <p className="text-sm text-ink-2">
            {vendor.ownerName} · {vendor.ownerEmail ?? "no email"}
            {vendor.phone ? ` · ${vendor.phone}` : ""}
          </p>
        </div>
        <VendorStatusPill status={vendor.status} />
      </div>

      {vendor.status === "rejected" && vendor.rejectionReason ? (
        <FormAlert>Changes requested: {vendor.rejectionReason}</FormAlert>
      ) : null}
      {error ? <FormAlert>{error}</FormAlert> : null}

      {actions.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {actions.map((a) => (
            <Button key={a.change} type="button" variant={a.variant} className={a.change === "deactivate" ? "text-danger" : ""} onClick={() => setChange(a.change)}>
              {a.label}
            </Button>
          ))}
        </div>
      ) : null}

      {can("vendors:edit") && vendor.status === "approved" ? (
        <div className="flex flex-col gap-4 rounded-[20px] bg-surface-2 p-4">
          <Switch
            checked={vendor.verified}
            onChange={(value) => setVerified({ vendorId, value }).catch((e) => setError(errorMessage(e)))}
            label="Verified"
            description="Shows a Verified badge on their card and profile."
          />
          <Switch
            checked={vendor.featured}
            onChange={(value) => setFeatured({ vendorId, value }).catch((e) => setError(errorMessage(e)))}
            label="Featured"
            description="Shows a Featured badge in search."
          />
        </div>
      ) : null}

      <dl className="grid grid-cols-2 gap-4 text-sm">
        <div><dt className="text-xs font-semibold text-ink-2">Services</dt><dd>{vendor.categories.join(", ") || "None"}</dd></div>
        <div><dt className="text-xs font-semibold text-ink-2">Average price</dt><dd>{vendor.avgPriceCents ? formatCents(vendor.avgPriceCents) : "No packages"}</dd></div>
        <div className="col-span-2"><dt className="text-xs font-semibold text-ink-2">Location</dt><dd>{vendor.address ?? "Not set"}{vendor.address ? (vendor.clientsComeToMe ? " · clients come to them" : ` · within ${vendor.serviceRadiusKm} km`) : ""}</dd></div>
        <div><dt className="text-xs font-semibold text-ink-2">Submitted</dt><dd>{vendor.submittedAt ? formatDateTime(vendor.submittedAt) : "Not yet"}</dd></div>
        <div><dt className="text-xs font-semibold text-ink-2">Owner account</dt><dd>{vendor.ownerStatus === "suspended" ? "Suspended" : "Active"}</dd></div>
      </dl>

      {vendor.about ? (
        <section>
          <h4 className="text-sm font-bold">About</h4>
          <p className="mt-1 text-sm whitespace-pre-line text-ink-2">{vendor.about}</p>
        </section>
      ) : null}

      <section>
        <h4 className="text-sm font-bold">Documents</h4>
        {vendor.documents.length === 0 ? (
          <p className="mt-1 text-sm text-ink-2">None uploaded.</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-2">
            {vendor.documents.map((d) => (
              <li key={d._id}>
                <a href={d.url ?? "#"} target="_blank" rel="noreferrer" className="flex min-h-11 items-center gap-3 rounded-2xl bg-surface-2 px-4 py-2 text-sm hover:bg-line">
                  <span className="flex-1 truncate font-semibold">{d.name}</span>
                  <span className="text-xs text-ink-2">{formatBytes(d.size)} · opens in a new tab</span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h4 className="text-sm font-bold">Portfolio ({vendor.images.length})</h4>
        {vendor.images.length === 0 ? (
          <p className="mt-1 text-sm text-ink-2">No photos yet.</p>
        ) : (
          <ul className="mt-2 grid grid-cols-3 gap-2">
            {vendor.images.map((img, i) => (
              <li key={img._id} className="relative aspect-square overflow-hidden rounded-2xl bg-surface-2">
                {img.url ? <Image src={img.url} alt={`Portfolio photo ${i + 1}`} fill sizes="150px" className="object-cover" /> : null}
                {can("vendors:edit") ? (
                  <button
                    type="button"
                    onClick={() => setRemoving(img._id)}
                    className="absolute right-1 bottom-1 min-h-9 rounded-full bg-navy-900/80 px-3 text-xs font-semibold text-white"
                  >
                    Remove<span className="sr-only"> photo {i + 1}</span>
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h4 className="text-sm font-bold">Packages</h4>
        {vendor.packages.length === 0 ? (
          <p className="mt-1 text-sm text-ink-2">No packages yet.</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-1 text-sm">
            {vendor.packages.map((p) => (
              <li key={p._id} className="flex justify-between gap-3">
                <span className={p.active ? "" : "text-ink-2 line-through"}>{p.name}</span>
                <span className="font-semibold">{formatPrice(p)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {vendor.history.length > 0 ? (
        <section>
          <h4 className="text-sm font-bold">History</h4>
          <ol className="mt-2 flex flex-col gap-2 text-sm">
            {vendor.history.map((h, i) => (
              <li key={i} className="flex justify-between gap-3">
                <span>{h.action.replace("vendor.", "").replace(/_/g, " ")}</span>
                <span className="text-ink-2">{formatDateTime(h.at)}</span>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {change ? (
        <ReasonDialog
          open
          onClose={() => setChange(null)}
          title={CHANGE_COPY[change].title.replace("this vendor", vendor.companyName)}
          consequence={CHANGE_COPY[change].consequence}
          confirmLabel={CHANGE_COPY[change].confirm}
          tone={CHANGE_COPY[change].tone}
          requireReason={CHANGE_COPY[change].needsReason}
          reasonLabel={CHANGE_COPY[change].reasonLabel}
          onConfirm={(reason) => changeStatus({ vendorId, change, reason: reason || undefined })}
        />
      ) : null}
      {removing ? (
        <ReasonDialog
          open
          onClose={() => setRemoving(null)}
          title="Remove this photo?"
          consequence="It's deleted from the vendor's portfolio straight away."
          confirmLabel="Remove photo"
          onConfirm={(reason) => removeImage({ imageId: removing, reason })}
        />
      ) : null}
    </div>
  );
}
